# IDAI STORES 43

IDAI STORES 43 e-commerce application built with Next.js 14, TypeScript,
Tailwind CSS, Mongoose, and Zustand.

## Requirements

- Node.js 18.17 or newer
- npm
- MongoDB locally or a MongoDB Atlas connection string

## Setup

```powershell
npm install
Copy-Item .env.example .env.local
```

Set the following values in `.env.local`:

- `MONGODB_URI`: reachable MongoDB instance (the example targets local MongoDB).
- `AUTH_SECRET`: a randomly generated secret with at least 32 characters.
- `NEXTAUTH_URL`: the canonical application URL, for example
  `http://localhost:3000` for development.
- `NEXTAUTH_SECRET`: a separate random secret with at least 32 characters for
  customer sessions. The admin JWT continues to use `AUTH_SECRET`.
- `ADMIN_BOOTSTRAP_SECRET`: a one-time secret for initial administrator setup.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`:
  Cloudinary credentials for product image uploads.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and
  optionally `SMTP_SECURE`: credentials for password resets and contact messages.
- `CONTACT_EMAIL`: optional destination for contact-form messages.
- `NEXT_PUBLIC_CONTACT_EMAIL`: optional public email shown on the contact page.
- `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL`: server-side access
  for the shopping assistant (`openai/gpt-4o-mini` is the default model).
  `IDAI_OPENROUTER_API_KEY` is also accepted as an alternative key name.

Create the first administrator by sending a JSON POST to
`/api/auth/admin/register` containing `email`, a password of at least 12
characters, and the configured `bootstrapSecret`. Registration is rejected when
an administrator already exists. Keep the bootstrap secret private and remove
or rotate it after setup.

Sign in at `/admin/login`. The admin login issues an HTTP-only, secure-in
production, same-site strict JWT cookie. Product and category write APIs require
a valid admin session; catalog changes are available to SuperAdmin and Manager
roles.

The admin panel is at `/admin`. Product image uploads are limited to JPEG, PNG,
and WebP files up to 5 MB.

The customer storefront is available at `/`, with the shop at `/shop`, product
details at `/product/[slug]`, and the local cart at `/cart`. Cart contents are
stored in the visitor's browser. Customer accounts are available at `/register`
and `/login`; password recovery emails require configured SMTP. The product API
supports `search`, repeatable `category`, `minPrice`,
`maxPrice`, `minRating`, `inStock`, `sort`, `page`, and `limit` query parameters.

Checkout is available at `/checkout` and accepts guest orders or authenticated
customer orders. Prices and stock are reloaded on the server, and all stock
decrements and order creation run in one MongoDB transaction. Checkout therefore
requires MongoDB to run as a replica set (MongoDB Atlas is replica-set based);
a standalone local MongoDB server cannot place orders transactionally.
Website orders are confirmed at `/checkout/success`; WhatsApp orders are saved
with their source before the browser opens the order message. Authenticated
customers can see their profile and addresses at `/account`, and their own order
history and details at `/account/orders`. Guest orders are not exposed by order
number alone.

Admins can review and update orders at `/admin/orders`, including source/status
filters and private internal notes. Order-status changes are reflected in the
customer's authenticated order pages. The floating shopping assistant uses
OpenRouter server-side tools for catalog search, live stock, and email-verified
order status; it requires `OPENROUTER_API_KEY` or `IDAI_OPENROUTER_API_KEY`. The catalog API, checkout, and
assistant exclude food and grocery categories/items. The assistant supports
English and Roman Urdu, browser voice input, and PNG/JPEG/WebP image attachments
up to 5 MB.

Inventory operations are available under `/admin/inventory`: supplier records
at `/admin/inventory/suppliers`, receiving stock and updating product cost from
purchase invoices at `/admin/inventory/purchase-invoices`, in-store checkout at
`/admin/inventory/pos`, and the paginated stock movement ledger at
`/admin/inventory/stock-ledger`. Website, AI, and POS orders all decrement the
same product stock within their order transaction; purchase invoices increase
that stock and write the corresponding audit movement. These operations require
MongoDB transactions and therefore a replica-set deployment. The ledger records
movements from this feature rollout onward; historical purchases and sales
cannot be reconstructed from current stock totals. The admin dashboard includes
daily, monthly, and yearly sales, profit, and order reports.

## Verify the database connection

With MongoDB running and `MONGODB_URI` configured, run:

```powershell
npm run db:check
```

For local storefront testing, `npm run db:seed-demo` adds four non-food demo
products and their categories. It only runs against a local MongoDB URI by
default; remote database writes are blocked unless `ALLOW_REMOTE_DEMO_SEED=YES`
is intentionally set.

On success, the script prints `MongoDB connection successful.` and disconnects.
Connection errors are printed and the command exits unsuccessfully.

## Run the application

```powershell
npm run dev
```

Open http://localhost:3000.

## Health check and deployment

`GET /api/health` returns `{ "status": "ok" }` without opening a database
connection, so it can be used as a Render health check. Production startup uses
`next start --hostname 0.0.0.0`; Render supplies the `PORT` environment variable.

Create a Render Web Service from the repository with:

- **Build command:** `npm install && npm run build`
- **Start command:** `npm run start`
- **Health check path:** `/api/health`

Configure these environment variables in Render:

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB Atlas URI; checkout transactions require a replica set. |
| `NEXTAUTH_URL` | Yes | Public canonical URL for the deployed service, including `https://`. |
| `NEXTAUTH_SECRET` | Yes | Long, random secret for customer sessions. |
| `AUTH_SECRET` | Yes | Separate long, random secret used for admin authentication. |
| `WHATSAPP_NUMBER` | Yes | Server-side WhatsApp number. Use international digits without `+` or spaces, e.g. `923278505273`. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Yes | Same WhatsApp number for public links; set before build, e.g. `03278505273`. |
| `ADMIN_BOOTSTRAP_SECRET` | Initial setup | One-time private secret; rotate/remove after creating the first admin. |
| `CLOUDINARY_CLOUD_NAME` | For image uploads | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | For image uploads | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | For image uploads | Cloudinary API secret. |
| `OPENROUTER_API_KEY` | For AI chat | Server-side OpenRouter key. |
| `OPENROUTER_MODEL` | No | Optional; defaults to `openai/gpt-4o-mini`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | For password resets | SMTP server settings. |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | For password resets | SMTP credentials and sender address. |
| `CONTACT_EMAIL` | No | Optional inbox for contact-form submissions (defaults to `SMTP_FROM`). |
| `NEXT_PUBLIC_CONTACT_EMAIL` | No | Optional public email address displayed on `/contact`. |
| `PORT` | No | Supplied by Render; do not hard-code it. |

