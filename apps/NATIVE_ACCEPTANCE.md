# Native acceptance — 2026-09-28

Do not mark a case passed without executing it on the named artifact/device and recording evidence. No physical Android device is currently available. Do not uninstall an existing debug build or clear customer data to install a differently signed release.

## Android 1.0.3 signed release

| Case | Current evidence / status |
|---|---|
| Build and original release signature | Passed: assembleRelease and apksigner |
| Native state, S256, expiry and strict deep-link URI | Passed: JVM executes actual OAuthRequest policy, not provider login |
| Server code exchange, private cookie, session reload | Passed with mocked Supabase, not a live provider session |
| Deployed OAuth routes and live Supabase Google startup | Passed: public integration check; opaque provider state means actual redirect still awaits account-owner login |
| Production invalid-code/demo-token rejection | Passed: live 401 with no session issued |
| Install/update preserving same-key release data | Passed: emulator-5556 update 1.0.2 → 1.0.3 with install -r, no uninstall/wipe; authenticated-session preservation not yet tested |
| Real storefront/toolbar absent | Passed on signed 1.0.3 emulator; `.data/live-verification/android-1.0.3-home.png` |
| Menu → login/menu dismissal | 1.0.2 QA emulator passed; recheck 1.0.3 pending |
| Google login → consent → return → app session → logout | Pending account-owner interactive Google login |
| Email/password, signup, recovery | Full native acceptance pending |
| Search/category/detail, cart and account isolation | Full native acceptance pending |
| Simulated payment → history/library → private download | Full native acceptance pending; no real charges |
| Notification dropdown/read/all/preferences | Full native acceptance pending |
| Expected receipt/delivery/support/recovery emails | Pending current native workflow and provider delivery evidence |
| Avatar system picker/upload | Full native acceptance pending |
| Back, keyboard, rotation/recreation, offline/retry | Full native acceptance pending |
| All functions on physical phone | Blocked: no physical phone available |

## Windows admin EXE

| Case | Current evidence / status |
|---|---|
| Build/package whitelist and navigation policy | Passed automated tests; existing 1.0.0 installer |
| Trusted Authenticode signing/timestamp | Blocked: no CA certificate or signing account; installer NotSigned |
| Signed release refuses missing credentials | Passed fail-closed configuration check |
| Admin logo/theme | Browser regression passed; actual EXE acceptance pending |
| Native login/logout, resize, restart, offline/retry | Full native acceptance pending |
| Products/upload/edit/visibility, orders, customers, support | Full native acceptance pending; browser tests are separate |
| CSV/JSON import/export and invalid input | Full native acceptance pending |
| Notifications/read/preferences/customer-page confinement | Policy tests passed; full native acceptance pending |
| SmartScreen on a clean Windows device | Pending signed artifact/device test; signing alone does not promise no warning |

## Completing a run

Record date, exact artifact SHA-256, OS/device, tester, scenario, result and evidence path. Google sign-in requires the account owner; never request passwords in chat. Confirm session persists after relaunch, another app cannot replay the callback, and logout revokes access. Use the authorized account and simulated payment only. Preserve existing app data; clean up only records created by the run when authorized.
