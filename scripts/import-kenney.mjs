import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe } from './catalog-copy.mjs';

const project = process.cwd();
const catalog = path.join(project, 'fixtures', 'kenney');
let env = '';
try { env = await readFile(path.join(project, '.env.local'), 'utf8'); } catch {}
for (const key of ['ADMIN_PASSWORD', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY']) {
  const value = env.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1];
  if (!process.env[key] && value) process.env[key] = value;
}
if (!process.env.ADMIN_PASSWORD) throw new Error('Missing Admin password');
const [{ default: admin }, { default: storefront }] = await Promise.all([
  import(pathToFileURL(path.join(project, 'handlers/admin.js'))),
  import(pathToFileURL(path.join(project, 'handlers/assets.js'))),
]);
const base = 'http://127.0.0.1:3000';
const login = await admin.fetch(new Request(base + '/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ action: 'login', password: process.env.ADMIN_PASSWORD }) }));
if (!login.ok) throw new Error('Admin login failed: ' + login.status);
const cookie = login.headers.get('set-cookie').split(';')[0];
const call = (url, options) => admin.fetch(new Request(base + url, { ...options, headers: { Cookie: cookie, Origin: base, ...options?.headers } }));
const existingResponse = await call('/api/admin?view=overview');
const existingPayload = await existingResponse.json();
if (!existingResponse.ok) throw new Error(`Admin overview ${existingResponse.status}: ${existingPayload.error}`);
const existing = new Set(existingPayload.assets.map(a => a.id));

const groups = {
  Characters: ['animated-characters-retro', 'animated-characters-protagonists', 'animated-characters-survivors', 'mini-characters'],
  Vehicles: ['watercraft-kit', 'toy-car-kit', 'train-kit'],
  Props: ['pirate-kit', 'tower-defense-kit', 'prototype-kit', 'minigolf-kit', 'holiday-kit'],
};
const names = {
  'city-kit-commercial': 'City Kit: Commercial', 'city-kit-industrial': 'City Kit: Industrial',
  'city-kit-suburban': 'City Kit: Suburban', 'animated-characters-retro': 'Animated Characters: Retro',
  'animated-characters-protagonists': 'Animated Characters: Protagonists',
  'animated-characters-survivors': 'Animated Characters: Survivors',
  '3d-road-tiles': '3D Road Tiles',
};
const rows = JSON.parse(await readFile(path.join(catalog, 'manifest.json'), 'utf8'));
let added = 0;
for (const [index, row] of rows.entries()) {
  if (existing.has(row.slug)) { console.log('EXISTS', row.slug); continue; }
  const category = Object.entries(groups).find(([, slugs]) => slugs.includes(row.slug))?.[0] || 'Environments';
  const title = names[row.slug] || row.slug.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
  const form = new FormData();
  for (const [key, value] of Object.entries({
    action: 'add-asset', id: row.slug, title,
    subtitle: `${category} · Kenney CC0`,
    description: describe(row, title),
    author: 'Kenney', price: String(89 + (index % 8) * 20), category,
    formats: row.formats.join(', '), engines: 'Unity, Unreal, Godot',
    version: '1.0.0', license: 'CC0 1.0', source_url: row.source_url,
    cover_mode: 'custom',
  })) form.set(key, value);
  form.set('file', new Blob([await readFile(path.join(catalog, row.slug + '.zip'))], { type: 'application/zip' }), row.slug + '.zip');
  form.set('cover_file', new Blob([await readFile(path.join(catalog, row.slug + '.png'))], { type: 'image/png' }), row.slug + '.png');
  const result = await call('/api/admin', { method: 'POST', body: form });
  const payload = await result.json();
  if (!result.ok) { console.log('FAILED', row.slug, result.status, payload.error); continue; }
  if (payload.asset.id !== row.slug) throw new Error('Unexpected ID for ' + row.slug);
  console.log('ADDED', row.slug, category);
  added++;
}
const overview = await call('/api/admin?view=overview');
const all = (await overview.json()).assets;
const shop = await storefront.fetch(new Request(base + '/api/assets'));
const visible = (await shop.json()).assets;
console.log(`RESULT added=${added} admin=${all.length} storefront=${visible.length}`);
for (const row of rows) {
  const item = all.find(asset => asset.id === row.slug);
  if (!item || item.source_url !== row.source_url || !item.fileName || !item.cover?.includes('/uploads/')) throw new Error('Verification failed: ' + row.slug);
  if (!visible.some(asset => asset.id === row.slug)) throw new Error('Storefront missing: ' + row.slug);
}
