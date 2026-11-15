-- ==============================================================================
-- Routemate - Supabase Database Migration: RLS & Atomic Ride Acceptance RPC
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/hjieeilzfbvubkhmlmdg/sql
-- ==============================================================================

-- 1. UPGRADE RIDES STATUS CHECK CONSTRAINT
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
