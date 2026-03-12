import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, TrendingUp, DollarSign, ShoppingCart, Target, Award } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';
import { TierBadge } from './TierBadge';
import { useUgcCreatorDetail } from '@/hooks/useUgcPerformance';
import { RECOMMENDATION_CONFIG, type UgcCreator } from '@/types/ugc';

interface CreatorPerformanceProfileProps {
  creator: UgcCreator;
  open: boolean;
  onClose: () => void;
}

export const CreatorPerformanceProfile: React.FC<CreatorPerformanceProfileProps> = ({
  creator,
  open,
  onClose,
}) => {
  const { ads, weeklyRoas, isLoading } = useUgcCreatorDetail(creator.id);

  const avatarUrl = creator.instagram_handle
    ? `https://unavatar.io/instagram/${creator.instagram_handle}`
    : null;

  const scoreData = [
    { name: 'ROAS', score: creator.roas_score ?? 0, fill: '#8b5cf6' },
    { name: 'Engagement', score: creator.engagement_score ?? 0, fill: '#3b82f6' },
    { name: 'Conversion', score: creator.conversion_score ?? 0, fill: '#22c55e' },
    { name: 'Consistency', score: creator.consistency_score ?? 0, fill: '#f59e0b' },
    { name: 'ROI', score: creator.roi_score ?? 0, fill: '#ef4444' },
  ];

  const rec = creator.recommendation ? RECOMMENDATION_CONFIG[creator.recommendation] : null;

  const formatCOP = (val: number) => `COP ${Math.round(val).toLocaleString()}`;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={creator.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">
                  {creator.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-lg">{creator.name}</SheetTitle>
                <TierBadge tier={creator.tier} size="md" showLabel />
              </div>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {creator.instagram_handle && (
                  <a
                    href={`https://instagram.com/${creator.instagram_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-0.5"
                  >
                    @{creator.instagram_handle} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <span className="text-xs font-bold text-foreground">
                  Score: {creator.overall_score?.toFixed(0) ?? '—'}/100
                </span>
              </div>
              {rec && (
                <Badge className={`${rec.bgClass} ${rec.textClass} text-[10px] border-0 mt-1`}>
                  {rec.label} — {rec.description}
                </Badge>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          {/* Score Breakdown */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Score Breakdown</h3>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreData} layout="vertical" margin={{ left: 80, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} width={75} />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 11 }}
                    formatter={(v: number) => [`${Math.round(v)}/100`, 'Score']}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={16}>
                    {scoreData.map((entry, i) => (
                      <rect key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Lifetime Metrics */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Metricas Lifetime</h3>
            <div className="grid grid-cols-3 gap-2">
              <MetricCard icon={<DollarSign className="h-3.5 w-3.5" />} label="Spend" value={formatCOP(creator.lifetime_spend ?? 0)} />
              <MetricCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Revenue" value={formatCOP(creator.lifetime_revenue ?? 0)} />
              <MetricCard icon={<Target className="h-3.5 w-3.5" />} label="ROAS" value={`${(creator.lifetime_roas ?? 0).toFixed(2)}x`} color={
                (creator.lifetime_roas ?? 0) >= 2.5 ? 'text-green-600' : (creator.lifetime_roas ?? 0) >= 1.5 ? 'text-amber-600' : 'text-red-600'
              } />
              <MetricCard icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Compras" value={String(creator.lifetime_purchases ?? 0)} />
              <MetricCard icon={<Award className="h-3.5 w-3.5" />} label="Mejor Producto" value={creator.best_product ?? '—'} sub={creator.best_product_roas ? `${creator.best_product_roas.toFixed(2)}x` : undefined} />
              <MetricCard icon={<Award className="h-3.5 w-3.5" />} label="Mejor Angulo" value={creator.best_angle ?? '—'} sub={creator.best_angle_roas ? `${creator.best_angle_roas.toFixed(2)}x` : undefined} />
            </div>
          </div>

          {/* ROAS Trend */}
          {weeklyRoas.length > 1 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">ROAS Semanal</h3>
              <div className="h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyRoas} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 9 }}
                      tickLine={false}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} width={30} />
                    <RechartsTooltip
                      contentStyle={{ fontSize: 11 }}
                      formatter={(v: number) => [`${v}x`, 'ROAS']}
                      labelFormatter={(l: string) => `Semana ${l}`}
                    />
                    <Line type="monotone" dataKey="roas" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Ads Table */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
              Ads ({ads.length})
            </h3>
            {ads.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">Sin ads vinculados</p>
            ) : (
              <div className="border border-border rounded-md overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-2 py-1.5 text-left">Ad</th>
                      <th className="px-2 py-1.5 text-center">Producto</th>
                      <th className="px-2 py-1.5 text-center">ROAS</th>
                      <th className="px-2 py-1.5 text-center">Spend</th>
                      <th className="px-2 py-1.5 text-center">Revenue</th>
                      <th className="px-2 py-1.5 text-center">Dias</th>
                      <th className="px-2 py-1.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ads.map((ad) => (
                      <tr key={ad.id} className="border-b border-border last:border-0">
                        <td className="px-2 py-1.5 max-w-[180px] truncate">{ad.ad_name ?? ad.ad_id}</td>
                        <td className="px-2 py-1.5 text-center text-muted-foreground">{ad.product ?? '—'}</td>
                        <td className={`px-2 py-1.5 text-center font-medium ${
                          ad.roas >= 2.5 ? 'text-green-600' : ad.roas >= 1.5 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {ad.roas.toFixed(2)}x
                        </td>
                        <td className="px-2 py-1.5 text-center text-muted-foreground">
                          {formatCOP(ad.total_spend)}
                        </td>
                        <td className="px-2 py-1.5 text-center text-muted-foreground">
                          {formatCOP(ad.total_revenue)}
                        </td>
                        <td className="px-2 py-1.5 text-center text-muted-foreground">
                          {ad.days_active ?? '—'}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <Badge
                            variant="outline"
                            className={`text-[9px] ${
                              ad.current_status === 'active' ? 'bg-green-50 text-green-700' :
                              ad.current_status === 'fatigued' ? 'bg-red-50 text-red-700' :
                              'bg-gray-50 text-gray-600'
                            }`}
                          >
                            {ad.current_status ?? '—'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

function MetricCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
      <p className={`text-sm font-semibold truncate ${color ?? 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
