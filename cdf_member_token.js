/*
脚本名称：获取中免会员 x-access-token
适用平台：Quantumult X 远程重写
脚本类型：script-request-header（不需要 requires-body）

匹配建议：
  ^https:\/\/cdfmbrapi\.cdfg\.com\.cn\/api\/user\/(signRecord|sign)

使用方法：
  1. 把本文件上传到仓库根目录，例如：
     https://raw.githubusercontent.com/lanzcer/QuantumultX/refs/heads/main/cdf_member_token.js
  2. 在 [rewrite_local] 中添加上面的匹配规则；
  3. 在 [mitm] 的 hostname 中加入 cdfmbrapi.cdfg.com.cn；
  4. 打开“中免会员”小程序 -> 我的 -> 签到页；
  5. 在 Quantumult X 日志中查看并复制 x-access-token，
     填到呆呆面板的 CDF_MEMBER_ACCOUNTS 环境变量即可。

说明：
  x-access-token 在请求头里，不在请求体里，所以用
  script-request-header；和联通那个读 body 的脚本不同。
*/

const headers = $request.headers || {};
const url = $request.url || "";
const PREFS_KEY = "cdf_member_x_access_token";

function getHeader(name) {
    const target = String(name).toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === target) {
            return headers[key];
        }
    }
    return null;
}

const raw = getHeader("x-access-token");
const token = raw ? String(raw).trim() : "";

if (token) {
    console.log("✅ [中免会员抓包] x-access-token:");
    console.log(token);
    console.log("✅ [中免会员抓包] 请求: " + url);

    let last = null;
    try {
        if (typeof $prefs !== "undefined" && $prefs.valueForKey) {
            last = $prefs.valueForKey(PREFS_KEY);
        }
    } catch (e) {}

    // 同一个 token 只通知一次，避免 signRecord 和 sign 重复弹窗
    if (token !== last) {
        try {
            if (typeof $prefs !== "undefined" && $prefs.setValueForKey) {
                $prefs.setValueForKey(token, PREFS_KEY);
            }
        } catch (e) {}
        $notify(
            "中免会员抓包",
            "Token 提取成功",
            "x-access-token 已获取\n请到 Quantumult X 日志查看"
        );
    }
} else {
    console.log("❌ [中免会员抓包] 未找到 x-access-token");
    console.log("❌ [中免会员抓包] 请求: " + url);
    console.log("❌ [中免会员抓包] headers: " + JSON.stringify(headers));
}

$done({});
