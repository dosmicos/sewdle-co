-- Add instagram_post and instagram_carousel as valid platform values for UGC content
-- This allows creators to upload photos in addition to videos

ALTER TABLE public.ugc_videos
  DROP CONSTRAINT IF EXISTS ugc_videos_platform_check;

ALTER TABLE public.ugc_videos
  ADD CONSTRAINT ugc_videos_platform_check
  CHECK (platform IS NULL OR platform IN ('instagram_reel', 'instagram_story', 'tiktok', 'instagram_post', 'instagram_carousel'));
