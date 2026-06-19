import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MessageCircleHeart,
  Sparkles,
  Loader2,
  ThumbsUp,
  Lightbulb,
  AlertTriangle,
  MessagesSquare,
} from 'lucide-react';
import FinanceDashboardLayout from '@/components/finance-dashboard/FinanceDashboardLayout';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

// ── Types ────────────────────────────────────────────────────────

interface ConversationInsight {
  id: string;
  type: string;
  sentiment: string;
  priority: string;
  status: string;
  summary: string;
  evidence: string | null;
  tags: string[] | null;
  source_conversation_ids: string[] | null;
  metadata: { occurrence_count?: number } | null;
  created_at: string;
}

// ── Labels & helpers ─────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  product_request: 'Pedido de producto',
  catalog_gap: 'Vacío de catálogo',
  answer_improvement: 'Mejorar respuesta de ELSA',
  quality_feedback: 'Calidad',
  customer_objection: 'Objeción',
  operations_friction: 'Fricción operativa',
  positive_signal: 'Testimonio',
  general: 'General',
};

const PRIORITY_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 };

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const SENTIMENT_LABELS: Record<string, string> = {
  opportunity: 'Oportunidad',
  improvement: 'Mejora',
  positive: 'Positivo',
  risk: 'Riesgo',
  neutral: 'Neutral',
};

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'high':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'medium':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

function sentimentDotClass(sentiment: string): string {
  switch (sentiment) {
    case 'positive':
      return 'bg-emerald-500';
    case 'opportunity':
      return 'bg-blue-500';
    case 'improvement':
      return 'bg-amber-500';
    case 'risk':
      return 'bg-red-500';
    default:
      return 'bg-slate-400';
  }
}

function shortDate(value?: string | null): string {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch {
    return '';
  }
}

function sortByPriority(insights: ConversationInsight[]): ConversationInsight[] {
  return [...insights].sort(
    (a, b) => (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0)
  );
}

const SUGGESTION_TYPES = [
  'product_request',
  'catalog_gap',
  'answer_improvement',
  'operations_friction',
];

const COMPLAINT_TYPES = ['quality_feedback', 'customer_objection'];

function isComplaint(i: ConversationInsight): boolean {
  return COMPLAINT_TYPES.includes(i.type) || i.sentiment === 'risk';
}

function isTestimonial(i: ConversationInsight): boolean {
  return i.type === 'positive_signal' || i.sentiment === 'positive';
}

function isSuggestion(i: ConversationInsight): boolean {
  if (isComplaint(i) || isTestimonial(i)) return false;
  return SUGGESTION_TYPES.includes(i.type);
}

// ── Insight Card ─────────────────────────────────────────────────

const InsightCard: React.FC<{ insight: ConversationInsight }> = ({ insight }) => {
  const occurrences = insight.metadata?.occurrence_count ?? 1;
  const tags = insight.tags ?? [];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityBadgeClass(insight.priority)}`}>
          {PRIORITY_LABELS[insight.priority] ?? insight.priority}
        </Badge>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {TYPE_LABELS[insight.type] ?? insight.type}
        </Badge>
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className={`h-1.5 w-1.5 rounded-full ${sentimentDotClass(insight.sentiment)}`} />
          {SENTIMENT_LABELS[insight.sentiment] ?? insight.sentiment}
        </span>
      </div>

      <p className="text-sm font-semibold text-gray-900 leading-snug">{insight.summary}</p>

      {insight.evidence && (
        <blockquote className="border-l-4 border-gray-200 pl-3 italic text-slate-600 text-sm">
          “{insight.evidence}”
        </blockquote>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 text-gray-500">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-gray-400 pt-0.5">
        <span>🗣 {occurrences} {occurrences === 1 ? 'conversación' : 'conversaciones'}</span>
        <span>{shortDate(insight.created_at)}</span>
      </div>
    </div>
  );
};

// ── Lens Column ──────────────────────────────────────────────────

const LensColumn: React.FC<{
  icon: React.ReactNode;
  title: string;
  accent: string;
  insights: ConversationInsight[];
  emptyLabel: string;
}> = ({ icon, title, accent, insights, emptyLabel }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      {icon}
      <h2 className={`text-xs font-semibold uppercase tracking-wider ${accent}`}>{title}</h2>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
        {insights.length}
      </Badge>
    </div>
    {insights.length === 0 ? (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-400">
        {emptyLabel}
      </div>
    ) : (
      <div className="space-y-3">
        {sortByPriority(insights).map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    )}
  </div>
);

// ── Stat ─────────────────────────────────────────────────────────

const Stat: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="flex items-baseline gap-1.5">
    <span className={`text-lg font-bold ${color}`}>{value}</span>
    <span className="text-xs text-gray-500">{label}</span>
  </div>
);

// ── Main Page ────────────────────────────────────────────────────

const CustomerVoicePage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data: insights = [], isLoading } = useQuery({
    queryKey: ['customer-voice-insights', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await (supabase.from('elsa_conversation_insights' as any) as any)
        .select(
          'id, type, sentiment, priority, status, summary, evidence, tags, source_conversation_ids, metadata, created_at'
        )
        .eq('organization_id', orgId)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data || []) as ConversationInsight[];
    },
  });

  const { testimonials, suggestions, complaints, highPriorityCount, riskCount } = useMemo(() => {
    const testimonials = insights.filter(isTestimonial);
    const complaints = insights.filter(isComplaint);
    const suggestions = insights.filter(isSuggestion);
    const highPriorityCount = insights.filter((i) => i.priority === 'high').length;
    const riskCount = insights.filter((i) => i.sentiment === 'risk').length;
    return { testimonials, suggestions, complaints, highPriorityCount, riskCount };
  }, [insights]);

  return (
    <FinanceDashboardLayout activeSection="customer-voice">
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-pink-600 font-medium mb-1">
              <Sparkles className="h-4 w-4" />
              Lo que dicen los clientes
            </div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MessageCircleHeart className="h-5 w-5 text-pink-500" />
              Voz del Cliente
            </h1>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Insights de las conversaciones de WhatsApp (testimonios, sugerencias, quejas).
            </p>
          </div>

          {!isLoading && insights.length > 0 && (
            <div className="flex items-center gap-5">
              <Stat label="insights" value={insights.length} color="text-gray-900" />
              <Stat label="prioridad alta" value={highPriorityCount} color="text-amber-600" />
              <Stat label="riesgos" value={riskCount} color="text-red-600" />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-10 text-center text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
            Cargando insights...
          </div>
        ) : insights.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-10 text-center">
            <MessagesSquare className="h-8 w-8 text-gray-300 mx-auto" />
            <p className="text-sm font-medium text-gray-600 mt-3">
              Aún no hay insights — el análisis corre cada mañana
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <LensColumn
              icon={<ThumbsUp className="h-4 w-4 text-emerald-500" />}
              title="✅ Testimonios"
              accent="text-emerald-700"
              insights={testimonials}
              emptyLabel="Sin testimonios todavía"
            />
            <LensColumn
              icon={<Lightbulb className="h-4 w-4 text-amber-500" />}
              title="💡 Sugerencias"
              accent="text-amber-700"
              insights={suggestions}
              emptyLabel="Sin sugerencias todavía"
            />
            <LensColumn
              icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
              title="⚠️ Quejas / Riesgos"
              accent="text-red-700"
              insights={complaints}
              emptyLabel="Sin quejas todavía"
            />
          </div>
        )}
      </div>
    </FinanceDashboardLayout>
  );
};

export default CustomerVoicePage;
