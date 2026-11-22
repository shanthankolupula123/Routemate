-- ==============================================================================
-- Routemate - Supabase Database Migration: RLS & Atomic Ride Acceptance RPC
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/hjieeilzfbvubkhmlmdg/sql
-- ==============================================================================

-- 1. UPGRADE RIDES STATUS & VEHICLE TYPE CHECK CONSTRAINTS & SEATS BOOKED COLUMN
-- Removes old restrictive check (status in ('active', 'completed', 'cancelled'))
-- to support full ride lifecycle: searching, accepted, driver_assigned, ride_started, completed, cancelled, expired.
DO $$
BEGIN
  ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_status_check;
  ALTER TABLE public.rides ADD CONSTRAINT rides_status_check 
    CHECK (status IN ('active', 'searching', 'accepted', 'driver_assigned', 'driver_accepted', 'ride_started', 'completed', 'cancelled', 'expired'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_vehicle_type_check;
  ALTER TABLE public.rides ADD CONSTRAINT rides_vehicle_type_check
    CHECK (vehicle_type IN ('bike', 'car', 'auto'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Add seats_booked column for multi-seat commuter bookings and capacity management
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS seats_booked integer NOT NULL DEFAULT 1;

-- 2. ROW LEVEL SECURITY (RLS) POLICIES FOR RIDES
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- Clean up any conflicting or overly restrictive existing policies on public.rides
DROP POLICY IF EXISTS "Allow public read access to active rides" ON public.rides;
DROP POLICY IF EXISTS "Allow public insert to rides" ON public.rides;
DROP POLICY IF EXISTS "Allow public update to rides" ON public.rides;
DROP POLICY IF EXISTS "Allow public select on rides" ON public.rides;
DROP POLICY IF EXISTS "Allow authenticated and anon insert on rides" ON public.rides;
DROP POLICY IF EXISTS "Allow drivers and commuters to update rides" ON public.rides;
DROP POLICY IF EXISTS "Allow delete on rides" ON public.rides;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.rides;
DROP POLICY IF EXISTS "Allow all for anon" ON public.rides;

-- Grant comprehensive peer-to-peer permissions for drivers & commuters
CREATE POLICY "Allow public select on rides"
  ON public.rides FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated and anon insert on rides"
  ON public.rides FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow drivers and commuters to update rides"
  ON public.rides FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete on rides"
  ON public.rides FOR DELETE
  USING (true);

-- 3. ATOMIC RPC FUNCTION FOR RIDE CLAIMS (RACE CONDITION & DB LOCK RESOLUTION)
-- SECURITY DEFINER ensures execution succeeds even if client session encounters policy conflicts.
CREATE OR REPLACE FUNCTION public.accept_ride_request(
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
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ride public.rides%ROWTYPE;
  v_notes jsonb;
  v_current_status text;
  v_assigned_driver text;
  v_updated_notes jsonb;
BEGIN
  -- Row-level locking to prevent race conditions among simultaneous drivers
  SELECT * INTO v_ride
  FROM public.rides
  WHERE id = p_ride_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'notFound', true, 'message', 'Ride request not found or expired.');
  END IF;

  -- Safe parse of notes json
  BEGIN
    v_notes := COALESCE(v_ride.notes::jsonb, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_notes := '{}'::jsonb;
  END;

  v_current_status := COALESCE(v_notes->>'status', v_ride.status, '');
  v_assigned_driver := COALESCE(v_ride.driver_id::text, v_notes->>'driverId', '');

  -- 1. Idempotency Check: Already assigned to this driver
  IF v_assigned_driver = p_driver_id::text OR (p_driver_email IS NOT NULL AND v_notes->>'driverEmail' = p_driver_email) THEN
    RETURN jsonb_build_object(
      'success', true, 
      'alreadyAccepted', true, 
      'message', 'Ride already accepted by you.',
      'ride_id', p_ride_id
    );
  END IF;

  -- 2. Conflict Check: Taken by another driver
  IF (v_current_status IN ('accepted', 'driver_accepted', 'driver_assigned', 'ride_started')) 
     AND v_assigned_driver <> '' 
     AND v_assigned_driver <> p_driver_id::text THEN
    RETURN jsonb_build_object('success', false, 'alreadyTaken', true, 'message', 'This ride has already been accepted by another driver.');
  END IF;

  -- 3. Cancellation Check
  IF v_current_status = 'cancelled' OR v_ride.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'cancelled', true, 'message', 'This ride was cancelled by the commuter.');
  END IF;

  -- 4. Vehicle Type Compatibility Check (Strict Mode Locking)
  -- Bike drivers must never claim Car/Auto requests; Car/Auto drivers only accept matching requests
  IF p_vehicle_type IS NOT NULL AND p_vehicle_type <> '' THEN
    IF lower(COALESCE(v_notes->>'vehicleType', v_ride.vehicle_type, '')) <> '' AND
       lower(COALESCE(v_notes->>'vehicleType', v_ride.vehicle_type, '')) <> lower(p_vehicle_type) THEN
      RETURN jsonb_build_object(
        'success', false, 
        'vehicleMismatch', true, 
        'message', 'Vehicle type mismatch: This ride requires ' || COALESCE(v_notes->>'vehicleType', v_ride.vehicle_type) || ', but your active driving vehicle is ' || p_vehicle_type || '.'
      );
    END IF;
  END IF;

  -- Build merged notes JSON payload
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

  -- Perform atomic update on rides table
  UPDATE public.rides
  SET
    status = 'accepted',
    driver_id = p_driver_id,
    driver_name = p_driver_name,
    driver_role = 'Driver',
    notes = v_updated_notes::text
  WHERE id = p_ride_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Ride accepted successfully',
    'ride_id', p_ride_id,
    'notes', v_updated_notes
  );
END;
$$;

-- Grant execution permission to public/anon/authenticated roles
GRANT EXECUTE ON FUNCTION public.accept_ride_request TO anon, authenticated, service_role;

-- ==============================================================================
-- 4. NOTIFICATIONS TABLE (DATABASE-BACKED NOTIFICATION & BROADCAST SYSTEM)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id text,
  recipient_role text DEFAULT 'all', -- 'all', 'drivers', 'commuters', 'driver', 'rider'
  type text DEFAULT 'info', -- 'warning', 'safety', 'broadcast', 'trip', 'account', 'promo', 'info', 'wallet'
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_role ON public.notifications(recipient_role);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select on notifications" ON public.notifications;
CREATE POLICY "Allow public select on notifications"
  ON public.notifications FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow public insert on notifications" ON public.notifications;
CREATE POLICY "Allow public insert on notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on notifications" ON public.notifications;
CREATE POLICY "Allow public update on notifications"
  ON public.notifications FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on notifications" ON public.notifications;
CREATE POLICY "Allow public delete on notifications"
  ON public.notifications FOR DELETE
  USING (true);

-- ==============================================================================
-- 5. DYNAMIC STAR RATING CALCULATION HOOK & SMART FEEDBACK ANALYSIS
-- ==============================================================================

-- Upgrade profiles table for dynamic ratings & reviews
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rating numeric(3,2) DEFAULT 5.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_reviews integer DEFAULT 0;

-- Upgrade feedbacks table columns for safety analysis
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS safety_rating numeric(2,1);
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS cleanliness_rating numeric(2,1);
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS punctuality_rating numeric(2,1);
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS safety_tags text[];
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS compliments text[];
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS is_safety_flag boolean DEFAULT false;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS is_flagged boolean DEFAULT false;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS flag_reason text;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS severity text DEFAULT 'low';
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS admin_action text;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS admin_action_at timestamp with time zone;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS admin_action_by text;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone DEFAULT timezone('utc'::text, now());
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS reviewer_id text;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS reviewer_role text DEFAULT 'rider';
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS target_user_id text;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS target_user_role text DEFAULT 'driver';

-- Function: Automatically recalculate average rating from historical feedbacks
CREATE OR REPLACE FUNCTION public.recalculate_user_rating()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_id text;
  v_rider_id text;
  v_avg_rating numeric(3,2);
  v_count integer;
BEGIN
  -- 1. Recalculate Driver Rating
  v_driver_id := COALESCE(NEW.driver_id, OLD.driver_id);
  IF v_driver_id IS NOT NULL AND v_driver_id != '' AND v_driver_id != 'DRV-UNKNOWN' THEN
    SELECT 
      ROUND(AVG(rating)::numeric, 2), 
      COUNT(*)
    INTO 
      v_avg_rating, 
      v_count
    FROM public.feedbacks
    WHERE driver_id = v_driver_id AND rating IS NOT NULL;

    BEGIN
      UPDATE public.profiles
      SET 
        rating = COALESCE(v_avg_rating, 5.00),
        total_reviews = COALESCE(v_count, 0)
      WHERE id::text = v_driver_id OR phone = v_driver_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- 2. Recalculate Rider / Commuter Rating (if target_user_role is rider or rider_id provided)
  v_rider_id := COALESCE(NEW.rider_id, OLD.rider_id);
  IF v_rider_id IS NOT NULL AND v_rider_id != '' THEN
    SELECT 
      ROUND(AVG(rating)::numeric, 2), 
      COUNT(*)
    INTO 
      v_avg_rating, 
      v_count
    FROM public.feedbacks
    WHERE rider_id = v_rider_id AND rating IS NOT NULL;

    BEGIN
      UPDATE public.profiles
      SET 
        rating = COALESCE(v_avg_rating, 5.00),
        total_reviews = COALESCE(v_count, 0)
      WHERE id::text = v_rider_id OR phone = v_rider_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Fire on every INSERT, UPDATE, or DELETE on public.feedbacks
DROP TRIGGER IF EXISTS trg_recalculate_feedback_rating ON public.feedbacks;
CREATE TRIGGER trg_recalculate_feedback_rating
AFTER INSERT OR UPDATE OR DELETE ON public.feedbacks
FOR EACH ROW EXECUTE FUNCTION public.recalculate_user_rating();

GRANT EXECUTE ON FUNCTION public.recalculate_user_rating TO anon, authenticated, service_role;

-- ==============================================================================
-- 8. SCHEDULED RIDES & ADVANCE ROUTE PRE-BOOKING (TABLES, RLS & ATOMIC RPC)
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



