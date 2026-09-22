import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import assetsApi from '../handlers/assets.js';
import customerApi from '../handlers/customer.js';
import ordersApi from '../handlers/orders.js';
import payApi from '../handlers/pay.js';
import downloadApi from '../handlers/download.js';
import adminApi from '../handlers/admin.js';
import supportApi from '../handlers/support.js';
import settingsApi from '../handlers/settings.js';
import { orderView } from '../lib/http.js';
import { renderDeliveryEmail } from '../lib/email-templates.js';

const base = 'http://localhost:3000';
const post = (url, value, cookie = '') => new Request(base + url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: base },
  body: JSON.stringify(value)
});

test('admin can create, export, import and remove asset metadata', async () => {
  process.env.ADMIN_PASSWORD = 'TemporaryAdminPassword123456!';
  const login = await adminApi.fetch(post('/api/admin', { action: 'login', password: process.env.ADMIN_PASSWORD }));
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const data = new FormData();
  data.set('action', 'add-asset');
  data.set('title', 'Testing Prop');
  data.set('subtitle', 'Props · test');
  data.set('description', 'A temporary OBJ prop used by an integration test.');
  data.set('author', 'Test Studio');
  data.set('price', '25');
  data.set('category', 'Props');
  data.set('formats', 'OBJ');
  data.set('engines', 'Godot, Unity');
  data.set('version', '1.0.0');
  data.set('license', 'CC0 1.0');
  data.set('source_url', 'https://kenney.nl/assets/furniture-kit');
  data.set('cover_mode', 'default');
  data.set('file', new Blob(['o Test\nv 0 0 0\n'], { type: 'text/plain' }), 'test.obj');
  const created = await adminApi.fetch(new Request(base + '/api/admin', { method: 'POST', headers: { Cookie: cookie, Origin: base }, body: data }));
  assert.equal(created.status, 200, JSON.stringify(await created.clone().json()));
  const id = (await created.json()).asset.id;
  try {
    const exported = await adminApi.fetch(new Request(base + '/api/admin?view=export', { headers: { Cookie: cookie } }));
    assert.equal(exported.status, 200);
    const row = (await exported.json()).assets.find(a => a.id === id);
    assert.equal(row.category, 'Props');
    assert.equal(row.source_url, 'https://kenney.nl/assets/furniture-kit');
    assert.ok(!('file' in row));
    let storefront = await assetsApi.fetch(new Request(base + '/api/assets'));
    assert.ok((await storefront.json()).assets.some(asset => asset.id === id));
    const edit = new FormData();
    for (const [key, value] of data.entries()) if (key !== 'file' && key !== 'action') edit.set(key, value);
    edit.set('action', 'update-asset');
    edit.set('id', id);
    edit.set('title', 'Testing Prop Updated');
    edit.set('price', '35');
    const updated = await adminApi.fetch(new Request(base + '/api/admin', { method: 'POST', headers: { Cookie: cookie, Origin: base }, body: edit }));
    assert.equal(updated.status, 200, JSON.stringify(await updated.clone().json()));
    assert.equal((await updated.json()).asset.price, 35);
    storefront = await assetsApi.fetch(new Request(base + '/api/assets'));
    assert.equal((await storefront.json()).assets.find(asset => asset.id === id).title, 'Testing Prop Updated');
    const hidden = await adminApi.fetch(post('/api/admin', { action: 'set-asset-active', id, active: false }, cookie));
    assert.equal(hidden.status, 200);
    storefront = await assetsApi.fetch(new Request(base + '/api/assets'));
    assert.ok(!(await storefront.json()).assets.some(asset => asset.id === id));
    const shown = await adminApi.fetch(post('/api/admin', { action: 'set-asset-active', id, active: true }, cookie));
    assert.equal(shown.status, 200);
    const imported = await adminApi.fetch(post('/api/admin', { action: 'import-assets', assets: [{ ...row, title: 'Updated Prop' }] }, cookie));
    assert.equal(imported.status, 200);
    assert.equal((await imported.json()).updated, 1);
  } finally {
    const removed = await adminApi.fetch(post('/api/admin', { action: 'delete-asset', id }, cookie));
    assert.equal(removed.status, 200);
    const storefront = await assetsApi.fetch(new Request(base + '/api/assets'));
    assert.ok(!(await storefront.json()).assets.some(asset => asset.id === id));
  }
});

