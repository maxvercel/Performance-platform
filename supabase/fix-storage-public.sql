-- Fix: ensure progress-photos bucket is PUBLIC
UPDATE storage.buckets SET public = true WHERE id = 'progress-photos';

-- If bucket doesn't exist yet, create it
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;
