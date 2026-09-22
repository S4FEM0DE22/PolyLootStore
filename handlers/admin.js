import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { adminConfigured, clearSessionCookie, correctPassword, isAdmin, sessionCookie } from '../lib/admin-auth.js';
import { listCustomerProfiles } from '../lib/customer-auth.js';
import { emailConfigured } from '../lib/delivery.js';
import { body, fail, json, orderView } from '../lib/http.js';
import { DEFAULT_COVER, inferCoverMode, validateCustomCoverFile } from '../lib/preview.js';
import { createAsset, deleteAsset, deleteCoverFile, deleteAssetFile, getAsset, getOrder, listAllAssets, listOrders, listSupportTickets, setAssetActive, updateAssetDetails, updateTicketStatus, uploadCoverFile, uploadAssetFile } from '../lib/store.js';
import payApi from './pay.js';
import cancelApi from './cancel.js';

const defaultAssetFiles = new Set(['blocky-characters.zip','modular-dungeon-kit.zip','blaster-kit.zip','car-kit.zip','furniture-kit.zip']);
const defaultCovers = new Set([DEFAULT_COVER]);
const allowedExts = new Set(['.zip', '.obj', '.fbx', '.glb', '.gltf', '.blend']);

const categories = new Set(['Characters','Environments','Weapons','Vehicles','Props']);
function metadata(input, size) {
  const category = String(input.category || 'Props');
  const formats = String(input.formats || 'OBJ').split(',').map(v => v.trim().toUpperCase()).filter(Boolean);
  const engines = String(input.engines || 'Unity,Unreal,Godot').split(',').map(v => v.trim()).filter(Boolean);
  const version = String(input.version || '1.0.0').trim();
  const license = String(input.license || 'Project demo').trim();
  const source_url = String(input.source_url || '').trim();
  if (source_url && (source_url.length > 500 || !/^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(source_url))) throw new Error('ลิงก์ที่มาต้องเป็น URL แบบ http หรือ https');
  if (!categories.has(category) || !formats.length || !engines.length || formats.length > 8 || engines.length > 8 || !/^[0-9]+\.[0-9]+(?:\.[0-9]+)?$/.test(version) || license.length < 3 || license.length > 120) throw new Error('ข้อมูล 3D asset ไม่ถูกต้อง');
  return { category, formats, engines, version, license, source_url: source_url || null, file_size_bytes: size };
}

function isDefaultCover(cover) {
  if (!cover || typeof cover !== 'string') return true;
  return defaultCovers.has(cover) || (cover.startsWith('/assets/covers/') && !cover.startsWith('/assets/covers/uploads/'));
}

function reply(data, status = 200, cookie) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return Response.json(data, { status, headers });
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const url = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.slice(0, -1);
  const hosts = [url.host, request.headers.get('host'), request.headers.get('x-forwarded-host')].filter(Boolean);
  const allowed = hosts.some(host => origin === `${proto}://${host}`) || origin === url.origin;
  if (!allowed) throw Object.assign(new Error('คำขอไม่ได้มาจากเว็บไซต์นี้'), { status: 403 });
}

function requireAdmin(request) {
  if (!isAdmin(request)) throw Object.assign(new Error('กรุณาเข้าสู่ระบบผู้ดูแล'), { status: 401 });
}

function validateUploadedFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('กรุณาเลือกไฟล์ 3D Asset');
  if (file.size <= 0) throw new Error('ไฟล์ 3D Asset ว่างเปล่า');
  if (file.size > 52428800) throw new Error('ไฟล์ 3D Asset มีขนาดใหญ่เกิน 50MB');
  const ext = path.extname(file.name || '').toLowerCase();
  if (!allowedExts.has(ext)) throw new Error('รองรับ ZIP, OBJ, FBX, GLB, GLTF หรือ BLEND');
  return ext;
}

function makeSlug(title, id) {
  if (typeof id === 'string' && /^[a-z0-9-]{3,80}$/.test(id.trim())) {
    return id.trim().toLowerCase();
  }
  let slug = (title || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length < 3) slug = 'asset-' + randomBytes(4).toString('hex');
  return slug.slice(0, 60);
}

