import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { TierBadge } from './TierBadge';
import type { UgcCreator } from '@/types/ugc';

interface CreatorComparisonViewProps {
  creators: UgcCreator[];
  open: boolean;
  onClose: () => void;
}

const COLORS = ['#8b5cf6', '#3b82f6', '#22c55e'];

export const CreatorComparisonView: React.FC<CreatorComparisonViewProps> = ({
  creators,
  open,
  onClose,
}) => {
  // Build score comparison data
  const scoreLabels = ['ROAS', 'Engagement', 'Conversion', 'Consistency'];
  const scoreKeys = ['roas_score', 'engagement_score', 'conversion_score', 'consistency_score'] as const;

  const chartData = scoreLabels.map((label, i) => {
    const entry: Record<string, any> = { metric: label };
    creators.forEach((c, ci) => {
      entry[c.name] = (c as any)[scoreKeys[i]] ?? 0;
    });
    return entry;
  });

  // Metrics comparison rows
  const metricRows = [
    { label: 'Overall Score', key: 'overall_score', format: (v: number) => `${v?.toFixed(0) ?? '—'}` },
    { label: 'Tier', key: 'tier', format: (v: string) => v ?? '—', isTier: true },
    { label: 'ROAS Promedio', key: 'lifetime_roas', format: (v: number) => `${v?.toFixed(2) ?? '—'}x` },
    { label: 'Spend Total', key: 'lifetime_spend', format: (v: number) => `COP ${Math.round(v ?? 0).toLocaleString()}` },
    { label: 'Revenue Total', key: 'lifetime_revenue', format: (v: number) => `COP ${Math.round(v ?? 0).toLocaleString()}` },
    { label: 'Compras', key: 'lifetime_purchases', format: (v: number) => `${v ?? 0}` },
    { label: 'Total Ads', key: 'total_ads', format: (v: number) => `${v ?? 0}` },
    { label: 'CTR', key: 'avg_ctr', format: (v: number) => `${v?.toFixed(2) ?? '—'}%` },
    { label: 'Hook Rate', key: 'avg_hook_rate', format: (v: number) => `${v?.toFixed(1) ?? '—'}%` },
    { label: 'Hold Rate', key: 'avg_hold_rate', format: (v: number) => `${v?.toFixed(1) ?? '—'}%` },
    { label: 'LP Conv Rate', key: 'avg_lp_conv_rate', format: (v: number) => `${v?.toFixed(2) ?? '—'}%` },
    { label: 'Mejor Producto', key: 'best_product', format: (v: string) => v ?? '—' },
    { label: 'Mejor Angulo', key: 'best_angle', format: (v: string) => v ?? '—' },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comparacion de Creadoras</DialogTitle>
        </DialogHeader>

        {/* Creator Headers */}
        <div className="flex gap-3 mt-2">
          {creators.map((c, i) => {
            const avatarUrl = c.instagram_handle
              ? `https://unavatar.io/instagram/${c.instagram_handle}`
              : c.tiktok_handle
              ? `https://unavatar.io/tiktok/${c.tiktok_handle}`
              : null;
            return (
              <div key={c.id} className="flex-1 flex items-center gap-2 p-2 rounded-lg border border-border">
                <div
                  className="w-2 h-8 rounded-full"
                  style={{ backgroundColor: COLORS[i] }}
                />
                <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {c.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{c.name}</p>
                  <div className="flex items-center gap-1">
                    <TierBadge tier={c.tier} size="sm" />
                    <span className="text-[10px] text-muted-foreground">{c.overall_score?.toFixed(0)}/100</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Score Comparison Chart */}
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Scores</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="metric" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} width={30} />
                <RechartsTooltip contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {creators.map((c, i) => (
                  <Bar key={c.id} dataKey={c.name} fill={COLORS[i]} radius={[2, 2, 0, 0]} barSize={24} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Metrics Comparison Table */}
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Metricas</h3>
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-1.5 text-left">Metrica</th>
                  {creators.map((c) => (
                    <th key={c.id} className="px-3 py-1.5 text-center">{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metricRows.map((row) => {
                  // Find best value for highlighting
                  const values = creators.map((c) => (c as any)[row.key]);
                  const numericValues = values.filter((v) => typeof v === 'number');
                  const bestVal = numericValues.length > 0 ? Math.max(...numericValues) : null;

                  return (
                    <tr key={row.key} className="border-b border-border last:border-0">
                      <td className="px-3 py-1.5 text-muted-foreground">{row.label}</td>
                      {creators.map((c, i) => {
                        const val = (c as any)[row.key];
                        const isBest = typeof val === 'number' && val === bestVal && numericValues.length > 1;
                        return (
                          <td
                            key={c.id}
                            className={`px-3 py-1.5 text-center ${isBest ? 'font-bold text-green-600' : ''}`}
                          >
                            {(row as any).isTier ? (
                              <TierBadge tier={val} size="sm" />
                            ) : (
                              row.format(val)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
