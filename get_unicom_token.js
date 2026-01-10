/*
脚本名称：获取联通 AppID 和 Token
*/
const body = $request.body;

if (body) {
    const getVal = (key) => {
        const reg = new RegExp(`(^|&)${key}=([^&]*)(&|$)`);
        const r = body.match(reg);
        return r ? decodeURIComponent(r[2]) : null;
    };

    const appId = getVal("appId");
    const token = getVal("token_online");

    if (appId && token) {
        $notify("联通登录抓包", "提取成功", `AppID 已获取\nToken 已获取`);
        console.log(`✅ [联通抓包] AppID: \n${appId}`);
        console.log(`✅ [联通抓包] Token_Online: \n${token}`);
        
    } else {
        console.log("❌ [联通抓包] 未找到 appId 或 token_online");
    }
} else {
    console.log("❌ [联通抓包] 请求体为空 (请检查 requires-body=true)");
}

$done({});
