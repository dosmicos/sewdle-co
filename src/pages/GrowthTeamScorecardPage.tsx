import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Gauge, Loader2, RefreshCw, Users } from 'lucide-react';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import FinanceDashboardLayout from '@/components/finance-dashboard/FinanceDashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGrowthTeamScorecard, type GrowthKpi, type GrowthRiskMatrixRow, type KpiStatus, type OwnerScorecard } from '@/hooks/useGrowthTeamScorecard';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const statusClasses: Record<KpiStatus, string> = {
  green: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  yellow: 'bg-amber-100 text-amber-800 border-amber-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  missing: 'bg-slate-100 text-slate-600 border-slate-200',
};

const statusLabel: Record<KpiStatus, string> = {
  green: 'Verde',
  yellow: 'Amarillo',
  red: 'Rojo',
  missing: 'No disponible',
};

const statusTextClasses: Record<KpiStatus, string> = {
  green: 'text-emerald-600',
  yellow: 'text-amber-600',
  red: 'text-red-600',
  missing: 'text-slate-400',
};

const kpiLabels: Record<string, string> = {
  revenue: 'Revenue',
  adSpend: 'Spend',
  mer: 'MER',
  cmPercent: 'CM%',
  newCustomers: 'New customers',
  aov: 'AOV',
  ncpa: 'NCPA',
  ncRevenuePercent: 'NC-Rev%',
  spend: 'Spend',
  mutations: 'Mutaciones',
  graduatedAds: 'Ads graduados T→S→O',
  testingWaste: 'Waste Testing',
  ugcPieces: 'UGC piezas',
  activeCreators: 'Creadoras activas',
  activeLinks: 'CMD links activos',
  cmdRevenue: 'CMD revenue',
  cmdOrders: 'CMD orders',
  googleQueryMix: 'Google query mix',
  pixelNcRevDeepDive: 'Pixel / NC-Rev deep-dive',
  staticsProduced: 'Statics producidos',
  angieStatics: 'Angie statics',
  anaMariaStatics: 'Ana María statics',
  staticsPublished: 'Statics publicados/tested',
  needsReviewBacklog: 'Backlog needs_review',
  trackerCompleteness: 'Tracker completo',
  salesAngleReport: 'Sales-angle report',
  topAnglesRanked: 'Top ángulos rankeados',
  focusDefined: 'Foco semanal definido',
  anglesAtRisk: 'Ángulos en riesgo',
  publishedToTesting: 'Publicados a Testing ABO',
  metaWrapperStatus: 'Wrapper Meta status',
  driveAttributedStatics: 'Statics atribuidos',
  briefs: 'Briefs',
  firstFrames: 'First frames',
};

function formatCOP(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'No disponible';
  return `COP ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(value))}`;
}