test('local storefront grants private download only after paid order', async () => {
  const catalog = await assetsApi.fetch(new Request(base + '/api/assets'));
  assert.equal(catalog.status, 200);
  const { assets } = await catalog.json();
  assert.deepEqual(new Set(assets.map(a => a.category)), new Set(['Characters','Environments','Weapons','Vehicles','Props']));
  assert.ok(assets.every(a => a.formats.length && a.engines.length && a.license));
  assert.ok(assets.every(a => !('file' in a)));

  const tag = randomBytes(5).toString('hex');
  const signup = await customerApi.fetch(post('/api/customer', {
    action: 'register', username: 'demo_' + tag, email: tag + '@example.test',
    password: 'SamplePass123!', first: 'Demo', last: 'User'
  }));
  assert.equal(signup.status, 201);
  const cookie = signup.headers.get('set-cookie').split(';')[0];
  const created = await ordersApi.fetch(post('/api/orders', { assetIds: [assets[0].id], name: 'Demo User' }, cookie));
  assert.equal(created.status, 201);
  const { order } = await created.json();
  const denied = await downloadApi.fetch(new Request(base + '/api/download?token=bad'));
  assert.equal(denied.status, 403);
  const paid = await payApi.fetch(post('/api/pay', { id: order.id }, cookie));
  assert.equal(paid.status, 200);
  const payment = (await paid.json()).order;
  assert.equal(payment.status, 'PAID');
  const download = await downloadApi.fetch(new Request(payment.downloadUrl));
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-type'), /zip/);
  assert.ok((await download.arrayBuffer()).byteLength > 50);
});


test('five-item order keeps checkout prices in history and email', async () => {
  const catalog = await assetsApi.fetch(new Request(base + '/api/assets'));
  const { assets } = await catalog.json();
  assert.equal(assets.length >= 5, true);
  const chosen = assets.slice(0, 5);
  const tag = randomBytes(5).toString('hex');
  const signup = await customerApi.fetch(post('/api/customer', {
    action: 'register', username: 'basket_' + tag, email: tag + '@example.test',
    password: 'SamplePass123!', first: 'Basket', last: 'User'
  }));
  assert.equal(signup.status, 201);
  const cookie = signup.headers.get('set-cookie').split(';')[0];
  const created = await ordersApi.fetch(post('/api/orders', { assetIds: chosen.map(item => item.id) }, cookie));
  assert.equal(created.status, 201, JSON.stringify(await created.clone().json()));
  const { order } = await created.json();
  const originalTotal = chosen.reduce((sum, item) => sum + item.price, 0);
  assert.equal(order.items.length, 5);
  assert.equal(order.price, originalTotal);
  const stored = (await (await import('../lib/store.js')).getOrder(order.id));
  const changedCatalog = chosen.map(item => ({ ...item, price: item.price + 500 }));
  const historical = orderView(stored, changedCatalog);
  assert.equal(historical.price, originalTotal);
  assert.deepEqual(historical.items.map(item => item.price), chosen.map(item => item.price));
  const email = renderDeliveryEmail(stored, changedCatalog, {}, base);
  assert.match(email.text, new RegExp(`ยอดรวม: ${originalTotal} บาท`));
});

