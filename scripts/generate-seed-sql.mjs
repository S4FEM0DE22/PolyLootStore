import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe } from './catalog-copy.mjs';

const project = process.cwd();
const catalog = path.join(project, 'fixtures', 'kenney');
const rows = JSON.parse(await readFile(path.join(catalog, 'manifest.json'), 'utf8'));

const groups = {
  Characters: ['animated-characters-retro', 'animated-characters-protagonists', 'animated-characters-survivors', 'mini-characters'],
  Vehicles: ['watercraft-kit', 'toy-car-kit', 'train-kit'],
  Props: ['pirate-kit', 'tower-defense-kit', 'prototype-kit', 'minigolf-kit', 'holiday-kit'],
};
const names = {
  'city-kit-commercial': 'City Kit: Commercial',
  'city-kit-industrial': 'City Kit: Industrial',
  'city-kit-suburban': 'City Kit: Suburban',
  'animated-characters-retro': 'Animated Characters: Retro',
  'animated-characters-protagonists': 'Animated Characters: Protagonists',
  'animated-characters-survivors': 'Animated Characters: Survivors',
  '3d-road-tiles': '3D Road Tiles',
};

const uploadFiles = await readdir(path.join(project, 'public/assets/previews/uploads')).catch(() => []);

const statements = [];
for (const [index, row] of rows.entries()) {
  const category = Object.entries(groups).find(([, slugs]) => slugs.includes(row.slug))?.[0] || 'Environments';
  const title = names[row.slug] || row.slug.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
  const subtitle = `${category} · Kenney CC0`;
  const description = describe(row, title).replace(/'/g, "''");
  const price = 89 + (index % 8) * 20;
  const coverUpload = uploadFiles.find(f => f.startsWith(row.slug + '-'));
  const cover = coverUpload ? `/assets/previews/uploads/${coverUpload}` : `/assets/previews/default-asset-preview.svg`;
  const file = `${row.slug}.zip`;
  const formats = `ARRAY[${row.formats.map(f => `'${f}'`).join(',')}]::text[]`;
  const engines = `ARRAY['Unity','Unreal','Godot']::text[]`;
  
  statements.push(
    `INSERT INTO public.assets (id, title, subtitle, description, price, author, cover, file, category, formats, engines, version, license, file_size_bytes, source_url)\n` +
    `VALUES ('${row.slug}', '${title}', '${subtitle}', '${description}', ${price}, 'Kenney', '${cover}', '${file}', '${category}', ${formats}, ${engines}, '1.0.0', 'CC0 1.0', ${row.bytes}, '${row.source_url}')\n` +
    `ON CONFLICT (id) DO UPDATE SET title=excluded.title, subtitle=excluded.subtitle, description=excluded.description, price=excluded.price, cover=excluded.cover, file=excluded.file, category=excluded.category, formats=excluded.formats, engines=excluded.engines, version=excluded.version, license=excluded.license, file_size_bytes=excluded.file_size_bytes, source_url=excluded.source_url;`
  );
}

const outPath = path.join(project, 'supabase', 'seed_all_assets.sql');
await writeFile(outPath, statements.join('\n\n') + '\n', 'utf8');
console.log(`Generated ${statements.length} SQL insert statements in supabase/seed_all_assets.sql`);
