# Catanduanes Tourism Platform: Prototype

This build runs **entirely in the browser**: no server, no database, no setup. Sample data and your changes are stored in localStorage (use "Reset demo" in the top banner to start over). Listings are SAMPLE data, payments are simulated.

## Run on localhost
```
cd client
npm install
npm run dev        # open http://localhost:5173
```
Sign-in page has one-tap demo logins: Tourist, Business owner, Transport provider, Admin (password for all: `demo1234`).

## Stay booking protection

Stay bookings follow one policy, written once in `client/src/lib/policy.js` and used by both the pages and the backend. Deadlines are in hotel local time (Philippine time) and every amount is the final price including taxes and mandatory fees, so owners must enter all-in room rates.

| Booked | At booking | Cancelling | No-show |
|---|---|---|---|
| 72 hours or more before check-in | Valid card on file, nothing charged | Free until 72 hours before check-in. Reminder at 96 hours. Not guaranteed by the deadline: released automatically | 50% charged to the card |
| 48 to 72 hours before | 50% charged | Non-refundable | Deposit forfeited, nothing more |
| Under 48 hours (same day included) | 100% charged | Non-refundable | Full amount forfeited |

How it works:
- A booking is a **request** until the hotel accepts it. The guest withdrawing before that, the hotel declining or cancelling, or the hotel never replying before check-in all refund everything charged.
- After the free-cancellation deadline, cancelling a card-guaranteed booking charges 50% (`POLICY.lateFeeRate`). A hotel can mark a no-show only after 18:00 on the check-in day.
- The server quotes the terms (`GET /bookings/quote`) and rejects a booking if the terms changed since the guest saw them.
- Card numbers and security codes never leave the browser. Only a token, brand, last 4 digits and expiry are sent. Sandbox cards are listed in `client/src/lib/card.js`. Replace `tokenize` and the charge/refund helpers in `backend.js` with a real gateway (PayMongo, Xendit, Stripe) before taking real money.
- There is no clock in the browser or in a serverless function, so reminders, automatic release and expiry run at the start of every request. State is always correct when anyone looks. For on-time alerts, add a Netlify scheduled function that calls the API hourly.
- Messages: on every stay, table, ride and rental request, the guest and the business can message each other, and either can write first. Messages go to the business owner's account (there are no separate staff roles). Each side gets an alert and an unread badge. Limits: 1,000 characters per message, 5 in a row without a reply, 200 per conversation. Endpoints: `GET/POST /messages/:kind/:id` and `POST /messages/:kind/:id/read`.
- Availability: owners of places to stay get an **Availability** tab with tonight's free rooms, a calendar per room type (who is in the room each night), and a tool to close dates for walk-ins, repairs or rooms sold elsewhere. Tourists see a calendar on the stay page with fully booked dates crossed out, "N left" on partly booked dates, and the list of rooms available for the dates they choose. Availability is counted night by night (check-in night counts, check-out night does not). Endpoints: `GET /accommodations/:id/calendar` (public), `GET /owner/business/:id/availability`, `POST /owner/business/:id/blocks`, `DELETE /owner/blocks/:id`. Online stays are limited to 60 nights.
- A pending request is declined and refunded automatically only after the guest was due to arrive and the hotel has had at least 6 hours (`POLICY.replyWindowHours`) to answer.
- Two people at the same moment: on the shared (Netlify) backend every save is conditional. A request only saves if nobody else saved since it read the data. If someone did, it is run again from the fresh data, so when two guests book the last room, one gets it and the other is told it was just taken. Nothing is silently overwritten. Emails and photo deletions wait until the save went through, so a repeated request never sends twice. After 8 attempts the guest gets a "system is busy, try again" message (HTTP 503). Booking dialogs also send a one-time `requestId`, so a double tap or a retry after a dropped connection returns the same booking instead of making and charging a second one. This needs `@netlify/blobs` 10.x or newer (conditional writes). The whole site is still one stored document, which is fine for a demo and a small pilot. For real traffic, move to a database that can lock a row or enforce a rule such as "no overlapping stays per room unit". The Express/Postgres server in `server/` does not have these protections.
- Native delicacies (Eat): home-based food stops where everything is made to order. The admin adds them in the **Native delicacies** tab (or the quick action on Overview) with basic information only: name, municipality, photos, description, address, phone, hours, the delicacies they make with prices, how much notice they need and how to order. No business papers are asked for, they are approved at once, and they never count as "papers missing" in reports (`REQUIRED.native` is empty, status `not_required`). They are stored as restaurants with `type: 'native'`, so menus, photos, reviews and check-in QR codes work, but they cannot take table reservations. The Eat page has a Restaurants / Native delicacies switch (`GET /restaurants?type=native|restaurant`). They belong to the admin account, so they never appear in a business owner's dashboard. Business owners cannot add them yet.
- Municipality filter: Eat, Stays and Shops have the same municipality chips as Explore, each showing how many places that municipality has. The choice is kept in the page address (`?municipality=Virac`).
- Ride and rental requests now alert the provider, and the provider's answer alerts the guest. The deposit and full-payment rules apply to stays only for now.

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
- Roam is now a vehicle rental catalog (with driver or self-drive, per-day price, chosen destinations, availability check, provider accept/reject, payment in My bookings). Airport and port ride requests remain under the second tab.
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

