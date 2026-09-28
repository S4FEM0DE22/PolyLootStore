import test from 'node:test';
import assert from 'node:assert/strict';
import policy from '../apps/desktop/policy.cjs';
import { readFileSync } from 'node:fs';
import { getAdminNavigation } from '../public/legacy/admin-platform.js';

test('app config accepts only HTTPS origins', () => {
  assert.equal(policy.validateAppUrl('https://shop.example/'), 'https://shop.example');
  for (const url of ['', 'http://localhost:3000', 'file:///tmp/app', 'https://user:pass@shop.example', 'https://shop.example/admin', 'https://shop.example/?x=1', 'https://shop.example/#home']) {
    assert.throws(() => policy.validateAppUrl(url));
  }
});
test('desktop confines navigation to same-origin admin paths', () => {
  const origin = 'https://shop.example';
  for (const url of [`${origin}/admin`, `${origin}/admin/`, `${origin}/admin/#orders`]) assert.equal(policy.isAdminUrl(url, origin), true);
  for (const url of [`${origin}/`, `${origin}/administrator`, `${origin}/admin/../`, 'https://user:pass@shop.example/admin/', 'https://shop.example.evil/admin/', 'javascript:alert(1)', 'file:///admin']) assert.equal(policy.isAdminUrl(url, origin), false);
});
test('external URLs exclude unsafe protocols and credentials', () => {
  assert.equal(policy.isExternalUrl('https://kenney.nl/assets'), true);
  for (const url of ['javascript:alert(1)', 'file:///tmp/app.exe', 'http://example.com', 'https://user:pass@example.com']) assert.equal(policy.isExternalUrl(url), false);
});
test('desktop package never depends on or bundles the server project', () => {
  const pkg = JSON.parse(readFileSync(new URL('../apps/desktop/package.json', import.meta.url), 'utf8'));
  assert.deepEqual(pkg.dependencies, {});
  assert.deepEqual(pkg.build.files, ['main.cjs', 'policy.cjs', 'runtime-config.json', 'package.json', 'icons/admin.png']);
});
test('web admin keeps storefront links; desktop admin hides links and disables logo', () => {
  const web = getAdminNavigation('Mozilla/5.0 Chrome/144.0.0.0');
  assert.match(web.brand, /href="\/"/);
  assert.match(web.backLink, /กลับหน้าร้าน/);
  assert.match(web.loginBackLink, /กลับหน้าร้าน/);
  const desktop = getAdminNavigation('Mozilla/5.0 PolyLootAdminDesktop/1.0');
  assert.doesNotMatch(desktop.brand, /<a|href=/);
  assert.equal(desktop.backLink, '');
  assert.equal(desktop.loginBackLink, '');
  const source = readFileSync(new URL('../public/legacy/admin.js', import.meta.url), 'utf8');
  assert.match(source, /adminNavigation\.loginBackLink/);
  assert.match(source, /adminNavigation\.backLink/);
  const main = readFileSync(new URL('../apps/desktop/main.cjs', import.meta.url), 'utf8');
  assert.match(main, /setUserAgent.*PolyLootAdminDesktop\//);
});
test('desktop cannot open customer pages in the system browser either', () => {
  const origin = 'https://shop.example';
  assert.equal(policy.canOpenInBrowser(`${origin}/`, origin), false);
  assert.equal(policy.canOpenInBrowser(`${origin}/#catalog`, origin), false);
  assert.equal(policy.canOpenInBrowser(`${origin}/admin/`, origin), true);
  assert.equal(policy.canOpenInBrowser('https://kenney.nl/assets', origin), true);
});
test('app icons use supplied artwork and platform-specific resources', () => {
  const ico = readFileSync(new URL('../apps/desktop/icons/admin.ico', import.meta.url));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 7);
  for (let i = 0; i < 7; i++) {
    const offset = ico.readUInt32LE(6 + i * 16 + 12);
    assert.equal(ico.subarray(offset, offset + 8).toString('hex'), '89504e470d0a1a0a');
  }
  const pkg = JSON.parse(readFileSync(new URL('../apps/desktop/package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.build.win.icon, 'icons/admin.ico');
  assert.equal(pkg.build.nsis.installerIcon, 'icons/admin.ico');
  assert.equal(pkg.build.nsis.uninstallerIcon, 'icons/admin.ico');
  const manifest = readFileSync(new URL('../apps/android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/);
  const adaptive = readFileSync(new URL('../apps/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', import.meta.url), 'utf8');
  assert.match(adaptive, /@drawable\/ic_launcher_foreground/);
});
