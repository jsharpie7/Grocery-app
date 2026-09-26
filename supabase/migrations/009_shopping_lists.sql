-- Household picture lists. Apply this migration once in the Supabase project.
CREATE TABLE IF NOT EXISTS shopping_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  store_name text NOT NULL,
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  checked boolean NOT NULL DEFAULT false,
  photo_path text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY shopping_list_access ON shopping_list_items FOR ALL TO authenticated
  USING (household_id = current_household_id())
  WITH CHECK (household_id = current_household_id());
INSERT INTO storage.buckets (id,name,public) VALUES ('shopping-product-photos','shopping-product-photos',false)
  ON CONFLICT (id) DO NOTHING;
CREATE POLICY shopping_photos_access ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'shopping-product-photos' AND (storage.foldername(name))[1] = current_household_id()::text)
  WITH CHECK (bucket_id = 'shopping-product-photos' AND (storage.foldername(name))[1] = current_household_id()::text);
ALTER PUBLICATION supabase_realtime ADD TABLE shopping_list_items;
