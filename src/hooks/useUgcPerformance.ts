import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { useState, useCallback } from 'react';
import type { UgcCreator, UgcCreatorAd } from '@/types/ugc';

export function useUgcPerformance() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;
  const [computing, setComputing] = useState(false);

  // Fetch all creators with performance data
  const { data: creators = [], isLoading: creatorsLoading } = useQuery({
    queryKey: ['ugc-performance-creators', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('ugc_creators')
        .select('*')
        .eq('organization_id', orgId)
        .not('scores_computed_at', 'is', null)
        .order('overall_score', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as UgcCreator[];
    },
    enabled: !!orgId,
  });

  // Fetch all creator ads
  const { data: creatorAds = [], isLoading: adsLoading } = useQuery({
    queryKey: ['ugc-creator-ads', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('ugc_creator_ads')
        .select('*')
        .eq('organization_id', orgId)
        .order('roas', { ascending: false });
      if (error) throw error;
      return (data || []) as UgcCreatorAd[];
    },
    enabled: !!orgId,
  });

  // Build map: creator_id → ads[]
  const creatorAdsMap = new Map<string, UgcCreatorAd[]>();
  for (const ad of creatorAds) {
    if (!creatorAdsMap.has(ad.creator_id)) creatorAdsMap.set(ad.creator_id, []);
    creatorAdsMap.get(ad.creator_id)!.push(ad);
  }

  const computeUgcScores = useCallback(async () => {
    if (!orgId) return false;
    setComputing(true);
    try {
      const { data, error } = await supabase.functions.invoke('compute-ugc-scores', {
        body: { organizationId: orgId },
      });
      if (error) throw error;
      const result = data as { success: boolean; creatorsScored: number; adsLinked: number; autoCreated: number };
      toast.success(
        `Scores computados: ${result.creatorsScored} creadoras, ${result.adsLinked} ads vinculados` +
          (result.autoCreated > 0 ? `, ${result.autoCreated} creadoras nuevas` : '')
      );
      queryClient.invalidateQueries({ queryKey: ['ugc-performance-creators'] });
      queryClient.invalidateQueries({ queryKey: ['ugc-creator-ads'] });
      queryClient.invalidateQueries({ queryKey: ['ugc-creators'] });
      return true;
    } catch (err) {
      toast.error(`Error computando scores: ${(err as Error).message}`);
      return false;
    } finally {
      setComputing(false);
    }
  }, [orgId, queryClient]);

  return {
    creators,
    creatorAds,
    creatorAdsMap,
    isLoading: creatorsLoading || adsLoading,
    computing,
    computeUgcScores,
  };
}

export function useUgcCreatorDetail(creatorId: string | null) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  // Fetch this creator's ads
  const { data: ads = [], isLoading: adsLoading } = useQuery({
    queryKey: ['ugc-creator-detail-ads', creatorId],
    queryFn: async () => {
      if (!creatorId || !orgId) return [];
      const { data, error } = await supabase
        .from('ugc_creator_ads')
        .select('*')
        .eq('organization_id', orgId)
        .eq('creator_id', creatorId)
        .order('roas', { ascending: false });
      if (error) throw error;
      return (data || []) as UgcCreatorAd[];
    },
    enabled: !!creatorId && !!orgId,
  });

  // Fetch weekly ROAS trend from ad_performance_daily
  const adIds = ads.map((a) => a.ad_id);
  const { data: weeklyRoas = [], isLoading: roasLoading } = useQuery({
    queryKey: ['ugc-creator-weekly-roas', creatorId, adIds.join(',')],
    queryFn: async () => {
      if (!orgId || adIds.length === 0) return [];
      const { data, error } = await supabase
        .from('ad_performance_daily')
        .select('date, spend, revenue')
        .eq('organization_id', orgId)
        .in('ad_id', adIds)
        .order('date', { ascending: true });
      if (error) throw error;

      // Group by week (Monday start)
      const weekMap = new Map<string, { spend: number; revenue: number }>();
      for (const row of data || []) {
        const d = new Date(row.date);
        const dayOfWeek = d.getDay();
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        const weekKey = monday.toISOString().split('T')[0];
        const curr = weekMap.get(weekKey) || { spend: 0, revenue: 0 };
        weekMap.set(weekKey, {
          spend: curr.spend + (Number(row.spend) || 0),
          revenue: curr.revenue + (Number(row.revenue) || 0),
        });
      }

      return Array.from(weekMap.entries())
        .map(([week, data]) => ({
          week,
          roas: data.spend > 0 ? Math.round((data.revenue / data.spend) * 100) / 100 : 0,
          spend: data.spend,
          revenue: data.revenue,
        }))
        .sort((a, b) => a.week.localeCompare(b.week));
    },
    enabled: !!creatorId && !!orgId && adIds.length > 0,
  });

  return {
    ads,
    weeklyRoas,
    isLoading: adsLoading || roasLoading,
  };
}
