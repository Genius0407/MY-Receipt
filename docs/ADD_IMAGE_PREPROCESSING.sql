-- Add receipt image preprocessing fields for upload-time crop/rotation.
-- Safe to run multiple times in Supabase SQL Editor.

alter table public.receipts
  add column if not exists processed_file_path text;

alter table public.receipts
  add column if not exists image_processing jsonb;
