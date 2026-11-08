/*
脚本名称：获取 起点读书 完整 Cookie
适用平台：Quantumult X 远程重写
脚本类型：script-request-header（不需要 requires-body）

匹配建议：
  ^https:\/\/(h5|magev6)\.if\.qidian\.com\/argus\/api\/(v1\/user\/getlogininfo|v2\/video\/adv\/mainPage|v2\/checkin\/detail|v3\/checkin\/getcurrentweekcheckininfo)

使用方法：
  1. 把本文件上传到仓库根目录：
     https://raw.githubusercontent.com/lanzcer/QuantumultX/refs/heads/main/qidian_cookie.js
  2. 在 [rewrite_local] 中加入上面的匹配规则；
  3. 在 [mitm] 的 hostname 中加入：
     h5.if.qidian.com, magev6.if.qidian.com
  4. 手机打开起点读书 App -> 福利中心（或“我的”->福利中心），
     触发 getlogininfo / mainPage 请求；
  5. 在 Quantumult X 日志中复制
     “起点读书 Cookie 开始/结束” 两行之间的完整 Cookie；
  6. 粘贴到呆呆面板环境变量 QD_COOKIE。

说明：
  - 每日任务脚本只要求 Cookie 里有 ywkey、ywguid；qid、uuid、QDHeader
    用于自动识别 UserId 和设备标识，建议整行一起复制；
  - 多个账号：切换账号后重新打开福利中心，脚本会按 UserId 分别缓存；
  - 登录态没变化时只输出一行短日志，不重复通知；
  - 主动打开福利中心（getlogininfo）时，即使登录态没变
    也会打印一次完整 Cookie，方便随时复制；
  - 本脚本只读取请求头，不会修改请求，$done({}) 原样放行。
*/

const PREFS_KEY = "qidian_cookie_map";
// 同一页面连续请求（getlogininfo 常连发两次）时，避免完整 Cookie 重复刷屏
const ENTRY_PRINT_INTERVAL = 5 * 1000;

// 判断登录态是否变化只看这些字段，避免 cmfuToken 等短期令牌刷新导致重复通知
const AUTH_FIELDS = [
    "ywkey", "ywguid", "qid", "uuid", "QDHeader", "ywopenid"
];

// 大小写不敏感地读取请求头
function getHeader(headers, name) {
    const target = String(name).toLowerCase();
    const keys = Object.keys(headers || {});
    for (let i = 0; i < keys.length; i++) {
        if (keys[i].toLowerCase() === target) {
            return headers[keys[i]];
        }
    }
    return null;
}

// 从 Cookie 字符串中取某个字段的值
function pickCookie(cookie, name) {
    const reg = new RegExp("(?:^|;\\s*)" + name + "=([^;]*)", "i");
    const m = String(cookie).match(reg);
    return m ? m[1].trim() : "";
}

// 只把登录相关字段拼成指纹，用来判断 Cookie 是否真的换了登录态
function authFingerprint(cookie) {
    const parts = [];
    for (let i = 0; i < AUTH_FIELDS.length; i++) {
        parts.push(AUTH_FIELDS[i] + "=" + pickCookie(cookie, AUTH_FIELDS[i]));
    }
    return parts.join("&");
}

// 读取已缓存的账号表：{ "uid_480098600": { cookie: "...", fp: "...", ts: 0 } }
function readAccounts() {
    try {
        if (typeof $prefs !== "undefined" && $prefs.valueForKey) {
            const raw = $prefs.valueForKey(PREFS_KEY);
            if (raw) {
                const obj = JSON.parse(raw);
                if (obj && typeof obj === "object") {
                    return obj;
                }
            }
        }
    } catch (e) {}
    return {};
}

function writeAccounts(accounts) {
    try {
        if (typeof $prefs !== "undefined" && $prefs.setValueForKey) {
            $prefs.setValueForKey(JSON.stringify(accounts), PREFS_KEY);
        }
    } catch (e) {}
}

// 轻量 Base64 解码（兼容 URL-safe 和缺失的 = 补位），不依赖 atob
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64Decode(input) {
    let str = String(input || "")
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .replace(/[^A-Za-z0-9+/=]/g, "")
        .replace(/=+$/, "");
    let out = "";
    let buffer = 0;
    let bits = 0;
    for (let i = 0; i < str.length; i++) {
        const idx = B64_CHARS.indexOf(str.charAt(i));
        if (idx < 0) {
            continue;
        }
        buffer = (buffer << 6) | idx;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            const code = (buffer >> bits) & 0xff;
            out += "%" + (code < 16 ? "0" : "") + code.toString(16);
        }
    }
    try {
        return decodeURIComponent(out);
    } catch (e) {
        return "";
    }
}

