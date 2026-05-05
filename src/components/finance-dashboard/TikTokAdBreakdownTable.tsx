import React, { useMemo, useState } from 'react';
import { useTikTokAdsBreakdown, type TikTokAdBreakdownRow } from '@/hooks/useTikTokAdsBreakdown';
import { type DateRange } from '@/hooks/useFinanceDateRange';
import { ArrowUpDown, ExternalLink, Loader2 } from 'lucide-react';

const formatMoney = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n);

const formatNumber = (n: number) =>
  new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n);

const formatPercent = (n: number) => `${n.toFixed(2)}%`;
const formatRoas = (n: number) => `${n.toFixed(2)}x`;

type SortKey =
  | 'spend'
  | 'roas'
  | 'ctr'
  | 'cpc'
  | 'purchases'
  | 'video_views'
  | 'hold_rate';

interface Props {
  range: DateRange;
}

const TikTokAdBreakdownTable: React.FC<Props> = ({ range }) => {
  const { rows, isLoading } = useTikTokAdsBreakdown(range);
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-500">
          No hay datos de TikTok Ads para este rango de fechas. Conecta tu cuenta y
          sincroniza para ver el desglose por creativo.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Creativo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Campaña</th>
              <SortableHeader
                label="Spend"
                active={sortKey === 'spend'}
                dir={sortDir}
                onClick={() => toggleSort('spend')}
              />
              <SortableHeader
                label="ROAS"
                active={sortKey === 'roas'}
                dir={sortDir}
                onClick={() => toggleSort('roas')}
              />
              <SortableHeader
                label="CTR"
                active={sortKey === 'ctr'}
                dir={sortDir}
                onClick={() => toggleSort('ctr')}
              />
              <SortableHeader
                label="CPC"
                active={sortKey === 'cpc'}
                dir={sortDir}
                onClick={() => toggleSort('cpc')}
              />
              <SortableHeader
                label="Compras"
                active={sortKey === 'purchases'}
                dir={sortDir}
                onClick={() => toggleSort('purchases')}
              />
              <SortableHeader
                label="Video views"
                active={sortKey === 'video_views'}
                dir={sortDir}
                onClick={() => toggleSort('video_views')}
              />
              <SortableHeader
                label="Hold rate"
                active={sortKey === 'hold_rate'}
                dir={sortDir}
                onClick={() => toggleSort('hold_rate')}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedRows.map((row) => (
              <AdRow key={row.tiktok_ad_id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SortableHeader: React.FC<{
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
}> = ({ label, active, dir, onClick }) => (
  <th className="text-right px-4 py-3 font-medium text-gray-700">
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 hover:text-gray-900 ${
        active ? 'text-gray-900' : ''
      }`}
    >
      {label}
      <ArrowUpDown
        className={`h-3 w-3 ${active ? 'opacity-100' : 'opacity-40'} ${
          active && dir === 'asc' ? 'rotate-180' : ''
        }`}
      />
    </button>
  </th>
);

const AdRow: React.FC<{ row: TikTokAdBreakdownRow }> = ({ row }) => {
  const thumbnail = row.image_urls?.[0];

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt=""
              className="w-10 h-10 rounded object-cover bg-gray-100 flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-gray-400">video</span>
            </div>
          )}
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate max-w-[240px]">
              {row.ad_name || `Ad ${row.tiktok_ad_id.slice(-6)}`}
            </div>
            {row.ad_text && (
              <div className="text-xs text-gray-500 truncate max-w-[240px]">
                {row.ad_text}
              </div>
            )}
          </div>
          {row.landing_url && (
            <a
              href={row.landing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-700"
              title="Abrir landing"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="text-gray-700 truncate max-w-[180px]">
          {row.campaign_name || '-'}
        </div>
        <div className="text-xs text-gray-500 truncate max-w-[180px]">
          {row.adgroup_name || ''}
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{formatMoney(row.spend)}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        <span className={row.roas >= 1 ? 'text-green-600' : 'text-gray-700'}>
          {formatRoas(row.roas)}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{formatPercent(row.ctr)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatMoney(row.cpc)}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        {formatNumber(row.purchases)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {formatNumber(row.video_views)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {formatPercent(row.hold_rate)}
      </td>
    </tr>
  );
};

export default TikTokAdBreakdownTable;
