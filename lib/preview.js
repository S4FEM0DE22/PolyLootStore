import path from 'node:path';
export const DEFAULT_COVER = '/assets/previews/default-asset-preview.svg';
export function inferCoverMode(cover) { return !cover || cover === DEFAULT_COVER ? 'default' : 'custom'; }
export function validateCustomCoverFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || file.size <= 0 || file.size > 5242880) throw new Error('เลือกรูปภาพ JPG, PNG หรือ WebP ขนาดไม่เกิน 5MB');
  const ext = path.extname(file.name || '').toLowerCase();
  if (!['.jpg','.jpeg','.png','.webp'].includes(ext) || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('รองรับเฉพาะ JPG, PNG หรือ WebP');
  return ext;
}
