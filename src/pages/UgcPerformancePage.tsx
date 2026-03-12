import React, { useState, useMemo } from 'react';
import FinanceDashboardLayout from '@/components/finance-dashboard/FinanceDashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Calculator, Trophy, TrendingUp, Loader2, ArrowUpDown, ExternalLink, GitCompare } from 'lucide-react';
import { useUgcPerformance } from '@/hooks/useUgcPerformance';
import { TierBadge } from '@/components/finance-dashboard/TierBadge';
import { CreatorPerformanceProfile } from '@/components/finance-dashboard/CreatorPerformanceProfile';
import { CreatorComparisonView } from '@/components/finance-dashboard/CreatorComparisonView';
import { TIER_CONFIG, RECOMMENDATION_CONFIG, type CreatorTier, type UgcCreator } from '@/types/ugc';

type SortKey = 'overall_score' | 'lifetime_roas' | 'lifetime_spend' | 'total_ads' | 'roas_score' | 'engagement_score' | 'conversion_score' | 'consistency_score';

const UgcPerformancePage: React.FC = () => {
  const { creators, creatorAdsMap, isLoading, computing, computeUgcScores } = useUgcPerformance();
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('overall_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedCreator, setSelectedCreator] = useState<UgcCreator | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);

  const filtered = useMemo(() => {
    let result = [...creators];
    if (tierFilter !== 'all') {
      result = result.filter((c) => c.tier === tierFilter);
    }
    result.sort((a, b) => {
      const aVal = Number((a as any)[sortKey]) || 0;
      const bVal = Number((b as any)[sortKey]) || 0;
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return result;
  }, [creators, tierFilter, sortKey, sortDir]);

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

  return (
    <FinanceDashboardLayout activeSection="ugc-performance">
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-purple-600" />
            <h1 className="text-xl font-bold text-foreground">UGC Performance</h1>
            <Badge variant="outline" className="text-xs">
              {totalCreators} creadoras
            </Badge>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Creadoras Tracked</p>
              </div>
              <p className="text-2xl font-bold">{totalCreators}</p>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">ROAS Promedio</p>
              </div>
              <p className="text-2xl font-bold">{avgRoas.toFixed(2)}x</p>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Tier S + A</p>
              </div>
              <p className="text-2xl font-bold">{tierSA}</p>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Ad Spend Total</p>
              </div>
              <p className="text-2xl font-bold">{formatCOP(totalAdSpend)}</p>
            </CardContent>
          </Card>
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
                  <th className="px-3 py-2 text-left">Creadora</th>
                  <th className="px-2 py-2 text-center">Tier</th>
                  <SortHeader label="Score" sortKey="overall_score" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="ROAS" sortKey="roas_score" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Engage" sortKey="engagement_score" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Conv" sortKey="conversion_score" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Consist" sortKey="consistency_score" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="ROAS x" sortKey="lifetime_roas" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Spend" sortKey="lifetime_spend" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Ads" sortKey="total_ads" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-2 py-2 text-left">Recomendacion</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={13} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Cargando...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center py-8 text-muted-foreground">
                      Sin datos. Ejecuta "Compute Scores" para calcular.
                    </td>
                  </tr>
                ) : (
                  filtered.map((creator, idx) => {
                    const avatarUrl = creator.instagram_handle
                      ? `https://unavatar.io/instagram/${creator.instagram_handle}`
                      : null;
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
                              <p className="text-[10px] text-muted-foreground">@{creator.instagram_handle}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <TierBadge tier={creator.tier} size="sm" />
                        </td>
                        <td className="px-2 py-2.5 text-center font-bold text-xs">
                          {creator.overall_score?.toFixed(0) ?? '—'}
                        </td>
                        <ScoreCell value={creator.roas_score} />
                        <ScoreCell value={creator.engagement_score} />
                        <ScoreCell value={creator.conversion_score} />
                        <ScoreCell value={creator.consistency_score} />
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
                          {rec && (
                            <Badge className={`${rec.bgClass} ${rec.textClass} text-[10px] border-0`}>
                              {rec.label}
                            </Badge>
                          )}
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
      className="px-2 py-2 text-center cursor-pointer hover:bg-muted/30 select-none"
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

export default UgcPerformancePage;
