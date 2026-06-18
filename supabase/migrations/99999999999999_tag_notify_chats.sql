WITH target_conversations AS (
  SELECT id, organization_id
  FROM public.messaging_conversations
  WHERE id IN (
    '525a309f-98f5-499b-997f-6c69d9327ff9',
    'cd20b237-78a0-498a-a6e3-f60db687fb22',
    '88d301df-e22f-43ad-88bd-63b090c0ef6a',
    'acf7c8ea-ef95-42bc-a967-56d529d6dd94'
  )
),
orgs AS (
  SELECT DISTINCT organization_id
  FROM target_conversations
),
upsert_tag AS (
  INSERT INTO public.messaging_conversation_tags (organization_id, name, color)
  SELECT organization_id, 'Notify', '#f59e0b'
  FROM orgs
  ON CONFLICT (organization_id, name)
  DO UPDATE SET color = EXCLUDED.color
  RETURNING id, organization_id
),
tag_row AS (
  SELECT id, organization_id FROM upsert_tag
  UNION
  SELECT t.id, t.organization_id
  FROM public.messaging_conversation_tags t
  JOIN orgs o ON o.organization_id = t.organization_id
  WHERE t.name = 'Notify'
)
INSERT INTO public.messaging_conversation_tag_assignments (conversation_id, tag_id)
SELECT c.id, tr.id
FROM target_conversations c
JOIN tag_row tr ON tr.organization_id = c.organization_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.messaging_conversation_tag_assignments a
  WHERE a.conversation_id = c.id
    AND a.tag_id = tr.id
);
