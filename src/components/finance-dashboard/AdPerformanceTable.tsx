import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import AdExpandedRow from './AdExpandedRow';

// ── Color thresholds ──────────────────────────────────────────────

type ThresholdDef = { green: number; yellow: number; invert?: boolean };

const THRESHOLDS: Record<string, ThresholdDef> = {
  roas: { green: 3.0, yellow: 1.5 },
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

function getStatusDot(roas: number): string {
  if (roas >= 3.0) return 'bg-green-500';
  if (roas >= 1.5) return 'bg-amber-500';
  return 'bg-red-500';
}

// ── Sort helpers ──────────────────────────────────────────────────

type SortKey = keyof AdPerformanceRow | 'status';
type SortDir = 'asc' | 'desc';

// ── Props ─────────────────────────────────────────────────────────

interface Props {
  ads: AdPerformanceRow[];
  formatCurrency: (n: number) => string;
  formatNumber: (n: number) => string;
  formatPercent: (n: number) => string;
}

const AdPerformanceTable: React.FC<Props> = ({
  ads,
  formatCurrency,
  formatNumber,
  formatPercent,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedAdId, setExpandedAdId] = useState<string | null>(null);

  // Get unique campaigns
  const campaigns = useMemo(() => {
    const set = new Set(ads.map((a) => a.campaign_name).filter(Boolean));
    return Array.from(set).sort();
  }, [ads]);

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
      result = result.filter((a) => a.spend > 0 && a.roas < 1.5);
    }

    return result;
  }, [ads, search, campaignFilter, statusFilter]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const key = sortKey === 'status' ? 'roas' : sortKey;
      const aVal = (a as any)[key] ?? 0;
      const bVal = (b as any)[key] ?? 0;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filtered, sortKey, sortDir]);

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
          <span className="text-xs text-gray-400 ml-auto">
            {sorted.length} ads
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
                <TH colKey="spend" label="Spend" />
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
                      {/* Status dot */}
                      <td className="px-2 py-2 text-center">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${getStatusDot(ad.roas)}`}
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
                      {/* Spend */}
                      <td className="px-2 py-2 text-gray-900 font-medium whitespace-nowrap">
                        {formatCurrency(ad.spend)}
                      </td>
                      {/* Revenue */}
                      <td className="px-2 py-2 text-gray-900 whitespace-nowrap">
                        {formatCurrency(ad.revenue)}
                      </td>
                      {/* ROAS */}
                      <td className={`px-2 py-2 whitespace-nowrap ${getColorClass('roas', ad.roas)}`}>
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
                        <td colSpan={hasTrend ? 18 : 17} className="p-0">
                          <AdExpandedRow
                            ad={ad}
                            formatCurrency={formatCurrency}
                            formatNumber={formatNumber}
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
