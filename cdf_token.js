const h = $request.headers || {};
const token = h['token'] || h['Token'] || h['cdfToken'];

if (token) {
  console.log('=== cdf_token ===');
  console.log(token);
  console.log('================');
} else {
  console.log('cdf_token: 未找到 token');
  console.log('headers: ' + JSON.stringify(h));
}
$done({});
