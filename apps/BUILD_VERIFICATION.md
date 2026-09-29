# Build verification — 2026-09-29

Current artifacts, not the historical 1.0.1 debug build. Build success, mock tests, browser tests and native-device acceptance are separate claims.

## Artifacts and checks

- Production origin: `https://poly-loot-store.vercel.app` (online clients, not offline server copies).
- Android **1.0.4 / versionCode 5**: signed release `.data/releases/PolyLoot-Customer-1.0.4.apk`. Built with the original 1.0.2 release key, not a replacement/debug key. `assembleRelease` and signature verification passed.
- APK SHA-256: `be73e132be401f1843f4af017f7cf3838cccccf8f5f4bb7bea6512cc2d0839eb`.
- Signer SHA-256: `3708bfa0c236123231ea93feadc3aac37d2a71e0f5e196bd6b71568f91b8c435`; RSA 3072, APK Signature Scheme v2 verified. Signing keys/passwords are excluded from Git and require secure backup.
- Windows **1.0.0 x64**: `apps/desktop/dist/PolyLoot-Admin-1.0.0-Setup.exe` exists; Authenticode reports **NotSigned**. The user confirmed no certificate/signing account is available. This is a test artifact, not a trusted-signed public release.
- Automated regression suite: **45/45 passed, zero skipped**. Three support-conversation checks cover ownership, trusted roles, duplicate prevention, reopening, notifications, escaped email content and provider retry/status persistence. Four session checks cover immediate authenticated return, stale guest responses, logout invalidation and offline errors. Existing PKCE/signing checks cover fixed S256 callbacks, validation, mocked code-to-cookie session/reload, expired-code rejection, production demo-token rejection, actual JVM native callback policy and signing guards.
- Support conversation: **4/4 Edge cases passed** using actual frontend modules and local handlers, customer/admin and light/dark themes. Covers a lost response followed by duplicate-safe retry, hostile text escaping, draft preservation and no horizontal overflow. Local email is DEMO, not delivery evidence. See [SUPPORT_VERIFICATION.md](SUPPORT_VERIFICATION.md).
- Edge storefront regression: **5/5 passed** using actual page DOM/CSS/modules and isolated API fixtures, not Google-provider E2E. Covers warm authenticated return without document reload, account rendering before slow catalog with preserved draft, stale guest response rejection, unchanged resume/draft/logout, and guest lifecycle events not granting identity. Run `node scripts/verify-session-resume.cjs` with Playwright installed or `POLYLOOT_PLAYWRIGHT_PATH` pointing to its module.
- Admin pre-login appearance: **4/4 Edge fixture cases passed** (web/desktop User-Agent, 390/1440 widths), using the actual admin module. Covers keyboard-accessible settings, light/dark/system including device changes, Thai/English both directions, reload persistence, password draft preservation, no private API access and desktop storefront confinement. Run `node scripts/verify-admin-app-settings.cjs`. This does not certify actual Electron executable interaction.
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

Mocked server exchange and actual JVM policy tests passed. **The account owner reports phone login succeeds, but 1.0.3 required closing/reopening the app and waiting.** This is user-reported evidence, not an agent-observed provider E2E pass. The deployed website must contain the callback; Supabase must allow the HTTPS callback through matching Site URL or explicit Redirect URLs. APK build success does not close full native acceptance.

1.0.4 fixes that observed lifecycle defect: after the native cookie callback completes, a fixed signal asks the storefront to re-read the server's HttpOnly-cookie session and render the profile immediately. No user identity/token is injected. Old/unloaded storefronts get a distinct-query document load (a fragment-only `loadUrl` retained stale guest state). Resume/page restoration also re-checks session, stale responses cannot overwrite newer state, and profile/login no longer wait for catalog/preferences/notifications. Install 1.0.4 and deploy the matching storefront; account-owner retest on the phone remains required.

Production integration check passed on 2026-09-28 against deployment `dpl_HeW8xeS5aHU9UZzKMfMAkAPEBZ1U` (commit `156a9df`, READY): the deployed start route uses S256, live Supabase starts Google authorization, the callback returns a safe app link with no-store/no-referrer, malformed requests fail, and fabricated codes/demo tokens return 401 with no session cookie. Supabase currently uses opaque provider state; successful authorization startup alone does not prove callback allowlisting or signed-in return. Run `node scripts/verify-android-oauth-live.mjs`; its report deliberately excludes verifier, provider state, codes, tokens and cookies.

## Native verification boundaries

- Historical 1.0.2 signed APK QA emulator smoke test passed: install/launch, real storefront, menu to login/menu dismissal and removed toolbar absent. Existing debug app/emulator data was not cleared.
- Runtime checks are recorded in `NATIVE_ACCEPTANCE.md`. Historical 1.0.3 smoke results do not automatically certify 1.0.4, provider login or a purchase.
- Signed 1.0.4 installed over 1.0.3 on preserved QA emulator-5556 via `adb install -r`, without uninstall/data wipe. Package manager confirms versionCode 5/versionName 1.0.4, real storefront renders and removed toolbar remains absent. Evidence: `.data/live-verification/android-1.0.4-home.png`. This is a launch/update smoke test, not authenticated provider return.
- Updated the separate QA emulator from same-key signed 1.0.2 to 1.0.3 using `adb install -r`, without uninstall/data wipe. Package manager confirms versionCode 4/versionName 1.0.3; actual storefront renders and removed toolbar remains absent. Local evidence: `.data/live-verification/android-1.0.3-home.png`.
- Signed 1.0.3 emulator-5556 also passed menu → account/login with menu dismissal, and its Google button launched external Chrome at accounts.google.com. Account-owner sign-in/consent and authenticated return remain pending, not inferred from this startup result. Evidence: `.data/live-verification/android-resume-login.png` and `android-resume-google-prompt.png`.
- Prior browser evidence: actual Edge guest/admin navigation, admin login/logout/exports, notifications/privacy and light/dark/system-theme logo checks. These do not certify native EXE/APK flows.
- The user initially had only an emulator, then reported successful login on a phone with the restart defect. No agent-observed physical-device run is available. Full physical-device end-to-end acceptance cannot be claimed; 1.0.4 requires an owner retest.
- Complete native customer purchase/download/email, recovery and all native admin operations remain acceptance items. Payment remains simulated, not live money processing.

## Windows signing guard

`npm run desktop:release` requires a certificate and expected publisher before building, uses `forceCodeSigning` and SHA-256/RFC3161 timestamp, and verifies trusted Authenticode signatures/publisher/timestamps on installer and app EXE before exporting. Missing credentials intentionally fail. `desktop:build` remains a test build, not a substitute.

No self-signed trust installation, SmartScreen disabling or certificate purchase performed. A valid CA signature does not guarantee immediate reputation: [Microsoft SmartScreen](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).

## Repository hygiene

Generated `next-env.d.ts` references production `.next/types/`; `AGENTS.md` and `CLAUDE.md` are intentionally tracked because Next.js regenerates them. APKs/installers, build folders, keys/passwords, `.env` and local evidence remain ignored. `next dev` can switch generated type paths again; run `npm run build` before the production handoff rather than discarding user edits.

Commands: [README.md](README.md). Acceptance: [NATIVE_ACCEPTANCE.md](NATIVE_ACCEPTANCE.md). PKCE: [Supabase docs](https://supabase.com/docs/guides/auth/sessions/pkce-flow).
