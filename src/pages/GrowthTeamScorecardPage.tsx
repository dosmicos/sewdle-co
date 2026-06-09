import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Gauge, Info, Loader2, RefreshCw, Users } from 'lucide-react';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import FinanceDashboardLayout from '@/components/finance-dashboard/FinanceDashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

type MetricDefinition = {
  title: string;
  description: string;
  formula?: string;
  health?: string;
  source?: string;
};

const metricDefinitions: Record<string, MetricDefinition> = {
  revenue: {
    title: 'Ventas netas del periodo',
    description: 'Ingreso Shopify válido en la semana seleccionada, alineado a Bogotá.',
    formula: 'Revenue = netSales del periodo',
    health: 'Verde si alcanza ≥95% del milestone semanal.',
    source: 'prophit-metrics / Shopify orders',
  },
  adSpend: {
    title: 'Inversión publicitaria',
    description: 'Gasto pagado total de la semana para evaluar pacing contra presupuesto.',
    formula: 'Spend = Meta + Google + TikTok/otros canales conectados',
    health: 'Verde si está ≥95% del presupuesto semanal aprobado.',
    source: 'prophit-metrics / ad_metrics_daily',
  },
  spend: {
    title: 'Inversión publicitaria',
    description: 'Mismo Spend de compañía, mostrado dentro del owner Julian.',
    formula: 'Spend = Meta + Google + TikTok/otros canales conectados',
    health: 'Debe pacear contra el contrato semanal sin romper MER/CM.',
    source: 'prophit-metrics / ad_metrics_daily',
  },
  mer: {
    title: 'Marketing Efficiency Ratio',
    description: 'Eficiencia total del gasto publicitario sobre ventas.',
    formula: 'MER = Revenue / Ad Spend',
    health: 'Rojo si cae >10% debajo del target semanal.',
    source: 'prophit-metrics',
  },
  cmPercent: {
    title: 'Contribution Margin post-tax',
    description: 'Margen después de costos variables, impuestos y pauta; antes de OpEx.',
    formula: 'CM% = (Net Sales − COGS − Shipping − Handling − Gateways − Taxes − Ad Spend) / Net Sales × 100',
    health: 'Verde ≥ target; amarillo ≥22%; rojo <22%.',
    source: 'prophit-metrics / finance settings',
  },
  newCustomers: {
    title: 'Clientes nuevos únicos',
    description: 'Clientes únicos del periodo que no tenían compra válida anterior.',
    formula: 'New customers = unique customer_id/email nuevos en la ventana',
    health: 'Verde si cumple ≥95% del target semanal.',
    source: 'Shopify orders / Customer Health logic',
  },
  aov: {
    title: 'Average Order Value',
    description: 'Ticket promedio de órdenes del periodo.',
    formula: 'AOV = Revenue / Orders',
    health: 'Meta operativa actual: COP 150.000.',
    source: 'prophit-metrics / Shopify orders',
  },
  ncpa: {
    title: 'New Customer Purchase Acquisition Cost',
    description: 'Costo de adquirir un cliente nuevo único.',
    formula: 'NCPA = Ad Spend / New customers',
    health: 'Verde si está en o por debajo del target COP 41.700.',
    source: 'ad spend + new customer count',
  },
  ncRevenuePercent: {
    title: 'Share de revenue de clientes nuevos',
    description: 'Qué porcentaje de las ventas viene de clientes nuevos vs recurrentes. Debe coincidir con Customer Health.',
    formula: 'NC-Rev% = NC Revenue / Total Revenue × 100',
    health: 'Guardrail actual: verde ≥10%, amarillo ≥5%, rojo <5%.',
    source: 'prophit-metrics normalizado a puntos porcentuales',
  },
  mutations: {
    title: 'Mutaciones de campañas',
    description: 'Cambios aprobados y ejecutados en campañas/adsets/ads.',
    formula: 'Mutaciones = conteo de cambios aprobados en el ledger Meta',
    health: 'Pendiente hasta conectar ledger Meta.',
    source: 'No disponible todavía',
  },
  graduatedAds: {
    title: 'Ads graduados',
    description: 'Creativos que pasan de Testing a Scaling/Opportunity según reglas.',
    formula: 'Graduados = ads movidos T→S→O con performance aprobada',
    health: 'Target operativo visible: 3/semana cuando aplique.',
    source: 'Pendiente ledger Meta',
  },
  testingWaste: {
    title: 'Waste de Testing',
    description: 'Porcentaje de spend de testing que no produce señal útil o ganadora.',
    formula: 'Waste = spend desperdiciado / spend de testing × 100',
    health: 'Verde ≤30%; rojo >40%.',
    source: 'Pendiente ledger Meta',
  },
  ugcPieces: {
    title: 'Piezas UGC',
    description: 'Volumen semanal de piezas UGC entregadas para desbloquear testing.',
    formula: 'UGC piezas = conteo de entregables UGC del periodo',
    health: 'Target semanal: 40; rojo si <32.',
    source: 'ugc_*',
  },
  activeCreators: {
    title: 'Creadoras activas',
    description: 'Creadoras UGC con actividad/link vigente.',
    formula: 'Active creators = creadoras activas únicas',
    health: 'Se compara contra target semanal del scorecard.',
    source: 'ugc_*',
  },
  activeLinks: {
    title: 'CMD links activos',
    description: 'Links/códigos CMD activos que pueden generar pedidos.',
    formula: 'Active links = links CMD activos',
    health: 'Meta operativa actual: 120 activos.',
    source: 'ugc_links / CMD',
  },
  cmdRevenue: {
    title: 'Revenue CMD',
    description: 'Ventas atribuidas a links/códigos CMD.',
    formula: 'CMD revenue = suma de órdenes atribuidas a CMD',
    health: 'Sin target fijo; lectura operativa.',
    source: 'ugc/CMD attribution',
  },
  cmdOrders: {
    title: 'Órdenes CMD',
    description: 'Pedidos atribuidos a links/códigos CMD.',
    formula: 'CMD orders = conteo de órdenes CMD',
    health: 'Sin target fijo; lectura operativa.',
    source: 'ugc/CMD attribution',
  },
  googleQueryMix: {
    title: 'Mix de queries Google',
    description: 'Separación entre brand/non-brand para detectar canibalización.',
    formula: 'Query mix = share brand vs non-brand de búsqueda',
    health: 'Pendiente instrumentación.',
    source: 'No disponible todavía',
  },
  pixelNcRevDeepDive: {
    title: 'Deep-dive Pixel / NC-Rev',
    description: 'Auditoría para explicar si la adquisición real viene de clientes nuevos o retorno.',
    formula: 'Reconciliación = NC-Rev% + pixel/events + mix de canales',
    health: 'Debe usarse cuando NC-Rev% o tracking se vea raro.',
    source: 'No disponible todavía',
  },
  staticsProduced: {
    title: 'Estáticos producidos',
    description: 'Imágenes/carouseles/product cards nuevos en carpetas estáticas autorizadas.',
    formula: 'Statics = imágenes Drive creadas en la ventana, excluyendo carpetas UGC',
    health: 'Target: 30/semana; rojo si <24.',
    source: 'Google Drive static assets',
  },
  angieStatics: {
    title: 'Estáticos de Angie',
    description: 'Piezas estáticas atribuidas a Angie por metadata/mapping Drive.',
    formula: 'Angie statics = assets con persona angie',
    health: 'Meta aproximada: 15/semana.',
    source: 'Google Drive identity map',
  },
  anaMariaStatics: {
    title: 'Estáticos de Ana María',
    description: 'Piezas estáticas atribuidas a Ana María por metadata/mapping Drive.',
    formula: 'Ana María statics = assets con persona ana_maria',
    health: 'Meta aproximada: 15/semana.',
    source: 'Google Drive identity map',
  },
  staticsPublished: {
    title: 'Estáticos publicados/testeados',
    description: 'Piezas producidas que sí llegaron a publicación o testing.',
    formula: 'Published/tested = assets publicados o usados en ads de testing',
    health: 'Target semanal: 24.',
    source: 'Pendiente ledger Meta/Drive',
  },
  needsReviewBacklog: {
    title: 'Backlog needs_review',
    description: 'Creativos pendientes de revisión/aprobación.',
    formula: 'Backlog = piezas con estado needs_review',
    health: 'Lower is better; pendiente fuente estructurada.',
    source: 'No disponible todavía',
  },
  trackerCompleteness: {
    title: 'Tracker completo',
    description: 'Qué tan completo está el tracker de producción/publicación.',
    formula: 'Completeness = campos requeridos completos / total requeridos',
    health: 'Higher is better; pendiente fuente estructurada.',
    source: 'No disponible todavía',
  },
  salesAngleReport: {
    title: 'Sales-angle report',
    description: 'Reporte semanal de Kira con ángulos de venta ganadores/perdedores.',
    formula: 'Disponible = AngleOS tiene ángulos estructurados para la semana',
    health: 'Debe existir cada lunes.',
    source: 'ad_tags AngleOS + ad_performance_daily',
  },
  topAnglesRanked: {
    title: 'Top ángulos rankeados',
    description: 'Ranking de ángulos creativos priorizados por performance.',
    formula: 'Ranked = ángulos con specific_angle + performance en la ventana',
    health: 'Debe alimentar la producción semanal.',
    source: 'ad_tags AngleOS + ad_performance_daily',
  },
  focusDefined: {
    title: 'Foco semanal definido',
    description: 'Brief/foco creativo que guía producción y testing de la semana.',
    formula: 'Foco definido = al menos un winner/promising de AngleOS',
    health: 'No tenerlo bloquea producción clara.',
    source: 'ad_tags AngleOS + ad_performance_daily',
  },
  anglesAtRisk: {
    title: 'Ángulos en riesgo',
    description: 'Ángulos creativos fatigados, perdedores o sin evidencia suficiente.',
    formula: 'At risk = ángulos clasificados como loser por performance',
    health: 'Verde en 0; amarillo 1–2; rojo >2.',
    source: 'ad_tags AngleOS + ad_performance_daily',
  },
  publishedToTesting: {
    title: 'Publicados a Testing ABO',
    description: 'Creativos que Hermes publicó a campañas de testing.',
    formula: 'Published to testing = ads nuevos publicados en Testing ABO',
    health: 'Debe desbloquear el ritmo de graduaciones.',
    source: 'Pendiente ledger Meta',
  },
  metaWrapperStatus: {
    title: 'Estado wrapper Meta',
    description: 'Salud del sistema que ejecuta operaciones Meta con guardrails.',
    formula: 'Wrapper status = disponibilidad + permisos + última ejecución válida',
    health: 'Debe estar disponible antes de mutaciones/pausas/escalados.',
    source: 'Pendiente Meta wrapper/cron',
  },
  driveAttributedStatics: {
    title: 'Estáticos atribuidos',
    description: 'Assets Drive asignados a una persona conocida.',
    formula: 'Attributed statics = assets con identity map resuelto',
    health: 'Los sin asignar quedan visibles, no ocultos.',
    source: 'Google Drive identity map',
  },
  briefs: {
    title: 'Briefs',
    description: 'Briefs creativos creados para guiar producción.',
    formula: 'Briefs = conteo de briefs vigentes del periodo',
    health: 'Debe alimentar producción y testing.',
    source: 'Pendiente fuente estructurada',
  },
  firstFrames: {
    title: 'First frames',
    description: 'Primeros frames/hooks visuales listos para creativos.',
    formula: 'First frames = conteo de hooks/frame concepts producidos',
    health: 'Debe alimentar rotación creativa.',
    source: 'Pendiente fuente estructurada',
  },
};

