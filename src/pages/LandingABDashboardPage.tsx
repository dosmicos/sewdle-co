import React, { useMemo, useState } from 'react';
import { FlaskConical, Loader2, RefreshCw, Trophy } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import FinanceDashboardLayout from '@/components/finance-dashboard/FinanceDashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLandingABDashboard, type ExperimentSummary, type VariantStats } from '@/hooks/useLandingABDashboard';
import { cn } from '@/lib/utils';

const CONTROL_COLOR = '#6b7280';
const CHALLENGER_COLOR = '#c0552d';
const MIN_ORDERS_FOR_READ = 30; // below this we say "juntando datos"

function formatCOP(v: number | null) {
  if (v === null || !Number.isFinite(v)) return '—';
  return `COP ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(v))}`;
}
function formatCvr(v: number | null) {
  if (v === null || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(2)}%`;
}
function formatPctRaw(v: number | null, digits = 1) {
  if (v === null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}%`;
}
function formatNum(v: number | null) {
  if (v === null || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('es-CO').format(v);
}

const VariantCard: React.FC<{ v: VariantStats; leader: boolean }> = ({ v, leader }) => (
  <Card className={cn('shadow-sm', leader && 'border-emerald-300 bg-emerald-50/40')}>
    <CardContent className="p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {v.role === 'control' ? 'Control' : 'Retador'}
        </span>
        {leader && <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-800">Va ganando</Badge>}
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-900">{v.label}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div><p className="text-[11px] text-slate-500">CVR</p><p className="text-lg font-bold text-slate-900">{formatCvr(v.cvr)}</p></div>
        <div><p className="text-[11px] text-slate-500">Visitas</p><p className="text-lg font-semibold text-slate-700">{formatNum(v.visits)}</p></div>
        <div><p className="text-[11px] text-slate-500">Compras</p><p className="text-sm font-semibold text-slate-700">{formatNum(v.orders)}</p></div>
        <div><p className="text-[11px] text-slate-500">Rev/visita</p><p className="text-sm font-semibold text-slate-700">{formatCOP(v.rpv)}</p></div>
      </div>
    </CardContent>
  </Card>
);

const MetricRow: React.FC<{ label: string; c: string; ch: string; highlightC?: boolean; highlightCh?: boolean }> = ({ label, c, ch, highlightC, highlightCh }) => (
  <TableRow>
    <TableCell className="font-medium text-slate-700">{label}</TableCell>
    <TableCell className={cn('text-right tabular-nums', highlightC && 'font-bold text-emerald-700')}>{c}</TableCell>
    <TableCell className={cn('text-right tabular-nums', highlightCh && 'font-bold text-emerald-700')}>{ch}</TableCell>
  </TableRow>
);

const ExperimentView: React.FC<{ exp: ExperimentSummary }> = ({ exp }) => {
  const { control, challenger, significance: sig } = exp;
  const leaderRole = sig.winner === 'control' || sig.winner === 'challenger' ? sig.winner : null;
  const totalOrders = control.orders + challenger.orders;

  const chartData = exp.timeseries.map((t) => ({
    day: t.day.slice(5),
    control: t.controlCvr !== null ? t.controlCvr * 100 : null,
    challenger: t.challengerCvr !== null ? t.challengerCvr * 100 : null,
  }));

  return (
    <div className="space-y-5">
      {/* Verdict banner */}
      <Card className="shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-50 p-2"><FlaskConical className="h-5 w-5 text-orange-600" /></div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{exp.name}</p>
              <p className="text-xs text-slate-500">
                {exp.destinationPath} · día {exp.daysRunning}{exp.status === 'running' ? ' / 14' : ''}
                {exp.status !== 'running' ? ` · ${exp.status}` : ''}
              </p>
            </div>
          </div>
          <div className="text-right">
            {sig.significant && leaderRole ? (
              <div className="flex items-center justify-end gap-1.5">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-slate-900">
                  Gana {leaderRole === 'challenger' ? challenger.label : control.label}
                </span>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-800">
                  {formatPctRaw(sig.confidencePct, 0)} conf.
                </Badge>
              </div>
            ) : (
              <Badge variant="outline" className="bg-slate-100 text-slate-600">
                {totalOrders < MIN_ORDERS_FOR_READ ? 'Juntando datos' : `Sin diferencia clara (${formatPctRaw(sig.confidencePct, 0)} conf.)`}
              </Badge>
            )}
            {sig.upliftPct !== null && Number.isFinite(sig.upliftPct) && (
              <p className="mt-0.5 text-xs text-slate-500">
                Uplift CVR del retador:{' '}
                <span className={cn('font-semibold', sig.upliftPct >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                  {sig.upliftPct >= 0 ? '+' : ''}{formatPctRaw(sig.upliftPct, 1)}
                </span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <VariantCard v={control} leader={leaderRole === 'control'} />
        <VariantCard v={challenger} leader={leaderRole === 'challenger'} />
      </section>

      {/* CVR evolution chart */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-semibold text-slate-900">Evolución del CVR (acumulado)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Tooltip
                  formatter={(value: number | null, name: string) => [
                    value != null ? `${Number(value).toFixed(2)}%` : '—',
                    name === 'control' ? control.label : challenger.label,
                  ]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend formatter={(v) => (v === 'control' ? control.label : challenger.label)} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="control" stroke={CONTROL_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                <Line type="monotone" dataKey="challenger" stroke={CHALLENGER_COLOR} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Comparison table */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-semibold text-slate-900">Comparación</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-4 pt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-right">{control.label} (control)</TableHead>
                <TableHead className="text-right">{challenger.label} (retador)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <MetricRow label="Visitas" c={formatNum(control.visits)} ch={formatNum(challenger.visits)} />
              <MetricRow label="Compras" c={formatNum(control.orders)} ch={formatNum(challenger.orders)} />
              <MetricRow label="CVR" c={formatCvr(control.cvr)} ch={formatCvr(challenger.cvr)} highlightC={leaderRole === 'control'} highlightCh={leaderRole === 'challenger'} />
              <MetricRow label="AOV" c={formatCOP(control.aov)} ch={formatCOP(challenger.aov)} />
              <MetricRow label="Revenue por visita" c={formatCOP(control.rpv)} ch={formatCOP(challenger.rpv)} />
              <MetricRow label="Revenue total" c={formatCOP(control.revenue)} ch={formatCOP(challenger.revenue)} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const LandingABDashboardPage: React.FC = () => {
  const dash = useLandingABDashboard();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const experiments = dash.data?.experiments ?? [];

  const active = useMemo(() => {
    if (!experiments.length) return null;
    return experiments.find((e) => e.slug === selectedSlug) ?? experiments[0];
  }, [experiments, selectedSlug]);

  if (dash.isLoading) {
    return (
      <FinanceDashboardLayout activeSection="landing-ab">
        <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      </FinanceDashboardLayout>
    );
  }

  if (dash.error) {
    return (
      <FinanceDashboardLayout activeSection="landing-ab">
        <div className="mx-auto max-w-[900px] p-6 pt-16 md:pt-6">
          <Card><CardContent className="p-6 text-sm text-red-600">No se pudo cargar el dashboard: {dash.error.message}</CardContent></Card>
        </div>
      </FinanceDashboardLayout>
    );
  }

  return (
    <FinanceDashboardLayout activeSection="landing-ab">
      <div className="mx-auto max-w-[1400px] space-y-5 p-4 pt-16 md:p-6 md:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">A/B de Landings</h1>
              <Badge variant="outline" className="bg-orange-50 text-orange-700">
                {experiments.length} experimento{experiments.length === 1 ? '' : 's'}
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              Split en la landing · medición ground-truth Shopify
              {dash.data ? ` · ${dash.data.period.start} → ${dash.data.period.end}` : ''}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => dash.refetch()} disabled={dash.isFetching}>
            {dash.isFetching ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Refrescar
          </Button>
        </div>

        {experiments.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {experiments.map((e) => (
              <Button key={e.slug} variant={active?.slug === e.slug ? 'default' : 'outline'} size="sm" onClick={() => setSelectedSlug(e.slug)}>
                {e.name}
              </Button>
            ))}
          </div>
        )}

        {!active ? (
          <Card><CardContent className="p-8 text-center text-sm text-slate-500">No hay experimentos de A/B de landings todavía.</CardContent></Card>
        ) : (
          <ExperimentView exp={active} />
        )}
      </div>
    </FinanceDashboardLayout>
  );
};

export default LandingABDashboardPage;
