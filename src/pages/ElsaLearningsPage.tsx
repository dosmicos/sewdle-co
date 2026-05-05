import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Brain, Archive, CheckCircle2, Loader2, RefreshCw, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ELSA_LEARNING_STATUSES,
  type ElsaResponseLearning,
  formatLearningConfidence,
  getLearningStatusLabel,
  normalizeLearningConfidence,
  normalizeLearningStatus,
} from '@/lib/elsaLearningReview';

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  sizes: 'Tallas',
  shipping: 'Envíos',
  payments: 'Pagos',
  order_creation: 'Crear pedido',
  changes: 'Cambios',
  pricing: 'Precios',
};

type LearningDraft = {
  category: string;
  situation: string;
  recommendedResponse: string;
  avoidResponse: string;
  confidence: string;
};

function toDraft(learning: ElsaResponseLearning): LearningDraft {
  return {
    category: learning.category || 'general',
    situation: learning.situation || '',
    recommendedResponse: learning.recommended_response || '',
    avoidResponse: learning.avoid_response || '',
    confidence: String(Math.round(normalizeLearningConfidence(learning.confidence) * 100)),
  };
}

function statusBadgeClass(status: unknown) {
  switch (normalizeLearningStatus(status)) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'archived':
      return 'bg-slate-50 text-slate-600 border-slate-200';
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200';
  }
}

function shortDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return 'Sin fecha';
  }
}

function LearningCard({
  learning,
  onReview,
  isPending,
}: {
  learning: ElsaResponseLearning;
  onReview: (learning: ElsaResponseLearning, action: string, draft?: LearningDraft) => void;
  isPending: boolean;
}) {
  const [draft, setDraft] = useState<LearningDraft>(() => toDraft(learning));
  const status = normalizeLearningStatus(learning.status);
  const categoryLabel = CATEGORY_LABELS[learning.category] || learning.category || 'General';

  const updateDraft = (field: keyof LearningDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={statusBadgeClass(status)}>
                {getLearningStatusLabel(status)}
              </Badge>
              <Badge variant="secondary">{categoryLabel}</Badge>
              <Badge variant="outline">Confianza {formatLearningConfidence(learning.confidence)}</Badge>
            </div>
            <CardTitle className="text-base">Aprendizaje de respuesta humana</CardTitle>
            <CardDescription>
              Capturado {shortDate(learning.created_at)} · última edición {shortDate(learning.updated_at)}
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            {status !== 'active' && (
              <Button size="sm" onClick={() => onReview(learning, 'approve', draft)} disabled={isPending}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Aprobar
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onReview(learning, 'update', draft)} disabled={isPending}>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
            {status !== 'archived' && (
              <Button size="sm" variant="outline" onClick={() => onReview(learning, 'archive', draft)} disabled={isPending}>
                <Archive className="h-4 w-4 mr-2" />
                Archivar
              </Button>
            )}
            {isPending && <Loader2 className="h-4 w-4 animate-spin text-slate-500 mt-2" />}
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Situación del cliente</label>
          <Textarea
            value={draft.situation}
            onChange={(event) => updateDraft('situation', event.target.value)}
            className="min-h-[120px]"
            placeholder="Qué preguntó o necesitaba el cliente"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Respuesta recomendada</label>
          <Textarea
            value={draft.recommendedResponse}
            onChange={(event) => updateDraft('recommendedResponse', event.target.value)}
            className="min-h-[120px]"
            placeholder="Cómo debería responder Elsa en casos parecidos"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Categoría</label>
          <select
            value={draft.category}
            onChange={(event) => updateDraft('category', event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Confianza</label>
          <Input
            type="number"
            min="0"
            max="100"
            value={draft.confidence}
            onChange={(event) => updateDraft('confidence', event.target.value)}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-slate-700">Evitar responder así / nota de corrección</label>
          <Textarea
            value={draft.avoidResponse}
            onChange={(event) => updateDraft('avoidResponse', event.target.value)}
            className="min-h-[80px]"
            placeholder="Opcional: qué debe evitar Elsa en este caso"
          />
        </div>
      </CardContent>
    </Card>
  );
}

const ElsaLearningsPage = () => {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all' | typeof ELSA_LEARNING_STATUSES[number]>('needs_review');

  const queryKey = ['elsa-response-learnings', currentOrganization?.id];

  const { data: learnings = [], isLoading, error, refetch } = useQuery({
    queryKey,
    enabled: Boolean(currentOrganization?.id),
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      const { data, error } = await (supabase.from('elsa_response_learnings' as any) as any)
        .select('id, organization_id, category, situation, recommended_response, avoid_response, confidence, status, metadata, created_at, updated_at')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as ElsaResponseLearning[];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ learning, action, draft }: { learning: ElsaResponseLearning; action: string; draft?: LearningDraft }) => {
      if (!currentOrganization?.id) throw new Error('Sin organización activa');

      const { data, error } = await supabase.functions.invoke('elsa-review-learning', {
        body: {
          action,
          learningId: learning.id,
          organizationId: currentOrganization.id,
          category: draft?.category,
          situation: draft?.situation,
          recommendedResponse: draft?.recommendedResponse,
          avoidResponse: draft?.avoidResponse,
          confidence: draft?.confidence,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, variables) => {
      const verb = variables.action === 'approve'
        ? 'aprobado'
        : variables.action === 'archive'
          ? 'archivado'
          : 'guardado';
      toast.success(`Aprendizaje ${verb}`);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: any) => {
      toast.error(`No se pudo actualizar el aprendizaje: ${err.message || err}`);
    },
  });

  const filteredLearnings = useMemo(() => {
    if (statusFilter === 'all') return learnings;
    return learnings.filter((learning) => normalizeLearningStatus(learning.status) === statusFilter);
  }, [learnings, statusFilter]);

  const counts = useMemo(() => {
    return learnings.reduce<Record<string, number>>((acc, learning) => {
      const status = normalizeLearningStatus(learning.status);
      acc[status] = (acc[status] || 0) + 1;
      acc.all = (acc.all || 0) + 1;
      return acc;
    }, { all: 0 });
  }, [learnings]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-orange-600 font-medium mb-2">
              <Sparkles className="h-4 w-4" />
              Elsa aprende de respuestas humanas
            </div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Brain className="h-8 w-8 text-orange-500" />
              Aprendizajes Elsa
            </h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Revisa, edita y aprueba patrones capturados desde las respuestas humanas. Elsa solo usa los aprendizajes marcados como activos.
            </p>
          </div>

          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {[
            ['needs_review', 'Por revisar'],
            ['active', 'Activos'],
            ['archived', 'Archivados'],
            ['all', 'Todos'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value as typeof statusFilter)}
              className={`rounded-xl border p-4 text-left transition ${statusFilter === value ? 'bg-white border-orange-300 shadow-sm' : 'bg-white/70 border-slate-200 hover:bg-white'}`}
            >
              <div className="text-sm text-slate-500">{label}</div>
              <div className="text-2xl font-bold text-slate-900">{counts[value] || 0}</div>
            </button>
          ))}
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">
              Error cargando aprendizajes: {(error as Error).message}
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <Card>
            <CardContent className="p-10 text-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
              Cargando aprendizajes...
            </CardContent>
          </Card>
        ) : filteredLearnings.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-slate-500">
              <Brain className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              No hay aprendizajes en este estado todavía.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredLearnings.map((learning) => (
              <LearningCard
                key={learning.id}
                learning={learning}
                isPending={reviewMutation.isPending}
                onReview={(item, action, draft) => reviewMutation.mutate({ learning: item, action, draft })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ElsaLearningsPage;
