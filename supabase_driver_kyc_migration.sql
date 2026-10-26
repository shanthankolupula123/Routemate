-- =========================================================================
-- ROUTEMATE - PRODUCTION DRIVER KYC DATABASE SCHEMA
-- Run this in your Supabase Dashboard -> SQL Editor
-- =========================================================================

-- 1. Create driver_kyc table
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
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    rejection_reason TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_driver_kyc_user_id ON public.driver_kyc (user_id);
CREATE INDEX IF NOT EXISTS idx_driver_kyc_status ON public.driver_kyc (status);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.driver_kyc ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Allow anyone with API key to read, submit, and update
DROP POLICY IF EXISTS "Allow read access to driver_kyc" ON public.driver_kyc;
CREATE POLICY "Allow read access to driver_kyc" ON public.driver_kyc FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert access to driver_kyc" ON public.driver_kyc;
CREATE POLICY "Allow insert access to driver_kyc" ON public.driver_kyc FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update access to driver_kyc" ON public.driver_kyc;
CREATE POLICY "Allow update access to driver_kyc" ON public.driver_kyc FOR UPDATE USING (true);
