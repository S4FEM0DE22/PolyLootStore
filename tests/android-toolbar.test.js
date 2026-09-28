import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('customer Android app has no reload or open-browser toolbar', () => {
  const source = readFileSync(new URL('../apps/android/app/src/main/java/com/polyloot/customer/MainActivity.java', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /import android\.widget\.Button|new Button\(|root\.addView\(toolbar\)|เปิดในเบราว์เซอร์/);
  assert.match(source, /root\.addView\(web, new LinearLayout\.LayoutParams\(-1, 0, 1\)\)/);
  // Removing the toolbar must not break downloads or connection-error recovery.
  assert.match(source, /web\.setDownloadListener/);
  assert.match(source, /setPositiveButton\("ลองใหม่", \(dialog, which\) -> web\.reload\(\)\)/);
  assert.match(source, /web\.loadUrl\(BuildConfig\.SITE_URL \+ "\/"\)/);
});
