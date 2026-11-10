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
