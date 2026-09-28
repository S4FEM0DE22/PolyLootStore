// Mechanical asset conversion only: preserve the supplied artwork, no crop or redesign.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require(process.env.POLYLOOT_SHARP_PATH || 'sharp');
const root = path.resolve(__dirname, '..');

async function savePng(input, output, size) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp(input).resize(size, size, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).png().toFile(output);
}
async function main() {
  const sourceDir = process.argv[2];
  const branding = path.join(root, 'apps/branding');
  await fs.mkdir(branding, { recursive: true });
  if (sourceDir) {
    await fs.copyFile(path.join(sourceDir, 'appLOGO.png'), path.join(branding, 'customer.png'));
    await fs.copyFile(path.join(sourceDir, 'appLOGO admin.png'), path.join(branding, 'admin.png'));
  }
  const customer = path.join(branding, 'customer.png');
  const admin = path.join(branding, 'admin.png');
  const icons = path.join(root, 'apps/desktop/icons');
  await savePng(admin, path.join(icons, 'admin.png'), 512);
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = await Promise.all(sizes.map(size => sharp(admin).resize(size, size, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).png().toBuffer()));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  images.forEach((image, i) => {
    const entry = 6 + i * 16;
    header[entry] = sizes[i] === 256 ? 0 : sizes[i]; header[entry + 1] = header[entry];
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });
  await fs.writeFile(path.join(icons, 'admin.ico'), Buffer.concat([header, ...images]));
  const resources = path.join(root, 'apps/android/app/src/main/res');
  for (const [density, size] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
    await savePng(customer, path.join(resources, `mipmap-${density}/ic_launcher.png`), size);
  }
  const foreground = path.join(resources, 'drawable-nodpi/ic_launcher_foreground.png');
  await fs.mkdir(path.dirname(foreground), { recursive: true });
  // 60dp artwork inside a 108dp layer, at 4x: preserve the logo under launcher masks.
  await sharp(customer).resize(240, 240, { fit: 'contain', background: '#ffffff' })
    .flatten({ background: '#ffffff' }).extend({ top: 96, bottom: 96, left: 96, right: 96, background: '#ffffff' }).png().toFile(foreground);
  console.log('Generated customer Android icons and admin Windows ICO/PNG from the original supplied PNGs.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
