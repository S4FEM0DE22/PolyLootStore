# Support conversations — 2026-09-29

Customers open Help → their ticket → View and reply. Admin opens Support → View conversation. Original ticket text is retained. Admin replies notify the owner in-app and send transactional email; customer replies notify admin and reopen resolved tickets. Notification preferences still apply. The email link requires the customer's normal sign-in; it is not an authentication token.

## Checks

- Regression suite: 45/45 passed, zero skipped. ESLint and production Next.js/TypeScript build passed.
- Edge: customer/admin × light/dark, 4/4 passed with actual local handlers and frontend. Lost-response retry keeps one message; hostile HTML remains text; refresh preserves unsent drafts.
- Production additive schema applied without deleting historical tickets. Transactional SQL fixture verified ownership rejection, duplicate-safe insert, reopening and notification ownership, then rolled back. Table RLS is enabled; browser roles cannot read/write messages or execute the service-only RPC.
- Supabase performance notices concern existing tables, not the new indexed conversation table. Existing foreign-key index notices can be reviewed separately: [database linter](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
- Production Edge admin test passed on deployment `dpl_2g1hqt3pVo48va6x1qdY1zJmfNU5`, commit `c63bce4` (READY), on 2026-09-29. One explicitly labelled QA ticket received one admin reply; Resend confirmed **delivered** for that email. Repeating the same request ID left one message and did not resend. Guest APIs returned 401; the customer notification has the correct owner and thread link. QA ticket `SP-20260929ABCDE123` was resolved and retained for inspection, with no existing customer tickets changed. Local evidence: `.data/live-verification/support-live-report.json` and `support-production-admin.png`. Delivery is provider evidence, not proof of inbox placement or user reading.
- Vercel post-test runtime scan found no error/fatal entries for this deployment in the inspected one-hour window. This is a bounded scan, not a zero-error guarantee for all time.
- Existing security advisories remain outside this change: browser EXECUTE grants on the profile synchronization trigger function ([anonymous](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)) and [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The new support RPC uses SECURITY INVOKER and is revoked from browser roles. Service-only tables intentionally have no client policies; [linter explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Operational boundaries

- Text-only: no attachments. Maximum 4,000 characters, 200 replies per ticket, 10 replies per role per 10 minutes. Use Check new messages to refresh the thread; notifications retain their existing polling behavior.
- Message, ticket update and notification are committed atomically. Client request IDs prevent a retry from creating a second message. Server authentication determines the author role and enforces ticket ownership.
- Email uses a persistent per-message status and a stable Resend idempotency key. Two bounded attempts handle transient failures; saved replies remain available if email fails. Admin can retry failed/pending email after 60 seconds, within 23 hours of the original message. There is no scheduled retry worker. A provider-accepted status is not a delivered/inbox-read claim.
- No new APK/EXE is required for this hosted frontend feature. Browser testing does not certify native authenticated end-to-end use; APK 1.0.4 owner retest and unsigned Windows release limitations remain in BUILD_VERIFICATION.md.

Run `node scripts/verify-support-thread.cjs` with Playwright or `POLYLOOT_PLAYWRIGHT_PATH`. The fixture must run without production Supabase credentials. `verify-support-live.cjs` requires an explicitly provisioned, clearly labelled QA ticket and real admin credentials; it sends one real email and never creates a customer session.