async function changeOrder(request, input) {
  if (!['mark-paid', 'cancel-order', 'retry-email'].includes(input.action) || typeof input.id !== 'string' || !/^GA-[A-F0-9]{24}$/.test(input.id)) {
    throw new Error('คำสั่งไม่ถูกต้อง');
  }
  const order = await getOrder(input.id);
  if (!order) throw Object.assign(new Error('ไม่พบคำสั่งซื้อ'), { status: 404 });
  if (input.action === 'mark-paid' && order.status !== 'PENDING') throw Object.assign(new Error('รายการนี้ไม่รอชำระเงินแล้ว'), { status: 409 });
  if (input.action === 'cancel-order' && order.status !== 'PENDING') throw Object.assign(new Error('ยกเลิกได้เฉพาะรายการที่รอชำระเงิน'), { status: 409 });
  if (input.action === 'retry-email' && order.status !== 'PAID') throw Object.assign(new Error('ส่งอีเมลได้หลังชำระเงินเท่านั้น'), { status: 409 });
  const handler = input.action === 'cancel-order' ? cancelApi : payApi;
  const response = await handler.fetch(new Request(new URL(input.action === 'cancel-order' ? '/api/cancel' : '/api/pay', request.url), {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: request.headers.get('cookie') || '' }, body: JSON.stringify({ id: order.id, forceEmail: true, action: input.action })
  }));
  return reply(await response.json(), response.status);
}

