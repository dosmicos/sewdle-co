import React, { useState, useMemo } from 'react';
import {
  Brain,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  Shield,
  Eye,
  Zap,
  TrendingUp,
  BookOpen,
  BarChart3,
  Scale,
  Filter,
} from 'lucide-react';
import FinanceDashboardLayout from '@/components/finance-dashboard/FinanceDashboardLayout';
import { useAdAnalysis } from '@/hooks/useAdAnalysis';
import type { AdAnalysisReport, AdRecommendation, AgentLearning, AgentBenchmark, AgentRule } from '@/hooks/useAdAnalysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Helpers ────────────────────────────────────────────────────

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CO', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const AUTONOMY_CONFIG: Record<
  number,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  1: {
    label: 'Observando',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: <Eye className="h-4 w-4" />,
  },
  2: {
    label: 'Recomendando',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
    icon: <Brain className="h-4 w-4" />,
  },
  3: {
    label: 'Actuando',
    color: 'text-green-700',
    bgColor: 'bg-green-50 border-green-200',
    icon: <Zap className="h-4 w-4" />,
  },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-50 border-red-200 text-red-800',
  high: 'bg-orange-50 border-orange-200 text-orange-800',
  medium: 'bg-amber-50 border-amber-200 text-amber-800',
  low: 'bg-green-50 border-green-200 text-green-800',
};

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  critical: <AlertCircle className="h-4 w-4 text-red-500" />,
  high: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  medium: <Info className="h-4 w-4 text-amber-500" />,
  low: <CheckCircle2 className="h-4 w-4 text-green-500" />,
};

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ─── Report Card ────────────────────────────────────────────────

const ReportCard: React.FC<{ report: AdAnalysisReport }> = ({ report }) => {
  const [expanded, setExpanded] = useState(false);
  const alerts = report.alerts || [];
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const highCount = alerts.filter((a) => a.severity === 'high').length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
              <div>
                <CardTitle className="text-sm font-medium">
                  {formatDate(report.report_date)}
                </CardTitle>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                  {report.executive_summary || 'Sin resumen'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {criticalCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {criticalCount} critica{criticalCount > 1 ? 's' : ''}
                </Badge>
              )}
              {highCount > 0 && (
                <Badge className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 hover:bg-orange-100">
                  {highCount} alta{highCount > 1 ? 's' : ''}
                </Badge>
              )}
              {report.autonomy_level_at_time && (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${AUTONOMY_CONFIG[report.autonomy_level_at_time]?.bgColor || ''}`}
                >
                  Nivel {report.autonomy_level_at_time}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </button>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-0 space-y-3">
          {/* Resumen ejecutivo */}
          {report.executive_summary && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
              {report.executive_summary}
            </div>
          )}

          {/* Alertas */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">
                Alertas ({alerts.length})
              </p>
              {alerts
                .sort(
                  (a, b) =>
                    (PRIORITY_ORDER[a.severity] ?? 9) -
                    (PRIORITY_ORDER[b.severity] ?? 9)
                )
                .map((alert, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${SEVERITY_COLORS[alert.severity] || 'bg-gray-50 border-gray-200'}`}
                  >
                    {SEVERITY_ICONS[alert.severity]}
                    <div>
                      <span className="font-medium">[{alert.type}]</span>{' '}
                      {alert.message}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Analisis completo */}
          {report.full_analysis && (
            <details className="group">
              <summary className="text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700">
                Analisis completo
              </summary>
              <div className="mt-2 bg-gray-50 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                {report.full_analysis}
              </div>
            </details>
          )}
        </CardContent>
      )}
    </Card>
  );
};

// ─── Recommendation Card ────────────────────────────────────────

