import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assets as defaultAssets } from './catalog.js';

const localFile = path.join(process.cwd(), '.data', 'orders.json');
const localAssetsFile = path.join(process.cwd(), '.data', 'asset-visibility.json');
const localAssetDetailsFile = path.join(process.cwd(), '.data', 'asset-details.json');
let localQueue = Promise.resolve();
let localAssetsQueue = Promise.resolve();

export function isLocalDemo() {
  return !process.env.VERCEL && !process.env.SUPABASE_URL && !process.env.SUPABASE_SECRET_KEY;
}

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || url.includes('YOUR_PROJECT') || key.includes('REPLACE_ME')) {
    throw Object.assign(new Error('ยังไม่ได้ตั้งค่า Supabase'), { status: 503 });
  }
  return { url: url.replace(/\/$/, ''), key };
}

async function supabase(table, method, query = '', payload) {
  const { url, key } = config();
  const headers = { apikey: key, 'Content-Type': 'application/json', Prefer: query.includes('on_conflict=') ? 'return=representation,resolution=merge-duplicates' : 'return=representation' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  const result = await fetch(`${url}/rest/v1/${table}${query}`, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: 'no-store'
  });
  if (!result.ok) throw Object.assign(new Error(`Supabase ${result.status}: ${await result.text()}`), { status: result.status === 409 ? 409 : 500 });
  return result.json();
}

