DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messaging_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messaging_conversations;
  END IF;
END$$;