Use independent randomly generated values for `AUTH_SECRET` and
`NEXTAUTH_SECRET`; never commit production secrets. The `.env.example` file
contains the full variable list. Set `NEXTAUTH_URL` to the exact public service
URL, and configure MongoDB Atlas network access for the deployed service.

There are no SQL migrations. Mongoose creates/uses collections and indexes as
models initialize. Run `npm run db:check` with the production URI in a secure
local environment to verify MongoDB connectivity before deployment. For initial
admin setup, send the protected bootstrap request described above, then remove
or rotate `ADMIN_BOOTSTRAP_SECRET`.

The English/Urdu preference is stored in the browser. Urdu switches the page
direction to RTL and uses Noto Nastaliq Urdu. Test both languages on the home,
shop, and checkout pages after deployment. The assistant is optional and is
disabled until `OPENROUTER_API_KEY` is configured.

## Local production verification

```powershell
npm run build
npm run start
```

In another terminal, confirm `http://localhost:3000/api/health` returns
`{"status":"ok"}`. Use a MongoDB replica-set URI to test checkout end-to-end.

## Foundation contents

- Mongoose models are in `src/models`.
- The cached database connector is `src/lib/db.ts`.
- Brand tokens are defined in `tailwind.config.ts` and `src/app/globals.css`.

Order totals, delivery charges, inventory deductions, and customer order access
are enforced by server-side routes.