## Business owner dashboard
Sign in as a business owner and open the dashboard. It shows one business at a time (a row of buttons switches between your businesses if you have several), with these sections:
- **Overview:** reservations waiting for a reply, upcoming ones, revenue (stays), a "page is X% complete" checklist, and a preview of how the business looks in the tourist list.
- **My page:** the cover photo, the photo album, description, hours, phone, address, map position and amenities (stays) or cuisines, price level and the online table reservation switch (restaurants). Changes show to tourists as soon as they are saved. The approved name, municipality and category are fixed because the tourism office checked them against the papers.
- **Rooms / Menu / Products:** stays manage rooms (price, sleeps, units; units set to 0 pauses a room, and a room that has booking history cannot be deleted), restaurants manage the menu, shops list products with an optional photo that tourists see on the shop page.
- **Reservations** (stays and restaurants): accept, decline, cancel, complete or mark a no-show. The guest is told when a request is accepted, declined or cancelled. A cancelled booking the guest already paid for needs a manual refund; the app warns about this.
- **Papers:** see which required papers the tourism office has added and verified (read-only; owners cannot upload).
A new hotel or restaurant gets the right papers list and tools from the moment it is registered.
These features, like the alerts below, run in the shared Netlify / in-browser backend; the Express server in `server/` does not have them. Existing saved data keeps working: the new lists (products, alerts) are added automatically the next time data loads, and nothing already stored is changed.

## Loading screen
A ~2.5 second adventure intro (sun rising, mountains, a sailing bangka, gulls, a route drawing itself to a map pin, then the 360 Catanduanes logo bursts in with "Adventure awaits!"; made of CSS and SVG, with the logo (`client/public/logo-360.png`)) shows every time the landing page `/` is opened or reloaded. Other pages skip it. When it ends, a golden circle opens on the green "0" of the logo and zooms out (about 2 seconds) until the landing page fills the screen. It stays until the page is really ready (the app is drawn, fonts, data requests and the pictures on screen have loaded, at least 2.5 seconds, with a 20 second safety limit); bouncing dots show if it is still waiting. It is plain HTML and CSS in `client/index.html`, so it appears before the app loads and respects "reduce motion".

## Transport provider dashboard
Providers get the same layout as business owners, with tabs: **Overview** (stats, "page is X% complete" checklist, preview card), **My page** (cover photo, photo album, description, phone, hours, address), **Vehicles** (add, edit, pause, delete; each vehicle has its own cover photo and album), **Routes and fares**, **Requests** (rentals and airport/port rides) and **Papers** (read-only). The cover, album and description show on the vehicle pages tourists see. These run in the shared Netlify / in-browser backend, not the Express server.

## Alerts and email
Every signed-in person has an **Alerts** bell in the header. Owners get an alert for each new booking request, payment and cancellation, and each table reservation; guests get one when the business accepts, declines or cancels. The last 100 alerts per person are kept.
Emails are optional and only work on the shared Netlify version (a browser-only demo cannot send mail). To switch them on, add two environment variables in Netlify (Site configuration > Environment variables): `RESEND_API_KEY` (from a free Resend account) and `NOTIFY_FROM` (a sender on a domain you verified in Resend, for example `TRISIKSTI <alerts@yourdomain.com>`). Without them, alerts still appear on the site. Addresses ending in `@demo.test` never get mail. A mail failure never blocks a booking.

## Business papers, reports and the application form
- **Papers:** each stay, restaurant, shop and transport provider has a checklist of required papers (BIR registration, business registration, mayor's permit, plus sanitary / fire safety / franchise where relevant). Only the admin adds papers (PDF or photo, in the Add/Edit drawer); papers the admin adds are marked verified. Owners and providers give copies to the tourism office and can only view the checklist. A business owner's listing can only be approved when every required paper is verified. Tourists see the checklist (and, if allowed, the file) on the business page and a "Papers complete" badge on cards. The required lists are in `REQUIRED` in `client/src/lib/backend.js`; change them to match the tourism office's rules.
- **Reports:** Admin > Reports > Registered businesses report (filter by type, status, papers) downloads CSV (Excel) or PDF.
- **Application form:** a fillable PDF that is generated in the browser (`client/src/lib/applicationForm.js`) with the current site name and logos from Admin > Branding, plus a fixed Word version at `client/public/forms/TRISIKSTI-Business-Application-Form.docx`. Both are linked on the public `/join` page and in the admin Reports tab; the Word file keeps the name and logo it was made with.
- Privacy: documents can contain private details; the admin can hide a file from tourists (the checklist still shows).

## QR scanning
`/scan` opens the phone or laptop camera (needs https or localhost and camera permission) and reads the QR code of a place, then checks the visitor in. Fallbacks: upload a photo of the QR, or type the code. Print the codes from Admin > QR codes > "Print QR sheet" and stick one at each place. A QR scanned with the phone's own camera app also works: it opens `/checkin/<code>`.

## Audit log
Admin > Audit log groups actions by day (newest first). The two latest days are open and older days are collapsed; click a day to open or close it, use Expand all / Collapse all, pick a date, or search by admin or action. The latest 1000 actions are listed and the latest 2000 are kept.