async function localRead() {
  try { return JSON.parse(await readFile(localFile, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

async function localWrite(orders) {
  await mkdir(path.dirname(localFile), { recursive: true });
  await writeFile(localFile, JSON.stringify(orders, null, 2));
}

async function withLocalWrite(action) {
  const work = localQueue.then(async () => {
    const orders = await localRead();
    const result = action(orders);
    await localWrite(orders);
    return result;
  });
  localQueue = work.catch(() => {});
  return work;
}

export async function createOrder(order) {
  if (isLocalDemo()) return withLocalWrite(orders => { orders.push(order); return order; });
  return (await supabase('orders', 'POST', '', order))[0];
}

export async function getOrder(id) {
  if (isLocalDemo()) return (await localRead()).find(order => order.id === id) || null;
  const rows = await supabase('orders', 'GET', `?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] || null;
}

export async function updateOrder(id, changes, expectedStatus) {
  if (isLocalDemo()) return withLocalWrite(orders => {
    const order = orders.find(item => item.id === id);
    if (!order || (expectedStatus && order.status !== expectedStatus)) return null;
    Object.assign(order, changes);
    return order;
  });
  const statusFilter = expectedStatus ? `&status=eq.${encodeURIComponent(expectedStatus)}` : '';
  return (await supabase('orders', 'PATCH', `?id=eq.${encodeURIComponent(id)}${statusFilter}`, changes))[0] || null;
}
const localAssetsDataFile = path.join(process.cwd(), '.data', 'assets.json');
const localStoreSettingsFile = path.join(process.cwd(), '.data', 'store-settings.json');
const localCustomerPreferencesFile = path.join(process.cwd(), '.data', 'customer-preferences.json');
let settingsQueue = Promise.resolve();

export const defaultStoreSettings = Object.freeze({
  contact_email: '', contact_phone: '', support_hours: 'จันทร์–ศุกร์ 09:00–17:00',
  announcement: '', faq: [
    { question: 'ซื้อสินค้าแล้วดาวน์โหลดที่ไหน?', answer: 'หลังชำระเงินจำลองสำเร็จ เปิดเมนูคลังเพื่อดาวน์โหลดไฟล์ 3D Asset' },
    { question: 'ลิงก์ดาวน์โหลดหมดอายุทำอย่างไร?', answer: 'เปิดคำสั่งซื้อหรือคลังอีกครั้งเพื่อสร้างลิงก์ดาวน์โหลดใหม่' }
  ], updated_at: null
});
export const defaultCustomerPreferences = Object.freeze({
  theme: 'system', language: 'th', notify_orders: true, notify_support: true,
  notify_announcements: true, read_ids: []
});

async function readLocalJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
async function writeLocalJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2));
}

export async function getStoreSettings() {
  if (isLocalDemo()) return { ...defaultStoreSettings, ...(await readLocalJson(localStoreSettingsFile, {})) };
  const rows = await supabase('store_settings', 'GET', '?id=eq.main&select=*');
  return { ...defaultStoreSettings, ...(rows[0] || {}) };
}
export async function setStoreSettings(changes) {
  const current = await getStoreSettings();
  const updated = { ...current, ...changes, updated_at: new Date().toISOString() };
  if (isLocalDemo()) {
    const work = settingsQueue.then(async () => { await writeLocalJson(localStoreSettingsFile, updated); return updated; });
    settingsQueue = work.catch(() => {});
    return work;
  }
  return (await supabase('store_settings', 'POST', '?on_conflict=id', { id: 'main', ...updated }))[0];
}
export async function getCustomerPreferences(customerId) {
  if (isLocalDemo()) {
    const rows = await readLocalJson(localCustomerPreferencesFile, {});
    return { ...defaultCustomerPreferences, ...(rows[customerId] || {}) };
  }
  const rows = await supabase('customer_preferences', 'GET', `?customer_id=eq.${encodeURIComponent(customerId)}&select=*`);
  return { ...defaultCustomerPreferences, ...(rows[0] || {}) };
}
export async function setCustomerPreferences(customerId, changes) {
  if (isLocalDemo()) {
    const work = settingsQueue.then(async () => {
      const rows = await readLocalJson(localCustomerPreferencesFile, {});
      rows[customerId] = { ...defaultCustomerPreferences, ...(rows[customerId] || {}), ...changes };
      await writeLocalJson(localCustomerPreferencesFile, rows);
      return rows[customerId];
    });
    settingsQueue = work.catch(() => {});
    return work;
  }
  const current = await getCustomerPreferences(customerId);
  const headers = { id: customerId, customer_id: customerId, ...current, ...changes };
  delete headers.id;
  return (await supabase('customer_preferences', 'POST', '?on_conflict=customer_id', headers))[0];
}
const localTicketsFile = path.join(process.cwd(), '.data', 'support-tickets.json');
let ticketQueue = Promise.resolve();

async function readTickets() {
  try { return JSON.parse(await readFile(localTicketsFile, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

export async function createTicket(ticket) {
  if (!isLocalDemo()) return (await supabase('support_tickets', 'POST', '', ticket))[0];
  const work = ticketQueue.then(async () => {
    const rows = await readTickets();
    rows.push(ticket);
    await mkdir(path.dirname(localTicketsFile), { recursive: true });
    await writeFile(localTicketsFile, JSON.stringify(rows, null, 2));
    return ticket;
  });
  ticketQueue = work.catch(() => {});
  return work;
}

export async function listCustomerTickets(customerId) {
  if (isLocalDemo()) return (await readTickets()).filter(row => row.customer_id === customerId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return supabase('support_tickets', 'GET', `?customer_id=eq.${encodeURIComponent(customerId)}&select=*&order=created_at.desc&limit=100`);
}

export async function listSupportTickets() {
  if (isLocalDemo()) return (await readTickets()).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100);
  return supabase('support_tickets', 'GET', '?select=*&order=created_at.desc&limit=100');
}

export async function updateTicketStatus(id, status) {
  if (!isLocalDemo()) return (await supabase('support_tickets', 'PATCH', `?id=eq.${encodeURIComponent(id)}`, { status }))[0] || null;
  const work = ticketQueue.then(async () => {
    const rows = await readTickets();
    const row = rows.find(item => item.id === id);
    if (!row) return null;
    row.status = status;
    await writeFile(localTicketsFile, JSON.stringify(rows, null, 2));
    return row;
  });
  ticketQueue = work.catch(() => {});
  return work;
}

async function localReadAssets() {
  try {
    return JSON.parse(await readFile(localAssetsDataFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      let visibility = {};
      let details = {};
      try { visibility = JSON.parse(await readFile(localAssetsFile, 'utf8')); } catch {}
      try { details = JSON.parse(await readFile(localAssetDetailsFile, 'utf8')); } catch {}
      const initial = defaultAssets.map(asset => ({ ...asset, ...details[asset.id], active: visibility[asset.id] !== false }));
      await mkdir(path.dirname(localAssetsDataFile), { recursive: true });
      await writeFile(localAssetsDataFile, JSON.stringify(initial, null, 2));
      return initial;
    }
    throw error;
  }
}

async function localWriteAssets(list) {
  await mkdir(path.dirname(localAssetsDataFile), { recursive: true });
  await writeFile(localAssetsDataFile, JSON.stringify(list, null, 2));
}

async function withLocalAssetsWrite(action) {
  const work = localAssetsQueue.then(async () => {
    const list = await localReadAssets();
    const result = await action(list);
    await localWriteAssets(list);
    return result;
  });
  localAssetsQueue = work.catch(() => {});
  return work;
}

export async function listAssets() {
  if (isLocalDemo()) return (await listAllAssets()).filter(asset => asset.active);
  return supabase('assets', 'GET', '?select=*&active=eq.true&order=id.asc');
}

export async function getAsset(id) {
  if (isLocalDemo()) return (await listAllAssets()).find(asset => asset.id === id) || null;
  const rows = await supabase('assets', 'GET', `?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] || null;
}

export async function listAllAssets() {
  if (!isLocalDemo()) return supabase('assets', 'GET', '?select=*&order=id.asc');
  return localReadAssets();
}

export async function createAsset(asset) {
  if (isLocalDemo()) {
    return withLocalAssetsWrite(list => {
      if (list.some(b => b.id === asset.id)) {
        throw Object.assign(new Error('รหัสแอสเซ็ตหรือชื่อนี้มีอยู่แล้ว'), { status: 409 });
      }
      list.push(asset);
      return asset;
    });
  }
  const rows = await supabase('assets', 'POST', '', asset);
  return rows[0] || asset;
}

export async function updateAssetDetails(id, changes) {
  if (!isLocalDemo()) {
    const rows = await supabase('assets', 'PATCH', `?id=eq.${encodeURIComponent(id)}`, changes);
    return rows[0] || null;
  }
  return withLocalAssetsWrite(list => {
    const item = list.find(b => b.id === id);
    if (!item) return null;
    Object.assign(item, changes);
    return item;
  });
}

export async function setAssetActive(id, active) {
  if (!isLocalDemo()) {
    const rows = await supabase('assets', 'PATCH', `?id=eq.${encodeURIComponent(id)}`, { active });
    return rows[0] || null;
  }
  return withLocalAssetsWrite(list => {
    const item = list.find(b => b.id === id);
    if (!item) return null;
    item.active = active;
    return item;
  });
}

export async function deleteAsset(id) {
  if (!isLocalDemo()) {
    const rows = await supabase('assets', 'DELETE', `?id=eq.${encodeURIComponent(id)}`);
    return rows[0] || null;
  }
  return withLocalAssetsWrite(async list => {
    if ((await localRead()).some(order => (order.asset_ids || [order.asset_id]).includes(id))) throw Object.assign(new Error('มีคำสั่งซื้ออ้างอิงแอสเซ็ตนี้'), { status: 409 });
    const idx = list.findIndex(b => b.id === id);
    if (idx === -1) return null;
    const [removed] = list.splice(idx, 1);
    return removed;
  });
}

export async function uploadAssetFile({ filename, buffer, mimeType }) {
  if (isLocalDemo()) {
    const dir = path.join(process.cwd(), 'private-assets');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buffer);
    return { path: filename };
  }
  const { url, key } = config();
  const headers = { apikey: key, 'Content-Type': mimeType || 'application/octet-stream', 'x-upsert': 'true' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  let response = await fetch(`${url}/storage/v1/object/assets/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers,
    body: buffer
  });
  if (!response.ok && (response.status === 503 || response.status === 502)) {
    await new Promise(r => setTimeout(r, 300));
    response = await fetch(`${url}/storage/v1/object/assets/${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers,
      body: buffer
    });
  }
  if (!response.ok) {
    throw Object.assign(new Error(`Storage upload failed (${response.status}): ${await response.text()}`), { status: 500 });
  }
  return { path: filename };
}

export async function getAssetBuffer(filename) {
  if (isLocalDemo()) {
    try {
      return await readFile(path.join(process.cwd(), 'private-assets', filename));
    } catch {
      return null;
    }
  }
  const { url, key } = config();
  const headers = { apikey: key };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  try {
    const res = await fetch(`${url}/storage/v1/object/assets/${encodeURIComponent(filename)}`, { headers });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function uploadCoverFile({ filename, buffer, mimeType }) {
  if (isLocalDemo()) {
    const dir = path.join(process.cwd(), 'public', 'assets', 'previews', 'uploads');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buffer);
    return { path: `/assets/previews/uploads/${filename}` };
  }
  const { url, key } = config();
  const headers = { apikey: key, 'Content-Type': mimeType || 'image/png', 'x-upsert': 'true' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  let response = await fetch(`${url}/storage/v1/object/covers/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers,
    body: buffer
  });
  if (!response.ok && (response.status === 503 || response.status === 502)) {
    await new Promise(r => setTimeout(r, 300));
    response = await fetch(`${url}/storage/v1/object/covers/${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers,
      body: buffer
    });
  }
  if (!response.ok) {
    throw Object.assign(new Error(`Storage cover upload failed (${response.status}): ${await response.text()}`), { status: 500 });
  }
  return { path: `${url}/storage/v1/object/public/covers/${encodeURIComponent(filename)}` };
}

export async function deleteCoverFile(filenameOrUrl) {
  if (!filenameOrUrl || typeof filenameOrUrl !== 'string') return true;
  if (filenameOrUrl.startsWith('/assets/previews/') && !filenameOrUrl.startsWith('/assets/previews/uploads/')) {
    return true;
  }
  if (isLocalDemo()) {
    if (filenameOrUrl.startsWith('/assets/previews/uploads/')) {
      const filename = path.basename(filenameOrUrl);
      try {
        await unlink(path.join(process.cwd(), 'public', 'assets', 'previews', 'uploads', filename));
      } catch {}
    }
    return true;
  }
  const { url, key } = config();
  let filename = filenameOrUrl;
  if (filename.includes('/storage/v1/object/public/covers/')) {
    filename = filename.split('/storage/v1/object/public/covers/')[1];
  } else if (filename.includes('/storage/v1/object/covers/')) {
    filename = filename.split('/storage/v1/object/covers/')[1];
  } else {
    filename = path.basename(filenameOrUrl);
  }
  filename = decodeURIComponent(filename.split('?')[0]);
  const headers = { apikey: key };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  try {
    await fetch(`${url}/storage/v1/object/covers/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers
    });
  } catch {}
  return true;
}

export async function deleteAssetFile(filename) {
  if (isLocalDemo()) {
    try {
      await unlink(path.join(process.cwd(), 'private-assets', filename));
    } catch {}
    return true;
  }
  const { url, key } = config();
  const headers = { apikey: key };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  try {
    await fetch(`${url}/storage/v1/object/assets/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers
    });
  } catch {}
  return true;
}

export async function listOrders(limit = 100) {
  if (isLocalDemo()) return (await localRead()).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  return supabase('orders', 'GET', `?select=*&order=created_at.desc&limit=${limit}`);
}

export async function listCustomerOrders(customerId) {
  if (isLocalDemo()) return (await localRead()).filter(order => order.customer_id === customerId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return supabase('orders', 'GET', `?customer_id=eq.${encodeURIComponent(customerId)}&select=*&order=created_at.desc&limit=100`);
}

export async function getCustomerProfileById(id) {
  const rows = await supabase('customer_profiles', 'GET', `?user_id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] || null;
}

export async function getCustomerProfileByUsername(username) {
  const rows = await supabase('customer_profiles', 'GET', `?username=eq.${encodeURIComponent(username)}&select=*`);
  return rows[0] || null;
}

export async function listCustomerProfilesDb() {
  return supabase('customer_profiles', 'GET', '?select=user_id,username,email,avatar_url,created_at&order=created_at.desc&limit=100');
}

export async function setCustomerUsername(id, username) {
  const rows = await supabase('customer_profiles', 'PATCH', `?user_id=eq.${encodeURIComponent(id)}&username=is.null`, { username });
  return rows[0] || null;
}

export async function updateCustomerUsernameDb(id, username) {
  const rows = await supabase('customer_profiles', 'PATCH', `?user_id=eq.${encodeURIComponent(id)}`, { username });
  return rows[0] || null;
}

export async function updateCustomerAvatarDb(id, avatarUrl) {
  const rows = await supabase('customer_profiles', 'PATCH', `?user_id=eq.${encodeURIComponent(id)}`, { avatar_url: avatarUrl });
  return rows[0] || null;
}

export async function createCustomerProfileDb(profile) {
  const rows = await supabase('customer_profiles', 'POST', '', profile);
  return rows[0] || null;
}

export async function getOrderAssets(order) {
  const ids = Array.isArray(order.asset_ids) && order.asset_ids.length ? order.asset_ids : [order.asset_id];
  return (await Promise.all(ids.map(getAsset))).filter(Boolean);
}