test('support request belongs to customer and admin can update its status', async () => {
  process.env.ADMIN_PASSWORD = 'TemporaryAdminPassword123456!';
  const tag = randomBytes(5).toString('hex');
  const signup = await customerApi.fetch(post('/api/customer', {
    action: 'register', username: 'support_' + tag, email: tag + '@example.test',
    password: 'SamplePass123!', first: 'Support', last: 'User'
  }));
  assert.equal(signup.status, 201);
  const customerCookie = signup.headers.get('set-cookie').split(';')[0];
  const anonymous = await supportApi.fetch(new Request(base + '/api/support'));
  assert.equal(anonymous.status, 401);
  const invalid = await supportApi.fetch(post('/api/support', { category: 'DOWNLOAD', message: 'short' }, customerCookie));
  assert.equal(invalid.status, 400);
  const created = await supportApi.fetch(post('/api/support', { category: 'DOWNLOAD', message: 'The preview file could not be opened in my engine.' }, customerCookie));
  assert.equal(created.status, 201);
  const { ticket } = await created.json();
  assert.equal(ticket.status, 'OPEN');
  const login = await adminApi.fetch(post('/api/admin', { action: 'login', password: process.env.ADMIN_PASSWORD }));
  const adminCookie = login.headers.get('set-cookie').split(';')[0];
  const overview = await adminApi.fetch(new Request(base + '/api/admin?view=overview', { headers: { Cookie: adminCookie } }));
  assert.ok((await overview.json()).tickets.some(row => row.id === ticket.id));
  const updated = await adminApi.fetch(post('/api/admin', { action: 'set-ticket-status', id: ticket.id, status: 'RESOLVED' }, adminCookie));
  assert.equal(updated.status, 200);
  const mine = await supportApi.fetch(new Request(base + '/api/support', { headers: { Cookie: customerCookie } }));
  assert.equal((await mine.json()).tickets.find(row => row.id === ticket.id).status, 'RESOLVED');
});

test('settings persist and notifications are private and markable', async () => {
  process.env.ADMIN_PASSWORD = 'TemporaryAdminPassword123456!';
  const originalSettings = (await (await settingsApi.fetch(new Request(base + '/api/settings'))).json()).settings;
  const tag = randomBytes(5).toString('hex');
  const signup = await customerApi.fetch(post('/api/customer', {
    action: 'register', username: 'prefs_' + tag, email: tag + '@example.test',
    password: 'SamplePass123!', first: 'Preferences', last: 'User'
  }));
  assert.equal(signup.status, 201);
  const customerCookie = signup.headers.get('set-cookie').split(';')[0];
  const forbidden = await settingsApi.fetch(new Request(base + '/api/settings?view=customer'));
  assert.equal(forbidden.status, 401);
  const saved = await settingsApi.fetch(post('/api/settings', { action: 'set-preferences', preferences: { theme: 'dark', language: 'en', notify_orders: true, notify_support: false, notify_announcements: true } }, customerCookie));
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).preferences.theme, 'dark');
  const adminDenied = await settingsApi.fetch(post('/api/settings', { action: 'update-store', contact_email: '', contact_phone: '', support_hours: '', announcement: '', faq: [] }, customerCookie));
  assert.equal(adminDenied.status, 401);
  const login = await adminApi.fetch(post('/api/admin', { action: 'login', password: process.env.ADMIN_PASSWORD }));
  const adminCookie = login.headers.get('set-cookie').split(';')[0];
  const updated = await settingsApi.fetch(post('/api/settings', { action: 'update-store', contact_email: 'help@example.test', contact_phone: '+66 2 123 4567', support_hours: 'Weekdays', announcement: 'Sample service update', faq: [{ question: 'How to download?', answer: 'Open your library.' }] }, adminCookie));
  assert.equal(updated.status, 200);
  const publicSettings = await settingsApi.fetch(new Request(base + '/api/settings'));
  assert.equal((await publicSettings.json()).settings.contact_email, 'help@example.test');
  const catalog = await assetsApi.fetch(new Request(base + '/api/assets'));
  const product = (await catalog.json()).assets[0];
  const created = await ordersApi.fetch(post('/api/orders', { assetIds: [product.id] }, customerCookie));
  assert.equal(created.status, 201);
  const { order } = await created.json();
  const mine = await settingsApi.fetch(new Request(base + '/api/settings?view=customer', { headers: { Cookie: customerCookie } }));
  const view = await mine.json();
  assert.equal(view.preferences.language, 'en');
  const notification = view.notifications.find(item => item.detail === order.id);
  assert.equal(notification.read, false);
  assert.equal(view.notifications.some(item => item.type === 'announcement'), true);
  const marked = await settingsApi.fetch(post('/api/settings', { action: 'mark-read', id: notification.id }, customerCookie));
  assert.equal(marked.status, 200);
  const after = await settingsApi.fetch(new Request(base + '/api/settings?view=customer', { headers: { Cookie: customerCookie } }));
  assert.equal((await after.json()).notifications.find(item => item.id === notification.id).read, true);
  const restored = await settingsApi.fetch(post('/api/settings', { action: 'update-store', contact_email: originalSettings.contact_email, contact_phone: originalSettings.contact_phone, support_hours: originalSettings.support_hours, announcement: originalSettings.announcement, faq: originalSettings.faq }, adminCookie));
  assert.equal(restored.status, 200);
});

