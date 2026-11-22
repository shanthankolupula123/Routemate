-- ==============================================================================
-- Routemate - Supabase Database Schema
-- Tables: profiles, rides, bookings
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/hjieeilzfbvubkhmlmdg/sql
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
  email text,
  avatar_url text,
  is_verified boolean default true,
  is_kyc_verified boolean default false,
  aadhaar_number text,
  dl_number text,
  kyc_verified_at timestamp with time zone,
  mpin text,
  kyc_status text default 'unverified',
  aadhaar_card_photo text,
  dl_expiry text,
  dl_photo text,
  rc_number text,
  rc_vehicle_name text,
  rc_photo text,
  kyc_submitted_at timestamp with time zone,
  kyc_reviewed_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Idempotent Migration for Existing Databases:
alter table public.profiles add column if not exists email text;
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_phone on public.profiles(phone);
alter table public.profiles add column if not exists is_kyc_verified boolean default false;
alter table public.profiles add column if not exists aadhaar_number text;
alter table public.profiles add column if not exists dl_number text;
alter table public.profiles add column if not exists kyc_verified_at timestamp with time zone;
alter table public.profiles add column if not exists mpin text;
alter table public.profiles add column if not exists kyc_status text default 'unverified';
alter table public.profiles add column if not exists aadhaar_card_photo text;
alter table public.profiles add column if not exists dl_expiry text;
alter table public.profiles add column if not exists dl_photo text;
alter table public.profiles add column if not exists rc_number text;
alter table public.profiles add column if not exists rc_vehicle_name text;
alter table public.profiles add column if not exists rc_photo text;
alter table public.profiles add column if not exists kyc_submitted_at timestamp with time zone;
alter table public.profiles add column if not exists kyc_reviewed_at timestamp with time zone;
alter table public.profiles add column if not exists rejection_reason text;

