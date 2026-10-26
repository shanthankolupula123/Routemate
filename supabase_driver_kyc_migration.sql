-- =========================================================================
-- ROUTEMATE - PRODUCTION DRIVER KYC, WALLET, UPI & SAFETY DATABASE SCHEMA
-- Run this in your Supabase Dashboard -> SQL Editor
-- =========================================================================

-- 1. Create or alter driver_kyc table
CREATE TABLE IF NOT EXISTS public.driver_kyc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    driver_phone TEXT,
    driver_email TEXT,
    driver_photo TEXT,
    dl_number TEXT NOT NULL,
    dl_front_photo TEXT,
    dl_back_photo TEXT,
    aadhaar_number TEXT NOT NULL,
    aadhaar_front_photo TEXT,
    aadhaar_back_photo TEXT,
    vehicle_number TEXT NOT NULL,
    rc_photo TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'suspended'
    rejection_reason TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT
);

-- Idempotent column additions for driver_kyc
ALTER TABLE public.driver_kyc ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE public.driver_kyc ADD COLUMN IF NOT EXISTS upi_qr TEXT;
ALTER TABLE public.driver_kyc ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT 100.00;
ALTER TABLE public.driver_kyc ADD COLUMN IF NOT EXISTS welcome_bonus_credited BOOLEAN DEFAULT FALSE;
ALTER TABLE public.driver_kyc ADD COLUMN IF NOT EXISTS warning_count INTEGER DEFAULT 0;
ALTER TABLE public.driver_kyc ADD COLUMN IF NOT EXISTS vehicle_name TEXT;
ALTER TABLE public.driver_kyc ADD COLUMN IF NOT EXISTS vehicle_color TEXT;
ALTER TABLE public.driver_kyc ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'bike';

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_driver_kyc_user_id ON public.driver_kyc (user_id);
CREATE INDEX IF NOT EXISTS idx_driver_kyc_status ON public.driver_kyc (status);

-- 3. Enable Row Level Security (RLS) on driver_kyc
ALTER TABLE public.driver_kyc ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to driver_kyc" ON public.driver_kyc;
CREATE POLICY "Allow read access to driver_kyc" ON public.driver_kyc FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert access to driver_kyc" ON public.driver_kyc;
CREATE POLICY "Allow insert access to driver_kyc" ON public.driver_kyc FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update access to driver_kyc" ON public.driver_kyc;
CREATE POLICY "Allow update access to driver_kyc" ON public.driver_kyc FOR UPDATE USING (true);

-- 4. Create feedbacks table for Post-Ride Rating & Safety Feedback
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id TEXT PRIMARY KEY,
    ride_id TEXT,
    passenger_name TEXT,
    passenger_phone TEXT,
    driver_id TEXT,
    driver_name TEXT,
    rating NUMERIC(3,1) DEFAULT 5.0,
    cleanliness_rating INTEGER DEFAULT 5,
    punctuality_rating INTEGER DEFAULT 5,
    safety_rating INTEGER DEFAULT 5,
    feedback_text TEXT,
    safety_tags TEXT[],
    compliments TEXT[],
    is_safety_flag BOOLEAN DEFAULT FALSE,
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    admin_action TEXT,
    admin_action_at TIMESTAMPTZ,
    admin_action_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_driver_id ON public.feedbacks (driver_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_is_safety_flag ON public.feedbacks (is_safety_flag);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to feedbacks" ON public.feedbacks;
CREATE POLICY "Allow read access to feedbacks" ON public.feedbacks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert access to feedbacks" ON public.feedbacks;
CREATE POLICY "Allow insert access to feedbacks" ON public.feedbacks FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update access to feedbacks" ON public.feedbacks;
CREATE POLICY "Allow update access to feedbacks" ON public.feedbacks FOR UPDATE USING (true);

-- Idempotent column additions for profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS upi_qr TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT 100.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS welcome_bonus_credited BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS warning_count INTEGER DEFAULT 0;
