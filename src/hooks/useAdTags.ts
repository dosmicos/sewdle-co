import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface AdTagData {
  ad_id: string;
  ad_name: string | null;
  creative_type: string | null;
  sales_angle: string | null;
  copy_type: string | null;
  hook_description: string | null;
  product: string | null;
  product_name: string | null;
  landing_page_type: string | null;
  offer_type: string | null;
  offer_value: string | null;
  funnel_stage: string | null;
  audience_type: string | null;
  audience_type_detail: string | null;
  audience_gender: string | null;
  audience_age_range: string | null;
  audience_location: string | null;
  audience_interests: string | null;
  is_advantage_plus: boolean | null;
  target_country: string | null;
  ugc_creator_handle: string | null;
  confidence: string | null;
  tagged_by: string | null;
}

export interface AdCreativeData {
  ad_id: string;
  primary_text: string | null;
  headline: string | null;
  description: string | null;
  destination_url: string | null;
  call_to_action: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  ugc_creator_handle: string | null;
}

export interface AdLifecycleData {
  ad_id: string;
  first_seen: string | null;
  last_seen: string | null;
  days_active: number | null;
  lifetime_spend: number | null;
  lifetime_revenue: number | null;
  lifetime_roas: number | null;
  lifetime_cpa: number | null;
  current_status: string | null;
  fatigue_start_date: string | null;
  days_to_fatigue: number | null;
}

async function fetchAdTags(orgId: string, adIds: string[]): Promise<Map<string, AdTagData>> {
  const map = new Map<string, AdTagData>();
  if (adIds.length === 0) return map;

  const { data, error } = await supabase
    .from('ad_tags')
    .select('*')
    .eq('organization_id', orgId)
    .in('ad_id', adIds);

  if (error) {
    console.error('Error fetching ad tags:', error);
    return map;
  }

  for (const row of data || []) {
    map.set(row.ad_id, row as AdTagData);
  }

  return map;
}

async function fetchAdCreatives(orgId: string, adIds: string[]): Promise<Map<string, AdCreativeData>> {
  const map = new Map<string, AdCreativeData>();
  if (adIds.length === 0) return map;

  const { data, error } = await supabase
    .from('ad_creative_content')
    .select('ad_id, primary_text, headline, description, destination_url, call_to_action, media_type, thumbnail_url, ugc_creator_handle')
    .eq('organization_id', orgId)
    .in('ad_id', adIds);

  if (error) {
    console.error('Error fetching ad creatives:', error);
    return map;
  }

  for (const row of data || []) {
    map.set(row.ad_id, row as AdCreativeData);
  }

  return map;
}

async function fetchAdLifecycle(orgId: string, adIds: string[]): Promise<Map<string, AdLifecycleData>> {
  const map = new Map<string, AdLifecycleData>();
  if (adIds.length === 0) return map;

  const { data, error } = await supabase
    .from('ad_lifecycle')
    .select('ad_id, first_seen, last_seen, days_active, lifetime_spend, lifetime_revenue, lifetime_roas, lifetime_cpa, current_status, fatigue_start_date, days_to_fatigue')
    .eq('organization_id', orgId)
    .in('ad_id', adIds);

  if (error) {
    console.error('Error fetching ad lifecycle:', error);
    return map;
  }

  for (const row of data || []) {
    map.set(row.ad_id, row as AdLifecycleData);
  }

  return map;
}

export function useAdTags(adIds: string[]) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data: tags, isLoading: tagsLoading } = useQuery({
    queryKey: ['ad-tags', orgId, adIds.sort().join(',')],
    queryFn: () => fetchAdTags(orgId!, adIds),
    enabled: !!orgId && adIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const { data: creatives, isLoading: creativesLoading } = useQuery({
    queryKey: ['ad-creatives', orgId, adIds.sort().join(',')],
    queryFn: () => fetchAdCreatives(orgId!, adIds),
    enabled: !!orgId && adIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const { data: lifecycle, isLoading: lifecycleLoading } = useQuery({
    queryKey: ['ad-lifecycle', orgId, adIds.sort().join(',')],
    queryFn: () => fetchAdLifecycle(orgId!, adIds),
    enabled: !!orgId && adIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  return {
    tags: tags ?? new Map<string, AdTagData>(),
    creatives: creatives ?? new Map<string, AdCreativeData>(),
    lifecycle: lifecycle ?? new Map<string, AdLifecycleData>(),
    isLoading: tagsLoading || creativesLoading || lifecycleLoading,
  };
}
