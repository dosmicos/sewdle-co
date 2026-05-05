import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useMetaAdsConnection } from '@/hooks/useMetaAdsConnection';
import { toast } from 'sonner';

export interface MetaPage {
  id: string;
  name: string;
  hasIgAccount: boolean;
  igId: string | null;
}

export interface SocialPost {
  id: string;
  org_id: string;
  platform: 'instagram' | 'facebook';
  external_post_id: string;
  post_type: 'image' | 'carousel' | 'reel' | 'story' | 'video' | 'text';
  caption: string;
  hashtags: string[];
  published_at: string;
  permalink: string;
  thumbnail_url: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
  engagement_rate: number;
  plays: number | null;
  avg_watch_time: number | null;
  content_category: string;
  performance_score: number;
  synced_at: string;
  created_at: string;
}

export interface PostTypeAnalysis {
  post_type: string;
  count: number;
  avg_engagement_rate: number;
  avg_reach: number;
  avg_saves: number;
  avg_shares: number;
  avg_likes: number;
  avg_comments: number;
  total_reach: number;
}

export interface HashtagPerformance {
  hashtag: string;
  count: number;
  avg_reach: number;
  avg_engagement_rate: number;
  avg_saves: number;
}

export interface PostingTimeAnalysis {
  day: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23
  count: number;
  avg_engagement_rate: number;
}

export interface EngagementTrend {
  week: string;
  avg_engagement_rate: number;
  total_posts: number;
  total_reach: number;
  total_saves: number;
}

type PlatformFilter = 'all' | 'instagram' | 'facebook';

async function fetchPosts(
  orgId: string,
  platform: PlatformFilter,
  startDate: string,
  endDate: string
): Promise<SocialPost[]> {
  let query = supabase
    .from('social_posts')
    .select('*')
    .eq('org_id', orgId)
    .gte('published_at', `${startDate}T00:00:00`)
    .lte('published_at', `${endDate}T23:59:59`)
    .order('published_at', { ascending: false });

  if (platform !== 'all') {
    query = query.eq('platform', platform);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching social posts:', error);
    return [];
  }
  return (data || []) as SocialPost[];
}