export default { async fetch(request) {
  try {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      if (url.searchParams.get('view') === 'session') return json({ authenticated: isAdmin(request), configured: adminConfigured() });
      requireAdmin(request);
      if (url.searchParams.get('view') === 'export') return json({ assets: (await listAllAssets()).map(({ file, ...asset }) => asset) });
      if (url.searchParams.get('view') !== 'overview') throw Object.assign(new Error('ไม่พบข้อมูล'), { status: 404 });
      const [assets, orders, customers, tickets] = await Promise.all([listAllAssets(), listOrders(), listCustomerProfiles(), listSupportTickets()]);
      const assetMap = new Map(assets.map(asset => [asset.id, asset]));
      return json({
        assets: assets.map(({ file, ...asset }) => ({ ...asset, fileName: file, coverMode: inferCoverMode(asset.cover) })),
        orders: orders.map(order => orderView(order, (Array.isArray(order.asset_ids) && order.asset_ids.length ? order.asset_ids : [order.asset_id]).map(id => assetMap.get(id)).filter(Boolean))),
        customers: customers.map(item => ({
          username: item.username,
          email: item.email,
          name: item.name || '',
          firstName: item.firstName || '',
          lastName: item.lastName || '',
          createdAt: item.created_at
        })),
        tickets: tickets.map(row => ({ id: row.id, email: row.email, category: row.category, orderId: row.order_id, message: row.message, status: row.status, createdAt: row.created_at })),
        emailConfigured: emailConfigured()
      });
    }
    if (request.method !== 'POST') throw Object.assign(new Error('Method not allowed'), { status: 405 });
    sameOrigin(request);
    const input = await body(request);
    if (input.action === 'login') {
      if (!adminConfigured()) throw Object.assign(new Error('ยังไม่ได้ตั้งค่ารหัสผู้ดูแล'), { status: 503 });
      if (!correctPassword(input.password)) return json({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
      return reply({ authenticated: true }, 200, sessionCookie(request));
    }
    requireAdmin(request);
    if (input.action === 'set-ticket-status') {
      if (typeof input.id !== 'string' || !/^SP-[A-F0-9]{16}$/.test(input.id) || !['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(input.status)) throw new Error('ข้อมูลคำร้องไม่ถูกต้อง');
      const ticket = await updateTicketStatus(input.id, input.status);
      if (!ticket) return json({ error: 'ไม่พบคำร้อง' }, 404);
      return json({ ticket: { id: ticket.id, status: ticket.status } });
    }
    if (input.action === 'import-assets') {
      if (!Array.isArray(input.assets) || input.assets.length > 100) throw new Error('JSON ต้องมี assets ไม่เกิน 100 รายการ');
      let count = 0;
      for (const row of input.assets) {
        if (!/^[a-z0-9-]{3,80}$/.test(row?.id || '')) continue;
        const existing = await getAsset(row.id);
        if (!existing) continue;
        await updateAssetDetails(row.id, { title: String(row.title || existing.title).slice(0,140), description: String(row.description || existing.description).slice(0,1000), price: Number(row.price) || existing.price, ...metadata({ ...row, source_url: row.source_url ?? existing.source_url }, existing.file_size_bytes || 0) });
        count++;
      }
      return json({ updated: count });
    }
    if (input.action === 'logout') return reply({ authenticated: false }, 200, clearSessionCookie(request));
    if (input.action === 'set-asset-active') {
      if (typeof input.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(input.id)) throw new Error('ข้อมูลแอสเซ็ตไม่ถูกต้อง');
      const active = input.active === true || input.active === 'true';
      const asset = await setAssetActive(input.id, active);
      if (!asset) throw Object.assign(new Error('ไม่พบแอสเซ็ต'), { status: 404 });
      return json({ asset: { id: asset.id, active: asset.active } });
    }
    if (input.action === 'add-asset') {
      const title = typeof input.title === 'string' ? input.title.trim() : '';
      const subtitle = typeof input.subtitle === 'string' ? input.subtitle.trim() : '';
      const description = typeof input.description === 'string' ? input.description.trim() : '';
      const author = typeof input.author === 'string' ? input.author.trim() : '';
      const price = Number(input.price);

      if (title.length < 3 || title.length > 140 || subtitle.length < 3 || subtitle.length > 180 || description.length < 10 || description.length > 1000 || author.length < 2 || author.length > 100 || !Number.isInteger(price) || price < 1 || price > 100000) {
        return json({ error: 'กรุณากรอกข้อมูลแอสเซ็ตและราคาให้ถูกต้อง' }, 400);
      }

      const ext = validateUploadedFile(input.file);
      let slug = makeSlug(title, input.id);
      const existing = await getAsset(slug);
      if (existing) slug = `${slug}-${randomBytes(2).toString('hex')}`;

      const safeFileName = `${slug}-${Date.now()}${ext}`;
      const buffer = Buffer.from(await input.file.arrayBuffer());
      await uploadAssetFile({ filename: safeFileName, buffer, mimeType: input.file.type });

      let cover = DEFAULT_COVER;
      const coverMode = typeof input.cover_mode === 'string' && input.cover_mode.trim() ? input.cover_mode.trim() : 'default';
      let notice = null;
      let createdCoverFile = null;

      if (coverMode === 'custom') {
        try {
          const imgExt = validateCustomCoverFile(input.cover_file);
          const imgBuffer = Buffer.from(await input.cover_file.arrayBuffer());
          const coverFileName = `${slug}-${Date.now()}-custom${imgExt}`;
          const res = await uploadCoverFile({ filename: coverFileName, buffer: imgBuffer, mimeType: input.cover_file.type || 'image/jpeg' });
          cover = res.path;
          createdCoverFile = res.path;
        } catch (err) {
          await deleteAssetFile(safeFileName);
          return json({ error: err.message || 'ไม่สามารถอัปโหลดรูปภาพพรีวิวได้' }, 400);
        }
      } else if (coverMode === 'default') {
        cover = DEFAULT_COVER;
      } else {
        cover = DEFAULT_COVER;
      }

      let newAsset;
      try {
        newAsset = await createAsset({
          id: slug,
          title,
          subtitle,
          description,
          author,
          price,
          cover,
          file: safeFileName,
          active: true,
          ...metadata(input, buffer.length)
        });
      } catch (err) {
        await deleteAssetFile(safeFileName);
        if (createdCoverFile) await deleteCoverFile(createdCoverFile);
        throw err;
      }

      return json({
        asset: { id: newAsset.id, title: newAsset.title, price: newAsset.price, cover: newAsset.cover },
        notice
      });
    }
    if (input.action === 'update-asset') {
      if (typeof input.id !== 'string') return json({ error: 'ไม่พบแอสเซ็ต' }, 404);
      const existing = await getAsset(input.id);
      if (!existing) return json({ error: 'ไม่พบแอสเซ็ต' }, 404);

      const title = typeof input.title === 'string' ? input.title.trim() : '';
      const subtitle = typeof input.subtitle === 'string' ? input.subtitle.trim() : '';
      const description = typeof input.description === 'string' ? input.description.trim() : '';
      const author = typeof input.author === 'string' ? input.author.trim() : '';
      const price = Number(input.price);

      if (title.length < 3 || title.length > 140 || subtitle.length < 3 || subtitle.length > 180 || description.length < 10 || description.length > 1000 || author.length < 2 || author.length > 100 || !Number.isInteger(price) || price < 1 || price > 100000) {
        return json({ error: 'กรุณาตรวจข้อมูลแอสเซ็ตและราคา' }, 400);
      }

      const changes = { title, subtitle, description, author, price, ...metadata(input, existing.file_size_bytes || 0) };

      let newFileName = null;
      let newFileBuffer = null;
      let newFileExt = null;
      if (input.file && typeof input.file.arrayBuffer === 'function' && input.file.size > 0) {
        newFileExt = validateUploadedFile(input.file);
        newFileName = `${input.id}-${Date.now()}${newFileExt}`;
        newFileBuffer = Buffer.from(await input.file.arrayBuffer());
        await uploadAssetFile({ filename: newFileName, buffer: newFileBuffer, mimeType: input.file.type });
        changes.file = newFileName;
        changes.file_size_bytes = newFileBuffer.length;
      }

      const coverMode = typeof input.cover_mode === 'string' && input.cover_mode.trim() ? input.cover_mode.trim() : null;
      let notice = null;
      let newCoverPath = null;
      const oldCover = existing.cover;

      if (coverMode === 'default') {
        changes.cover = DEFAULT_COVER;
      } else if (coverMode === 'custom') {
        if (input.cover_file && typeof input.cover_file.arrayBuffer === 'function' && input.cover_file.size > 0) {
          const imgExt = validateCustomCoverFile(input.cover_file);
          const imgBuffer = Buffer.from(await input.cover_file.arrayBuffer());
          const coverFileName = `${input.id}-${Date.now()}-custom${imgExt}`;
          const res = await uploadCoverFile({ filename: coverFileName, buffer: imgBuffer, mimeType: input.cover_file.type || 'image/jpeg' });
          changes.cover = res.path;
          newCoverPath = res.path;
        } else {
          if (oldCover && !isDefaultCover(oldCover)) {
            changes.cover = oldCover;
          } else {
            return json({ error: 'กรุณาเลือกรูปภาพพรีวิวสำหรับโหมดอัปโหลดภาพพรีวิวเอง' }, 400);
          }
        }
      }

      let asset;
      try {
        asset = await updateAssetDetails(input.id, changes);
      } catch (err) {
        if (newFileName) await deleteAssetFile(newFileName);
        if (newCoverPath) await deleteCoverFile(newCoverPath);
        throw err;
      }

      if (newFileName && existing.file && existing.file !== newFileName && !defaultAssetFiles.has(existing.file)) {
        await deleteAssetFile(existing.file);
      }
      if (changes.cover && oldCover && oldCover !== changes.cover && !isDefaultCover(oldCover)) {
        await deleteCoverFile(oldCover);
      }

      return json({
        asset: { id: asset.id, title: asset.title, subtitle: asset.subtitle, description: asset.description, author: asset.author, price: asset.price, cover: asset.cover },
        notice
      });
    }
    if (input.action === 'delete-asset') {
      if (typeof input.id !== 'string') return json({ error: 'ไม่พบแอสเซ็ต' }, 404);
      const existing = await getAsset(input.id);
      if (!existing) return json({ error: 'ไม่พบแอสเซ็ต' }, 404);
      try {
        await deleteAsset(input.id);
      } catch (err) {
        if (err.status === 409 || (err.message && err.message.includes('violates foreign key constraint'))) {
          return json({ error: 'ไม่สามารถลบแอสเซ็ตชุดนี้ได้ เนื่องจากมีประวัติคำสั่งซื้ออ้างอิงอยู่ แนะนำให้ใช้ปุ่ม "ซ่อนแอสเซ็ต" แทน' }, 409);
        }
        throw err;
      }
      if (existing.file && !defaultAssetFiles.has(existing.file)) {
        await deleteAssetFile(existing.file);
      }
      if (existing.cover && !isDefaultCover(existing.cover)) {
        await deleteCoverFile(existing.cover);
      }
      return json({ success: true, id: input.id });
    }
    return changeOrder(request, input);
  } catch (error) { return fail(error); }
} };
