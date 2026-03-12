import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { type AdPerformanceRow } from '@/hooks/useAdPerformance';

interface Props {
  ad: AdPerformanceRow;
  formatCurrency: (n: number) => string;
  formatNumber: (n: number) => string;
}

// ── Funnel Step ───────────────────────────────────────────────────

interface FunnelStep {
  label: string;
  value: number;
  rate?: string; // conversion rate to next step
}

const FunnelBar: React.FC<{ step: FunnelStep; maxValue: number; isLast: boolean }> = ({
  step,
  maxValue,
  isLast,
}) => {
  const pct = maxValue > 0 ? (step.value / maxValue) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col items-center gap-1">
      <span className="text-[10px] text-gray-500 font-medium">{step.label}</span>
      <div className="w-full h-8 bg-gray-100 rounded relative overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded transition-all"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-800">
        {step.value.toLocaleString('es-CO')}
      </span>
      {!isLast && step.rate && (
        <span className="text-[10px] text-gray-400">{step.rate}</span>
      )}
    </div>
  );
};

// ── Video completion data ─────────────────────────────────────────

function getVideoCompletionData(ad: AdPerformanceRow) {
  if (ad.video_thruplay == null) return null;
  return [
    { label: 'ThruPlay', value: ad.video_thruplay || 0 },
    { label: '25%', value: ad.video_p25 || 0 },
    { label: '50%', value: ad.video_p50 || 0 },
    { label: '75%', value: ad.video_p75 || 0 },
    { label: '95%', value: ad.video_p95 || 0 },
    { label: '100%', value: ad.video_p100 || 0 },
  ];
}

// ── Component ─────────────────────────────────────────────────────

const AdExpandedRow: React.FC<Props> = ({ ad, formatCurrency, formatNumber }) => {
  const hasVideo = ad.video_thruplay != null;
  const videoData = getVideoCompletionData(ad);

  // Build funnel steps
  const funnelSteps: FunnelStep[] = [
    {
      label: 'Impressions',
      value: ad.impressions,
      rate: ad.impressions > 0
        ? `${((ad.clicks / ad.impressions) * 100).toFixed(1)}%`
        : undefined,
    },
    {
      label: 'Clicks',
      value: ad.clicks,
      rate: ad.clicks > 0 && ad.landing_page_views > 0
        ? `${((ad.landing_page_views / ad.clicks) * 100).toFixed(1)}%`
        : undefined,
    },
    {
      label: 'LP Views',
      value: ad.landing_page_views,
      rate: ad.landing_page_views > 0
        ? `${((ad.add_to_cart / ad.landing_page_views) * 100).toFixed(1)}%`
        : undefined,
    },
    {
      label: 'ATC',
      value: ad.add_to_cart,
      rate: ad.add_to_cart > 0
        ? `${((ad.initiate_checkout / ad.add_to_cart) * 100).toFixed(1)}%`
        : undefined,
    },
    {
      label: 'Checkout',
      value: ad.initiate_checkout,
      rate: ad.initiate_checkout > 0
        ? `${((ad.purchases / ad.initiate_checkout) * 100).toFixed(1)}%`
        : undefined,
    },
    { label: 'Purchase', value: ad.purchases },
  ];

  const maxFunnelValue = Math.max(...funnelSteps.map((s) => s.value), 1);

  // ROAS trend chart data
  const roasTrendData = (ad.dailyData || []).map((d) => ({
    date: d.date.slice(5), // MM-DD
    roas: Number(d.roas.toFixed(2)),
  }));

  return (
    <div className="bg-gray-50 border-t border-gray-200 px-4 py-4 space-y-5">
      {/* Funnel */}
      <div>
        <h4 className="text-xs font-semibold text-gray-600 mb-2">
          Funnel de Conversión
        </h4>
        <div className="flex items-end gap-1">
          {funnelSteps.map((step, i) => (
            <React.Fragment key={step.label}>
              <FunnelBar
                step={step}
                maxValue={maxFunnelValue}
                isLast={i === funnelSteps.length - 1}
              />
              {i < funnelSteps.length - 1 && (
                <span className="text-gray-300 text-xs pb-3">→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className={`grid gap-4 ${hasVideo ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {/* ROAS Trend (7 days) */}
        {roasTrendData.length >= 2 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-600 mb-2">
              ROAS Tendencia
            </h4>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={roasTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    width={30}
                  />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 11 }}
                    formatter={(v: number) => [`${v}x`, 'ROAS']}
                  />
                  <Line
                    type="monotone"
                    dataKey="roas"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Video completion curve */}
        {hasVideo && videoData && (
          <div>
            <h4 className="text-xs font-semibold text-gray-600 mb-2">
              Retención de Video
            </h4>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={videoData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    width={40}
                  />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 11 }}
                    formatter={(v: number) => [v.toLocaleString('es-CO'), 'Views']}
                  />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Key metrics summary */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <span>
          <strong>Spend:</strong> {formatCurrency(ad.spend)}
        </span>
        <span>
          <strong>Revenue:</strong> {formatCurrency(ad.revenue)}
        </span>
        <span>
          <strong>ROAS:</strong> {ad.roas.toFixed(2)}x
        </span>
        <span>
          <strong>CPA:</strong> {ad.purchases > 0 ? formatCurrency(ad.cpa) : '-'}
        </span>
        {ad.atc_to_purchase != null && (
          <span>
            <strong>ATC→Purchase:</strong> {ad.atc_to_purchase.toFixed(1)}%
          </span>
        )}
        {ad.checkout_rate != null && (
          <span>
            <strong>Checkout Rate:</strong> {ad.checkout_rate.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};

export default AdExpandedRow;
