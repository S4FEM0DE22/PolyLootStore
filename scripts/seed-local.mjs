import { mkdir, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd(); const target = path.join(root,'private-assets');
await mkdir(target,{recursive:true});
for (const file of await readdir(path.join(root,'fixtures'))) if (file.endsWith('.zip')) await copyFile(path.join(root,'fixtures',file),path.join(target,file));
console.log('Demo asset packages copied to private-assets.');
