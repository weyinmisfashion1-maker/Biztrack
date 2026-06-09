-- BizTrack Supabase Database Schema
-- Run this in the Supabase SQL Editor to set up your project.

-- 1. Create Profiles Table (for Business Details)
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  business_name text,
  phone_number text,
  location text,
  bank_name text,
  account_number text,
  account_name text,
  logo text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Create Sales Table
create table sales (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null default current_date,
  customer_name text not null,
  contact text,
  address text,
  items jsonb not null default '[]'::jsonb,
  delivery_fee numeric default 0,
  discount numeric default 0,
  total numeric not null,
  status text default 'Pending',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Create Expenses Table
create table expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null default current_date,
  type text not null,
  description text,
  amount numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Create Stock Table (Inventory)
create table stock (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  category text,
  qty numeric default 0,
  unit text,
  cost_price numeric not null,
  selling_price numeric,
  added date default current_date,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- ENABLE ROW LEVEL SECURITY (IMPORTANT)
-- ==========================================

alter table profiles enable row level security;
alter table sales enable row level security;
alter table expenses enable row level security;
alter table stock enable row level security;

-- Create Security Policies (Allows users to only see/edit their own data)

-- Profiles Policies
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Sales Policies
create policy "Users can view own sales" on sales for select using (auth.uid() = user_id);
create policy "Users can insert own sales" on sales for insert with check (auth.uid() = user_id);

-- Expenses Policies
create policy "Users can view own expenses" on expenses for select using (auth.uid() = user_id);
create policy "Users can insert own expenses" on expenses for insert with check (auth.uid() = user_id);

-- Stock Policies
create policy "Users can view own stock" on stock for select using (auth.uid() = user_id);
create policy "Users can insert own stock" on stock for insert with check (auth.uid() = user_id);
