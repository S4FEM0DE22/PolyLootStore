# Build verification — 2026-09-26

Initial proof builds used the reserved `https://example.invalid` origin. After the user confirmed the production URL, the app configuration was changed to `https://poly-loot-store.vercel.app` and both targets were rebuilt. Current binaries target the real shop; they are still test builds, not signed production releases.

- Android: `assembleDebug` and `lintDebug` succeeded; `app/build/outputs/apk/debug/app-debug.apk` generated. Lint has warnings, no errors. Gradle locale pinned to en_US to avoid Buddhist-calendar ZIP timestamp failures on this Thai-locale machine.
- Windows: Electron 44.4.5 / electron-builder 26.15.3 produced `desktop/dist/PolyLoot-Admin-1.0.0-Setup.exe` (x64). No production signing certificate supplied.
- Desktop package whitelist: `main.cjs`, `policy.cjs`, `runtime-config.json`, `package.json`, and `icons/admin.png`. No server code, `.env`, database, user data, or service keys included in the whitelist.
- Automated tests: 20/20 passed, including existing server flows, URL/navigation/package policies, web storefront links being preserved while desktop links are hidden, refusal to open customer pages externally from desktop, and icon resources/configuration. Typecheck passed during initial preparation; ESLint passed after the icon update. Own tracked changes passed `git diff --check`; unrelated pre-existing design-generator whitespace was not modified.
- Both binaries rebuilt with user-supplied icons. Branding source copies match the original PNG SHA-256 hashes. The actual Windows app EXE's extracted 32px icon matches the generated ADMIN ICO pixel-for-pixel. Android APK badging confirms the adaptive launcher resource; customer artwork is centered with safe padding and is not cropped. Native launcher appearance on a real device has not been tested.
- Admin navigation deployed to Vercel production from GitHub commit `8b3ba1e` (deployment `dpl_HYKVmXTPwBNq9MqfprSyMqARtz3J`, READY). Only the two web modules and a standalone test were committed; unrelated local design/CSS/app-preparation changes were left untouched.
- Verified the live `/admin/` page in headless Edge: normal browser has one return link and clickable logo; desktop User-Agent has zero return links and a SPAN logo. Clicking the web return link navigated to `/`. No page JavaScript errors. Vercel reported no grouped runtime errors for `/admin` and `/api/admin` in the checked 10-minute window. No live admin login or data changes were performed; native EXE installation was not retested.
- Confirmed HTTP 200 for the storefront `/` and admin `/admin/` using read-only requests. Verified the real origin in Android's generated BuildConfig and the packaged Electron runtime config. No production login or data changes were performed.
- `apps/config.json` now contains the user-confirmed production URL. Current system Node is 20.18; desktop build was verified using a separate bundled Node 24 runtime. Normal desktop commands require an upgrade to Node 22.12+.
- Not performed: installation/native UI testing, real account/email checks, Google OAuth return to APK, APK release signing, EXE signing, or store submission. Do not treat build success as end-to-end readiness.

## Update — 2026-09-28

- Android 1.0.1 (`versionCode` 2): removed the reload/open-browser toolbar; retained connection-error retry and download handling. Debug APK built successfully using the installed Android Studio JBR 25 and offline Gradle dependencies.
- Installed the new APK over the existing app on `emulator-5554` without clearing app data. The production storefront loaded; screenshot and UI hierarchy confirmed both toolbar buttons were absent. This is emulator verification, not a physical-device end-to-end test.
- Current project checks: 30/30 automated tests passed, TypeScript and ESLint passed. Android release signing and Windows signing remain outstanding.

Follow [README.md](README.md) for commands and release requirements.
