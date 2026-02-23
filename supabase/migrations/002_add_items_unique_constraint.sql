-- Items are unique per household by name.
-- Required for ON CONFLICT upserts to work correctly in the import flow.
ALTER TABLE items
  ADD CONSTRAINT items_household_name_unique UNIQUE (household_id, name);