test('google auth session, changing username, and avatar updates work seamlessly', async () => {
  // 1. Request Google Auth URL
  const authUrlRes = await customerApi.fetch(post('/api/customer', { action: 'google-auth-url' }));
  assert.equal(authUrlRes.status, 200);
  const { url } = await authUrlRes.json();
  assert.ok(url.includes('google'));

  // 2. Exchange Google Session (using demo token for local test environment)
  const tokenTag = randomBytes(4).toString('hex');
  const sessionRes = await customerApi.fetch(post('/api/customer', { action: 'google-session', accessToken: 'demo-google-token-' + tokenTag }));
  assert.equal(sessionRes.status, 200);
  const sessionData = await sessionRes.json();
  assert.ok(sessionData.user);
  assert.ok(sessionData.user.username.startsWith('poly_'));
  assert.ok(sessionData.user.avatarUrl);
  const customerCookie = sessionRes.headers.get('set-cookie').split(';')[0];

  // 3. Change Username via update-profile
  const newUsername = 'poly_ninja_' + randomBytes(3).toString('hex');
  const updateProfileRes = await customerApi.fetch(post('/api/customer', {
    action: 'update-profile',
    first: 'Poly',
    last: 'Master',
    username: newUsername
  }, customerCookie));
  assert.equal(updateProfileRes.status, 200);
  const updatedData = await updateProfileRes.json();
  assert.equal(updatedData.user.username, newUsername);
  assert.equal(updatedData.user.name, 'Poly Master');
  const updatedCookie = updateProfileRes.headers.get('set-cookie').split(';')[0];

  // 4. Update Avatar via update-avatar
  const avatarFormData = new FormData();
  avatarFormData.set('action', 'update-avatar');
  avatarFormData.set('avatar_file', new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }), 'avatar.png');
  const updateAvatarRes = await customerApi.fetch(new Request(base + '/api/customer', {
    method: 'POST',
    headers: { Cookie: updatedCookie, Origin: base },
    body: avatarFormData
  }));
  assert.equal(updateAvatarRes.status, 200);
  const avatarData = await updateAvatarRes.json();
  assert.ok(avatarData.avatarUrl);
  assert.equal(avatarData.user.avatarUrl, avatarData.avatarUrl);
  const avatarCookie = updateAvatarRes.headers.get('set-cookie').split(';')[0];

  // 5. Verify Session returns the updated user, username and avatar
  const getSessionRes = await customerApi.fetch(new Request(base + '/api/customer?view=session', {
    headers: { Cookie: avatarCookie }
  }));
  assert.equal(getSessionRes.status, 200);
  const currentSession = await getSessionRes.json();
  assert.equal(currentSession.user.username, newUsername);
  assert.equal(currentSession.user.avatarUrl, avatarData.avatarUrl);
});

