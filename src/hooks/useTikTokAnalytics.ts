import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface TikTokPost {
  id: string;
  externalVideoId: string;
  caption: string;
  hashtags: string[];
  publishedAt: string;
  videoUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  avgWatchTime: number;
  fullVideoWatchedRate: number;
  reach: number;
  engagementRate: number;
  contentCategory: string;
  performanceScore: number;
  soundName: string;
  isOriginalSound: boolean;
}

interface ContentPattern {
  category: string;
  avgPerformance: number;
  avgViews: number;
  avgEngagement: number;
  count: number;
}

interface DurationBucket {
  label: string;
  range: [number, number];
  avgViews: number;
  avgEngagement: number;
  avgWatchRate: number;
  count: number;
}

interface PostingTimeSlot {
  hour: number;
  day: number;
  avgPerformance: number;
  count: number;
}

interface SoundAnalysis {
  original: { count: number; avgViews: number; avgEngagement: number };
  trending: { count: number; avgViews: number; avgEngagement: number };
  topSounds: { name: string; count: number; avgViews: number }[];
}

interface WatchTimeFunnel {
  total: number;
  watched25: number;
  watched50: number;
  watched75: number;
  watched100: number;
}

// Prophit System: Performance Score TikTok
// views(0.15) + full_watch_rate(0.30) + shares(0.25) + saves(0.20) + comments(0.10)
function calculatePerformanceScore(post: {
  views: number;
  fullVideoWatchedRate: number;
  shares: number;
  saves: number;
  comments: number;
  likes: number;
}): number {
  const maxViews = 100000;
  const normalizedViews = Math.min(post.views / maxViews, 1);
  const normalizedWatchRate = post.fullVideoWatchedRate / 100;
  const shareRate = post.views > 0 ? post.shares / post.views : 0;
  const saveRate = post.views > 0 ? post.saves / post.views : 0;
  const commentRate = post.views > 0 ? post.comments / post.views : 0;

  return (
    normalizedViews * 0.15 +
    normalizedWatchRate * 0.30 +
    Math.min(shareRate * 50, 1) * 0.25 +
    Math.min(saveRate * 50, 1) * 0.20 +
    Math.min(commentRate * 50, 1) * 0.10
  ) * 100;
}

function mapPost(row: any): TikTokPost {
  return {
    id: row.id,
    externalVideoId: row.external_video_id,
    caption: row.caption || '',
    hashtags: row.hashtags || [],
    publishedAt: row.published_at,
    videoUrl: row.video_url || '',
    thumbnailUrl: row.thumbnail_url || '',
    durationSeconds: Number(row.duration_seconds) || 0,
    views: Number(row.views) || 0,
    likes: Number(row.likes) || 0,
    comments: Number(row.comments) || 0,
    shares: Number(row.shares) || 0,
    saves: Number(row.saves) || 0,
    avgWatchTime: Number(row.avg_watch_time) || 0,
    fullVideoWatchedRate: Number(row.full_video_watched_rate) || 0,
    reach: Number(row.reach) || 0,
    engagementRate: Number(row.engagement_rate) || 0,
    contentCategory: row.content_category || 'uncategorized',
    performanceScore: Number(row.performance_score) || 0,
    soundName: row.sound_name || '',
    isOriginalSound: row.is_original_sound ?? false,
  };
}

