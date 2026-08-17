-- Migration: Add reference_id to activities table
-- This allows activities to reference related records (e.g., meal_id for meal activities)
-- Run this in Supabase SQL Editor if you have an existing database.

ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS reference_id uuid;

COMMENT ON COLUMN public.activities.reference_id IS 'Optional reference to related record (e.g., meal_id for meal activities)';
