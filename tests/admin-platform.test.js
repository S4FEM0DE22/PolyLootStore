import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getAdminNavigation } from '../public/legacy/admin-platform.js';

test('browser admin offers storefront navigation before and after login', () => {
  const navigation = getAdminNavigation('Mozilla/5.0 Chrome/144.0.0.0');
  assert.match(navigation.brand, /<a[^>]+href="\/"/);
  assert.match(navigation.loginBackLink, /href="\/".*กลับหน้าร้าน/);
  assert.match(navigation.backLink, /href="\/".*กลับหน้าร้าน/);
});

test('desktop admin hides storefront navigation and uses a non-clickable logo', () => {
  const navigation = getAdminNavigation('Mozilla/5.0 PolyLootAdminDesktop/1.0');
  assert.match(navigation.brand, /^<span/);
  assert.doesNotMatch(navigation.brand, /href=|<a\b/);
  assert.equal(navigation.loginBackLink, '');
  assert.equal(navigation.backLink, '');
});

test('both admin rendering paths use platform-aware navigation', () => {
  const source = readFileSync(new URL('../public/legacy/admin.js', import.meta.url), 'utf8');
  assert.match(source, /getAdminNavigation\(navigator\.userAgent\)/);
  assert.match(source, /adminNavigation\.loginBackLink/);
  assert.match(source, /adminNavigation\.backLink/);
  assert.equal((source.match(/adminNavigation\.brand/g) || []).length, 2);
});

test('admin logo supports both themes without an unconditional CSS override', () => {
  for (const userAgent of ['', 'PolyLootAdminDesktop/1.0']) {
    const { brand } = getAdminNavigation(userAgent);
    assert.match(brand, /class="theme-logo-light" src="\/assets\/brand\/polyloot\.png"/);
    assert.match(brand, /class="theme-logo-dark" src="\/assets\/brand\/polyloot-dark\.png"/);
  }
  const css = readFileSync(new URL('../app/admin/admin.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /theme-logo-(?:light|dark)[^{]*\{[^}]*display\s*:/);
  const dark = readFileSync(new URL('../app/dark.css', import.meta.url), 'utf8');
  assert.match(dark, /html\[data-theme='dark'\] \.theme-logo-light\s*\{\s*display:\s*none/);
  assert.match(dark, /html\[data-theme='dark'\] \.theme-logo-dark\s*\{\s*display:\s*block/);
});