export function useTikTokAnalytics(dateRange?: { from: Date; to: Date }) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['tiktok-posts', orgId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<TikTokPost[]> => {
      let query = supabase
        .from('tiktok_posts')
        .select('*')
        .eq('organization_id', orgId!)
        .order('published_at', { ascending: false });

      if (dateRange?.from) {
        query = query.gte('published_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('published_at', dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapPost);
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const analytics = useMemo(() => {
    if (!posts.length) {
      return {
        totalVideos: 0,
        avgViews: 0,
        avgEngagementRate: 0,
        bestCategory: '-',
        totalViews: 0,
        totalLikes: 0,
        totalShares: 0,
        totalSaves: 0,
        videosByPerformance: [] as TikTokPost[],
        contentPatterns: [] as ContentPattern[],
        durationAnalysis: [] as DurationBucket[],
        viralityAnalysis: { avgShareRate: 0, avgViewToLikeRatio: 0, topViralPosts: [] as TikTokPost[] },
        bestPostingTimes: [] as PostingTimeSlot[],
        soundAnalysis: { original: { count: 0, avgViews: 0, avgEngagement: 0 }, trending: { count: 0, avgViews: 0, avgEngagement: 0 }, topSounds: [] } as SoundAnalysis,
        watchTimeFunnel: { total: 0, watched25: 0, watched50: 0, watched75: 0, watched100: 0 } as WatchTimeFunnel,
      };
    }

    // Recalculate performance scores
    const scoredPosts = posts.map((p) => ({
      ...p,
      performanceScore: calculatePerformanceScore(p),
    }));

    // KPIs
    const totalViews = scoredPosts.reduce((s, p) => s + p.views, 0);
    const avgViews = Math.round(totalViews / scoredPosts.length);
    const avgEngagementRate =
      scoredPosts.reduce((s, p) => s + p.engagementRate, 0) / scoredPosts.length;
    const totalLikes = scoredPosts.reduce((s, p) => s + p.likes, 0);
    const totalShares = scoredPosts.reduce((s, p) => s + p.shares, 0);
    const totalSaves = scoredPosts.reduce((s, p) => s + p.saves, 0);

    // Videos by performance
    const videosByPerformance = [...scoredPosts].sort(
      (a, b) => b.performanceScore - a.performanceScore
    );

    // Content patterns by category
    const categoryMap = new Map<string, TikTokPost[]>();
    scoredPosts.forEach((p) => {
      const cat = p.contentCategory || 'uncategorized';
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(p);
    });

    const contentPatterns: ContentPattern[] = Array.from(categoryMap.entries())
      .map(([category, items]) => ({
        category,
        avgPerformance: items.reduce((s, p) => s + p.performanceScore, 0) / items.length,
        avgViews: Math.round(items.reduce((s, p) => s + p.views, 0) / items.length),
        avgEngagement: items.reduce((s, p) => s + p.engagementRate, 0) / items.length,
        count: items.length,
      }))
      .sort((a, b) => b.avgPerformance - a.avgPerformance);

    const bestCategory = contentPatterns[0]?.category || '-';

    // Duration analysis (buckets: <15s, 15-30s, 30-60s, 60s+)
    const durationBuckets: { label: string; range: [number, number] }[] = [
      { label: '<15s', range: [0, 15] },
      { label: '15-30s', range: [15, 30] },
      { label: '30-60s', range: [30, 60] },
      { label: '60s+', range: [60, Infinity] },
    ];

    const durationAnalysis: DurationBucket[] = durationBuckets.map(({ label, range }) => {
      const bucket = scoredPosts.filter(
        (p) => p.durationSeconds >= range[0] && p.durationSeconds < range[1]
      );
      return {
        label,
        range,
        avgViews: bucket.length ? Math.round(bucket.reduce((s, p) => s + p.views, 0) / bucket.length) : 0,
        avgEngagement: bucket.length ? bucket.reduce((s, p) => s + p.engagementRate, 0) / bucket.length : 0,
        avgWatchRate: bucket.length ? bucket.reduce((s, p) => s + p.fullVideoWatchedRate, 0) / bucket.length : 0,
        count: bucket.length,
      };
    });

    // Virality analysis
    const avgShareRate = totalViews > 0 ? totalShares / totalViews : 0;
    const avgViewToLikeRatio = totalViews > 0 ? totalLikes / totalViews : 0;
    const topViralPosts = [...scoredPosts]
      .sort((a, b) => b.shares - a.shares)
      .slice(0, 5);

    // Best posting times (hour x day heatmap)
    const timeSlots = new Map<string, { totalPerf: number; count: number }>();
    scoredPosts.forEach((p) => {
      if (!p.publishedAt) return;
      const d = new Date(p.publishedAt);
      const key = `${d.getDay()}-${d.getHours()}`;
      const existing = timeSlots.get(key) || { totalPerf: 0, count: 0 };
      existing.totalPerf += p.performanceScore;
      existing.count += 1;
      timeSlots.set(key, existing);
    });

    const bestPostingTimes: PostingTimeSlot[] = Array.from(timeSlots.entries())
      .map(([key, val]) => {
        const [day, hour] = key.split('-').map(Number);
        return { hour, day, avgPerformance: val.totalPerf / val.count, count: val.count };
      })
      .sort((a, b) => b.avgPerformance - a.avgPerformance);

    // Sound analysis
    const originalPosts = scoredPosts.filter((p) => p.isOriginalSound);
    const trendingPosts = scoredPosts.filter((p) => !p.isOriginalSound);

    const soundMap = new Map<string, { count: number; totalViews: number }>();
    scoredPosts.forEach((p) => {
      if (!p.soundName) return;
      const existing = soundMap.get(p.soundName) || { count: 0, totalViews: 0 };
      existing.count += 1;
      existing.totalViews += p.views;
      soundMap.set(p.soundName, existing);
    });

    const topSounds = Array.from(soundMap.entries())
      .map(([name, val]) => ({ name, count: val.count, avgViews: Math.round(val.totalViews / val.count) }))
      .sort((a, b) => b.avgViews - a.avgViews)
      .slice(0, 10);

    const soundAnalysis: SoundAnalysis = {
      original: {
        count: originalPosts.length,
        avgViews: originalPosts.length ? Math.round(originalPosts.reduce((s, p) => s + p.views, 0) / originalPosts.length) : 0,
        avgEngagement: originalPosts.length ? originalPosts.reduce((s, p) => s + p.engagementRate, 0) / originalPosts.length : 0,
      },
      trending: {
        count: trendingPosts.length,
        avgViews: trendingPosts.length ? Math.round(trendingPosts.reduce((s, p) => s + p.views, 0) / trendingPosts.length) : 0,
        avgEngagement: trendingPosts.length ? trendingPosts.reduce((s, p) => s + p.engagementRate, 0) / trendingPosts.length : 0,
      },
      topSounds,
    };

    // Watch time funnel
    const watchTimeFunnel: WatchTimeFunnel = {
      total: scoredPosts.length,
      watched25: scoredPosts.filter((p) => p.fullVideoWatchedRate >= 25).length,
      watched50: scoredPosts.filter((p) => p.fullVideoWatchedRate >= 50).length,
      watched75: scoredPosts.filter((p) => p.fullVideoWatchedRate >= 75).length,
      watched100: scoredPosts.filter((p) => p.fullVideoWatchedRate >= 100).length,
    };

    return {
      totalVideos: scoredPosts.length,
      avgViews,
      avgEngagementRate,
      bestCategory,
      totalViews,
      totalLikes,
      totalShares,
      totalSaves,
      videosByPerformance,
      contentPatterns,
      durationAnalysis,
      viralityAnalysis: { avgShareRate, avgViewToLikeRatio, topViralPosts },
      bestPostingTimes,
      soundAnalysis,
      watchTimeFunnel,
    };
  }, [posts]);

  return {
    posts,
    isLoading,
    ...analytics,
  };
}
