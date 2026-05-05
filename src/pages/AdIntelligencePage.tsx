import React, { useState } from 'react';
import { Sparkles, RefreshCw, Loader2, TrendingUp, TrendingDown, Users, Zap } from 'lucide-react';
import FinanceDashboardLayout from '@/components/finance-dashboard/FinanceDashboardLayout';
import MetaAdsConnectionModal from '@/components/finance-dashboard/MetaAdsConnectionModal';
import ProductMVPMatrix from '@/components/finance-dashboard/ProductMVPMatrix';
import { useMetaAdsConnection } from '@/hooks/useMetaAdsConnection';
import { useAdIntelligence, type PerformancePattern } from '@/hooks/useAdIntelligence';
import { useAdCreativeSync } from '@/hooks/useAdCreativeSync';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const formatCOP = (amount: number) => {
  return `COP ${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
};

const DIMENSION_LABELS: Record<string, string> = {
  creative_type: 'Creative Type',
  sales_angle: 'Sales Angle',
  product: 'Product',
  audience_type: 'Audience Type',
  audience_gender: 'Gender',
  is_advantage_plus: 'Advantage+ vs Manual',
  target_country: 'Country',
  funnel_stage: 'Funnel Stage',
  offer_type: 'Offer Type',
};

// ── Pattern Card ─────────────────────────────────────────────────

const PatternCard: React.FC<{
  dimension: string;
  patterns: PerformancePattern[];
}> = ({ dimension, patterns }) => {
  if (patterns.length === 0) return null;

  const best = patterns[0];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        {DIMENSION_LABELS[dimension] || dimension}
      </h3>
      <div className="space-y-2">
        {patterns.slice(0, 5).map((p) => (
          <div key={p.dimension_value} className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-medium text-gray-400 w-4">
                #{p.roas_rank}
              </span>
              <span className="text-sm text-gray-800 truncate">
                {p.dimension_value.replace(/_/g, ' ')}
              </span>
              {p.roas_rank === 1 && (
                <Badge variant="secondary" className="text-[10px] bg-green-50 text-green-700 px-1 py-0">
                  Best
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs shrink-0">
              <span className={`font-medium ${p.avg_roas >= 2 ? 'text-green-600' : p.avg_roas >= 1 ? 'text-amber-600' : 'text-red-600'}`}>
                {p.avg_roas.toFixed(2)}x
              </span>
              <span className="text-gray-500">
                {formatCOP(p.total_spend)}
              </span>
              <span className="text-gray-400">
                {p.total_ads} ads
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Summary Cards ────────────────────────────────────────────────

const SummaryCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle?: string;
  color: string;
}> = ({ icon, title, value, subtitle, color }) => (
  <div className={`rounded-lg border p-4 ${color}`}>
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="text-xs font-medium text-gray-600">{title}</span>
    </div>
    <p className="text-lg font-bold text-gray-900">{value}</p>
    {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
  </div>
);

// ── Main Page ────────────────────────────────────────────────────

const AdIntelligencePage: React.FC = () => {
  const metaConnection = useMetaAdsConnection();
  const [periodType, setPeriodType] = useState('7d');
  const intelligence = useAdIntelligence(periodType);
  const creativeSync = useAdCreativeSync();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Derive summary stats
  const bestAudience = intelligence.patternsByDimension.get('audience_type')?.[0];
  const bestCreative = intelligence.patternsByDimension.get('creative_type')?.[0];

  const risingStars = intelligence.lifecycles.filter(
    (l) => l.current_status === 'scaling' && l.lifetime_roas > 1.5
  );
  const decliningAds = intelligence.lifecycles.filter(
    (l) => l.current_status === 'declining'
  );

  return (
    <FinanceDashboardLayout activeSection="intelligence" onOpenSettings={() => setSettingsOpen(true)}>
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Intelligence
            </h1>
            <Select value={periodType} onValueChange={setPeriodType}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {metaConnection.isConnected && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => creativeSync.syncCreativeAndTags()}
                  disabled={creativeSync.syncing}
                >
                  {creativeSync.syncing ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Sync Tags
                </Button>
                <Button
                  size="sm"
                  onClick={() => intelligence.computeIntelligence()}
                  disabled={intelligence.computing}
                >
                  {intelligence.computing ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Compute Intelligence
                </Button>
              </>
            )}
          </div>
        </div>

        {!metaConnection.isConnected ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
            <Sparkles className="h-8 w-8 text-amber-400 mx-auto" />
            <p className="text-sm font-medium text-amber-900 mt-3">Conecta Meta Ads para ver Intelligence</p>
            <p className="text-xs text-amber-700 mt-1">
              Necesitas datos de rendimiento y tags para generar insights
            </p>
          </div>
        ) : intelligence.patterns.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <Sparkles className="h-8 w-8 text-gray-300 mx-auto" />
            <p className="text-sm font-medium text-gray-600 mt-3">No hay datos de intelligence aún</p>
            <p className="text-xs text-gray-500 mt-1">
              Primero sincroniza creative + tags, luego computa intelligence
            </p>
          </div>
        ) : (
          <>
            {/* Product MVP Matrix */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Product MVP Matrix — Ultimos 30 dias
              </h2>
              <ProductMVPMatrix />
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <SummaryCard
                icon={<Users className="h-4 w-4 text-purple-500" />}
                title="Best Audience"
                value={bestAudience?.dimension_value.replace(/_/g, ' ') || '-'}
                subtitle={bestAudience ? `ROAS ${bestAudience.avg_roas.toFixed(2)}x — ${bestAudience.total_ads} ads` : undefined}
                color="bg-purple-50 border-purple-200"
              />
              <SummaryCard
                icon={<Zap className="h-4 w-4 text-blue-500" />}
                title="Best Creative"
                value={bestCreative?.dimension_value.replace(/_/g, ' ') || '-'}
                subtitle={bestCreative ? `ROAS ${bestCreative.avg_roas.toFixed(2)}x — ${bestCreative.total_ads} ads` : undefined}
                color="bg-blue-50 border-blue-200"
              />
              <SummaryCard
                icon={<TrendingUp className="h-4 w-4 text-green-500" />}
                title="Rising Stars"
                value={`${risingStars.length} ads`}
                subtitle="Scaling with ROAS > 1.5x"
                color="bg-green-50 border-green-200"
              />
              <SummaryCard
                icon={<TrendingDown className="h-4 w-4 text-red-500" />}
                title="Declining"
                value={`${decliningAds.length} ads`}
                subtitle="Declining performance"
                color="bg-red-50 border-red-200"
              />
            </div>

            {/* Pattern Rankings */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Performance Rankings ({periodType === '7d' ? 'Last 7 Days' : 'Last 30 Days'})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from(intelligence.patternsByDimension.entries()).map(
                  ([dimension, patterns]) => (
                    <PatternCard
                      key={dimension}
                      dimension={dimension}
                      patterns={patterns}
                    />
                  )
                )}
              </div>
            </div>

            {/* Lifecycle Overview */}
            {intelligence.lifecycles.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Ad Lifecycle Overview
                </h2>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Ad</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">Days</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">Spend</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">Revenue</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">ROAS</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">CPA</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">Fatigue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {intelligence.lifecycles.slice(0, 20).map((lc) => {
                        const statusColors: Record<string, string> = {
                          testing: 'bg-blue-100 text-blue-700',
                          scaling: 'bg-green-100 text-green-700',
                          mature: 'bg-emerald-100 text-emerald-700',
                          declining: 'bg-red-100 text-red-700',
                          inactive: 'bg-gray-100 text-gray-500',
                          active: 'bg-amber-100 text-amber-700',
                        };
                        return (
                          <tr key={lc.ad_id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 max-w-[200px] truncate text-gray-800">
                              {lc.ad_name || lc.ad_id}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] px-1.5 py-0 ${statusColors[lc.current_status] || 'bg-gray-100'}`}
                              >
                                {lc.current_status}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">{lc.days_active}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{formatCOP(lc.lifetime_spend)}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{formatCOP(lc.lifetime_revenue)}</td>
                            <td className={`px-3 py-2 text-right font-medium ${
                              lc.lifetime_roas >= 2 ? 'text-green-600' : lc.lifetime_roas >= 1 ? 'text-amber-600' : 'text-red-600'
                            }`}>
                              {lc.lifetime_roas.toFixed(2)}x
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {lc.lifetime_cpa > 0 ? formatCOP(lc.lifetime_cpa) : '-'}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-500">
                              {lc.days_to_fatigue != null ? `${lc.days_to_fatigue}d` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <MetaAdsConnectionModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSuccess={() => setSettingsOpen(false)}
      />
    </FinanceDashboardLayout>
  );
};

export default AdIntelligencePage;
