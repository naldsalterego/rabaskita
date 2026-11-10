# Catanduanes Tourism Platform: Prototype

This build runs **entirely in the browser**: no server, no database, no setup. Sample data and your changes are stored in localStorage (use "Reset demo" in the top banner to start over). Listings are SAMPLE data, payments are simulated.

## Run on localhost
```
cd client
npm install
npm run dev        # open http://localhost:5173
```
Sign-in page has one-tap demo logins: Tourist, Business owner, Transport provider, Admin (password for all: `demo1234`).

## Deploy to Netlify (pick one)
1. **Drag and drop:** `cd client && npm install && npm run build`, then drag the `client/dist` folder onto https://app.netlify.com/drop.
2. **From Git:** push this folder to GitHub, "Add new site → Import", Netlify reads the root `netlify.toml` (base `client`, build `npm run build`, publish `dist`).

## 5-minute demo script
1. Sign in as Tourist → Explore → open a destination → "Demo: simulate scanning this QR" to earn points → Rewards.
2. Stays: pick dates, book a room, then My bookings → pay (sandbox) → confirmed. Try booking the same room again.
3. Transport: pick Virac Airport, choose a time, request a ride. Restaurants: open the Cafe and reserve a table.
4. Itinerary: Build a trip, drag stops between days, edit costs, Share, Export PDF.
5. Sign in as Provider → accept the ride. Sign in as Owner → add a business → Admin approves it → Admin dashboard stats, QR codes, reports.

## Tests
`cd client && npm test` runs the in-browser backend through the main flows.

## Full-stack version
The real Express + PostgreSQL backend is still in `server/` (see `DEPLOYMENT.md`). Build the client with `VITE_API_URL=https://your-api` to use it instead of demo mode. Not needed for the competition prototype.

## Admin console (demo mode)
Sign in as Admin. The sidebar lets the tourism office add, edit and delete destinations, stays (with rooms), restaurants (with menus), transport providers (with vehicles and routes), other businesses and rewards, plus approvals, QR codes, reports, users and the audit log. Changes show up immediately on the public pages. These content-manager endpoints (`/admin/manage/...`) exist in the in-browser demo backend only; the Express server in `server/` does not have them yet.

## Latest revisions
- Saved trips can be deleted (from the list or inside a trip).
- Shops show only souvenir shops and groceries; restaurants stay under Eat.
- Check-in points are shown only to signed-in users.
- Each business owner sees only their own businesses (the sample owner owns just "Seaside Inn").
- Ship is now a vehicle rental catalog (with driver or self-drive, per-day price, chosen destinations, availability check, provider accept/reject, payment in My bookings). Airport and port ride requests remain under the second tab.
The rental, admin content-manager and per-destination features run in the in-browser demo backend; the Express server in `server/` does not have them yet. Demo data was reset to a new version (v2), so old browser data is replaced on first load.

## Destination, stay, restaurant, shop, vehicle and reward photos
Admin > Destinations, Stays, Eat, Transport (per vehicle), Shops and Rewards each have a cover photo upload and a multi-photo album in their Add/Edit forms. The cover shows on Explore, Home and the destination banner; the album shows on the destination page with a full-screen viewer. In demo mode photos are resized in the browser and stored in that browser's IndexedDB, so they are visible only on the device where they were uploaded. To ship photos with the site, put files in `client/public/img/` named after the place (for example `puraran-beach.jpg`) and they are used as the cover automatically. Photo upload is not implemented in the Express server in `server/`.

## Credits page
The footer shows "Developed by IslaTek" and links to `/credits` (company name and team with a photo slot above each name). Only an admin sees the "Edit credits" button: they can rename the company, upload photos, edit names and roles, reorder, add and remove members. Transport providers also have a cover photo and album (shown on their vehicle pages and ride cards). Like the other demo-mode features, credits and uploaded photos are stored in the browser and are not in the Express server.

## Shared data on Netlify (so every device sees the same photos and edits)
The simple build keeps data in each visitor's browser. To share data between devices (admin uploads on a laptop, everyone sees them), deploy with the included Netlify Function, which stores data in Netlify Blobs (no database to set up):
1. Push this whole folder to a GitHub repository.
2. In Netlify: Add new site > Import an existing project > pick the repo. `netlify.toml` already sets the build, the `/api` function and the redirects. (Or use the Netlify CLI: `netlify deploy --build --prod`.) Drag-and-dropping only the `dist` folder deploys the simple, per-browser version because it has no function.
3. Optional but recommended: Site configuration > Environment variables > add `ADMIN_PASSWORD` with a secret. The admin account then uses that password and the one-tap Admin button is hidden. Set it before the first visit (or use "Reset to starting data" afterwards).
4. Re-upload the photos once from the admin account; they are now stored on the server.
In shared mode every visitor uses the same data (accounts, bookings, listings, credits). Simultaneous edits are last-write-wins. "Reset to starting data" resets it for everyone. The app detects the function automatically and falls back to the simple per-browser mode if it is missing.
Tests: `npm install && npm test` at the repo root checks the function; `cd client && npm test` checks the backend logic.

## Live refresh (shared mode)
In shared mode every open page checks a tiny revision number (`/api/sync`) every 15 seconds while the tab is visible and in use (it pauses after 5 minutes without activity and checks again as soon as you return). When anyone changes data, pages quietly re-fetch, with no reload and without clearing what you are typing. Each check is one small function call, so leave fewer tabs open if you are watching your Netlify free-plan usage. The trip editor keeps your working copy until you leave it.

## Branding (admin)
Admin > Branding changes the site name (also the browser tab title), the tagline, the main logo (header, footer and tab icon) and the developer badge beside it (logo, on/off, background). Logos are uploaded as PNG so transparency is kept. Leaving a logo empty uses the built-in one. In shared mode every visitor sees the change within a few seconds.

## Business papers, reports and the application form
- **Papers:** each stay, restaurant, shop and transport provider has a checklist of required papers (BIR registration, business registration, mayor's permit, plus sanitary / fire safety / franchise where relevant). Owners and providers upload PDFs or photos from their dashboard; the admin can also add them in the Add/Edit drawer. Papers uploaded by owners wait for the admin to verify them. A business owner's listing can only be approved when every required paper is verified. Tourists see the checklist (and, if allowed, the file) on the business page and a "Papers complete" badge on cards. The required lists are in `REQUIRED` in `client/src/lib/backend.js`; change them to match the tourism office's rules.
- **Reports:** Admin > Reports > Registered businesses report (filter by type, status, papers) downloads CSV (Excel) or PDF.
- **Application form:** `client/public/forms/Rabas-Kita-Business-Application-Form.pdf` (fillable) and `.docx`, linked on the public `/join` page, in the footer, and in the admin Reports tab.
- Privacy: documents can contain private details; the admin can hide a file from tourists (the checklist still shows).

## QR scanning
`/scan` opens the phone or laptop camera (needs https or localhost and camera permission) and reads the QR code of a place, then checks the visitor in. Fallbacks: upload a photo of the QR, or type the code. Print the codes from Admin > QR codes > "Print QR sheet" and stick one at each place. A QR scanned with the phone's own camera app also works: it opens `/checkin/<code>`.
