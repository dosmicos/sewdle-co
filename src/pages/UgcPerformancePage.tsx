import React, { useState, useMemo } from 'react';
import FinanceDashboardLayout from '@/components/finance-dashboard/FinanceDashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users,
  Calculator,
  Trophy,
  TrendingUp,
  Loader2,
  GitCompare,
  Link2,
  MousePointerClick,
  DollarSign,
  FileVideo,
  Target,
  Wallet,
} from 'lucide-react';
import { useUgcPerformance, type UgcCreatorWithAffiliate } from '@/hooks/useUgcPerformance';
import { TierBadge } from '@/components/finance-dashboard/TierBadge';
import { CreatorPerformanceProfile } from '@/components/finance-dashboard/CreatorPerformanceProfile';
import { CreatorComparisonView } from '@/components/finance-dashboard/CreatorComparisonView';
import { TIER_CONFIG, RECOMMENDATION_CONFIG, type CreatorTier } from '@/types/ugc';

type SortKey =
  | 'overall_score'
  | 'lifetime_roas'
  | 'lifetime_spend'
  | 'total_ads'
  | 'roas_score'
  | 'engagement_score'
  | 'conversion_score'
  | 'consistency_score'
  | 'affiliate_week_commission'
  | 'affiliate_month_commission'
  | 'affiliate_month_revenue'
  | 'affiliate_month_orders'
  | 'affiliate_week_clicks'
  | 'affiliate_month_content'
  | 'affiliate_pending_balance';

type AffiliateFilter = 'all' | 'cmd' | 'active_link' | 'earners' | 'needs_link' | 'reactivate';

const DEFAULT_MONTHLY_GOAL = {
  revenue_goal: 6_000_000,
  stretch_revenue_goal: 10_000_000,
  orders_goal: 25,
  converting_creators_goal: 10,
  active_creators_goal: 40,
  weekly_active_creators_goal: 20,
  content_pieces_goal: 120,
  active_links_goal: 90,
};

