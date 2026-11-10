-- ============================================================
-- FireOrder — Supabase setup
-- Run this once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Orders table
create table if not exists orders (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  address text not null,
  notes text,
  payment_method text not null,
  screenshot_url text,
  status text not null default 'new' check (status in ('new', 'confirmed', 'delivered'))
);

-- 2. Turn on Row Level Security (RLS) — without policies below, ALL access is blocked by default
alter table orders enable row level security;

-- 3. Customers (anonymous visitors) can only INSERT new orders — never read, edit, or delete others' orders
create policy "Anyone can submit an order"
  on orders for insert
  to anon
  with check (true);

-- 4. Only signed-in admins (you) can view, update, or delete orders
create policy "Admins can view orders"
  on orders for select
  to authenticated
  using (true);

create policy "Admins can update orders"
  on orders for update
  to authenticated
  using (true);

create policy "Admins can delete orders"
  on orders for delete
  to authenticated
  using (true);

-- 5. Realtime updates (so the dashboard refreshes the moment a new order comes in)
alter publication supabase_realtime add table orders;

-- ============================================================
-- Storage: create the "screenshots" bucket separately in
-- Dashboard → Storage → New bucket → name it "screenshots" → toggle Public ON.
-- Then run the two policies below (SQL Editor) so anonymous customers
-- can upload but not browse/delete each other's files.
-- ============================================================

create policy "Anyone can upload a screenshot"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'screenshots');

create policy "Public can view screenshots"
  on storage.objects for select
  to public
  using (bucket_id = 'screenshots');

-- ============================================================
-- Payment handles (editable in Admin → Payments)
-- Safe to re-run.
-- ============================================================
create table if not exists payment_handles (
  id         bigint generated always as identity primary key,
  method     text not null check (method in ('cashapp','applepay','paypal','zelle')),
  handle     text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table payment_handles enable row level security;

drop policy if exists "Public can read active payment handles" on payment_handles;
create policy "Public can read active payment handles"
  on payment_handles for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Admins manage payment handles" on payment_handles;
create policy "Admins manage payment handles"
  on payment_handles for all
  to authenticated
  using (true) with check (true);

-- Seed with the handles that were in orders.json (only if the table is empty)
insert into payment_handles (method, handle)
select * from (values
  ('cashapp','$3raqu1a'),
  ('cashapp','$KasimeBernardJr'),
  ('applepay','(404) 543-5509'),
  ('paypal','paypal.me/a5sxe'),
  ('zelle','(678) 923-4967')
) as v(method, handle)
where not exists (select 1 from payment_handles);