function formatNumber(value: number | null, suffix = '') {
  if (value === null || !Number.isFinite(value)) return 'No disponible';
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

function formatKpiValue(key: string, value: number | null) {
  if (['revenue', 'adSpend', 'spend', 'cmdRevenue', 'aov', 'ncpa'].includes(key)) return formatCOP(value);
  if (['mer'].includes(key)) return formatNumber(value, 'x');
  if (['cmPercent', 'ncRevenuePercent', 'testingWaste'].includes(key)) return formatNumber(value, '%');
  return formatNumber(value);
}

function formatRiskValue(row: GrowthRiskMatrixRow, value: number | null) {
  if (row.valueType === 'cop') return formatCOP(value);
  if (row.valueType === 'mer') return formatNumber(value, 'x');
  if (row.valueType === 'percent') return formatNumber(value, '%');
  return formatNumber(value);
}

function kpiProgress(kpi: GrowthKpi) {
  if (kpi.progress === null || !Number.isFinite(kpi.progress)) return 0;
  return Math.max(0, Math.min(100, kpi.progress));
}

const StatusBadge: React.FC<{ status: KpiStatus; className?: string }> = ({ status, className }) => (
  <Badge variant="outline" className={cn('text-[11px] px-2 py-0.5', statusClasses[status], className)}>
    {statusLabel[status]}
  </Badge>
);

const KpiPill: React.FC<{ label: string; kpi: GrowthKpi; metricKey: string }> = ({ label, kpi, metricKey }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <StatusBadge status={kpi.status} />
    </div>
    <div className="mt-2 text-sm font-semibold text-slate-900">
      {formatKpiValue(metricKey, kpi.actual)}
    </div>
    <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
      <span className="text-slate-500">Target: {formatKpiValue(metricKey, kpi.target)}</span>
      {kpi.progress !== null && Number.isFinite(kpi.progress) && (
        <span className={cn('font-semibold tabular-nums', statusTextClasses[kpi.status])}>
          Llevamos {formatNumber(Math.round(kpi.progress), '%')}
        </span>
      )}
    </div>
    <Progress value={kpiProgress(kpi)} className="mt-2 h-1.5" />
  </div>
);

const OwnerCard: React.FC<{ owner: OwnerScorecard }> = ({ owner }) => (
  <Card className="shadow-sm">
    <CardHeader className="p-4 pb-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <CardTitle className="text-sm font-semibold text-slate-900">{owner.label}</CardTitle>
          <p className="text-xs text-slate-500">{owner.role}</p>
        </div>
        <StatusBadge status={owner.status} />
      </div>
    </CardHeader>
    <CardContent className="space-y-3 p-4 pt-2">
      <div className="grid grid-cols-1 gap-2">
        {Object.entries(owner.kpis).map(([key, kpi]) => (
          <div key={key} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs">
            <span className="font-medium text-slate-600">{kpiLabels[key] ?? key}</span>
            <span className="text-right text-slate-900">
              {formatKpiValue(key, kpi.actual)}
              {kpi.target !== null && <span className="text-slate-400"> / {formatKpiValue(key, kpi.target)}</span>}
            </span>
          </div>
        ))}
      </div>
      {owner.notes.length > 0 && (
        <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-500">
          {owner.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}
    </CardContent>
  </Card>
);

const GrowthTeamScorecardPage: React.FC = () => {
  // Weekly milestones run Monday→Sunday; the backend treats period_end as
  // exclusive (Monday + 7). Default to the current week's Monday.
  const currentWeekStart = useMemo(
    () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    []
  );
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const weekEnd = useMemo(() => format(addDays(parseISO(weekStart), 7), 'yyyy-MM-dd'), [weekStart]);
  const isCurrentWeek = weekStart === currentWeekStart;
  const canGoNext = weekStart < currentWeekStart; // never navigate into future weeks
  const weekRangeLabel = useMemo(() => {
    const s = parseISO(weekStart);
    const e = addDays(s, 6); // inclusive Sunday
    return `${format(s, 'd MMM', { locale: es })} – ${format(e, 'd MMM', { locale: es })}`;
  }, [weekStart]);

  const goPrevWeek = () => setWeekStart((w) => format(addDays(parseISO(w), -7), 'yyyy-MM-dd'));
  const goNextWeek = () => setWeekStart((w) => (w < currentWeekStart ? format(addDays(parseISO(w), 7), 'yyyy-MM-dd') : w));
  const goCurrentWeek = () => setWeekStart(currentWeekStart);

  const scorecard = useGrowthTeamScorecard({ periodStart: weekStart, periodEnd: weekEnd });
  const data = scorecard.data;

  const handleSyncDrive = async () => {
    try {
      await scorecard.syncDriveStatics.mutateAsync(45);
      toast.success('Drive static creatives sincronizado');
    } catch (err) {
      toast.error(`No se pudo sincronizar Drive: ${(err as Error).message}`);
    }
  };

  if (scorecard.isLoading) {
    return (
      <FinanceDashboardLayout activeSection="team-scorecard">
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </FinanceDashboardLayout>
    );
  }

  if (scorecard.error || !data) {
    return (
      <FinanceDashboardLayout activeSection="team-scorecard">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900">No pude cargar el Team Scorecard</h1>
            <p className="mt-1 text-sm text-slate-500">{scorecard.error?.message ?? 'Respuesta vacía'}</p>
          </div>
          <Button onClick={() => scorecard.refetch()}>Reintentar</Button>
        </div>
      </FinanceDashboardLayout>
    );
  }

  const overallStatus = data.blockers.some((b) => b.severity === 'red') ? 'red' : data.blockers.length > 0 ? 'yellow' : 'green';
  const periodEndInclusive = new Date(`${data.period.end}T12:00:00Z`);
  periodEndInclusive.setUTCDate(periodEndInclusive.getUTCDate() - 1);
  const periodEndLabel = periodEndInclusive.toISOString().slice(0, 10);
  const ownerCards = [
    data.owners.julian,
    data.owners.sebastian,
    data.owners.creativeProduction,
    data.owners.kira,
    data.owners.hermes,
  ].filter(Boolean) as OwnerScorecard[];
  const riskRows = data.riskMatrix ?? [];

  return (
    <FinanceDashboardLayout activeSection="team-scorecard">
      <div className="mx-auto max-w-[1400px] space-y-5 p-4 pt-16 md:p-6 md:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Junio 600M Operating Dashboard</h1>
              <StatusBadge status={overallStatus} />
              <Badge variant="outline" className="bg-blue-50 text-blue-700">Milestones no lineales</Badge>
              <Badge variant="outline" className="bg-purple-50 text-purple-700">Owners + agentes IA</Badge>
            </div>
            <p className="text-sm text-slate-500">{data.period.label} · {data.period.start} → {periodEndLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Week selector — Mon→Sun weeks, capped at the current week */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-slate-600 hover:text-slate-900"
                onClick={goPrevWeek}
                aria-label="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex min-w-[110px] items-center justify-center gap-1.5 px-1 text-xs font-medium text-slate-700">
                {scorecard.isFetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                ) : (
                  <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                )}
                <span className="whitespace-nowrap capitalize">{weekRangeLabel}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-slate-600 hover:text-slate-900 disabled:opacity-30"
                onClick={goNextWeek}
                disabled={!canGoNext}
                aria-label="Semana siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {!isCurrentWeek && (
              <Button variant="outline" size="sm" onClick={goCurrentWeek}>
                Semana actual
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => scorecard.refetch()} disabled={scorecard.isFetching}>
              {scorecard.isFetching ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Refrescar
            </Button>
            <Button size="sm" onClick={handleSyncDrive} disabled={scorecard.syncDriveStatics.isPending}>
              {scorecard.syncDriveStatics.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Sync Drive
            </Button>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Card className="border-blue-100 bg-blue-50/50 shadow-sm xl:col-span-2">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Gauge className="h-4 w-4 text-blue-600" /> Contrato semanal
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 p-4 pt-2 text-xs md:grid-cols-4">
              <div><p className="text-slate-500">Revenue</p><p className="font-semibold text-slate-900">{formatCOP(data.milestone.revenue_target)}</p></div>
              <div><p className="text-slate-500">Spend</p><p className="font-semibold text-slate-900">{formatCOP(data.milestone.ad_spend_budget)}</p></div>
              <div><p className="text-slate-500">MER</p><p className="font-semibold text-slate-900">{formatNumber(data.milestone.mer_target, 'x')}</p></div>
              <div><p className="text-slate-500">NC</p><p className="font-semibold text-slate-900">{formatNumber(data.milestone.new_customers_target)}</p></div>
            </CardContent>
          </Card>
          <KpiPill label="Revenue" metricKey="revenue" kpi={data.company.revenue} />
          <KpiPill label="Spend" metricKey="adSpend" kpi={data.company.adSpend} />
          <KpiPill label="MER" metricKey="mer" kpi={data.company.mer} />
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <KpiPill label="New customers" metricKey="newCustomers" kpi={data.company.newCustomers} />
          <KpiPill label="CM% post-tax" metricKey="cmPercent" kpi={data.company.cmPercent} />
          <KpiPill label="AOV" metricKey="aov" kpi={data.company.aov} />
          <KpiPill label="NCPA" metricKey="ncpa" kpi={data.company.ncpa} />
          <KpiPill label="NC-Rev%" metricKey="ncRevenuePercent" kpi={data.company.ncRevenuePercent} />
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-5">
          {ownerCards.map((owner) => <OwnerCard key={owner.label} owner={owner} />)}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">Risk matrix — triggers automáticos</CardTitle>
                  <p className="text-xs text-slate-500">Semáforos del anexo 600M. Si no hay fuente confiable, queda No disponible y se abre action item.</p>
                </div>
                <Badge variant="outline" className="bg-slate-50">{riskRows.filter((row) => row.status === 'red').length} rojos</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>KPI</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead className="text-right">Real / target</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Trigger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {riskRows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell className="text-xs text-slate-600">{row.owner}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs">
                          {formatRiskValue(row, row.actual)}
                          {row.target !== null && <span className="text-slate-400"> / {formatRiskValue(row, row.target)}</span>}
                        </TableCell>
                        <TableCell><StatusBadge status={row.status} /></TableCell>
                        <TableCell className="max-w-[340px] text-xs text-slate-500">{row.trigger}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Action items / blockers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-2">
              {data.blockers.map((blocker) => (
                <div key={`${blocker.owner}-${blocker.message}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">{blocker.owner}</span>
                    <StatusBadge status={blocker.severity} />
                  </div>
                  <p className="mt-1 text-slate-600">{blocker.message}</p>
                </div>
              ))}
              {data.blockers.length === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Sin blockers críticos.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">Static creative production by product</CardTitle>
                  <p className="text-xs text-slate-500">Meta 30/semana entre Angie + Ana María 50/50. Solo imágenes en Estáticos/static roots; carpetas UGC excluidas.</p>
                </div>
                <Badge variant="outline" className="bg-slate-50">
                  {data.staticCreatives.total}/{data.staticCreatives.target} esta semana
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Angie</TableHead>
                      <TableHead className="text-right">Ana María</TableHead>
                      <TableHead className="text-right">Shared/Sin asignar</TableHead>
                      <TableHead>Último upload</TableHead>
                      <TableHead>Folder</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.staticCreatives.byProduct.map((row) => (
                      <TableRow key={row.productKey}>
                        <TableCell className="font-medium">{row.productName}</TableCell>
                        <TableCell className="text-right">{row.total}</TableCell>
                        <TableCell className="text-right">{row.byPerson.angie ?? 0}</TableCell>
                        <TableCell className="text-right">{row.byPerson.ana_maria ?? 0}</TableCell>
                        <TableCell className="text-right">{(row.byPerson.shared ?? 0) + (row.byPerson.unknown ?? 0)}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-500">{row.lastUploadAt ? row.lastUploadAt.slice(0, 10) : '—'}</TableCell>
                        <TableCell>
                          <a className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline" href={row.folderUrl} target="_blank" rel="noreferrer">
                            Abrir <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users className="h-4 w-4 text-blue-600" />
                Roles corregidos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-2 text-xs text-slate-600">
              <p><strong>Kira:</strong> dirección creativa IA con sales-angle report y foco semanal.</p>
              <p><strong>Angie + Ana María:</strong> productoras 50/50; target 30/semana, ~15 c/u.</p>
              <p><strong>Hermes:</strong> ops, publicación a Testing ABO, pausas, medición y graduación T→S→O.</p>
              <p><strong>info@dosmicos.co:</strong> Shared / Sin asignar hasta confirmación explícita; no se atribuye a Ana María por defecto.</p>
              <p className="text-slate-400">Fuentes: {data.metadata.sources.join(', ')} · computed {new Date(data.metadata.computedAt).toLocaleString('es-CO')}</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-900">Últimos assets estáticos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-2">
              {data.staticCreatives.latestAssets.length === 0 && <p className="text-xs text-slate-500">Sin imágenes nuevas en la ventana actual.</p>}
              {data.staticCreatives.latestAssets.map((asset) => (
                <div key={`${asset.createdTime}-${asset.name}`} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-700">{asset.name}</p>
                    <p className="text-slate-500">{asset.productName} · {asset.personLabel} · {asset.createdTime.slice(0, 10)}</p>
                  </div>
                  {asset.webViewLink && (
                    <a className="text-blue-600 hover:underline" href={asset.webViewLink} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-900">Data no disponible = action item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-2 text-xs text-slate-600">
              <p>El dashboard no inventa proxies silenciosos. Las métricas sin fuente confiable se muestran como <strong>No disponible</strong> y quedan en blockers/instrumentación.</p>
              <div className="flex flex-wrap gap-1.5">
                {data.metadata.missingMetrics.map((metric) => (
                  <Badge key={metric} variant="outline" className="bg-slate-50 text-[10px] text-slate-600">{metric}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </FinanceDashboardLayout>
  );
};

export default GrowthTeamScorecardPage;
