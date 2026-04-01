-- Add content_type and platform fields to marketing_events
-- Allows tracking what type of content (reel, story, post, etc.)
-- and where it's published (Instagram, TikTok, Facebook, etc.)

ALTER TABLE marketing_events
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS platform text[];

-- content_type: reel, story, post, carousel, live, tiktok, email, blog, ugc, other
-- platform: array of platforms like {'instagram', 'tiktok', 'facebook', 'whatsapp', 'email', 'blog'}
