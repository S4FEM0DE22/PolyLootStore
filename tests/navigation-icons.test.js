import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { navigationIcon, applyAdminNavigationIcons } from '../public/legacy/navigation-icons.js';

test('every menu icon references an existing SVG symbol, not an emoji', async () => {
  const sprite = await readFile(new URL('../public/icons/navigation.svg', import.meta.url), 'utf8');
  for (const name of ['home', 'catalog', 'orders', 'library', 'overview', 'assets', 'customers', 'support', 'alerts', 'settings', 'store', 'logout', 'refresh']) {
    const icon = navigationIcon(name);
    assert.ok(sprite.includes(`id="${name}"`));
    assert.ok(icon.includes(`/icons/navigation.svg#${name}`));
    assert.ok(icon.includes('aria-hidden="true"'));
    assert.ok(icon.includes('focusable="false"'));
    assert.ok(icon.includes('stroke="currentColor"'));
    assert.equal(/\p{Extended_Pictographic}/u.test(icon + sprite), false);
  }
  assert.equal(navigationIcon('<script>'), '');
});

test('admin icons prepend once without replacing labels or badges', () => {
  const items = [{ view: 'orders' }, { view: 'alerts' }, { action: 'logout' }, { action: 'refresh' }, {}].map(dataset => ({
    dataset,
    content: 'Original label <span>7</span>',
    querySelector() { return this.content.includes('menu-icon'); },
    insertAdjacentHTML(position, html) { assert.equal(position, 'afterbegin'); this.content = html + this.content; },
  }));
  const root = { querySelectorAll: () => items };
  applyAdminNavigationIcons(root);
  applyAdminNavigationIcons(root);
  for (const item of items) {
    assert.equal(item.content.match(/class="menu-icon"/g).length, 1);
    assert.ok(item.content.endsWith('Original label <span>7</span>'));
  }
  assert.ok(items[4].content.includes('#store'));
});