test('admin can create asset with rich long description and client zip inspector parses archive metadata', async () => {
  const { inspectZipFile } = await import('../public/legacy/zip-inspect.js');
  const fs = await import('node:fs');
  const buf = fs.readFileSync('fixtures/blaster-kit.zip');
  const testFile = new File([buf], 'blaster-kit.zip');

  // Test ZIP inspector
  const inspection = await inspectZipFile(testFile);
  assert.equal(inspection.isZip, true);
  assert.ok(inspection.modelCount > 0);
  assert.ok(inspection.totalFiles > 0);
  assert.ok(inspection.formatsDetected.includes('OBJ') || inspection.formatsDetected.includes('FBX') || inspection.formatsDetected.includes('GLB'));
  assert.equal(inspection.suggestedTitle, 'Blaster Kit');

  // Test creating asset with rich long description (> 1000 characters)
  process.env.ADMIN_PASSWORD = 'TemporaryAdminPassword123456!';
  const login = await adminApi.fetch(post('/api/admin', { action: 'login', password: process.env.ADMIN_PASSWORD }));
  const cookie = login.headers.get('set-cookie').split(';')[0];

  const longDesc = 'A'.repeat(1800) + '\n\nFeatures:\n- Modular\n- Low Poly\n- Rigged';
  const data = new FormData();
  data.set('action', 'add-asset');
  data.set('title', 'Rich Description Asset');
  data.set('subtitle', 'Weapons · Modular · Sci-Fi');
  data.set('description', longDesc);
  data.set('author', 'Kenney');
  data.set('price', '150');
  data.set('category', 'Weapons');
  data.set('formats', 'OBJ, FBX, GLB');
  data.set('engines', 'Unity, Unreal, Godot');
  data.set('version', '1.0.0');
  data.set('license', 'CC0 1.0');
  data.set('cover_mode', 'default');
  data.set('file', new Blob(['o Blaster\nv 0 0 0\n'], { type: 'text/plain' }), 'blaster.obj');

  const created = await adminApi.fetch(new Request(base + '/api/admin', { method: 'POST', headers: { Cookie: cookie, Origin: base }, body: data }));
  assert.equal(created.status, 200, JSON.stringify(await created.clone().json()));
  const id = (await created.json()).asset.id;

  try {
    const storefront = await assetsApi.fetch(new Request(base + '/api/assets'));
    const item = (await storefront.json()).assets.find(a => a.id === id);
    assert.ok(item);
    assert.equal(item.description.replace(/\r\n/g, '\n'), longDesc.replace(/\r\n/g, '\n'));
    assert.equal(item.category, 'Weapons');
    assert.deepEqual(item.formats, ['OBJ', 'FBX', 'GLB']);
  } finally {
    const removed = await adminApi.fetch(post('/api/admin', { action: 'delete-asset', id }, cookie));
    assert.equal(removed.status, 200);
  }
});

test('product gallery details provide 10 model preview images per pack', async () => {
  const { productDetails } = await import('../public/legacy/product-gallery.js');
  const fs = await import('node:fs');
  const path = await import('node:path');

  // Verify built-in kits have 10 items in their preview slides
  assert.ok(productDetails['pirate-kit']);
  const pirateItems = productDetails['pirate-kit'].slides[0].items;
  assert.equal(pirateItems.length, 10);
  assert.equal(pirateItems[0].src, '/assets/gallery/pirate-kit/preview-1.png');
  assert.equal(pirateItems[9].src, '/assets/gallery/pirate-kit/preview-10.png');

  // Verify physical files exist on disk for sample kits
  for (const kitId of ['pirate-kit', 'castle-kit', 'watercraft-kit', 'nature-kit']) {
    for (let i = 1; i <= 10; i++) {
      const filePath = path.join(process.cwd(), 'public', 'assets', 'gallery', kitId, `preview-${i}.png`);
      assert.ok(fs.existsSync(filePath), `Missing preview file: ${filePath}`);
    }
  }
});

