# Build verification — 2026-09-28

Current artifacts, not the historical 1.0.1 debug build. Build success, mock tests, browser tests and native-device acceptance are separate claims.

## Artifacts and checks

- Production origin: `https://poly-loot-store.vercel.app` (online clients, not offline server copies).
- Android **1.0.3 / versionCode 4**: signed release `.data/releases/PolyLoot-Customer-1.0.3.apk`. Built with the original 1.0.2 release key, not a replacement/debug key. `assembleRelease` and signature verification passed.
- APK SHA-256: `53c33c60d970da51627724cb446207f53b2d56bf490c4dd72aa59c9ec35b0195`.
- Signer SHA-256: `3708bfa0c236123231ea93feadc3aac37d2a71e0f5e196bd6b71568f91b8c435`; RSA 3072, APK Signature Scheme v2 verified. Signing keys/passwords are excluded from Git and require secure backup.
- Windows **1.0.0 x64**: `apps/desktop/dist/PolyLoot-Admin-1.0.0-Setup.exe` exists; Authenticode reports **NotSigned**. The user confirmed no certificate/signing account is available. This is a test artifact, not a trusted-signed public release.
- Automated regression suite: **38/38 passed, zero skipped** (previously 31, not 30). Seven additional PKCE/signing checks cover fixed S256 callbacks, validation, mocked code-to-cookie session/reload, expired-code rejection, production demo-token rejection, actual JVM native callback policy and signing guards.
- ESLint passed. Production Next.js build and TypeScript compilation passed, including `/auth/android/start` and `/auth/android/callback`.
- Android `lintRelease` passed: 0 errors, 11 warnings. These warnings remain visible, not silently suppressed.
- No server secrets bundled. Desktop whitelist: `main.cjs`, `policy.cjs`, `runtime-config.json`, `package.json`, `icons/admin.png`.
- User-supplied customer/admin icons retained. Admin logo theme fix retained with regression coverage.

## Android Google OAuth: implementation versus acceptance

1. Google button opens system browser, not Google inside WebView.
2. App-private random state/verifier with five-minute expiry bind the callback to the requesting installation. Only the S256 challenge enters the start URL.
3. Supabase redirects to the store's HTTPS callback. An explicit **return to app** button supports browsers that block automatic custom-scheme navigation.
4. Deep link carries one-time code/state only. Native code rejects wrong scheme/host/path, credentials, fragments, duplicate/extra parameters, expiry and mismatched state.
5. Native HTTPS POST exchanges code server-side and installs only a Secure/HttpOnly customer cookie into WebView. No JavaScript bridge, service key or Google access/refresh token in the deep link.
6. Pending requests are consumed before exchange. Web Google login is preserved; production rejects demo Google tokens.

Mocked server exchange and actual JVM policy tests passed. **Google provider login/consent and authenticated return in the signed APK are not yet confirmed end-to-end.** Account-owner sign-in is required. The deployed website must contain the callback; Supabase must allow the HTTPS callback through matching Site URL or explicit Redirect URLs. APK build success does not close this acceptance item.

## Native verification boundaries

- Historical 1.0.2 signed APK QA emulator smoke test passed: install/launch, real storefront, menu to login/menu dismissal and removed toolbar absent. Existing debug app/emulator data was not cleared.
- Current 1.0.3 runtime checks are recorded in `NATIVE_ACCEPTANCE.md`. JVM policy tests do not certify provider login or a purchase.
- Updated the separate QA emulator from same-key signed 1.0.2 to 1.0.3 using `adb install -r`, without uninstall/data wipe. Package manager confirms versionCode 4/versionName 1.0.3; actual storefront renders and removed toolbar remains absent. Local evidence: `.data/live-verification/android-1.0.3-home.png`.
- Prior browser evidence: actual Edge guest/admin navigation, admin login/logout/exports, notifications/privacy and light/dark/system-theme logo checks. These do not certify native EXE/APK flows.
- **Physical Android device unavailable**, user confirmed 2026-09-28. Full physical-device end-to-end acceptance cannot be claimed.
- Complete native customer purchase/download/email, recovery and all native admin operations remain acceptance items. Payment remains simulated, not live money processing.

## Windows signing guard

`npm run desktop:release` requires a certificate and expected publisher before building, uses `forceCodeSigning` and SHA-256/RFC3161 timestamp, and verifies trusted Authenticode signatures/publisher/timestamps on installer and app EXE before exporting. Missing credentials intentionally fail. `desktop:build` remains a test build, not a substitute.

No self-signed trust installation, SmartScreen disabling or certificate purchase performed. A valid CA signature does not guarantee immediate reputation: [Microsoft SmartScreen](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).

## Repository hygiene

Generated `next-env.d.ts` references production `.next/types/`; `AGENTS.md` and `CLAUDE.md` are intentionally tracked because Next.js regenerates them. APKs/installers, build folders, keys/passwords, `.env` and local evidence remain ignored. `next dev` can switch generated type paths again; run `npm run build` before the production handoff rather than discarding user edits.

Commands: [README.md](README.md). Acceptance: [NATIVE_ACCEPTANCE.md](NATIVE_ACCEPTANCE.md). PKCE: [Supabase docs](https://supabase.com/docs/guides/auth/sessions/pkce-flow).
