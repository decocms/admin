-- Migration: Finalize customer table migration from workspace to org_id
-- This migration completes the transition by:
-- 1. Making org_id NOT NULL (data migration should be complete)
-- 2. Removing the deprecated workspace column and related constraints

-- Step 1: Make org_id NOT NULL
-- Assumes all customer records have been migrated to have org_id populated
ALTER TABLE public.deco_chat_customer 
  ALTER COLUMN org_id SET NOT NULL;

-- Step 2: Drop the partial unique index on workspace (no longer needed)
DROP INDEX IF EXISTS deco_chat_customer_workspace_key;

-- Step 3: Drop the workspace column index
DROP INDEX IF EXISTS idx_deco_chat_customer_workspace;

-- Step 4: Drop the workspace column
ALTER TABLE public.deco_chat_customer 
  DROP COLUMN workspace;

-- Step 5: Update the partial unique index on org_id to a full unique constraint
-- First drop the partial index
DROP INDEX IF EXISTS deco_chat_customer_org_id_key;

-- Then create a full unique constraint since org_id is now NOT NULL
ALTER TABLE public.deco_chat_customer 
  ADD CONSTRAINT deco_chat_customer_org_id_key UNIQUE (org_id);

-- Note: The foreign key constraint deco_chat_customer_org_id_fkey should already exist
-- from migration 20250919162917_project-hard-refs.sql

