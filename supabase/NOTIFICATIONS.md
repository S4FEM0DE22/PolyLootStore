# Notification center — 2026-09-28

## Setup

Apply `notifications.sql` once after the existing schema/settings/support tables. The additive migration `notification_event_history` has already been applied to the connected PolyLootStore project. Deploy the new API and UI only after the database migration succeeds. Do not re-run the bootstrap SQL against an initialized project.

- Database triggers capture order creation/payment/cancellation, support creation/status changes, and changed non-empty store announcements in the same transaction as the source event.
- Existing orders are backfilled from known timestamps. Existing tickets only have a creation timestamp; past transition times cannot be reconstructed. Future transitions use their actual update time. Existing announcement read markers may become unread once during migration.
- `GET /api/notifications` is customer-scoped; `GET /api/admin/notifications` requires the existing admin session. Neither accepts a caller-supplied recipient or role. Admin reads are shared by the store's single password-based admin identity, not individual admin accounts.
- `days=7` limits the dropdown, not history or unread totals. Full history is paginated in batches of 20; no old 100-event display cap or 200-read-marker eviction. Preferences hide disabled customer notification types. Existing order/ticket read IDs remain respected.
- Marking all as read uses a fetch-time cutoff so events arriving afterward stay unread. Receipts are atomically upserted and repeated reads are idempotent.
- The client polls every 30 seconds while visible, refreshes on reconnect/visibility, retains error/retry states, and clears private UI on session expiry/logout. This is in-app notification delivery, **not Android/Windows OS push notifications**.
- Admin store settings now post to `/api/admin/settings` so the path-restricted admin cookie is actually sent; announcements can be saved through the UI.

## Security and verification

Both notification tables have RLS and deny direct anonymous/authenticated access. RPCs and capture triggers use SECURITY INVOKER with a pinned search path; RPC EXECUTE is granted only to service_role. Ownership and preferences are enforced before returning or marking records. Keep service keys server-side.

Verified: 27 Node tests; TypeScript, ESLint, production build; six Edge UI fixture scenarios (customer/admin, light/dark/mobile) including 7-day dropdown, all-history pagination, unread/type filters, read/read-all, retry, Escape focus, related-page navigation, new-event refresh and session-expiry cleanup. Screenshots live in ignored `.data/notification-verification`. Run `scripts/verify-notifications.cjs` with an available Playwright installation and Edge. `scripts/verify-notifications-live.cjs` checks production admin API/UI read-only using a configured admin credential without changing real receipts.

Verified against the connected database in a rolled-back transaction: source triggers preserve order/support transitions, 7-day support update timing, cross-customer denial, and read-all. No transactional test orders/tickets/receipts remain. Production users' notification receipts were not changed during verification.

Supabase security advisors report INFO for RLS without policies on these server-only tables (intentional deny-by-default). Existing unrelated warnings concern `sync_customer_profile` SECURITY DEFINER execution and disabled leaked-password protection; not changed by this work. See [function security advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
