# Paul Eats — Supabase + free hosting setup

Follow these in order. Total cost: **$0** on Supabase's free tier and any of the free static hosts below, as long as your order volume stays modest (free tier covers 500MB database + 1GB file storage + 50k monthly active users — plenty for a small business).

## 1. Create your Supabase project
1. Go to [supabase.com](https://supabase.com) → sign up → **New project**.
2. Pick a name, set a database password (save it somewhere — you won't need it day-to-day, but you'll want it if you ever need direct DB access), pick the region closest to your customers.
3. Wait ~2 minutes for it to provision.

## 2. Run the database schema
1. In your project, open **SQL Editor** (left sidebar) → **New query**.
2. Paste in everything from `schema.sql` (included in this project) and click **Run**.
3. This creates the `orders` table and locks it down with Row Level Security: customers can only *submit* orders, only signed-in admins can *view/edit/delete* them.

## 3. Create the screenshots storage bucket
1. Go to **Storage** (left sidebar) → **New bucket**.
2. Name it exactly `screenshots`, toggle **Public bucket** ON, click **Create bucket**.
3. Back in **SQL Editor**, the two storage policies at the bottom of `schema.sql` should already be applied if you ran the whole file — if you ran it before creating the bucket, re-run just those two `create policy` statements now.

## 4. Create your admin login
1. Go to **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter the email and password you want to log into the dashboard with. Check "Auto Confirm User" so you don't need to click an email link.
3. That's it — this is the account you'll use on the `login.html` page.

## 5. Connect the site to your project
1. In Supabase, go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. Open `config.js` in this project and paste them in:
   ```js
   const SUPABASE_URL = "https://your-project-ref.supabase.co";
   const SUPABASE_ANON_KEY = "your-anon-public-key";
   ```
4. Open `orders.json` and update `paymentHandles` with your real Cash App/Zelle/PayPal/Apple Pay info.

## 6. Test it locally
Because the pages now fetch real files (`config.js`, `orders.json`) and call Supabase, opening `index.html` by double-clicking it may hit browser file:// restrictions. Easiest fix — run a tiny local server from inside the project folder:
```bash
python3 -m http.server 8000
```
Then visit `http://localhost:8000` in your browser. Place a test order, then log into `http://localhost:8000/login.html` with the admin account from step 4 and confirm it shows up.

## 7. Deploy for free
Pick one:

**Netlify (easiest)**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag the whole project folder onto the page. Done — you get a live URL immediately.
3. Optional: claim a free `yourname.netlify.app` subdomain, or connect your own domain later (also free, you just pay for the domain itself if you don't already own one).

**Cloudflare Pages**
1. Go to [pages.cloudflare.com](https://pages.cloudflare.com) → connect a GitHub repo with these files (or drag-and-drop, similar to Netlify).
2. Deploy — also free, with generous bandwidth.

**GitHub Pages**
1. Push this folder to a GitHub repo.
2. Repo → **Settings → Pages** → set source to your main branch.
3. Free, slightly more setup than the other two.

## 9. New features: chat, menu, today's restaurants
The schema.sql file now also creates `featured_restaurants`, `menu_items`, and `chat_messages` tables. If you already ran schema.sql once before, just re-run the whole file again — every statement uses `if not exists` / `on conflict` / safe patterns so it won't break your existing orders data, it'll just add the new tables and policies.

**Today's Restaurants tab (admin):** just 3 name fields — whatever you type shows up as chips on the homepage instantly.

**Menu tab (admin):** add/hide/delete shared menu items (name, category, price, description). This is one flat list, not tied to any specific restaurant — customers browse it on `menu.html`.

**Chat:** every visitor gets a floating chat bubble (bottom-right) backed by `faq.json` — it answers common questions instantly, and every message (customer + bot) is also saved so you can see and reply to any conversation live from the admin Chat tab. Edit `faq.json` to change what the bot knows.

**Note on chat privacy:** conversations are identified by a random ID stored in the customer's browser, not a real login — practically private, but not true per-user security. Don't rely on it for anything sensitive.

## 11. Homepage: Recent Orders (now pulled from Telegram)

The "Recent orders 🔥" section on the homepage pulls its photos and captions directly from your **public Telegram channel**, via a Supabase Edge Function — not from customer-submitted screenshots anymore. This needs the same Edge Function setup either way, so follow **Option A** below regardless.

(The `public_recent_orders()` database function from `schema.sql` is still there and harmless to leave — it's just not used by the homepage anymore. If you ever want to switch back to showing real customer order screenshots instead of Telegram posts, it's ready to go — just ask.)

This is a step up in complexity from the rest of the site — it needs a real server-side piece (a Supabase **Edge Function**), because browsers can't fetch Telegram's pages directly (CORS blocks it).

**You'll need the Supabase CLI installed** (this part can't be done through drag-and-drop, unlike the rest of the site):
```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref   # find this in your Supabase project URL
```

**Option A: Telegram (what powers Recent Orders)**

Works with any *public* Telegram channel — no bot, no login, no API key.

1. Deploy the function:
   ```bash
   supabase functions deploy telegram-feed --no-verify-jwt
   ```
2. Set your channel's username as a secret (the part after `t.me/` in your channel's link):
   ```bash
   supabase secrets set TELEGRAM_CHANNEL=your_channel_username
   ```
3. Redeploy your site files to Netlify — no `config.js` change needed for this one anymore, the homepage calls `telegram-feed` directly.

**Heads up:** this works by reading Telegram's public web preview page, since Telegram's official Bot API doesn't let a bot fetch a channel's post history. It's a common technique but unofficial — if Telegram changes that page's layout, photos might stop showing up until the function's parsing logic is updated. Nothing breaks elsewhere on your site if that happens — the section just shows a friendly "couldn't load" message.

Until you deploy this function, the Recent Orders section will show a message pointing back to this setup step — everything else on the site works fine either way.

---

**Option B: Instagram (available if you want a *separate* gallery later)**

The `instagram-feed` function from before is still in the project and untouched, in case you want to add a second, Instagram-specific gallery section somewhere on the site down the line. It's not wired into the homepage right now. Just ask if you want it added back in.

## 13. Order tracking
Customers can look up their own order at `track.html` using their order number + the phone number they gave when ordering (the phone acts as a lightweight check so people can't just guess order numbers to see others' status). This just needs the updated `schema.sql` re-run — it adds a `tracking_url` column and a `public_track_order()` function that only exposes status/tracking link/date, never name or address.

**To add a tracking link to an order:** open it in the admin **Orders** tab, paste the link into the new "Tracking link" field, and hit save. It shows up for the customer immediately — no separate step needed to "publish" it.

## 15. Store open/closed toggle
New admin tab: **Store Status**. Flip the checkbox off and add a reason ("Stepped out for lunch, back at 2pm!") and hit save — the homepage instantly shows that message instead of letting people submit new orders. Flip it back on when you're back. Needs the updated `schema.sql` re-run (adds a `store_status` table).

## 16. Multiple payment handles + payment screenshots
**Multiple accounts per method:** open `orders.json` — any payment method can now be either a single string or a list:
```json
"cashapp": ["$YourCashApp1", "$YourCashApp2"],
"applepay": "(551) 555-0134",
"paypal": "paypal.me/yourhandle",
"zelle": "you@yourzelle.com"
```
**Fill in your real handles here** — the placeholders won't mean anything to customers. If a method is a list, one is picked at random per order, and *which one* gets saved with that order so you can match it up later (visible in the admin Orders tab when you open an order).

**Payment note:** the confirmation screen now tells customers to put their order number in the payment note/memo — this is the only way to match a payment to an order manually, since Cash App/Apple Pay/Zelle/PayPal don't offer a way for a website to detect an incoming payment automatically without a business banking API integration (a much bigger project). This screenshot approach is the practical middle ground.

**Payment screenshot:** after placing an order, customers can optionally upload a screenshot of the payment itself. It attaches to that exact order (verified by order number + phone, so no one else can attach to someone else's order) and shows up right in the order detail in your Orders tab, next to their order screenshot — so you can visually confirm payment before marking an order Confirmed. Needs the updated `schema.sql` re-run (adds `payment_handle` and `payment_screenshot_url` columns, plus a safe attach function).

## 17. Deals (price checker)
New admin tab: **Deals**. Add a title, price, and optional description (e.g. "Zaxby's Large Meal + Dessert — $10, includes a drink"). Customers browse these at `deals.html` (linked from the homepage) so they know what to screenshot and expect to pay before ordering. This is a straightforward priced list, not a build-your-own combo calculator — if you want customers to pick items and see a live total instead, that's a bigger feature, just ask. Needs the updated `schema.sql` re-run (adds a `deals` table).

## 19. New homepage: splash screen + one-page scroll hub
`index.html` is now a single scrollable page instead of a plain order form: it opens with a "Paul Eats" splash screen (tap Continue to enter), then five full-screen sections you scroll or swipe through in order — **Place Order → Track Order → Deals → Menu → Admin**. The top nav bar (and a small dot rail on mobile) jumps straight to any section and highlights which one you're currently on. `track.html`, `deals.html`, and `menu.html` still exist and work fine as standalone pages too (e.g. for direct links) — the homepage just also includes that same functionality inline so people never have to leave the page.

## 20. Deals now tell customers exactly what to pay
The order form has a new step: "Is this one of today's deals?" — a dropdown of whatever's active in the admin Deals tab. Picking one locks in that exact price, and the confirmation screen shows a large, unmissable **"Total to send: $X"** instead of just a payment handle with no amount. Picking "Not a deal" keeps the old behavior (customer states their own total when they pay). Needs the updated `schema.sql` re-run — adds `deal_id` and `amount` columns to `orders`, plus a new version of `create_order()` that accepts them.

## 21. Fixed: payment screenshots silently failing to attach
Found the real cause — the "attach payment screenshot" step only worked if the browser tab stayed open in memory the whole time. In practice, a lot of customers would place the order, switch over to their Cash App/Zelle app to actually send the money, then come back to the browser — and on many phones, switching apps can cause the tab to reload or lose its in-memory state, silently breaking the attach button with no visible error. Order details now get saved to the browser's local storage the moment the order is placed, and restored automatically if the page reloads, so switching apps to pay no longer breaks anything. A "Start a new order instead" link is available if someone wants to clear that and place a different order.

## 22. Ongoing costs to watch (updated)
Everything above is free at small scale. You'd only start paying if:
- Your Supabase project exceeds the free tier's database/storage/bandwidth limits (Supabase will email you before this happens).
- You want a custom domain (e.g. `pauleats.com`) — the domain itself typically costs $10–15/year; the hosting stays free.

## Notes on this being a "real" backend
- Orders now live in Supabase's Postgres database, not the browser — so a customer ordering from their phone shows up instantly on your laptop's dashboard (thanks to the realtime subscription in `admin.js`).
- Admin login is real Supabase Auth now (email + password checked server-side), not the client-side password hash from before — this is actually secure.
- Row Level Security policies are what keep customers from reading or editing each other's orders, and keep the orders table private from the public internet — don't remove them.