export function useMetaSocialAnalytics(
  platform: PlatformFilter = 'all',
  startDate: string,
  endDate: string
) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();
  const { isConnected } = useMetaAdsConnection();
  const [syncing, setSyncing] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(() => {
    if (!orgId) return null;
    return localStorage.getItem(`social_page_${orgId}`) || null;
  });

  // Update localStorage when selection changes
  useEffect(() => {
    if (orgId && selectedPageId) {
      localStorage.setItem(`social_page_${orgId}`, selectedPageId);
    }
  }, [orgId, selectedPageId]);

  // Fetch available Facebook pages + Instagram accounts
  const { data: availablePages, isLoading: loadingPages } = useQuery({
    queryKey: ['meta-pages', orgId],
    queryFn: async (): Promise<MetaPage[]> => {
      const { data, error } = await supabase.functions.invoke('sync-meta-posts', {
        body: { organizationId: orgId, action: 'list_pages' },
      });
      if (error || !data.success) return [];
      return data.pages || [];
    },
    enabled: !!orgId && isConnected,
    staleTime: 1000 * 60 * 10,
  });

  // Fetch all posts for the date range
  const { data: posts, isLoading } = useQuery({
    queryKey: ['social-posts', orgId, platform, startDate, endDate],
    queryFn: () => fetchPosts(orgId!, platform, startDate, endDate),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  // Sync posts from Meta Graph API
  const syncPosts = useCallback(
    async (sinceDays: number = 90) => {
      if (!orgId) {
        toast.error('No hay organizacion seleccionada');
        return false;
      }
      if (!isConnected) {
        toast.error('Conecta tu cuenta de Meta Ads primero');
        return false;
      }

      setSyncing(true);
      try {
        const { data, error } = await supabase.functions.invoke('sync-meta-posts', {
          body: {
            organizationId: orgId,
            platform: platform === 'all' ? undefined : platform,
            sinceDays,
            pageId: selectedPageId || undefined,
          },
        });

        if (error) throw error;

        if (data.needsReconnect) {
          toast.error(data.error || 'Necesitas reconectar tu cuenta de Meta');
          return false;
        }

        if (data.success) {
          // Log diagnostics for debugging
          if (data.diagnostics) {
            console.log('🔍 Sync diagnostics:', JSON.stringify(data.diagnostics, null, 2));
          }
          if (data.syncedPosts === 0 && data.diagnostics?.steps?.length > 0) {
            // Show all pages found and their IG status for debugging
            const pagesStep = data.diagnostics.steps.find((s: any) => s.step === 'fetch_pages');
            if (pagesStep?.pages) {
              const pagesSummary = pagesStep.pages.map((p: any) =>
                `${p.name}: ${p.hasIgAccount ? `IG ✓ (${p.igId})` : 'Sin IG ✗'}`
              ).join(' | ');
              console.warn('📄 Páginas encontradas:', pagesSummary);
              toast.error(`0 posts sincronizados. Páginas: ${pagesSummary}`, { duration: 10000 });
            } else {
              const failedStep = data.diagnostics.steps.find((s: any) => s.status === 'error' || s.status === 'skipped');
              toast.error(`0 posts: ${failedStep?.step || 'desconocido'} - ${failedStep?.detail || failedStep?.status || 'sin detalle'}`);
            }
          } else {
            toast.success(`${data.syncedPosts} posts sincronizados`);
          }
          queryClient.invalidateQueries({ queryKey: ['social-posts'] });
          return true;
        } else {
          toast.error(data.error || 'Error al sincronizar posts');
          return false;
        }
      } catch (error: any) {
        console.error('Error syncing social posts:', error);
        toast.error('Error al sincronizar posts de Meta');
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [orgId, platform, isConnected, queryClient, selectedPageId]
  );

  // --- Analysis functions (computed from fetched posts) ---

  const allPosts = posts || [];

  // Posts grouped by type with avg metrics
  const postsByType = useMemo((): PostTypeAnalysis[] => {
    const groups = new Map<string, SocialPost[]>();
    for (const p of allPosts) {
      const existing = groups.get(p.post_type) || [];
      existing.push(p);
      groups.set(p.post_type, existing);
    }

    return Array.from(groups.entries()).map(([type, items]) => {
      const count = items.length;
      return {
        post_type: type,
        count,
        avg_engagement_rate: items.reduce((s, p) => s + p.engagement_rate, 0) / count,
        avg_reach: items.reduce((s, p) => s + p.reach, 0) / count,
        avg_saves: items.reduce((s, p) => s + p.saves, 0) / count,
        avg_shares: items.reduce((s, p) => s + p.shares, 0) / count,
        avg_likes: items.reduce((s, p) => s + p.likes, 0) / count,
        avg_comments: items.reduce((s, p) => s + p.comments, 0) / count,
        total_reach: items.reduce((s, p) => s + p.reach, 0),
      };
    }).sort((a, b) => b.avg_engagement_rate - a.avg_engagement_rate);
  }, [allPosts]);

  // Top posts by engagement rate
  const topPosts = useMemo((): SocialPost[] => {
    return [...allPosts]
      .sort((a, b) => b.performance_score - a.performance_score)
      .slice(0, 20);
  }, [allPosts]);

  // Engagement trend (weekly)
  const engagementTrend = useMemo((): EngagementTrend[] => {
    const weeks = new Map<string, SocialPost[]>();
    for (const p of allPosts) {
      const date = new Date(p.published_at);
      // Get ISO week start (Monday)
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(date.setDate(diff));
      const weekKey = weekStart.toISOString().split('T')[0];
      const existing = weeks.get(weekKey) || [];
      existing.push(p);
      weeks.set(weekKey, existing);
    }

    return Array.from(weeks.entries())
      .map(([week, items]) => ({
        week,
        avg_engagement_rate: items.reduce((s, p) => s + p.engagement_rate, 0) / items.length,
        total_posts: items.length,
        total_reach: items.reduce((s, p) => s + p.reach, 0),
        total_saves: items.reduce((s, p) => s + p.saves, 0),
      }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [allPosts]);

  // Content category analysis
  const contentCategoryAnalysis = useMemo(() => {
    const groups = new Map<string, SocialPost[]>();
    for (const p of allPosts) {
      const cat = p.content_category || 'uncategorized';
      const existing = groups.get(cat) || [];
      existing.push(p);
      groups.set(cat, existing);
    }

    return Array.from(groups.entries()).map(([category, items]) => {
      const count = items.length;
      return {
        category,
        count,
        avg_engagement_rate: items.reduce((s, p) => s + p.engagement_rate, 0) / count,
        avg_saves: items.reduce((s, p) => s + p.saves, 0) / count,
        avg_reach: items.reduce((s, p) => s + p.reach, 0) / count,
        avg_performance_score: items.reduce((s, p) => s + p.performance_score, 0) / count,
      };
    }).sort((a, b) => b.avg_performance_score - a.avg_performance_score);
  }, [allPosts]);

  // Best posting times (heatmap data)
  const bestPostingTimes = useMemo((): PostingTimeAnalysis[] => {
    const timeSlots = new Map<string, { count: number; totalEng: number }>();
    for (const p of allPosts) {
      const date = new Date(p.published_at);
      const day = date.getDay();
      const hour = date.getHours();
      const key = `${day}-${hour}`;
      const existing = timeSlots.get(key) || { count: 0, totalEng: 0 };
      existing.count++;
      existing.totalEng += p.engagement_rate;
      timeSlots.set(key, existing);
    }

    return Array.from(timeSlots.entries()).map(([key, val]) => {
      const [day, hour] = key.split('-').map(Number);
      return {
        day,
        hour,
        count: val.count,
        avg_engagement_rate: val.totalEng / val.count,
      };
    });
  }, [allPosts]);

  // Hashtag performance
  const hashtagPerformance = useMemo((): HashtagPerformance[] => {
    const tags = new Map<string, { count: number; reach: number; eng: number; saves: number }>();
    for (const p of allPosts) {
      for (const tag of p.hashtags || []) {
        const existing = tags.get(tag) || { count: 0, reach: 0, eng: 0, saves: 0 };
        existing.count++;
        existing.reach += p.reach;
        existing.eng += p.engagement_rate;
        existing.saves += p.saves;
        tags.set(tag, existing);
      }
    }

    return Array.from(tags.entries())
      .map(([hashtag, val]) => ({
        hashtag,
        count: val.count,
        avg_reach: val.reach / val.count,
        avg_engagement_rate: val.eng / val.count,
        avg_saves: val.saves / val.count,
      }))
      .filter((h) => h.count >= 2) // Only hashtags used 2+ times
      .sort((a, b) => b.avg_engagement_rate - a.avg_engagement_rate)
      .slice(0, 30);
  }, [allPosts]);

  // KPI summaries
  const kpis = useMemo(() => {
    const total = allPosts.length;
    if (total === 0) {
      return {
        totalPosts: 0,
        avgEngagementRate: 0,
        bestPostType: '-',
        totalReach: 0,
        avgSaves: 0,
        avgReach: 0,
      };
    }

    const avgEngagementRate = allPosts.reduce((s, p) => s + p.engagement_rate, 0) / total;
    const totalReach = allPosts.reduce((s, p) => s + p.reach, 0);
    const avgSaves = allPosts.reduce((s, p) => s + p.saves, 0) / total;
    const bestType = postsByType[0]?.post_type || '-';

    return {
      totalPosts: total,
      avgEngagementRate,
      bestPostType: bestType,
      totalReach,
      avgSaves,
      avgReach: totalReach / total,
    };
  }, [allPosts, postsByType]);

  // Auto-insights (Prophit System style)
  const insights = useMemo((): string[] => {
    const result: string[] = [];
    if (allPosts.length < 5) return result;

    // Compare post types
    if (postsByType.length >= 2) {
      const best = postsByType[0];
      const worst = postsByType[postsByType.length - 1];
      if (worst.avg_engagement_rate > 0) {
        const ratio = (best.avg_engagement_rate / worst.avg_engagement_rate).toFixed(1);
        result.push(
          `Tus ${best.post_type}s tienen ${ratio}x mas engagement que tus ${worst.post_type}s`
        );
      }
    }

    // Saves insight (Prophit: saves = purchase intent)
    const highSaves = [...allPosts].sort((a, b) => b.saves - a.saves).slice(0, 5);
    if (highSaves.length > 0 && highSaves[0].saves > 0) {
      const topSaveTypes = new Set(highSaves.map((p) => p.post_type));
      result.push(
        `Los posts con mas SAVES (intencion de compra) son: ${Array.from(topSaveTypes).join(', ')}`
      );
    }

    // Best posting time
    if (bestPostingTimes.length > 0) {
      const bestTime = bestPostingTimes.sort(
        (a, b) => b.avg_engagement_rate - a.avg_engagement_rate
      )[0];
      const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
      result.push(
        `Mejor momento para publicar: ${days[bestTime.day]} a las ${bestTime.hour}:00`
      );
    }

    // Top hashtags
    if (hashtagPerformance.length >= 3) {
      const top3 = hashtagPerformance.slice(0, 3).map((h) => h.hashtag);
      result.push(`Top hashtags por engagement: ${top3.join(', ')}`);
    }

    return result;
  }, [allPosts, postsByType, bestPostingTimes, hashtagPerformance]);

  return {
    posts: allPosts,
    isLoading,
    syncing,
    syncPosts,
    // Analysis
    postsByType,
    topPosts,
    engagementTrend,
    contentCategoryAnalysis,
    bestPostingTimes,
    hashtagPerformance,
    kpis,
    insights,
    // Meta connection
    isConnected,
    // Page selection
    availablePages: availablePages || [],
    loadingPages,
    selectedPageId,
    setSelectedPageId,
  };
}
