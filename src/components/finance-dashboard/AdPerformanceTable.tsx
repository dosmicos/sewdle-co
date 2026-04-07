import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { type AdPerformanceRow } from '@/hooks/useAdPerformance';
import { type AdTagData, type AdCreativeData, type AdLifecycleData } from '@/hooks/useAdTags';
import AdExpandedRow from './AdExpandedRow';

// ── Color thresholds ──────────────────────────────────────────────

type ThresholdDef = { green: number; yellow: number; invert?: boolean };

const THRESHOLDS: Record<string, ThresholdDef> = {
  roas: { green: 3.0, yellow: 1.5 },
  amer: { green: 1.5, yellow: 1.0 },
  nc_roas: { green: 1.5, yellow: 1.0 },
  cpa: { green: 25000, yellow: 35000, invert: true },
  ctr: { green: 1.8, yellow: 1.2 },
  cpm: { green: 15000, yellow: 25000, invert: true },
  frequency: { green: 2.5, yellow: 3.5, invert: true },
  hook_rate: { green: 35, yellow: 25 },
  hold_rate: { green: 30, yellow: 20 },
  lp_conv_rate: { green: 3.5, yellow: 2 },
  atc_rate: { green: 8, yellow: 5 },
};

function getColorClass(metric: string, value: number | null): string {
  if (value == null) return '';
  const t = THRESHOLDS[metric];
  if (!t) return '';

  if (t.invert) {
    // Lower is better (CPA, CPM, Frequency)
    if (value <= t.green) return 'text-green-600 font-medium';
    if (value <= t.yellow) return 'text-amber-600 font-medium';
    return 'text-red-600 font-medium';
  }
  // Higher is better
  if (value >= t.green) return 'text-green-600 font-medium';
  if (value >= t.yellow) return 'text-amber-600 font-medium';
  return 'text-red-600 font-medium';
}

function getStatusDot(amer: number): string {
  if (amer >= 1.5) return 'bg-green-500';
  if (amer >= 1.0) return 'bg-amber-500';
  return 'bg-red-500';
}

// ── Audience & Tag helpers ───────────────────────────────────────

const AUDIENCE_COLORS: Record<string, string> = {
  lookalike: 'bg-purple-100 text-purple-700',
  retargeting: 'bg-blue-100 text-blue-700',
  interest: 'bg-green-100 text-green-700',
  broad: 'bg-yellow-100 text-yellow-700',
  advantage_plus: 'bg-gray-100 text-gray-700',
  custom_compradores: 'bg-pink-100 text-pink-700',
  custom_other: 'bg-indigo-100 text-indigo-700',
};

const PHASE_COLORS: Record<string, string> = {
  testing: 'bg-blue-100 text-blue-700',
  scaling: 'bg-green-100 text-green-700',
  mature: 'bg-emerald-100 text-emerald-700',
  declining: 'bg-red-100 text-red-700',
  inactive: 'bg-gray-100 text-gray-500',
  active: 'bg-amber-100 text-amber-700',
};

function getAudienceBadgeClass(type: string | null | undefined): string {
  if (!type) return 'bg-gray-100 text-gray-500';
  return AUDIENCE_COLORS[type] || 'bg-gray-100 text-gray-500';
}

function getPhaseBadgeClass(phase: string | null | undefined): string {
  if (!phase) return '';
  return PHASE_COLORS[phase] || 'bg-gray-100 text-gray-500';
}

// ── Sort helpers ──────────────────────────────────────────────────

type SortKey = keyof AdPerformanceRow | 'status' | 'audience_type' | 'phase';
type SortDir = 'asc' | 'desc';

// ── Props ─────────────────────────────────────────────────────────

interface Props {
  ads: AdPerformanceRow[];
  formatCurrency: (n: number) => string;
  formatNumber: (n: number) => string;
  formatPercent: (n: number) => string;
  tagsMap?: Map<string, AdTagData>;
  creativesMap?: Map<string, AdCreativeData>;
  lifecycleMap?: Map<string, AdLifecycleData>;
}