// QDHeader 是 Base64 的 | 分隔串，第 12 段通常是 UserId
function uidFromQdHeader(value) {
    if (!value) {
        return "";
    }
    let raw = String(value);
    try {
        raw = decodeURIComponent(raw);
    } catch (e) {}
    const text = base64Decode(raw);
    if (!text) {
        return "";
    }
    const parts = text.split("|");
    if (parts.length > 11 && /^\d{4,12}$/.test(parts[11])) {
        return parts[11];
    }
    for (let i = 0; i < parts.length; i++) {
        if (/^\d{4,12}$/.test(parts[i])) {
            return parts[i];
        }
    }
    return "";
}

// 精简 Cookie：只保留 qidian_daily.py 真正会用到的字段
function buildMinimalCookie(cookie) {
    const names = ["ywkey", "ywguid", "qid", "uuid", "QDHeader"];
    const parts = [];
    for (let i = 0; i < names.length; i++) {
        const value = pickCookie(cookie, names[i]);
        if (value) {
            parts.push(names[i] + "=" + value);
        }
    }
    return parts.join("; ");
}

const headers = $request.headers || {};
const url = $request.url || "";
const rawCookie = getHeader(headers, "Cookie");
const cookie = rawCookie ? String(rawCookie).trim() : "";

if (!cookie) {
    console.log("⚠️ [起点读书抓包] 请求头里没有 Cookie，已跳过");
    console.log("   请求: " + url);
    $done({});
} else {
    const ywkey = pickCookie(cookie, "ywkey");
    const ywguid = pickCookie(cookie, "ywguid");

    if (!ywkey || !ywguid) {
        console.log("⚠️ [起点读书抓包] Cookie 不完整（缺少 ywkey 或 ywguid），可能尚未登录");
        console.log("   请求: " + url);
        console.log("   Cookie 长度: " + cookie.length);
        $done({});
    } else {
        const userId = uidFromQdHeader(pickCookie(cookie, "QDHeader"));
        // ywguid 是设备号，同设备切号时会重复；优先用 UserId 区分账号
        const accountKey = userId ? "uid_" + userId : "key_" + ywkey;
        const accounts = readAccounts();
        const old = accounts[accountKey];
        const fp = authFingerprint(cookie);
        const changed = !old || old.fp !== fp;
        // 只把 getlogininfo 当作“主动打开页面”的信号；mainPage 在广告流程里会反复请求
        const isEntryPage = /\/argus\/api\/v[0-9]+\/user\/getlogininfo(?:[\/?#]|$)/.test(url);
        const now = Date.now();
        const canForcePrint = isEntryPage && (!old || now - (old.lastPrint || 0) > ENTRY_PRINT_INTERVAL);
        const accountLabel = userId ? ("UserId=" + userId) : ("ywguid=" + ywguid);

        if (changed || canForcePrint) {
            accounts[accountKey] = {
                cookie: cookie, fp: fp, uid: userId, ts: now, lastPrint: now
            };
            writeAccounts(accounts);

            if (changed) {
                console.log("✅ [起点读书抓包] " + (old ? "Cookie 已更新" : "Cookie 获取成功") +
                    "（" + accountLabel + "，长度=" + cookie.length + "）");
            } else {
                console.log("ℹ️ [起点读书抓包] 登录态未变化，以下是最新 Cookie（" +
                    accountLabel + "，长度=" + cookie.length + "）");
            }
            console.log("   请求: " + url);
            console.log("========== 起点读书 Cookie 开始（复制下面整行） ==========");
            console.log(cookie);
            console.log("========== 起点读书 Cookie 结束 ==========");
            console.log("👉 打开呆呆面板 -> 环境变量 QD_COOKIE -> 粘贴上面整行；多账号换行分隔。");
            console.log("👉 精简 Cookie（可选，仅关键字段）：" + buildMinimalCookie(cookie));

            if (changed) {
                $notify(
                    "起点读书抓包",
                    old ? "Cookie 已更新" : "Cookie 获取成功",
                    accountLabel + "\n请到 Quantumult X 日志复制完整 Cookie"
                );
            }
        } else {
            console.log("ℹ️ [起点读书抓包] 登录态未变化（" + accountLabel + "，长度=" + cookie.length +
                "），已缓存 " + Object.keys(accounts).length + " 个账号");
        }

        $done({});
    }
}
