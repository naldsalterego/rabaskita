# Deployment guide

## 1. Prerequisites
Node 22+, PostgreSQL 14+ (or a Supabase project, using its Postgres connection string), a domain with HTTPS.

## 2. Configure
Copy `.env.example` to `server/.env` and set real values:
- `DATABASE_URL` – production Postgres (use SSL; append `?sslmode=require` if your host needs it).
- `JWT_SECRET` – 32+ random bytes (`openssl rand -hex 32`). Never reuse across environments.
- `CLIENT_ORIGIN` – the public site URL, e.g. `https://visitcatanduanes.example` (also used inside QR code links).
- `PAYMENT_MODE` – keep `sandbox` until a real gateway is wired in. In `live` mode the sandbox confirm button is disabled and payments are only marked paid by the signed webhook.
- `PAYMENT_WEBHOOK_SECRET` – shared secret with your payment provider.
Never commit `.env`; never put secrets in `client/`.

## 3. Database
`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql` on a fresh database. For later changes add numbered files under `database/migrations/` and apply them in order. Then create the first admin:
`cd server && node --env-file=.env scripts/create-admin.js you@example.com "Your Name" "a-long-password"`

## 4. Build and run (single server)
```
cd client && npm ci && npm run build      # produces client/dist
cd ../server && npm ci --omit=dev && npm start
```
The API serves `client/dist` automatically when it exists. Put it behind a reverse proxy (Caddy or nginx) that terminates HTTPS, and run it under a process manager (systemd, pm2, or a container). Set `app.set('trust proxy', 1)` in `server/src/app.js` when behind a proxy so rate limiting sees real client IPs.

## 5. Go-live checklist
- [ ] Tests pass: `cd server && DATABASE_URL=... npm test` (needs a scratch database with the schema).
- [ ] Strong `JWT_SECRET`, HTTPS enforced, `.env` not in git.
- [ ] Admin account created; no default passwords.
- [ ] Payment gateway wired in `server/src/routes/payments.js` (`createPayment`), webhook URL registered at the provider, tested with the provider's sandbox, then `PAYMENT_MODE=live`. Verify with the provider's documentation and a small real transaction before launch.
- [ ] Real destination data entered with correct coordinates; point tiers reviewed; QR codes printed from the admin dashboard and tested on a phone.
- [ ] Privacy notice and terms published (the platform stores names, emails, bookings and location-related check-ins).
- [ ] Photos: file upload is not built yet. Use hosted image URLs in listings or add Supabase Storage.

## 6. Backups and operations
- Daily `pg_dump -Fc "$DATABASE_URL" > backup-$(date +%F).dump`, kept off the server for at least 14 days; managed Postgres (Supabase, RDS) usually offers point-in-time recovery, so enable it.
- Do a test restore at least once before launch (`pg_restore -d newdb backup.dump`).
- Monitor `/api/health`, and watch logs for repeated 401/429 responses.
- Review the admin audit log regularly.

## 7. Testing summary
`server/test/unit.test.js` covers itinerary math. `server/test/api.test.js` runs real HTTP requests against Postgres for: registration and role rules, QR check-in (cooldown, parallel claims, deactivation), points and rewards (overspend, single-use claims), stay booking (approval gate, no double-booking, payment confirmation, signed webhooks, replay), transport booking, itineraries (edit, recalculation, privacy, sharing), and reviews. Not covered by automated tests: the browser UI (drag-and-drop, forms), mobile layouts, and real payment gateways. Test those by hand before launch.