const AdPerformanceTable: React.FC<Props> = ({
  ads,
  formatCurrency,
  formatNumber,
  formatPercent,
  tagsMap,
  creativesMap,
  lifecycleMap,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [audienceFilter, setAudienceFilter] = useState<string>('all');
  const [expandedAdId, setExpandedAdId] = useState<string | null>(null);

  const hasTags = tagsMap && tagsMap.size > 0;

  // Global new customer % (same value for all ads since it comes from Shopify)
  const globalNewPct = useMemo(() => {
    if (ads.length === 0) return '0.0';
    return (ads[0].new_customer_pct * 100).toFixed(1);
  }, [ads]);

  // Get unique campaigns
  const campaigns = useMemo(() => {
    const set = new Set(ads.map((a) => a.campaign_name).filter(Boolean));
    return Array.from(set).sort();
  }, [ads]);

  // Get unique audience types from tags
  const audienceTypes = useMemo(() => {
    if (!tagsMap) return [];
    const set = new Set<string>();
    for (const tag of tagsMap.values()) {
      if (tag.audience_type) set.add(tag.audience_type);
    }
    return Array.from(set).sort();
  }, [tagsMap]);

  // Filter
  const filtered = useMemo(() => {
    let result = ads;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.ad_name.toLowerCase().includes(q) ||
          a.campaign_name.toLowerCase().includes(q) ||
          a.adset_name.toLowerCase().includes(q)
      );
    }

    if (campaignFilter !== 'all') {
      result = result.filter((a) => a.campaign_name === campaignFilter);
    }

    if (statusFilter === 'problem') {
      result = result.filter((a) => a.spend > 0 && a.amer < 1.0);
    }

    if (audienceFilter !== 'all' && tagsMap) {
      result = result.filter((a) => {
        const tag = tagsMap.get(a.ad_id);
        return tag?.audience_type === audienceFilter;
      });
    }

    return result;
  }, [ads, search, campaignFilter, statusFilter, audienceFilter, tagsMap]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortKey === 'status') {
        aVal = a.amer;
        bVal = b.amer;
      } else if (sortKey === 'audience_type') {
        aVal = tagsMap?.get(a.ad_id)?.audience_type || '';
        bVal = tagsMap?.get(b.ad_id)?.audience_type || '';
      } else if (sortKey === 'phase') {
        aVal = a.phase || '';
        bVal = b.phase || '';
      } else {
        aVal = (a as any)[sortKey] ?? 0;
        bVal = (b as any)[sortKey] ?? 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filtered, sortKey, sortDir, tagsMap]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
    if (sortKey !== colKey)
      return <ChevronsUpDown className="h-3 w-3 text-gray-400" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3 w-3 text-gray-700" />
    ) : (
      <ChevronDown className="h-3 w-3 text-gray-700" />
    );
  };

  const TH: React.FC<{ colKey: SortKey; label: string; className?: string }> = ({
    colKey,
    label,
    className = '',
  }) => (
    <th
      className={`px-2 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none whitespace-nowrap ${className}`}
      onClick={() => handleSort(colKey)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        <SortIcon colKey={colKey} />
      </span>
    </th>
  );

  const TrendIcon = ({ trend }: { trend?: 'up' | 'down' | 'stable' }) => {
    if (!trend || trend === 'stable')
      return <Minus className="h-3 w-3 text-gray-400" />;
    if (trend === 'up')
      return <TrendingUp className="h-3 w-3 text-green-500" />;
    return <TrendingDown className="h-3 w-3 text-red-500" />;
  };

  if (ads.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        No hay datos de ads. Sincroniza para ver el rendimiento individual.
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Buscar ad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="Todas las campañas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las campañas</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="problem">Problemáticos</SelectItem>
            </SelectContent>
          </Select>
          {audienceTypes.length > 0 && (
            <Select value={audienceFilter} onValueChange={setAudienceFilter}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Audiencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las audiencias</SelectItem>
                {audienceTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="text-xs text-gray-400 ml-auto flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-gray-500">
                  <Info className="h-3 w-3" />
                  New Cust: {globalNewPct}%
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">% global de ingresos de clientes nuevos en el periodo (calculado desde Shopify). Se aplica a todos los ads para estimar AMER.</p>
              </TooltipContent>
            </Tooltip>
            <span>{sorted.length} ads</span>
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <TH colKey="status" label="" className="w-8" />
                <TH colKey="ad_name" label="Ad" className="min-w-[180px]" />
                <TH colKey="campaign_name" label="Campaign" />
                <TH colKey="adset_name" label="Ad Set" />
                {hasTags && <TH colKey="audience_type" label="Audience" />}
                {hasTags && (
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                    Tags
                  </th>
                )}
                <TH colKey="phase" label="Phase" />
                <TH colKey="spend" label="Spend" />
                <th
                  className="px-2 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                  onClick={() => handleSort('amer')}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5">
                        AMER
                        <Info className="h-3 w-3 text-gray-400" />
                        <SortIcon colKey={'amer' as SortKey} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs font-medium">Acquisition Marketing Efficiency Ratio</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        AMER estimado: usa el % global de nuevos clientes de Shopify ({globalNewPct}%) aplicado al revenue de cada ad. No es atribucion per-ad.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </th>
                <TH colKey="revenue" label="Revenue" />
                <TH colKey="roas" label="ROAS" />
                <TH colKey="purchases" label="Purch" />
                <TH colKey="cpa" label="CPA" />
                <TH colKey="ctr" label="CTR%" />
                <TH colKey="cpm" label="CPM" />
                <TH colKey="frequency" label="Freq" />
                <TH colKey="landing_page_views" label="LP Views" />
                <TH colKey="atc_rate" label="ATC%" />
                <TH colKey="lp_conv_rate" label="LP Conv%" />
                <TH colKey="hook_rate" label="Hook%" />
                <TH colKey="hold_rate" label="Hold%" />
                {sorted.some((a) => a.trend) && (
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 w-8">
                    Trend
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((ad) => {
                const isExpanded = expandedAdId === ad.ad_id;
                const hasTrend = sorted.some((a) => a.trend);
                return (
                  <React.Fragment key={ad.ad_id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() =>
                        setExpandedAdId(isExpanded ? null : ad.ad_id)
                      }
                    >
                      {/* Status dot (based on AMER) */}
                      <td className="px-2 py-2 text-center">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${getStatusDot(ad.amer)}`}
                        />
                      </td>
                      {/* Ad name */}
                      <td className="px-2 py-2 max-w-[180px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate block font-medium text-gray-900">
                              {ad.ad_name}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs">{ad.ad_name}</p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      {/* Campaign */}
                      <td className="px-2 py-2 text-gray-600 max-w-[120px]">
                        <span className="truncate block">{ad.campaign_name}</span>
                      </td>
                      {/* Ad Set */}
                      <td className="px-2 py-2 text-gray-600 max-w-[120px]">
                        <span className="truncate block">{ad.adset_name}</span>
                      </td>
                      {/* Audience */}
                      {hasTags && (() => {
                        const tag = tagsMap?.get(ad.ad_id);
                        return (
                          <td className="px-2 py-2">
                            {tag?.audience_type ? (
                              <Badge
                                variant="secondary"
                                className={`text-[10px] px-1.5 py-0 font-medium ${getAudienceBadgeClass(tag.audience_type)}`}
                              >
                                {tag.audience_type.replace(/_/g, ' ')}
                              </Badge>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })()}
                      {/* Tags */}
                      {hasTags && (() => {
                        const tag = tagsMap?.get(ad.ad_id);
                        const pills: string[] = [];
                        if (tag?.creative_type) pills.push(tag.creative_type);
                        if (tag?.sales_angle) pills.push(tag.sales_angle);
                        if (tag?.product) pills.push(tag.product);
                        return (
                          <td className="px-2 py-2 max-w-[160px]">
                            {pills.length > 0 ? (
                              <div className="flex flex-wrap gap-0.5">
                                {pills.slice(0, 3).map((p) => (
                                  <Badge
                                    key={p}
                                    variant="outline"
                                    className="text-[10px] px-1 py-0 font-normal text-gray-600 border-gray-200"
                                  >
                                    {p.replace(/_/g, ' ')}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })()}
                      {/* Phase (computed client-side from spend in selected range) */}
                      <td className="px-2 py-2">
                        {ad.phase ? (
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 font-medium ${getPhaseBadgeClass(ad.phase)}`}
                          >
                            {ad.phase}
                          </Badge>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      {/* Spend */}
                      <td className="px-2 py-2 text-gray-900 font-medium whitespace-nowrap">
                        {formatCurrency(ad.spend)}
                      </td>
                      {/* AMER (NC-ROAS) */}
                      <td className={`px-2 py-2 whitespace-nowrap ${getColorClass('amer', ad.amer)}`}>
                        {ad.amer.toFixed(2)}x
                      </td>
                      {/* Revenue */}
                      <td className="px-2 py-2 text-gray-900 whitespace-nowrap">
                        {formatCurrency(ad.revenue)}
                      </td>
                      {/* ROAS (blended) */}
                      <td className={`px-2 py-2 whitespace-nowrap text-gray-500`}>
                        {ad.roas.toFixed(2)}x
                      </td>
                      {/* Purchases */}
                      <td className="px-2 py-2 text-gray-700">
                        {formatNumber(ad.purchases)}
                      </td>
                      {/* CPA */}
                      <td className={`px-2 py-2 whitespace-nowrap ${getColorClass('cpa', ad.cpa)}`}>
                        {ad.purchases > 0 ? formatCurrency(ad.cpa) : '-'}
                      </td>
                      {/* CTR */}
                      <td className={`px-2 py-2 ${getColorClass('ctr', ad.ctr)}`}>
                        {formatPercent(ad.ctr)}
                      </td>
                      {/* CPM */}
                      <td className={`px-2 py-2 whitespace-nowrap ${getColorClass('cpm', ad.cpm)}`}>
                        {formatCurrency(ad.cpm)}
                      </td>
                      {/* Frequency */}
                      <td className={`px-2 py-2 ${getColorClass('frequency', ad.frequency)}`}>
                        {ad.frequency.toFixed(1)}
                      </td>
                      {/* LP Views */}
                      <td className="px-2 py-2 text-gray-700">
                        {formatNumber(ad.landing_page_views)}
                      </td>
                      {/* ATC Rate */}
                      <td className={`px-2 py-2 ${getColorClass('atc_rate', ad.atc_rate)}`}>
                        {ad.atc_rate != null ? `${ad.atc_rate.toFixed(1)}%` : '-'}
                      </td>
                      {/* LP Conv Rate */}
                      <td className={`px-2 py-2 ${getColorClass('lp_conv_rate', ad.lp_conv_rate)}`}>
                        {ad.lp_conv_rate != null ? `${ad.lp_conv_rate.toFixed(1)}%` : '-'}
                      </td>
                      {/* Hook Rate */}
                      <td className={`px-2 py-2 ${getColorClass('hook_rate', ad.hook_rate)}`}>
                        {ad.hook_rate != null ? `${ad.hook_rate.toFixed(1)}%` : '-'}
                      </td>
                      {/* Hold Rate */}
                      <td className={`px-2 py-2 ${getColorClass('hold_rate', ad.hold_rate)}`}>
                        {ad.hold_rate != null ? `${ad.hold_rate.toFixed(1)}%` : '-'}
                      </td>
                      {/* Trend */}
                      {hasTrend && (
                        <td className="px-2 py-2 text-center">
                          <TrendIcon trend={ad.trend} />
                        </td>
                      )}
                    </tr>
                    {/* Expanded detail */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={100} className="p-0">
                          <AdExpandedRow
                            ad={ad}
                            formatCurrency={formatCurrency}
                            formatNumber={formatNumber}
                            tagData={tagsMap?.get(ad.ad_id)}
                            creativeData={creativesMap?.get(ad.ad_id)}
                            lifecycleData={lifecycleMap?.get(ad.ad_id)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default AdPerformanceTable;