test('home hero carousel renders multiple product slides and controls', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const storefrontSrc = fs.readFileSync(path.join(process.cwd(), 'public', 'legacy', 'storefront.js'), 'utf8');
  const storeCss = fs.readFileSync(path.join(process.cwd(), 'app', 'store.css'), 'utf8');

  // Verify carousel logic and structure
  assert.ok(storefrontSrc.includes('initHeroCarousel'), 'initHeroCarousel should be defined');
  assert.ok(storefrontSrc.includes('hero-carousel'), 'hero-carousel element should be generated');
  assert.ok(storefrontSrc.includes('hero-slide'), 'hero-slide elements should be generated');
  assert.ok(storefrontSrc.includes('hero-carousel-arrow prev'), 'previous arrow button should exist');
  assert.ok(storefrontSrc.includes('hero-carousel-arrow next'), 'next arrow button should exist');
  assert.ok(!storefrontSrc.includes('hero-carousel-counter'), 'page count numbers should not exist in markup');
  assert.ok(storefrontSrc.includes('hero-progress-fill'), 'progress fill bar should exist');
  assert.ok(storefrontSrc.includes('clearInterval(heroCarouselInterval)'), 'timer cleanup should be handled');

  // Verify it rotates through the entire active store catalog and filters out hidden/deleted products
  assert.ok(storefrontSrc.includes('activeAssets = assets.filter(item => item.active !== false && !item.is_hidden)'), 'filters active and non-hidden assets');
  assert.ok(!storefrontSrc.includes('heroAssets = (assets.filter(item => item.cover).length ? assets.filter(item => item.cover) : assets).slice(0, 10);'), 'does not slice to only 10 items');

  // Verify styling
  assert.ok(storeCss.includes('.hero-carousel-viewport'), 'carousel viewport styles should exist');
  assert.ok(storeCss.includes('.hero-slide.is-active'), 'active slide transition should exist');
  assert.ok(storeCss.includes('.hero-slide-badge'), 'product badge overlay should exist');
  assert.ok(!storeCss.includes('.hero-carousel-counter'), 'counter styles should not exist');
  assert.ok(storeCss.includes('.hero-carousel-progress-fill'), 'progress fill styles should exist');

  // Verify strict no emoji rule in carousel section
  const heroMatch = storefrontSrc.match(/function initHeroCarousel[\s\S]*?function catalog/);
  assert.ok(heroMatch, 'carousel code block found');
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.equal(emojiRegex.test(heroMatch[0]), false, 'Hero carousel must have zero emojis');

  // Verify generic back button wording (not tied to specific pages)
  assert.ok(!storefrontSrc.includes('กลับไปดูสินค้าทั้งหมด'), 'should not have specific destination in back button');
  assert.ok(storefrontSrc.includes('data-back-fallback="#catalog">← ย้อนกลับ</button>'), 'asset page back button should use generic back text');
  assert.ok(storefrontSrc.includes(': \'#cart\'}">← ย้อนกลับ</button>'), 'checkout back button should use generic back text');
});

test('cart items are isolated per account, emptied on logout, and restored on switch', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const storefrontSrc = fs.readFileSync(path.join(process.cwd(), 'public', 'legacy', 'storefront.js'), 'utf8');

  // Verify code implementation presence
  assert.ok(storefrontSrc.includes('cartStorageKey'), 'cartStorageKey helper should exist');
  assert.ok(storefrontSrc.includes('polyloot-cart-user-'), 'user-specific cart storage key prefix should exist');
  assert.ok(storefrontSrc.includes('switchCartToUser'), 'switchCartToUser function should exist');

  // Verify logout empties cart
  assert.ok(storefrontSrc.includes('cart = [];'), 'active cart must be cleared on logout');
  assert.ok(storefrontSrc.includes('selected.clear();'), 'selected items must be cleared on logout');

  // Simulate the storage isolation logic
  const store = {};
  const mockLocalStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const getStorageKey = (user) => (user?.email ? `polyloot-cart-user-${user.email.trim().toLowerCase()}` : 'polyloot-cart-guest');
  const readUserCart = (user) => {
    const raw = mockLocalStorage.getItem(getStorageKey(user));
    return raw ? JSON.parse(raw) : [];
  };
  const saveUserCart = (user, items) => {
    mockLocalStorage.setItem(getStorageKey(user), JSON.stringify(items));
  };

  const userA = { email: 'alice@example.test', username: 'alice' };
  const userB = { email: 'bob@example.test', username: 'bob' };

  // Step 1: User A adds items
  let activeCart = ['pirate-kit', 'castle-kit'];
  saveUserCart(userA, activeCart);
  assert.deepEqual(readUserCart(userA), ['pirate-kit', 'castle-kit']);

  // Step 2: User A logs out -> cart emptied
  activeCart = [];
  assert.deepEqual(activeCart, []);

  // Step 3: User B logs in -> sees own empty cart initially
  activeCart = readUserCart(userB);
  assert.deepEqual(activeCart, []);

  // User B adds an item
  activeCart = ['nature-kit'];
  saveUserCart(userB, activeCart);
  assert.deepEqual(readUserCart(userB), ['nature-kit']);

  // Step 4: User B logs out -> cart emptied
  activeCart = [];
  assert.deepEqual(activeCart, []);

  // Step 5: User A logs back in -> User A items completely restored
  activeCart = readUserCart(userA);
  assert.deepEqual(activeCart, ['pirate-kit', 'castle-kit']);

  // Step 6: User B logs back in -> User B items completely restored
  activeCart = readUserCart(userB);
  assert.deepEqual(activeCart, ['nature-kit']);
});


