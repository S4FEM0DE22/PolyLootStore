export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function body(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 52428800) throw new Error('ไฟล์มีขนาดใหญ่เกิน 50MB');
    const formData = await request.formData();
    const data = {};
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }
    return data;
  }
  if (contentType.includes('application/json')) {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 1048576) throw new Error('ข้อมูลยาวเกินไป');
    return request.json();
  }
  throw new Error('ส่งข้อมูลไม่ถูกต้อง');
}

export function fail(error) {
  const status = error.status || 400;
  if (status >= 500) console.error(error);
  return json({ error: status >= 500 ? 'ระบบขัดข้อง กรุณาลองใหม่' : error.message }, status);
}

export function method(request, expected) {
  if (request.method !== expected) throw Object.assign(new Error('Method not allowed'), { status: 405 });
}

export function validateEmail(email) {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function cleanEmail(email) {
  return email.trim().toLowerCase();
}

export function orderView(order, assets, extra = {}) {
  const source = Array.isArray(order.items_snapshot) && order.items_snapshot.length ? order.items_snapshot : assets;
  const items = (Array.isArray(source) ? source : [source]).filter(Boolean).map(asset => ({
    id: asset.id,
    title: asset.title,
    subtitle: asset.subtitle,
    description: asset.description,
    cover: asset.cover,
    price: asset.price,
    category: asset.category,
    formats: asset.formats,
    engines: asset.engines,
    version: asset.version,
    license: asset.license
  }));
  return {
    id: order.id,
    assetId: items[0]?.id,
    title: items[0]?.title,
    price: Number.isInteger(order.total_amount) ? order.total_amount : items.reduce((sum, item) => sum + item.price, 0),
    items,
    customerName: order.customer_name,
    email: order.email,
    status: order.status,
    emailStatus: order.email_status,
    createdAt: order.created_at,
    ...extra
  };
}