-- 2. RIDES TABLE
create table if not exists public.rides (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid references public.profiles(id) on delete set null,
  driver_name text not null,
  driver_role text default 'Commuter',
  rating numeric(3,2) default 4.90,
  avatar text,
  vehicle_type text not null check (vehicle_type in ('bike', 'car', 'auto')),
  vehicle_name text not null,
  vehicle_number text not null,
  pickup text not null,
  drop_location text not null,
  departure_time text not null,
  seats_available integer not null default 1,
  seats_booked integer not null default 1,
  per_seat_price numeric(10,2) not null,
  payment_preference text not null default 'both' check (payment_preference in ('upi', 'cash', 'both')),
  verified boolean default true,
  helmet_provided boolean default false,
  ac boolean default false,
  status text not null default 'active' check (status in ('active', 'searching', 'accepted', 'driver_assigned', 'driver_accepted', 'ride_started', 'completed', 'cancelled', 'expired')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Idempotent check constraint upgrade for existing tables:
do $$
begin
  alter table public.rides drop constraint if exists rides_status_check;
  alter table public.rides add constraint rides_status_check 
    check (status in ('active', 'searching', 'accepted', 'driver_assigned', 'driver_accepted', 'ride_started', 'completed', 'cancelled', 'expired'));
  alter table public.rides drop constraint if exists rides_vehicle_type_check;
  alter table public.rides add constraint rides_vehicle_type_check
    check (vehicle_type in ('bike', 'car', 'auto'));
  alter table public.rides add column if not exists seats_booked integer not null default 1;
exception when others then
  null;
end $$;

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
create policy "Allow public delete on rides" on public.rides for delete using (true);

-- Bookings policies
create policy "Allow public read access to bookings" on public.bookings for select using (true);
create policy "Allow public insert to bookings" on public.bookings for insert with check (true);
create policy "Allow public update to bookings" on public.bookings for update using (true);

-- Atomic RPC Function for Instant Ride Claims (Race condition & Lock Resolution)
create or replace function public.accept_ride_request(
  p_ride_id uuid,
  p_driver_id uuid,
  p_driver_name text,
  p_driver_phone text,
  p_driver_email text,
  p_driver_avatar text,
  p_vehicle_number text,
  p_vehicle_type text,
  p_upi_id text,
  p_upi_qr text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides%rowtype;
  v_notes jsonb;
  v_current_status text;
  v_assigned_driver text;
  v_updated_notes jsonb;
begin
  select * into v_ride from public.rides where id = p_ride_id for update;
  if not found then
    return jsonb_build_object('success', false, 'notFound', true, 'message', 'Ride request not found or expired.');
  end if;

  begin
    v_notes := coalesce(v_ride.notes::jsonb, '{}'::jsonb);
  exception when others then
    v_notes := '{}'::jsonb;
  end;

  v_current_status := coalesce(v_notes->>'status', v_ride.status, '');
  v_assigned_driver := coalesce(v_ride.driver_id::text, v_notes->>'driverId', '');

  if v_assigned_driver = p_driver_id::text or (p_driver_email is not null and v_notes->>'driverEmail' = p_driver_email) then
    return jsonb_build_object('success', true, 'alreadyAccepted', true, 'message', 'Ride already accepted by you.');
  end if;

  if (v_current_status in ('accepted', 'driver_accepted', 'driver_assigned', 'ride_started')) and v_assigned_driver <> '' and v_assigned_driver <> p_driver_id::text then
    return jsonb_build_object('success', false, 'alreadyTaken', true, 'message', 'This ride has already been accepted by another driver.');
  end if;

  if v_current_status = 'cancelled' or v_ride.status = 'cancelled' then
    return jsonb_build_object('success', false, 'cancelled', true, 'message', 'This ride was cancelled by the commuter.');
  end if;

  v_updated_notes := v_notes || jsonb_build_object(
    'isRequest', true,
    'status', 'driver_accepted',
    'driverId', p_driver_id,
    'driverName', p_driver_name,
    'driverPhone', p_driver_phone,
    'driverEmail', p_driver_email,
    'driver', jsonb_build_object(
      'id', p_driver_id,
      'name', p_driver_name,
      'phone', p_driver_phone,
      'email', p_driver_email,
      'avatar', p_driver_avatar,
      'vehicleNumber', p_vehicle_number,
      'vehicleType', p_vehicle_type,
      'upiId', p_upi_id,
      'upi_id', p_upi_id,
      'upiQr', p_upi_qr,
      'upi_qr', p_upi_qr
    ),
    'acceptedAt', now()
  );

  update public.rides
  set
    status = 'accepted',
    driver_id = p_driver_id,
    driver_name = p_driver_name,
    driver_role = 'Driver',
    notes = v_updated_notes::text
  where id = p_ride_id;

  return jsonb_build_object('success', true, 'message', 'Ride accepted successfully', 'ride_id', p_ride_id);
end;
$$;

grant execute on function public.accept_ride_request to anon, authenticated, service_role;

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

-- ==============================================================================
-- 4. RIDE_REQUESTS TABLE (Real-Time Rider-Driver Matching & Tracking)
-- ==============================================================================
create table if not exists public.ride_requests (
  id text primary key,
  rider_id text,
  rider_name text not null,
  rider_phone text,
  rider_avatar text,
  rider_role text default 'Commuter',
  rider_rating numeric(3,2) default 4.90,
  pickup text not null,
  pickup_lat numeric(10,6),
  pickup_lng numeric(10,6),
  drop_location text not null,
  drop_lat numeric(10,6),
  drop_lng numeric(10,6),
  distance_km numeric(6,2) default 84.0,
  vehicle_type text not null default 'bike' check (vehicle_type in ('bike', 'car')),
  seats integer not null default 1,
  fare numeric(10,2) not null,
  payment_method text not null default 'upi' check (payment_method in ('upi', 'cash')),
  pin text not null default '4821',
  status text not null default 'searching' check (status in ('searching', 'driver_accepted', 'ride_started', 'ride_completed', 'cancelled')),
  driver_id text,
  driver_name text,
  driver_phone text,
  driver_avatar text,
  driver_vehicle_name text,
  driver_vehicle_number text,
  accepted_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ride_requests enable row level security;
create policy "Allow public read access to ride_requests" on public.ride_requests for select using (true);
create policy "Allow public insert to ride_requests" on public.ride_requests for insert with check (true);
create policy "Allow public update to ride_requests" on public.ride_requests for update using (true);

-- ==============================================================================
-- 5. FEEDBACKS & RATINGS TABLE (Customer Reviews & Admin Moderation)
-- ==============================================================================
create table if not exists public.feedbacks (
  id text primary key,
  ride_id text,
  driver_id text,
  driver_name text not null,
  driver_phone text,
  driver_avatar text,
  driver_vehicle text,
  rider_id text,
  rider_name text not null,
  rider_phone text,
  rating numeric(2,1) not null,
  tags text[],
  safety_tags text[],
  compliments text[],
  feedback_text text,
  cleanliness_rating numeric(2,1),
  punctuality_rating numeric(2,1),
  safety_rating numeric(2,1),
  has_safety_concern boolean default false,
  is_safety_flag boolean default false,
  is_flagged boolean default false,
  flag_reason text,
  severity text default 'low',
  admin_action text,
  admin_action_at timestamp with time zone,
  admin_action_by text,
  reviewer_id text,
  reviewer_role text default 'rider',
  target_user_id text,
  target_user_role text default 'driver',
  route text,
  status text default 'published',
  submitted_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles add column if not exists total_reviews integer default 0;

alter table public.feedbacks enable row level security;
drop policy if exists "Allow public read access to feedbacks" on public.feedbacks;
create policy "Allow public read access to feedbacks" on public.feedbacks for select using (true);
drop policy if exists "Allow public insert to feedbacks" on public.feedbacks;
create policy "Allow public insert to feedbacks" on public.feedbacks for insert with check (true);
drop policy if exists "Allow public update to feedbacks" on public.feedbacks;
create policy "Allow public update to feedbacks" on public.feedbacks for update using (true);
drop policy if exists "Allow public delete on feedbacks" on public.feedbacks;
create policy "Allow public delete on feedbacks" on public.feedbacks for delete using (true);

-- Function & Trigger to dynamically recalculate average rating
create or replace function public.recalculate_user_rating()
returns trigger as $$
declare
  v_driver_id text;
  v_rider_id text;
  v_avg_rating numeric(3,2);
  v_count integer;
begin
  v_driver_id := coalesce(new.driver_id, old.driver_id);
  if v_driver_id is not null and v_driver_id != '' and v_driver_id != 'DRV-UNKNOWN' then
    select round(avg(rating)::numeric, 2), count(*)
    into v_avg_rating, v_count
    from public.feedbacks
    where driver_id = v_driver_id and rating is not null;

    begin
      update public.profiles
      set rating = coalesce(v_avg_rating, 5.00), total_reviews = coalesce(v_count, 0)
      where id::text = v_driver_id or phone = v_driver_id;
    exception when others then null;
    end;
  end if;

  v_rider_id := coalesce(new.rider_id, old.rider_id);
  if v_rider_id is not null and v_rider_id != '' then
    select round(avg(rating)::numeric, 2), count(*)
    into v_avg_rating, v_count
    from public.feedbacks
    where rider_id = v_rider_id and rating is not null;

    begin
      update public.profiles
      set rating = coalesce(v_avg_rating, 5.00), total_reviews = coalesce(v_count, 0)
      where id::text = v_rider_id or phone = v_rider_id;
    exception when others then null;
    end;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_recalculate_feedback_rating on public.feedbacks;
create trigger trg_recalculate_feedback_rating
after insert or update or delete on public.feedbacks
for each row execute function public.recalculate_user_rating();


-- ==============================================================================
-- 6. RIDE_MESSAGES TABLE (In-App Real-Time Chat via Supabase Realtime)
-- ==============================================================================
create table if not exists public.ride_messages (
  id uuid primary key default uuid_generate_v4(),
  ride_id text not null,
  sender_id text not null,
  sender_name text not null,
  sender_role text default 'rider',
  message text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_ride_messages_ride_id on public.ride_messages(ride_id);

alter table public.ride_messages enable row level security;
drop policy if exists "Allow public read access to ride_messages" on public.ride_messages;
create policy "Allow public read access to ride_messages" on public.ride_messages for select using (true);
drop policy if exists "Allow public insert to ride_messages" on public.ride_messages;
create policy "Allow public insert to ride_messages" on public.ride_messages for insert with check (true);

-- ==============================================================================
-- 7. NOTIFICATIONS TABLE (DATABASE-BACKED NOTIFICATIONS & BROADCAST ALERTS)
-- ==============================================================================
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id text,
  recipient_role text default 'all',
  type text default 'info',
  title text not null,
  message text not null,
  data jsonb default '{}'::jsonb,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_recipient_role on public.notifications(recipient_role);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "Allow public select on notifications" on public.notifications;
create policy "Allow public select on notifications" on public.notifications for select using (true);
drop policy if exists "Allow public insert on notifications" on public.notifications;
create policy "Allow public insert on notifications" on public.notifications for insert with check (true);
drop policy if exists "Allow public update on notifications" on public.notifications;
create policy "Allow public update on notifications" on public.notifications for update using (true);
drop policy if exists "Allow public delete on notifications" on public.notifications;
create policy "Allow public delete on notifications" on public.notifications for delete using (true);

-- ==============================================================================
-- 8. SCHEDULED RIDES & ADVANCE ROUTE PRE-BOOKING TABLES
-- ==============================================================================
create table if not exists public.scheduled_rides (
  id uuid primary key default uuid_generate_v4(),
  driver_id text not null,
  driver_name text not null,
  driver_phone text,
  driver_avatar text,
  driver_rating numeric default 5.0,
  driver_upi text,
  vehicle_type text not null default 'bike',
  vehicle_name text,
  vehicle_number text,
  pickup text not null,
  drop_location text not null,
  pickup_lat double precision,
  pickup_lng double precision,
  drop_lat double precision,
  drop_lng double precision,
  distance_km numeric default 0,
  scheduled_datetime timestamp with time zone not null,
  departure_date text not null,
  departure_time text not null,
  total_seats integer not null default 1,
  available_seats integer not null default 1,
  per_seat_fare numeric not null default 0,
  status text not null default 'published', -- 'published', 'active', 'completed', 'cancelled'
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_scheduled_rides_driver_id on public.scheduled_rides(driver_id);
create index if not exists idx_scheduled_rides_status on public.scheduled_rides(status);
create index if not exists idx_scheduled_rides_datetime on public.scheduled_rides(scheduled_datetime);

alter table public.scheduled_rides enable row level security;
drop policy if exists "Allow public select on scheduled_rides" on public.scheduled_rides;
create policy "Allow public select on scheduled_rides" on public.scheduled_rides for select using (true);
drop policy if exists "Allow public insert on scheduled_rides" on public.scheduled_rides;
create policy "Allow public insert on scheduled_rides" on public.scheduled_rides for insert with check (true);
drop policy if exists "Allow public update on scheduled_rides" on public.scheduled_rides;
create policy "Allow public update on scheduled_rides" on public.scheduled_rides for update using (true);
drop policy if exists "Allow public delete on scheduled_rides" on public.scheduled_rides;
create policy "Allow public delete on scheduled_rides" on public.scheduled_rides for delete using (true);

-- BOOKINGS FOR SCHEDULED RIDES
create table if not exists public.scheduled_ride_bookings (
  id uuid primary key default uuid_generate_v4(),
  scheduled_ride_id uuid not null,
  commuter_id text not null,
  commuter_name text not null,
  commuter_phone text,
  commuter_avatar text,
  seats_booked integer not null default 1,
  total_fare numeric not null default 0,
  pickup text,
  drop_location text,
  status text not null default 'confirmed', -- 'confirmed', 'cancelled', 'completed'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_scheduled_bookings_ride_id on public.scheduled_ride_bookings(scheduled_ride_id);
create index if not exists idx_scheduled_bookings_commuter_id on public.scheduled_ride_bookings(commuter_id);

alter table public.scheduled_ride_bookings enable row level security;
drop policy if exists "Allow public select on scheduled_ride_bookings" on public.scheduled_ride_bookings;
create policy "Allow public select on scheduled_ride_bookings" on public.scheduled_ride_bookings for select using (true);
drop policy if exists "Allow public insert on scheduled_ride_bookings" on public.scheduled_ride_bookings;
create policy "Allow public insert on scheduled_ride_bookings" on public.scheduled_ride_bookings for insert with check (true);
drop policy if exists "Allow public update on scheduled_ride_bookings" on public.scheduled_ride_bookings;
create policy "Allow public update on scheduled_ride_bookings" on public.scheduled_ride_bookings for update using (true);
drop policy if exists "Allow public delete on scheduled_ride_bookings" on public.scheduled_ride_bookings;
create policy "Allow public delete on scheduled_ride_bookings" on public.scheduled_ride_bookings for delete using (true);

-- ATOMIC RPC FUNCTION TO PRE-BOOK SEATS
create or replace function public.book_scheduled_ride_seats(
  p_ride_id uuid,
  p_commuter_id text,
  p_commuter_name text,
  p_commuter_phone text,
  p_commuter_avatar text,
  p_seats_booked integer,
  p_total_fare numeric
)
returns json
language plpgsql
security definer
as $$
declare
  v_ride record;
  v_booking_id uuid;
begin
  select * into v_ride
  from public.scheduled_rides
  where id = p_ride_id
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'Scheduled ride not found.');
  end if;

  if v_ride.status != 'published' then
    return json_build_object('success', false, 'error', 'This scheduled ride is no longer open for booking.');
  end if;

  if v_ride.available_seats < p_seats_booked then
    return json_build_object('success', false, 'error', 'Not enough available seats left on this trip.');
  end if;

  update public.scheduled_rides
  set available_seats = available_seats - p_seats_booked
  where id = p_ride_id;

  insert into public.scheduled_ride_bookings (
    scheduled_ride_id,
    commuter_id,
    commuter_name,
    commuter_phone,
    commuter_avatar,
    seats_booked,
    total_fare,
    pickup,
    drop_location,
    status
  ) values (
    p_ride_id,
    p_commuter_id,
    p_commuter_name,
    p_commuter_phone,
    p_commuter_avatar,
    p_seats_booked,
    p_total_fare,
    v_ride.pickup,
    v_ride.drop_location,
    'confirmed'
  )
  returning id into v_booking_id;

  return json_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'remaining_seats', v_ride.available_seats - p_seats_booked
  );
end;
$$;

grant execute on function public.book_scheduled_ride_seats to anon, authenticated, service_role;





