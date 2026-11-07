/*
脚本名称：获取腾讯视频完整 Cookie（vqq_vusession / vqq_access_token）
适用平台：Quantumult X 远程重写
脚本类型：script-request-header（不需要 requires-body）

匹配建议：
  ^https:\/\/(vip|film)\.video\.qq\.com\/(rpc\/|x\/grade\/)

使用方法：
  1. 把本文件上传到仓库根目录：
     https://raw.githubusercontent.com/lanzcer/QuantumultX/refs/heads/main/tencentvideo_cookie.js
  2. 在 [rewrite_local] 中加入上面的匹配规则；
  3. 在 [mitm] 的 hostname 中加入：
     vip.video.qq.com, film.video.qq.com
  4. 手机打开腾讯视频 App -> 我的 -> 视频VIP -> 会员中心/V力值页面，
     触发 ReadTaskList / GetVipUserInfoH5 请求；
  5. 在 Quantumult X 日志中复制
     “腾讯视频 Cookie 开始/结束” 两行之间的完整 Cookie；
  6. 粘贴到呆呆面板环境变量 TXSP_COOKIE。

说明：
  - 签到脚本需要完整 Cookie，尤其是 vqq_vusession、vqq_access_token、
    vqq_openid、vqq_vuserid、vdevice_qimei36、main_login；
  - 多个账号：切换账号后重新打开会员中心，脚本会按 vuserid/openid 分别缓存；
  - 登录态没变化时只输出一行短日志，不重复通知；
  - 主动打开会员中心时，即使登录态没变也会打印一次完整 Cookie；
  - 本脚本只读取请求头，不会修改请求，$done({}) 原样放行。
*/

const PREFS_KEY = "tencentvideo_cookie_map";

// 判断登录态是否变化只看这些字段，避免统计字段变化导致重复通知
const AUTH_FIELDS = [
    "vqq_vusession", "vusession", "vqq_access_token", "vqq_refresh_token",
    "vqq_openid", "vqq_vuserid", "vqq_appid", "main_login",
    "vdevice_qimei36", "qq_nick"
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

// 读取已缓存的账号表：{ "170104213": { cookie: "...", fp: "...", ts: 1790000000000 } }
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

function shortUid(uid) {
    if (!uid) {
        return "未知";
    }
    if (uid.length > 16 && !/^\d+$/.test(uid)) {
        return uid.slice(0, 8) + "...";
    }
    return uid;
}

const headers = $request.headers || {};
const url = $request.url || "";
const rawCookie = getHeader(headers, "Cookie");
const cookie = rawCookie ? String(rawCookie).trim() : "";

if (!cookie) {
    console.log("⚠️ [腾讯视频抓包] 请求头里没有 Cookie，已跳过");
    console.log("   请求: " + url);
    $done({});
} else {
    const session = pickCookie(cookie, "vqq_vusession") || pickCookie(cookie, "vusession");
    const accessToken = pickCookie(cookie, "vqq_access_token");
    const openid = pickCookie(cookie, "vqq_openid");
    const uidRaw = pickCookie(cookie, "vqq_vuserid") || openid;
    const uid = uidRaw || "default";

    if (!session && !(accessToken && openid)) {
        console.log("⚠️ [腾讯视频抓包] Cookie 不完整（缺少 vqq_vusession/access_token），可能尚未登录");
        console.log("   请求: " + url);
        console.log("   Cookie 长度: " + cookie.length);
        $done({});
    } else {
        const accounts = readAccounts();
        const old = accounts[uid];
        const fp = authFingerprint(cookie);
        const changed = !old || old.fp !== fp;
        // 主动打开会员中心 / 任务列表时，无论登录态是否变化都打印一份最新 Cookie
        const isVipPage = /\/x\/grade\//.test(url) ||
            /\/ReadTaskList/.test(url) ||
            /\/GetVipUserInfoH5/.test(url);

        if (changed || isVipPage) {
            accounts[uid] = { cookie: cookie, fp: fp, ts: Date.now() };
            writeAccounts(accounts);

            if (changed) {
                console.log("✅ [腾讯视频抓包] " + (old ? "Cookie 已更新" : "Cookie 获取成功") +
                    "（uid=" + shortUid(uid) + "，长度=" + cookie.length + "）");
            } else {
                console.log("ℹ️ [腾讯视频抓包] 登录态未变化，以下是最新 Cookie（uid=" +
                    shortUid(uid) + "，长度=" + cookie.length + "）");
            }
            console.log("   请求: " + url);
            console.log("========== 腾讯视频 Cookie 开始（复制下面整行） ==========");
            console.log(cookie);
            console.log("========== 腾讯视频 Cookie 结束 ==========");
            console.log("👉 打开呆呆面板 -> 环境变量 TXSP_COOKIE -> 粘贴上面整行；多账号换行分隔。");

            if (changed) {
                $notify(
                    "腾讯视频抓包",
                    old ? "Cookie 已更新" : "Cookie 获取成功",
                    "uid=" + shortUid(uid) + "\n请到 Quantumult X 日志复制完整 Cookie"
                );
            }
        } else {
            console.log("ℹ️ [腾讯视频抓包] 登录态未变化（uid=" + shortUid(uid) +
                "，长度=" + cookie.length + "），已缓存 " +
                Object.keys(accounts).length + " 个账号");
        }

        $done({});
    }
}