function formatCOP(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'No disponible';
  return `COP ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(value))}`;
}

function formatNumber(value: number | null, suffix = '') {
  if (value === null || !Number.isFinite(value)) return 'No disponible';
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

function percentOfTarget(kpi: GrowthKpi) {
  if (kpi.actual === null || kpi.target === null || !Number.isFinite(kpi.actual) || !Number.isFinite(kpi.target) || kpi.target === 0) {
    return null;
  }
  return (kpi.actual / kpi.target) * 100;
}

function formatPercentOfTarget(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value)}% meta`;
}

function formatKpiValue(key: string, value: number | null) {
  if (['salesAngleReport', 'focusDefined'].includes(key)) {
    if (value === null || !Number.isFinite(value)) return 'No disponible';
    return value >= 1 ? 'Sí' : 'No';
  }
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

const MetricInfo: React.FC<{ metricKey: string; side?: 'top' | 'right' | 'bottom' | 'left' }> = ({ metricKey, side = 'bottom' }) => {
  const definition = metricDefinitions[metricKey];
  if (!definition) return null;

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 shrink-0 cursor-help text-slate-300 hover:text-slate-500" aria-label={`Cómo se calcula ${kpiLabels[metricKey] ?? metricKey}`} />
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-[300px] text-xs leading-relaxed">
          <p className="mb-1 font-medium text-slate-900">{definition.title}</p>
          <p>{definition.description}</p>
          {definition.formula && <p className="mt-1 text-slate-600">{definition.formula}</p>}
          {definition.health && <p className="mt-1 text-slate-400">Salud: {definition.health}</p>}
          {definition.source && <p className="mt-1 text-slate-400">Fuente: {definition.source}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const KpiPill: React.FC<{ label: string; kpi: GrowthKpi; metricKey: string }> = ({ label, kpi, metricKey }) => {
  const targetPercent = formatPercentOfTarget(percentOfTarget(kpi));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {label}
          <MetricInfo metricKey={metricKey} />
        </span>
        <StatusBadge status={kpi.status} />
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="min-w-0 text-sm font-semibold text-slate-900">
          {formatKpiValue(metricKey, kpi.actual)}
        </span>
        {targetPercent && (
          <Badge variant="outline" className="shrink-0 border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            {targetPercent}
          </Badge>
        )}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">
        Target: {formatKpiValue(metricKey, kpi.target)}
      </div>
      <Progress value={kpiProgress(kpi)} className="mt-2 h-1.5" />
    </div>
  );
};

const OwnerCard: React.FC<{ owner: OwnerScorecard }> = ({ owner }) => {
  const entries = Object.entries(owner.kpis);
  const instrumentationPending = entries.length > 0 && entries.every(([, kpi]) => kpi.actual === null && kpi.target === null);

  return (
    <Card className="shadow-sm">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">{owner.label}</CardTitle>
            <p className="text-xs text-slate-500">{owner.role}</p>
          </div>
          {instrumentationPending ? (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[11px] px-2 py-0.5">
              Pendiente conexión
            </Badge>
          ) : (
            <StatusBadge status={owner.status} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-2">
        {instrumentationPending ? (
          <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-800">
            <p className="font-medium">Fuente aún no conectada al scorecard.</p>
            <p className="mt-1 text-blue-700">No es una métrica en cero; queda como action item de instrumentación.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {entries.map(([key, kpi]) => (
              <div key={key} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs">
                <span className="inline-flex min-w-0 items-center gap-1 font-medium text-slate-600">
                  <span className="truncate">{kpiLabels[key] ?? key}</span>
                  <MetricInfo metricKey={key} side="right" />
                </span>
                <span className="text-right text-slate-900">
                  {formatKpiValue(key, kpi.actual)}
                  {kpi.target !== null && <span className="text-slate-400"> / {formatKpiValue(key, kpi.target)}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
        {owner.notes.length > 0 && (
          <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-500">
            {owner.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

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
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-1">
                            {row.label}
                            <MetricInfo metricKey={row.key} side="right" />
                          </span>
                        </TableCell>
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
