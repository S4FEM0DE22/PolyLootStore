import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import policy from '../apps/desktop/policy.cjs';
import signing from '../apps/desktop/signing-policy.cjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  signing.releaseSigning(process.env); // Fail BEFORE producing any unsigned artifact.
  if (process.argv.includes('--check')) { console.log('Signing configuration present; certificate trust is only confirmed after signing.'); }
  else {
    if (process.platform !== 'win32') throw new Error('Windows release requires Windows for Authenticode verification.');
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major < 22 || (major === 22 && minor < 12)) throw new Error('Desktop build requires Node 22.12+.');
    const origin = policy.validateAppUrl(process.env.POLYLOOT_APP_URL || JSON.parse(readFileSync(resolve(root, 'apps/config.json'), 'utf8')).appUrl);
    writeFileSync(resolve(root, 'apps/desktop/runtime-config.json'), JSON.stringify({ appUrl: origin }, null, 2) + '\n');
    const requireDesktop = createRequire(resolve(root, 'apps/desktop/package.json'));
    const cli = requireDesktop.resolve('electron-builder/cli.js');
    const build = spawnSync(process.execPath, [cli, '--win', 'nsis', '--x64', '--publish', 'never', '--config', 'electron-builder.release.cjs'], { cwd: resolve(root, 'apps/desktop'), stdio: 'inherit', env: process.env });
    if (build.error) throw build.error;
    if (build.status !== 0) throw new Error('Signed Windows build failed; nothing exported as a release.');
    const version = JSON.parse(readFileSync(resolve(root, 'apps/desktop/package.json'), 'utf8')).version;
    const name = `PolyLoot-Admin-${version}-Setup.exe`;
    const installer = resolve(root, 'apps/desktop/dist-signed', name);
    const executable = resolve(root, 'apps/desktop/dist-signed/win-unpacked/PolyLoot Admin.exe');
    // Paths are literal arguments, never interpolated into a PowerShell command.
    const verify = spawnSync('powershell.exe', ['-NoProfile', '-File', resolve(root, 'scripts/verify-windows-signature.ps1'), installer], { env: process.env, stdio: 'inherit' });
    if (verify.error) throw verify.error;
    if (verify.status !== 0) throw new Error('Installer signature failed verification.');
    const verifyExe = spawnSync('powershell.exe', ['-NoProfile', '-File', resolve(root, 'scripts/verify-windows-signature.ps1'), executable], { env: process.env, stdio: 'inherit' });
    if (verifyExe.error) throw verifyExe.error;
    if (verifyExe.status !== 0) throw new Error('Application signature failed verification.');
    const output = resolve(root, '.data/releases'); mkdirSync(output, { recursive: true });
    const artifact = resolve(output, name); copyFileSync(installer, artifact);
    const checksum = createHash('sha256').update(readFileSync(artifact)).digest('hex');
    writeFileSync(artifact + '.sha256', `${checksum}  ${name}\n`);
    console.log(`Verified signed installer: ${artifact}\nSHA256: ${checksum}`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
