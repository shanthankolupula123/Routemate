-- ==============================================================================
-- Routemate - Supabase Database Schema
-- Tables: profiles, rides, bookings
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/hjieeizfbvubkhmlmdg/sql
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  role text,
  rating numeric(3,2) default 4.90,
  total_rides integer default 0,
  phone text,
  avatar_url text,
  is_verified boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. RIDES TABLE
create table if not exists public.rides (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid references public.profiles(id) on delete set null,
  driver_name text not null,
  driver_role text default 'Commuter',
  rating numeric(3,2) default 4.90,
  avatar text,
  vehicle_type text not null check (vehicle_type in ('bike', 'car')),
  vehicle_name text not null,
  vehicle_number text not null,
  pickup text not null,
  drop_location text not null,
  departure_time text not null,
  seats_available integer not null default 1,
  per_seat_price numeric(10,2) not null,
  payment_preference text not null default 'both' check (payment_preference in ('upi', 'cash', 'both')),
  verified boolean default true,
  helmet_provided boolean default false,
  ac boolean default false,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. BOOKINGS TABLE
create table if not exists public.bookings (
  id uuid primary key default uuid_generate_v4(),
  ride_id uuid references public.rides(id) on delete cascade,
  rider_name text not null,
  rider_phone text,
  seats_booked integer not null default 1,
  total_fare numeric(10,2) not null,
  payment_method text not null default 'upi' check (payment_method in ('upi', 'cash')),
  status text not null default 'confirmed' check (status in ('confirmed', 'completed', 'cancelled')),
  booking_pin text default '4821',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- Enables public read/write for peer-to-peer frontend operations
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.rides enable row level security;
alter table public.bookings enable row level security;

-- Profiles policies
create policy "Allow public read access to profiles" on public.profiles for select using (true);
create policy "Allow public insert to profiles" on public.profiles for insert with check (true);
create policy "Allow public update to profiles" on public.profiles for update using (true);

-- Rides policies
create policy "Allow public read access to active rides" on public.rides for select using (true);
create policy "Allow public insert to rides" on public.rides for insert with check (true);
create policy "Allow public update to rides" on public.rides for update using (true);

-- Bookings policies
create policy "Allow public read access to bookings" on public.bookings for select using (true);
create policy "Allow public insert to bookings" on public.bookings for insert with check (true);
create policy "Allow public update to bookings" on public.bookings for update using (true);

-- ==============================================================================
-- Seed Initial Highway Corridor Rides
-- ==============================================================================

insert into public.rides (
  driver_name, driver_role, rating, avatar, vehicle_type, vehicle_name, 
  vehicle_number, pickup, drop_location, departure_time, seats_available, 
  per_seat_price, payment_preference, verified, helmet_provided, ac, notes
) values 
(
  'Ramesh Kumar', 'TCS Infopark Commuter', 4.90,
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
  'bike', 'Bajaj Pulsar 150', 'TS 08 EK 4321', 'Uppal Ring Road Metro', 'Jangaon Railway Station',
  'Today, 06:30 PM', 1, 108.00, 'upi', true, true, false,
  'Leaving right on time from Uppal Metro. Regular daily commuter.'
),
(
  'Priya Sharma', 'Bank Officer (SBI)', 4.80,
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
  'car', 'Maruti Suzuki Swift VXi (AC)', 'TS 09 FH 9182', 'Uppal X Roads', 'Jangaon Court Chowrasta',
  'Today, 07:15 PM', 3, 185.00, 'both', true, false, true,
  'Comfortable AC car ride with boot space for 2 bags. No smoking.'
),
(
  'Vikram Reddy', 'Cognizant Analyst', 4.95,
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
  'bike', 'Royal Enfield Classic 350', 'TS 08 AA 1109', 'Uppal Bus Stand', 'Jangaon Bus Depot',
  'Today, 06:45 PM', 1, 115.00, 'both', true, true, false,
  'Comfortable pillion seat. Extra helmet available.'
);