const UgcPerformancePage: React.FC = () => {
  const {
    creators,
    creatorAdsMap,
    affiliateSummary,
    monthlyGoal,
    weeklyReport,
    isLoading,
    computing,
    computeUgcScores,
  } = useUgcPerformance();
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [affiliateFilter, setAffiliateFilter] = useState<AffiliateFilter>('cmd');
  const [sortKey, setSortKey] = useState<SortKey>('affiliate_month_commission');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedCreator, setSelectedCreator] = useState<UgcCreatorWithAffiliate | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);

  const goals = monthlyGoal || DEFAULT_MONTHLY_GOAL;

  const getSortValue = (creator: UgcCreatorWithAffiliate, key: SortKey) => {
    switch (key) {
      case 'affiliate_week_commission': return creator.affiliate.weekCommission;
      case 'affiliate_month_commission': return creator.affiliate.monthCommission;
      case 'affiliate_month_revenue': return creator.affiliate.monthRevenue;
      case 'affiliate_month_orders': return creator.affiliate.monthOrders;
      case 'affiliate_week_clicks': return creator.affiliate.weekClicks;
      case 'affiliate_month_content': return creator.affiliate.monthContentPieces;
      case 'affiliate_pending_balance': return creator.affiliate.pendingBalance;
      default: {
        const record = creator as unknown as Record<string, unknown>;
        return Number(record[key]) || 0;
      }
    }
  };

  const filtered = useMemo(() => {
    let result = [...creators];
    if (tierFilter !== 'all') {
      result = result.filter((c) => c.tier === tierFilter);
    }
    if (affiliateFilter === 'cmd') {
      result = result.filter((c) => c.isCmd);
    } else if (affiliateFilter === 'active_link') {
      result = result.filter((c) => c.affiliate.hasActiveLink);
    } else if (affiliateFilter === 'earners') {
      result = result.filter((c) => c.affiliate.monthCommission > 0 || c.affiliate.totalCommission > 0);
    } else if (affiliateFilter === 'needs_link') {
      result = result.filter((c) => c.isCmd && !c.affiliate.hasActiveLink);
    } else if (affiliateFilter === 'reactivate') {
      result = result.filter((c) =>
        c.isCmd &&
        c.affiliate.hasActiveLink &&
        c.affiliate.weekOrders === 0 &&
        c.affiliate.weekClicks === 0 &&
        c.affiliate.weekContentPieces === 0
      );
    }
    result.sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return result;
  }, [creators, tierFilter, affiliateFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  };

  // Summary stats
  const totalCreators = creators.length;
  const avgRoas = totalCreators > 0
    ? creators.reduce((s, c) => s + (c.lifetime_roas ?? 0), 0) / totalCreators
    : 0;
  const tierSA = creators.filter((c) => c.tier === 'S' || c.tier === 'A').length;
  const totalAdSpend = creators.reduce((s, c) => s + (c.lifetime_spend ?? 0), 0);

  const compareCreators = creators.filter((c) => compareIds.has(c.id));

  const formatCOP = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
    return `$${Math.round(val)}`;
  };

  const formatFullCOP = (val: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

  return (
    <FinanceDashboardLayout activeSection="ugc-performance">
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-purple-600" />
            <h1 className="text-xl font-bold text-foreground">UGC + Afiliados Performance</h1>
            <Badge variant="outline" className="text-xs">
              {totalCreators} creadoras
            </Badge>
            <Badge variant="outline" className="text-xs bg-pink-50 text-pink-700 border-pink-200">
              {affiliateSummary.cmdCreators} CMD
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {compareIds.size >= 2 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowComparison(true)}
              >
                <GitCompare className="h-4 w-4 mr-1" />
                Comparar ({compareIds.size})
              </Button>
            )}
            <Select value={affiliateFilter} onValueChange={(value) => setAffiliateFilter(value as AffiliateFilter)}>
              <SelectTrigger className="w-[170px] h-9">
                <SelectValue placeholder="Filtro afiliados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="cmd">CMD</SelectItem>
                <SelectItem value="active_link">Con link activo</SelectItem>
                <SelectItem value="earners">Con ganancias</SelectItem>
                <SelectItem value="needs_link">CMD sin link</SelectItem>
                <SelectItem value="reactivate">Reactivar esta semana</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Filtrar tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(Object.keys(TIER_CONFIG) as CreatorTier[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIER_CONFIG[t].emoji} {t === 'new' ? 'New' : `Tier ${t}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={computeUgcScores} disabled={computing}>
              {computing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Calculator className="h-4 w-4 mr-1" />}
              Compute Scores
            </Button>
          </div>
        </div>

        {/* Affiliate operating scoreboard */}
        <Card className="border border-pink-100 bg-gradient-to-r from-pink-50 to-orange-50">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-widest text-pink-700 font-semibold">Plan afiliados CMD</p>
                <h2 className="text-lg font-bold text-foreground">Scoreboard semanal + objetivo mensual</h2>
                <p className="text-sm text-muted-foreground">
                  12% comisión para mamá · 5% descuento cliente · ranking para incentivar contenido y ventas.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Reporte SQL semanal</p>
                <p className="text-sm font-medium">
                  {weeklyReport ? 'Activo' : 'Pendiente de migración'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <GoalProgress
                label="Revenue mes"
                value={affiliateSummary.monthRevenue}
                goal={Number(goals.revenue_goal)}
                valueLabel={formatFullCOP(affiliateSummary.monthRevenue)}
                goalLabel={formatFullCOP(Number(goals.revenue_goal))}
              />
              <GoalProgress
                label="Órdenes mes"
                value={affiliateSummary.monthOrders}
                goal={Number(goals.orders_goal)}
                valueLabel={`${affiliateSummary.monthOrders}`}
                goalLabel={`${goals.orders_goal}`}
              />
              <GoalProgress
                label="Creadoras activas semana"
                value={affiliateSummary.weekActiveCreators}
                goal={Number(goals.weekly_active_creators_goal)}
                valueLabel={`${affiliateSummary.weekActiveCreators}`}
                goalLabel={`${goals.weekly_active_creators_goal}`}
              />
              <GoalProgress
                label="Contenido mes"
                value={affiliateSummary.monthContentPieces}
                goal={Number(goals.content_pieces_goal)}
                valueLabel={`${affiliateSummary.monthContentPieces} piezas`}
                goalLabel={`${goals.content_pieces_goal}`}
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
          <MetricCard icon={<Link2 className="h-4 w-4" />} label="Links CMD" value={`${affiliateSummary.activeLinks}/${affiliateSummary.cmdCreators}`} hint={`${affiliateSummary.linkActivationRate.toFixed(0)}% activación`} />
          <MetricCard icon={<DollarSign className="h-4 w-4" />} label="Comisión semana" value={formatCOP(affiliateSummary.weekCommission)} hint={`${affiliateSummary.weekOrders} órdenes`} />
          <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="Revenue mes" value={formatCOP(affiliateSummary.monthRevenue)} hint={`${affiliateSummary.monthOrders} órdenes`} />
          <MetricCard icon={<MousePointerClick className="h-4 w-4" />} label="Clicks semana" value={`${affiliateSummary.weekClicks}`} hint="nuevo tracking" />
          <MetricCard icon={<FileVideo className="h-4 w-4" />} label="Contenido semana" value={`${affiliateSummary.weekContentPieces}`} hint="piezas UGC" />
          <MetricCard icon={<Wallet className="h-4 w-4" />} label="Saldo pendiente" value={formatCOP(affiliateSummary.pendingBalance)} hint="por pagar" />
          <MetricCard icon={<Trophy className="h-4 w-4" />} label="Tier S + A" value={`${tierSA}`} hint={`${avgRoas.toFixed(2)}x ROAS avg`} />
          <MetricCard icon={<Target className="h-4 w-4" />} label="Ad Spend" value={formatCOP(totalAdSpend)} hint="ads UGC" />
        </div>

        {/* Creator Ranking Table */}
        <Card className="border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-2 py-2 text-left w-8">#</th>
                  <th className="px-2 py-2 text-left w-8">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={compareIds.size > 0}
                      onChange={() => setCompareIds(new Set())}
                      title="Limpiar seleccion"
                    />
                  </th>
                  <th className="px-3 py-2 text-left min-w-[220px]">Creadora</th>
                  <th className="px-2 py-2 text-center">CMD</th>
                  <th className="px-2 py-2 text-center">Link</th>
                  <SortHeader label="Com sem" sortKey="affiliate_week_commission" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Com mes" sortKey="affiliate_month_commission" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Rev mes" sortKey="affiliate_month_revenue" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Órdenes" sortKey="affiliate_month_orders" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Clicks sem" sortKey="affiliate_week_clicks" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Contenido" sortKey="affiliate_month_content" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Pendiente" sortKey="affiliate_pending_balance" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-2 py-2 text-center">Tier</th>
                  <SortHeader label="Score" sortKey="overall_score" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="ROAS" sortKey="roas_score" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Engage" sortKey="engagement_score" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Conv" sortKey="conversion_score" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="ROAS x" sortKey="lifetime_roas" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Spend" sortKey="lifetime_spend" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Ads" sortKey="total_ads" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-2 py-2 text-left">Recomendación</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={21} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Cargando...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={21} className="text-center py-8 text-muted-foreground">
                      Sin datos para este filtro.
                    </td>
                  </tr>
                ) : (
                  filtered.map((creator, idx) => {
                    const avatarUrl = creator.instagram_handle
                      ? `https://unavatar.io/instagram/${creator.instagram_handle}`
                      : creator.tiktok_handle
                      ? `https://unavatar.io/tiktok/${creator.tiktok_handle}`
                      : null;
                    const displayHandle = creator.instagram_handle || creator.tiktok_handle;
                    const rec = creator.recommendation
                      ? RECOMMENDATION_CONFIG[creator.recommendation]
                      : null;
                    return (
                      <tr
                        key={creator.id}
                        className="border-b border-border hover:bg-muted/20 cursor-pointer transition-colors"
                        onClick={() => setSelectedCreator(creator)}
                      >
                        <td className="px-2 py-2.5 text-muted-foreground text-xs">{idx + 1}</td>
                        <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={compareIds.has(creator.id)}
                            onChange={() => toggleCompare(creator.id)}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full overflow-hidden bg-muted flex-shrink-0">
                              {avatarUrl ? (
                                <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                                  {creator.name.charAt(0)}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-xs truncate">{creator.name}</p>
                              {displayHandle && (
                                <p className="text-[10px] text-muted-foreground">@{displayHandle}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {creator.isCmd ? (
                            <Badge className="bg-pink-100 text-pink-700 border-0 text-[10px]">CMD</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {creator.affiliate.hasActiveLink ? (
                            <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">
                              {creator.affiliate.discountValue}% / {creator.affiliate.commissionRate}%
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">Sin link</Badge>
                          )}
                        </td>
                        <MoneyCell value={creator.affiliate.weekCommission} positive />
                        <MoneyCell value={creator.affiliate.monthCommission} positive />
                        <MoneyCell value={creator.affiliate.monthRevenue} />
                        <td className="px-2 py-2.5 text-center text-xs font-medium">
                          {creator.affiliate.monthOrders}
                        </td>
                        <td className="px-2 py-2.5 text-center text-xs">
                          {creator.affiliate.weekClicks}
                        </td>
                        <td className="px-2 py-2.5 text-center text-xs">
                          {creator.affiliate.monthContentPieces}
                        </td>
                        <MoneyCell value={creator.affiliate.pendingBalance} positive />
                        <td className="px-2 py-2.5 text-center">
                          <TierBadge tier={creator.tier} size="sm" />
                        </td>
                        <td className="px-2 py-2.5 text-center font-bold text-xs">
                          {creator.overall_score?.toFixed(0) ?? '—'}
                        </td>
                        <ScoreCell value={creator.roas_score} />
                        <ScoreCell value={creator.engagement_score} />
                        <ScoreCell value={creator.conversion_score} />
                        <td className="px-2 py-2.5 text-center text-xs">
                          <span className={creator.lifetime_roas && creator.lifetime_roas >= 2.5 ? 'text-green-600 font-medium' : creator.lifetime_roas && creator.lifetime_roas >= 1.5 ? 'text-amber-600' : 'text-red-600'}>
                            {creator.lifetime_roas?.toFixed(2) ?? '—'}x
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center text-xs text-muted-foreground">
                          {formatCOP(creator.lifetime_spend ?? 0)}
                        </td>
                        <td className="px-2 py-2.5 text-center text-xs text-muted-foreground">
                          {creator.total_ads ?? 0}
                        </td>
                        <td className="px-2 py-2.5">
                          {rec ? (
                            <Badge className={`${rec.bgClass} ${rec.textClass} text-[10px] border-0`}>
                              {rec.label}
                            </Badge>
                          ) : creator.affiliate.hasActiveLink && creator.affiliate.monthOrders === 0 ? (
                            <Badge className="bg-amber-100 text-amber-700 text-[10px] border-0">Reactivar</Badge>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Creator Profile Drawer */}
      {selectedCreator && (
        <CreatorPerformanceProfile
          creator={selectedCreator}
          open={!!selectedCreator}
          onClose={() => setSelectedCreator(null)}
        />
      )}

      {/* Comparison View */}
      {showComparison && compareCreators.length >= 2 && (
        <CreatorComparisonView
          creators={compareCreators}
          open={showComparison}
          onClose={() => setShowComparison(false)}
        />
      )}
    </FinanceDashboardLayout>
  );
};

// ─── Sub-components ──────────────────────────────────────────────

function MetricCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card className="border border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1 text-muted-foreground">
          {icon}
          <p className="text-xs">{label}</p>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function GoalProgress({
  label,
  value,
  goal,
  valueLabel,
  goalLabel,
}: {
  label: string;
  value: number;
  goal: number;
  valueLabel: string;
  goalLabel: string;
}) {
  const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
  return (
    <div className="rounded-lg bg-white/70 border border-white p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-pink-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{valueLabel}</span> / {goalLabel}
      </p>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="px-2 py-2 text-center cursor-pointer hover:bg-muted/30 select-none whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      <span className={`text-xs ${active ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
        {label}
        {active && (dir === 'desc' ? ' ↓' : ' ↑')}
      </span>
    </th>
  );
}

function ScoreCell({ value }: { value: number | null | undefined }) {
  if (value == null) return <td className="px-2 py-2.5 text-center text-xs text-muted-foreground">—</td>;
  const color =
    value >= 70 ? 'text-green-600' : value >= 45 ? 'text-amber-600' : 'text-red-600';
  return (
    <td className={`px-2 py-2.5 text-center text-xs ${color}`}>
      {Math.round(value)}
    </td>
  );
}

function MoneyCell({ value, positive = false }: { value: number; positive?: boolean }) {
  const text = value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(1)}M` : value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : value > 0 ? `$${Math.round(value)}` : '—';
  return (
    <td className={`px-2 py-2.5 text-center text-xs ${positive && value > 0 ? 'text-green-600 font-semibold' : 'text-muted-foreground'}`}>
      {text}
    </td>
  );
}

export default UgcPerformancePage;
