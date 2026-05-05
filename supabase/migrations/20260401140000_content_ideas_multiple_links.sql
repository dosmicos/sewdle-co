-- Convert reference_url (single text) to reference_urls (text array) for multiple links
ALTER TABLE content_ideas
  ADD COLUMN IF NOT EXISTS reference_urls text[];

-- Migrate existing data
UPDATE content_ideas
  SET reference_urls = ARRAY[reference_url]
  WHERE reference_url IS NOT NULL AND reference_urls IS NULL;

-- Drop old column
ALTER TABLE content_ideas
  DROP COLUMN IF EXISTS reference_url;
