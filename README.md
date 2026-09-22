# PolyLoot — Mini Project 3D Game Assets Store

Created as a separate project using the original shop's account, order, admin, download and email architecture. It now uses Next.js App Router and TypeScript page/route files. The existing storefront and admin interactions run as client-side modules while the API is exposed through Next.js Route Handlers.

## Local demo

Run `npm install`, `npm run seed`, then `npm run dev`. Open http://localhost:3000. This checkout has five starter packs plus 29 additional CC0 Kenney 3D packs added through the Admin create action. The added packs are available in `fixtures/kenney` as original ZIPs and preview images. On a fresh checkout, run `npm run import:kenney` from the project directory after setting `ADMIN_PASSWORD` to add them through the same Admin action. It is safe to run again: existing product IDs are skipped. The on-screen prices are fictional; the original packs are free. Checkout is simulated and never collects real payments.

The admin page is /admin/. This local machine has a newly generated `ADMIN_PASSWORD` in the Git-ignored `.env.local`; open that file to sign in, then choose **แอสเซ็ต** to add, edit, hide, search/filter or delete. Change it to a strong password of your choice when ready. Local demo data lives in `.data`, and uploaded ZIPs live in `private-assets`. These are ignored by Git. Products referenced by orders cannot be deleted; hide them instead so order history and downloads stay valid.

## New cloud projects

The local Git repository is initialized on `main` with no remote. Create a **new remote Git repository**, a **new Vercel project** with Next.js auto-detection, and a **new Supabase project**. In that Supabase project's SQL editor run supabase/schema.sql, followed by supabase/customer_accounts.sql. For an existing PolyLoot database created before order snapshots, run supabase/upgrade_order_snapshots.sql before deploying this update. New orders store their price and product details at checkout; historical orders without snapshots fall back to the current catalog. Set Supabase Auth Email and your new site's redirect URL. Upload your licensed asset packages to private Storage bucket `assets`; covers use public bucket `covers`. Kenney ZIPs are versioned in `fixtures/`; run `npm run seed` to copy them into the ignored private asset folder. Upload those ZIPs to Supabase Storage if you want the demo catalog to download in production.

Copy .env.example to .env.local and fill SUPABASE_URL, SUPABASE_SECRET_KEY, DOWNLOAD_SECRET (at least 32 random characters), ADMIN_PASSWORD (at least 20 random characters), and PUBLIC_SITE_URL. Put the same values in the **new** Vercel project. Never copy credentials from the book shop. If you want email delivery, use the existing Resend account with a dedicated RESEND_API_KEY for this project and set EMAIL_FROM on a verified sending domain. This does not configure Supabase Auth SMTP automatically.

Store: search and category filter, detail metadata, cart, simulated checkout, account and My Library. Admin: asset CRUD, source links, search/category/status filters, order status, dashboard, JSON import/export of catalog metadata. The JSON import updates existing products only; it does not import binary packages. To add the 29 bundles to a new database through Admin, use `npm run import:kenney` with the new Supabase and Admin environment values. Export omits private file names. Download links expire and files remain private. This is a demo, not a real payment system or DRM.

Each of the 34 Kenney product pages now offers a small public ZIP with one preview model. These sample files are in `public/assets/samples`; the full packages stay in private storage. Paid and cancelled order pages can be printed or saved as order summaries, clearly marked as demo documents rather than tax invoices. Signed-in customers can submit a support request and view its status on the Help page. Admin has a support queue with status updates, a report from the latest 100 orders, and a CSV export. All sales amounts are simulated. For an existing Supabase project, run `supabase/support_tickets.sql` before deploying this change; a new project gets that table from `supabase/schema.sql`. Support requests are stored locally in the ignored `.data/support-tickets.json` in demo mode. The support queue does not send outgoing replies or notifications; staff should follow up using the customer email through an approved channel.

## Settings and notifications

Customers can open **Settings** from their account or the footer. Theme (light, dark, device) and language are shared between the storefront and Admin in the same browser; signed-in customers also save these choices and their in-app notification preferences to their account. English covers menus and settings; catalog descriptions and some older flows remain in Thai. The bell opens an in-app notification center generated from order status, support request status, and the current store announcement. Read state persists per account. It is not push notification or marketing email; transactional delivery email is unaffected.

Admin **Store settings** manages contact email, phone, support hours, a store announcement, and up to eight FAQ entries. These appear in customer Help. The Admin notifications view shows pending orders and open support requests from the latest 100 of each. In local demo mode settings live in ignored `.data/store-settings.json` and `.data/customer-preferences.json`. On an existing Supabase project, run `supabase/settings.sql` before deploying this update; new projects include both tables in `supabase/schema.sql`. No new environment variables are required.

Use `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test` to verify.


## Catalog sources

All 34 visible products come from [Kenney](https://kenney.nl/support), which states that game assets on its asset pages are CC0. The starter ZIPs include License.txt; each additional pack's official page was checked for CC0 and a usable 3D archive before Admin import. Attribution is optional, but product pages credit Kenney and link to the original free packs. Prices and checkout are entirely simulated. The additional original URLs and file details are recorded in `fixtures/kenney/manifest.json`.
- [Blocky Characters](https://kenney.nl/assets/blocky-characters)
- [Modular Dungeon Kit](https://kenney.nl/assets/modular-dungeon-kit)
- [Blaster Kit](https://kenney.nl/assets/blaster-kit)
- [Car Kit](https://kenney.nl/assets/car-kit)
- [Furniture Kit](https://kenney.nl/assets/furniture-kit)

## Next.js structure

`app/page.tsx` and `app/admin/page.tsx` render the storefront and admin shells. The existing interaction code lives in `public/legacy/`; `app/api/*/route.ts` exposes server code from `handlers/` through Next.js. CSS for each page is in `app/`. Use `npm run dev` for Next.js.

