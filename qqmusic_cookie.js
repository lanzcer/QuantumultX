/*
脚本名称：获取 QQ音乐 完整 Cookie
适用平台：Quantumult X 远程重写
脚本类型：script-request-header（不需要 requires-body）

匹配建议：
  ^https:\/\/(u6|i2|y)\.y\.qq\.com\/(cgi-bin\/musics\.fcg|n3\/cm\/pages\/vip\/)

使用方法：
  1. 把本文件上传到仓库根目录：
     https://raw.githubusercontent.com/lanzcer/QuantumultX/refs/heads/main/qqmusic_cookie.js
  2. 在 [rewrite_local] 中加入上面的匹配规则；
  3. 在 [mitm] 的 hostname 中加入：
     u6.y.qq.com, i2.y.qq.com, y.qq.com
  4. 手机打开 QQ音乐 -> 我的 -> 会员中心/成长值页面，触发抓取；
  5. 在 Quantumult X 日志中复制
     “QQ音乐 Cookie 开始/结束” 两行之间的完整 Cookie；
  6. 粘贴到呆呆面板环境变量 QQMUSIC_COOKIE。

说明：
  - 签到脚本必须使用“完整 Cookie”，只保留 qqmusic_key + uin
    请求接口会返回 code=1000（登录态无效）；
  - 多个账号：切换账号后重新打开会员中心，脚本会按 uin 分别缓存；
  - 登录态没变化时只输出一行短日志，不重复通知；
  - 主动打开会员中心页面时，即使登录态没变也会打印一次完整 Cookie，
    方便随时复制；普通接口请求只在登录态变化时打印；
  - 本脚本只读取请求头，不会修改请求，$done({}) 原样放行。
*/

const PREFS_KEY = "qqmusic_cookie_map";

// 判断登录态是否变化只看这些字段，避免 ts_last 等统计字段变化导致重复通知
const AUTH_FIELDS = [
    "qqmusic_key", "qm_keyst", "uin", "uid", "skey", "p_lskey",
    "psrf_qqaccess_token", "psrf_qqopenid", "refresh_key",
    "wxrefresh_token", "wxuin", "login_type", "tmeLoginType", "euin"
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

// 读取已缓存的账号表：{ "634720220": { cookie: "...", ts: 1790000000000 } }
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

const headers = $request.headers || {};
const url = $request.url || "";
const rawCookie = getHeader(headers, "Cookie");
const cookie = rawCookie ? String(rawCookie).trim() : "";

if (!cookie) {
    console.log("⚠️ [QQ音乐抓包] 请求头里没有 Cookie，已跳过");
    console.log("   请求: " + url);
    $done({});
} else {
    const loginKey = pickCookie(cookie, "qqmusic_key") || pickCookie(cookie, "qm_keyst");
    const uinRaw = pickCookie(cookie, "uin");
    // uin 常见形式为 o0634720220，转成 634720220 方便和签到脚本日志对应
    const uin = uinRaw.replace(/^o/i, "").replace(/^0+/, "") || uinRaw;

    if (!loginKey || !uinRaw) {
        console.log("⚠️ [QQ音乐抓包] Cookie 不完整（缺少 qqmusic_key/qm_keyst 或 uin），可能尚未登录");
        console.log("   请求: " + url);
        console.log("   Cookie 长度: " + cookie.length);
        $done({});
    } else {
        const accounts = readAccounts();
        const old = accounts[uin];
        const fp = authFingerprint(cookie);
        const changed = !old || old.fp !== fp;
        // 主动打开会员中心页面时，无论登录态是否变化都打印一份最新 Cookie
        const isVipPage = /\/n3\/cm\/pages\/vip\//.test(url);

        if (changed || isVipPage) {
            accounts[uin] = { cookie: cookie, fp: fp, ts: Date.now() };
            writeAccounts(accounts);

            if (changed) {
                console.log("✅ [QQ音乐抓包] " + (old ? "Cookie 已更新" : "Cookie 获取成功") +
                    "（uin=" + uin + "，长度=" + cookie.length + "）");
            } else {
                console.log("ℹ️ [QQ音乐抓包] 登录态未变化，以下是最新 Cookie（uin=" + uin +
                    "，长度=" + cookie.length + "）");
            }
            console.log("   请求: " + url);
            console.log("========== QQ音乐 Cookie 开始（复制下面整行） ==========");
            console.log(cookie);
            console.log("========== QQ音乐 Cookie 结束 ==========");
            console.log("👉 打开呆呆面板 -> 环境变量 QQMUSIC_COOKIE -> 粘贴上面整行；多账号换行分隔。");

            if (changed) {
                $notify(
                    "QQ音乐抓包",
                    old ? "Cookie 已更新" : "Cookie 获取成功",
                    "uin=" + uin + "\n请到 Quantumult X 日志复制完整 Cookie"
                );
            }
        } else {
            console.log("ℹ️ [QQ音乐抓包] 登录态未变化（uin=" + uin + "，长度=" + cookie.length +
                "），已缓存 " + Object.keys(accounts).length + " 个账号");
        }

        $done({});
    }
}
