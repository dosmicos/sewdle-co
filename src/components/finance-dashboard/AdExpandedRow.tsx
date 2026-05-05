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
import { Badge } from '@/components/ui/badge';
import { type AdPerformanceRow } from '@/hooks/useAdPerformance';
import { type AdTagData, type AdCreativeData, type AdLifecycleData } from '@/hooks/useAdTags';

interface Props {
  ad: AdPerformanceRow;
  formatCurrency: (n: number) => string;
  formatNumber: (n: number) => string;
  tagData?: AdTagData;
  creativeData?: AdCreativeData;
  lifecycleData?: AdLifecycleData;
}

// ── Funnel Step ───────────────────────────────────────────────────

interface FunnelStep {
  label: string;
  value: number;
  rate?: string;
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

// ── Info Item ─────────────────────────────────────────────────────

const InfoItem: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div>
      <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
      <p className="text-xs text-gray-700 mt-0.5">{value}</p>
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────

const AdExpandedRow: React.FC<Props> = ({
  ad,
  formatCurrency,
  formatNumber,
  tagData,
  creativeData,
  lifecycleData,
}) => {
  const hasVideo = ad.video_thruplay != null;
  const videoData = getVideoCompletionData(ad);
  const hasIntelligence = !!tagData || !!creativeData || !!lifecycleData;

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
    date: d.date.slice(5),
    roas: Number(d.roas.toFixed(2)),
  }));

  return (
    <div className="bg-gray-50 border-t border-gray-200 px-4 py-4 space-y-5">
      {/* Intelligence Section */}
      {hasIntelligence && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Creative Content */}
          {creativeData && (
            <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
              <h4 className="text-xs font-semibold text-gray-600">Creative Content</h4>
              {creativeData.primary_text && (
                <p className="text-xs text-gray-700 line-clamp-3">{creativeData.primary_text}</p>
              )}
              <InfoItem label="Headline" value={creativeData.headline} />
              <InfoItem label="CTA" value={creativeData.call_to_action?.replace(/_/g, ' ')} />
              {creativeData.destination_url && (
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">URL</span>
                  <p className="text-xs text-blue-600 mt-0.5 truncate">{creativeData.destination_url}</p>
                </div>
              )}
              {creativeData.media_type && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {creativeData.media_type}
                </Badge>
              )}
            </div>
          )}

          {/* Tags */}
          {tagData && (
            <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
              <h4 className="text-xs font-semibold text-gray-600">Tags & Classification</h4>
              <div className="flex flex-wrap gap-1">
                {tagData.creative_type && (
                  <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">
                    {tagData.creative_type}
                  </Badge>
                )}
                {tagData.sales_angle && (
                  <Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-700">
                    {tagData.sales_angle.replace(/_/g, ' ')}
                  </Badge>
                )}
                {tagData.copy_type && (
                  <Badge variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-700">
                    {tagData.copy_type.replace(/_/g, ' ')}
                  </Badge>
                )}
                {tagData.funnel_stage && (
                  <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700">
                    {tagData.funnel_stage.toUpperCase()}
                  </Badge>
                )}
                {tagData.offer_type && (
                  <Badge variant="secondary" className="text-[10px] bg-green-50 text-green-700">
                    {tagData.offer_value || tagData.offer_type}
                  </Badge>
                )}
                {tagData.product_name && (
                  <Badge variant="outline" className="text-[10px]">
                    {tagData.product_name}
                  </Badge>
                )}
                {tagData.ugc_creator_handle && (
                  <Badge variant="outline" className="text-[10px]">
                    {tagData.ugc_creator_handle}
                  </Badge>
                )}
              </div>
              {tagData.hook_description && (
                <InfoItem label="Hook" value={tagData.hook_description} />
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-gray-400">
                  {tagData.tagged_by === 'ai_auto' ? '🤖 AI + Rules' : '📏 Rules only'}
                </span>
                {tagData.confidence && (
                  <span className={`text-[10px] ${
                    tagData.confidence === 'alto' ? 'text-green-600' :
                    tagData.confidence === 'medio' ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    Confidence: {tagData.confidence}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Audience + Lifecycle */}
          <div className="space-y-3">
            {tagData?.audience_type && (
              <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                <h4 className="text-xs font-semibold text-gray-600">Audience</h4>
                <InfoItem label="Type" value={tagData.audience_type_detail || tagData.audience_type} />
                <InfoItem label="Gender" value={tagData.audience_gender} />
                <InfoItem label="Age" value={tagData.audience_age_range} />
                <InfoItem label="Location" value={tagData.audience_location} />
                <InfoItem label="Country" value={tagData.target_country} />
                {tagData.is_advantage_plus && (
                  <Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-600">
                    Advantage+
                  </Badge>
                )}
              </div>
            )}

            {lifecycleData && (
              <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                <h4 className="text-xs font-semibold text-gray-600">Lifecycle</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <InfoItem label="Status" value={lifecycleData.current_status} />
                  <InfoItem label="Days Active" value={lifecycleData.days_active?.toString()} />
                  <InfoItem label="Lifetime ROAS" value={lifecycleData.lifetime_roas?.toFixed(2) + 'x'} />
                  <InfoItem label="Lifetime CPA" value={
                    lifecycleData.lifetime_cpa != null
                      ? formatCurrency(lifecycleData.lifetime_cpa)
                      : null
                  } />
                  {lifecycleData.fatigue_start_date && (
                    <InfoItem label="Fatigue Start" value={lifecycleData.fatigue_start_date} />
                  )}
                  {lifecycleData.days_to_fatigue != null && (
                    <InfoItem label="Days to Fatigue" value={lifecycleData.days_to_fatigue.toString()} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
