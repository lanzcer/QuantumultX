const h = $request.headers || {};
const token = h['token'] || h['Token'] || h['cdfToken'];
if (token) {
  try {
    if (typeof $persistentStore !== 'undefined' && $persistentStore.write) {
      $persistentStore.write(token, 'cdf_token');
    } else {
      $prefs.setValueForKey(token, 'cdf_token');
    }
  } catch (e) {}
  $notify('cdf中免 Token', token, '已保存到 cdf_token');
}
$done({});
