-- Storage bucket for receipt images
-- Apply after 001_grocery_spend_schema.sql

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own household folder
CREATE POLICY "upload_receipt_images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'receipts'
    AND auth.uid() IS NOT NULL
  );

-- Allow users to read their own household's images
CREATE POLICY "read_receipt_images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'receipts'
    AND auth.uid() IS NOT NULL
  );

-- Allow users to delete their own household's images
CREATE POLICY "delete_receipt_images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'receipts'
    AND auth.uid() IS NOT NULL
  );
