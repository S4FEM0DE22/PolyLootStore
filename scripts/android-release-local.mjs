// Private local signing material is generated only on explicit initialization.
// Never put .data/android-signing, its passwords, or its key in source control.
import { mkdirSync, existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const privateDir = resolve(root, '.data/android-signing');
const key = resolve(privateDir, 'polyloot-release.p12');
const credentialsFile = resolve(privateDir, 'credentials.json');
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Release step failed (${result.status ?? 'no exit code'})`);
}
try {
  if (!existsSync(key) || !existsSync(credentialsFile)) {
    if (existsSync(key) || existsSync(credentialsFile)) throw new Error('Signing material is incomplete. Restore the original backup; do not replace an existing signing key.');
    if (!process.argv.includes('--init-signing')) throw new Error('No local release key. Initialize once with --init-signing, or use android:release with your existing release signing environment.');
    mkdirSync(privateDir, { recursive: true });
    const password = randomBytes(36).toString('base64url');
    const credentials = { alias: 'polyloot', storePassword: password, keyPassword: password };
    // Exclusive creation prevents silently overwriting existing release credentials.
    writeFileSync(credentialsFile, JSON.stringify(credentials, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    const keytool = process.env.JAVA_HOME ? resolve(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool') : 'keytool';
    run(keytool, ['-J-Duser.language=en', '-J-Duser.country=US', '-genkeypair', '-keystore', key,
      '-storetype', 'PKCS12', '-alias', credentials.alias, '-keyalg', 'RSA', '-keysize', '3072',
      '-sigalg', 'SHA256withRSA', '-validity', '10000', '-dname', 'CN=PolyLoot Customer, O=PolyLoot',
      '-storepass:env', 'POLYLOOT_STORE_PASSWORD', '-keypass:env', 'POLYLOOT_KEY_PASSWORD'],
    { ...process.env, POLYLOOT_STORE_PASSWORD: password, POLYLOOT_KEY_PASSWORD: password });
    console.log('New private release key created. Back up .data/android-signing securely before distributing updates.');
  }
  const credentials = JSON.parse(readFileSync(credentialsFile, 'utf8'));
  if (!credentials.alias || !credentials.storePassword || !credentials.keyPassword) throw new Error('Invalid signing credentials. Restore the original backup.');
  const buildEnv = { ...process.env, POLYLOOT_KEYSTORE: key, POLYLOOT_KEY_ALIAS: credentials.alias,
    POLYLOOT_STORE_PASSWORD: credentials.storePassword, POLYLOOT_KEY_PASSWORD: credentials.keyPassword };
  run(process.execPath, [resolve(root, 'scripts/apps.mjs'), 'android-release'], buildEnv);
  const apk = resolve(root, 'apps/android/app/build/outputs/apk/release/app-release.apk');
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, 'Android/Sdk'));
  if (!sdk) throw new Error('Android SDK location is required to verify the release signature.');
  const java = process.env.JAVA_HOME ? resolve(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
  run(java, ['-jar', resolve(sdk, 'build-tools/36.0.0/lib/apksigner.jar'), 'verify', '--verbose', '--print-certs', apk]);
  const gradle = readFileSync(resolve(root, 'apps/android/app/build.gradle'), 'utf8');
  const version = gradle.match(/versionName\s*=\s*'([0-9.]+)'/)?.[1];
  if (!version) throw new Error('Cannot read release version.');
  const outputDir = resolve(root, '.data/releases');
  mkdirSync(outputDir, { recursive: true });
  const name = `PolyLoot-Customer-${version}.apk`;
  const artifact = resolve(outputDir, name);
  copyFileSync(apk, artifact);
  const checksum = createHash('sha256').update(readFileSync(artifact)).digest('hex');
  writeFileSync(artifact + '.sha256', `${checksum}  ${name}\n`);
  console.log(`Signed APK: ${artifact}\nSHA256: ${checksum}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