const RecommendationCard: React.FC<{
  rec: AdRecommendation;
  onExecute: (id: string) => void;
  onIgnore: (id: string) => void;
  executing: boolean;
  ignoring: boolean;
}> = ({ rec, onExecute, onIgnore, executing, ignoring }) => {
  const priorityColor: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-green-100 text-green-700 border-green-200',
  };

  const categoryLabels: Record<string, string> = {
    scale: 'Escalar',
    pause: 'Pausar',
    creative_refresh: 'Refresh Creativo',
    budget_realloc: 'Reasignar Budget',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              {rec.priority && (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${priorityColor[rec.priority] || ''}`}
                >
                  {rec.priority}
                </Badge>
              )}
              {rec.category && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {categoryLabels[rec.category] || rec.category}
                </Badge>
              )}
              {rec.confidence != null && (
                <span className="text-[10px] text-gray-400">
                  {(rec.confidence * 100).toFixed(0)}% confianza
                </span>
              )}
            </div>
            <p className="text-sm text-gray-800 font-medium">{rec.action}</p>
            {rec.rationale && (
              <p className="text-xs text-gray-500 mt-1">{rec.rationale}</p>
            )}
            {rec.accuracy_score != null && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10px] text-gray-400">Accuracy:</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${
                    rec.accuracy_score >= 0.7
                      ? 'bg-green-50 text-green-700'
                      : rec.accuracy_score >= 0.4
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {(rec.accuracy_score * 100).toFixed(0)}%
                </Badge>
              </div>
            )}
          </div>

          {!rec.executed && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                onClick={() => onExecute(rec.id)}
                disabled={executing || ignoring}
              >
                {executing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                )}
                Ejecutar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-gray-500 hover:text-red-600 hover:border-red-300"
                onClick={() => onIgnore(rec.id)}
                disabled={executing || ignoring}
              >
                {ignoring ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <XCircle className="h-3 w-3 mr-1" />
                )}
                Ignorar
              </Button>
            </div>
          )}

          {rec.executed && (
            <Badge
              variant="outline"
              className={`text-[10px] shrink-0 ${
                rec.executed_by === 'ignored'
                  ? 'bg-gray-50 text-gray-500'
                  : rec.executed_by === 'agent'
                  ? 'bg-purple-50 text-purple-700'
                  : 'bg-green-50 text-green-700'
              }`}
            >
              {rec.executed_by === 'ignored'
                ? 'Ignorada'
                : rec.executed_by === 'agent'
                ? 'Auto-ejecutada'
                : 'Ejecutada'}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Main Page ──────────────────────────────────────────────────

const AdAnalysisPage: React.FC = () => {
  const {
    reports,
    reportsLoading,
    pendingRecommendations,
    allRecommendations,
    agentStatus,
    statusLoading,
    executeRecommendation,
    ignoreRecommendation,
    executingRec,
    ignoringRec,
    learnings,
    learningsLoading,
    benchmarks,
    benchmarksLoading,
    rules,
    rulesLoading,
  } = useAdAnalysis();

  const [learningCategoryFilter, setLearningCategoryFilter] = useState<string>('all');

  const autonomyConfig = AUTONOMY_CONFIG[agentStatus.autonomy_level] || AUTONOMY_CONFIG[1];
  const accuracyPct = agentStatus.accuracy * 100;
  const targetAccuracy = 80;

  const learningCategories = useMemo(() => {
    const cats = new Set(learnings.map((l) => l.category));
    return Array.from(cats).sort();
  }, [learnings]);

  const filteredLearnings = useMemo(() => {
    if (learningCategoryFilter === 'all') return learnings;
    return learnings.filter((l) => l.category === learningCategoryFilter);
  }, [learnings, learningCategoryFilter]);

  return (
    <FinanceDashboardLayout activeSection="ad-analysis">
      <div className="p-6 max-w-[1200px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-purple-600" />
            <h1 className="text-xl font-bold text-gray-900">Ad Intelligence Agent</h1>
            <Badge
              variant="outline"
              className={`${autonomyConfig.bgColor} ${autonomyConfig.color} gap-1`}
            >
              {autonomyConfig.icon}
              {autonomyConfig.label}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{agentStatus.total_recommendations} recomendaciones</span>
            <span>{agentStatus.total_executed} ejecutadas</span>
          </div>
        </div>

        {/* Accuracy Meter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-700">
                  Accuracy del Agente
                </span>
              </div>
              <span
                className={`text-sm font-bold ${
                  accuracyPct >= targetAccuracy
                    ? 'text-green-600'
                    : accuracyPct >= 50
                    ? 'text-amber-600'
                    : 'text-gray-400'
                }`}
              >
                {agentStatus.total_recommendations > 0
                  ? `${accuracyPct.toFixed(0)}%`
                  : 'Sin datos'}
              </span>
            </div>
            <Progress
              value={accuracyPct}
              className="h-2"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-400">0%</span>
              <span className="text-[10px] text-gray-400">
                Meta: {targetAccuracy}% para Nivel 3
              </span>
              <span className="text-[10px] text-gray-400">100%</span>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="reports" className="space-y-4">
          <TabsList>
            <TabsTrigger value="reports" className="text-xs">
              Reportes Diarios
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="text-xs">
              Recomendaciones
              {pendingRecommendations.length > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-[10px] px-1 py-0 h-4">
                  {pendingRecommendations.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              Historial
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="text-xs">
              <BookOpen className="h-3 w-3 mr-1" />
              Conocimiento
            </TabsTrigger>
          </TabsList>

          {/* Tab: Reportes */}
          <TabsContent value="reports" className="space-y-3">
            {reportsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : reports.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Brain className="h-8 w-8 text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-500 mt-3">
                    No hay reportes de analisis aun
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    El agente genera reportes diarios a las 8:00 AM
                  </p>
                </CardContent>
              </Card>
            ) : (
              reports.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))
            )}
          </TabsContent>

          {/* Tab: Recomendaciones pendientes */}
          <TabsContent value="recommendations" className="space-y-3">
            {pendingRecommendations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-300 mx-auto" />
                  <p className="text-sm text-gray-500 mt-3">
                    No hay recomendaciones pendientes
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Todas las recomendaciones han sido procesadas
                  </p>
                </CardContent>
              </Card>
            ) : (
              pendingRecommendations
                .sort(
                  (a, b) =>
                    (PRIORITY_ORDER[a.priority || 'low'] ?? 9) -
                    (PRIORITY_ORDER[b.priority || 'low'] ?? 9)
                )
                .map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    rec={rec}
                    onExecute={executeRecommendation}
                    onIgnore={ignoreRecommendation}
                    executing={executingRec}
                    ignoring={ignoringRec}
                  />
                ))
            )}
          </TabsContent>

          {/* Tab: Historial */}
          <TabsContent value="history" className="space-y-3">
            {allRecommendations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <TrendingUp className="h-8 w-8 text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-500 mt-3">
                    Sin historial de recomendaciones
                  </p>
                </CardContent>
              </Card>
            ) : (
              allRecommendations.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  onExecute={executeRecommendation}
                  onIgnore={ignoreRecommendation}
                  executing={executingRec}
                  ignoring={ignoringRec}
                />
              ))
            )}
          </TabsContent>

          {/* Tab: Conocimiento */}
          <TabsContent value="knowledge" className="space-y-6">
            {/* Sub-sección: Learnings */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-purple-500" />
                    <CardTitle className="text-sm font-medium">Learnings</CardTitle>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {filteredLearnings.length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-3 w-3 text-gray-400" />
                    <Select
                      value={learningCategoryFilter}
                      onValueChange={setLearningCategoryFilter}
                    >
                      <SelectTrigger className="h-7 w-[160px] text-xs">
                        <SelectValue placeholder="Todas las categorías" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {learningCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                {learningsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : filteredLearnings.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">
                    No hay learnings registrados
                  </p>
                ) : (
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-[120px]">Categoría</TableHead>
                          <TableHead className="text-xs">Contenido</TableHead>
                          <TableHead className="text-xs w-[90px]">Confianza</TableHead>
                          <TableHead className="text-xs w-[80px]">Fuente</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLearnings.map((learning) => (
                          <TableRow key={learning.id}>
                            <TableCell className="text-xs font-medium">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {learning.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-gray-700 max-w-[400px]">
                              <span className="line-clamp-2">{learning.content}</span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${
                                  learning.confidence === 'high'
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : learning.confidence === 'medium'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-red-50 text-red-700 border-red-200'
                                }`}
                              >
                                {learning.confidence === 'high'
                                  ? 'Alta'
                                  : learning.confidence === 'medium'
                                  ? 'Media'
                                  : 'Baja'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${
                                  learning.source === 'seed'
                                    ? 'bg-gray-50 text-gray-600 border-gray-200'
                                    : learning.source === 'agent'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-violet-50 text-violet-700 border-violet-200'
                                }`}
                              >
                                {learning.source === 'seed'
                                  ? 'Semilla'
                                  : learning.source === 'agent'
                                  ? 'Agente'
                                  : 'Humano'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sub-sección: Benchmarks */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  <CardTitle className="text-sm font-medium">Benchmarks</CardTitle>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {benchmarks.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                {benchmarksLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : benchmarks.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">
                    No hay benchmarks registrados
                  </p>
                ) : (
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Métrica</TableHead>
                          <TableHead className="text-xs w-[100px]">Bueno</TableHead>
                          <TableHead className="text-xs w-[100px]">Promedio</TableHead>
                          <TableHead className="text-xs w-[100px]">Malo</TableHead>
                          <TableHead className="text-xs w-[100px]">Fuente</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {benchmarks.map((benchmark) => (
                          <TableRow key={benchmark.id}>
                            <TableCell className="text-xs font-medium text-gray-800">
                              {benchmark.metric_name}
                            </TableCell>
                            <TableCell className="text-xs text-green-700 font-mono">
                              {benchmark.good_threshold}
                            </TableCell>
                            <TableCell className="text-xs text-amber-700 font-mono">
                              {benchmark.average_threshold}
                            </TableCell>
                            <TableCell className="text-xs text-red-700 font-mono">
                              {benchmark.bad_threshold}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${
                                  benchmark.source === 'dynamic'
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : 'bg-gray-50 text-gray-600 border-gray-200'
                                }`}
                              >
                                {benchmark.source === 'dynamic' ? 'Dinámico' : 'Inicial'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sub-sección: Reglas */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-amber-500" />
                  <CardTitle className="text-sm font-medium">Reglas</CardTitle>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {rules.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                {rulesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : rules.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">
                    No hay reglas registradas
                  </p>
                ) : (
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Regla</TableHead>
                          <TableHead className="text-xs w-[80px]">Aplicada</TableHead>
                          <TableHead className="text-xs w-[80px]">Correcta</TableHead>
                          <TableHead className="text-xs w-[90px]">Accuracy</TableHead>
                          <TableHead className="text-xs w-[80px]">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rules.map((rule) => {
                          const accuracy =
                            rule.times_applied > 0
                              ? (rule.times_correct / rule.times_applied) * 100
                              : 0;
                          return (
                            <TableRow key={rule.id}>
                              <TableCell className="text-xs text-gray-700 max-w-[400px]">
                                <span className="line-clamp-2">{rule.rule_text}</span>
                              </TableCell>
                              <TableCell className="text-xs font-mono text-center">
                                {rule.times_applied}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-center">
                                {rule.times_correct}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${
                                    accuracy >= 70
                                      ? 'bg-green-50 text-green-700 border-green-200'
                                      : accuracy >= 40
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-red-50 text-red-700 border-red-200'
                                  }`}
                                >
                                  {accuracy.toFixed(0)}%
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${
                                    rule.is_active
                                      ? 'bg-green-50 text-green-700 border-green-200'
                                      : 'bg-gray-50 text-gray-500 border-gray-200'
                                  }`}
                                >
                                  {rule.is_active ? 'Activa' : 'Inactiva'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </FinanceDashboardLayout>
  );
};

export default AdAnalysisPage;
