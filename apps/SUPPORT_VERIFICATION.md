# Support conversations — 2026-09-29

Customers open Help → their ticket → View and reply. Admin opens Support → View conversation. Original ticket text is retained. Admin replies notify the owner in-app and send transactional email; customer replies notify admin and reopen resolved tickets. Notification preferences still apply. The email link requires the customer's normal sign-in; it is not an authentication token.

## Checks

- Regression suite: 45/45 passed, zero skipped. ESLint and production Next.js/TypeScript build passed.
- Edge: customer/admin × light/dark, 4/4 passed with actual local handlers and frontend. Lost-response retry keeps one message; hostile HTML remains text; refresh preserves unsent drafts.
- Production additive schema applied without deleting historical tickets. Transactional SQL fixture verified ownership rejection, duplicate-safe insert, reopening and notification ownership, then rolled back. Table RLS is enabled; browser roles cannot read/write messages or execute the service-only RPC.
- Supabase performance notices concern existing tables, not the new indexed conversation table. Existing foreign-key index notices can be reviewed separately: [database linter](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
- Real provider delivery verification is recorded below after deployment; local DEMO and mocked provider tests do not prove inbox delivery.

## Operational boundaries

- Text-only: no attachments. Maximum 4,000 characters, 200 replies per ticket, 10 replies per role per 10 minutes. Use Check new messages to refresh the thread; notifications retain their existing polling behavior.
- Message, ticket update and notification are committed atomically. Client request IDs prevent a retry from creating a second message. Server authentication determines the author role and enforces ticket ownership.
- Email uses a persistent per-message status and a stable Resend idempotency key. Two bounded attempts handle transient failures; saved replies remain available if email fails. Admin can retry failed/pending email after 60 seconds, within 23 hours of the original message. There is no scheduled retry worker. A provider-accepted status is not a delivered/inbox-read claim.
- No new APK/EXE is required for this hosted frontend feature. Browser testing does not certify native authenticated end-to-end use; APK 1.0.4 owner retest and unsigned Windows release limitations remain in BUILD_VERIFICATION.md.

Run `node scripts/verify-support-thread.cjs` with Playwright or `POLYLOOT_PLAYWRIGHT_PATH`. The fixture must run without production Supabase credentials. `verify-support-live.cjs` requires an explicitly provisioned, clearly labelled QA ticket and real admin credentials; it sends one real email and never creates a customer session.
