import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import policy from '../apps/desktop/policy.cjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const action = process.argv[2];
try {
  if (action?.startsWith('desktop-')) {
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major < 22 || (major === 22 && minor < 12)) throw new Error('Desktop tooling requires Node.js 22.12+; upgrade Node before installing/building.');
  }
  if (action === 'desktop-install') {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(npm, ['ci'], {
      cwd: resolve(root, 'apps/desktop'), stdio: 'inherit', shell: process.platform === 'win32',
    });
    if (result.error) throw result.error;
    process.exit(result.status ?? 1);
  }
  const config = JSON.parse(readFileSync(resolve(root, 'apps/config.json'), 'utf8'));
  const origin = policy.validateAppUrl(process.env.POLYLOOT_APP_URL || config.appUrl);
  if (action === 'check') {
    console.log(`Customer APK: ${origin}/\nAdmin EXE: ${origin}/admin/\nOnline clients; no server secrets are bundled.`);
  } else if (action === 'desktop-dev' || action === 'desktop-build') {
    // Generated public config never contains .env credentials.
    writeFileSync(resolve(root, 'apps/desktop/runtime-config.json'), JSON.stringify({ appUrl: origin }, null, 2) + '\n');
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(npm, ['run', action === 'desktop-dev' ? 'start' : 'dist'], {
      cwd: resolve(root, 'apps/desktop'), stdio: 'inherit', shell: process.platform === 'win32',
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } else if (action === 'android-debug' || action === 'android-release') {
    if (action === 'android-release') {
      for (const key of ['POLYLOOT_KEYSTORE', 'POLYLOOT_STORE_PASSWORD', 'POLYLOOT_KEY_ALIAS', 'POLYLOOT_KEY_PASSWORD']) {
        if (!process.env[key]) throw new Error(`Release signing requires ${key}. See apps/README.md.`);
      }
    }
    const cwd = resolve(root, 'apps/android');
    const command = process.platform === 'win32' ? resolve(cwd, 'gradlew.bat') : resolve(cwd, 'gradlew');
    if (!existsSync(command)) throw new Error('Gradle wrapper missing. See apps/README.md to initialize it.');
    const buildEnv = { ...process.env, POLYLOOT_APP_URL: origin };
    if (!buildEnv.ANDROID_HOME && !buildEnv.ANDROID_SDK_ROOT && process.platform === 'win32' && process.env.LOCALAPPDATA) {
      const sdk = resolve(process.env.LOCALAPPDATA, 'Android/Sdk');
      if (existsSync(sdk)) buildEnv.ANDROID_HOME = sdk;
    }
    const result = spawnSync(command, [action === 'android-debug' ? 'assembleDebug' : 'assembleRelease', '--no-daemon'], {
      cwd, stdio: 'inherit', env: buildEnv, shell: process.platform === 'win32',
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } else throw new Error('Unknown app command.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
