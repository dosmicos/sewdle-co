import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";

// Las tablas/funciones nuevas aún no están en los tipos generados de Supabase;
// se castea el cliente para esas consultas hasta regenerar types tras el merge.
const db = supabase as any;

export interface SeasonPlan {
  id: string;
  organization_id: string;
  name: string;
  target_date: string;
  plan_start_date: string;
  capacity_mode: "shared" | "per_category";
  baseline_weekly_capacity: number | null;
  target_weekly_capacity: number;
  output_per_workshop: number | null;
  ramp_weeks: number;
  ramp_profile: "linear" | "immediate" | "s_curve";
  seasonal_uplift: number;
  lead_weeks: number;
  include_zero_sales_variants: boolean;
  status: "active" | "archived";
}

export interface SeasonCategoryTarget {
  id?: string;
  plan_id?: string;
  category: string;
  reserve_target: number;
}

export interface PlanFeasibility {
  category: string;
  horizon_weeks: number;
  current_pipeline: number;
  expected_sales_total: number;
  reserve_target: number;
  production_needed: number;
  total_capacity: number;
  baseline_weekly_capacity: number;
  feasible: boolean;
  shortfall: number;
  min_target_weekly_capacity: number | null;
}

export interface PlanWeek {
  category: string;
  week_index: number;
  week_start: string;
  expected_sales: number;
  weekly_capacity: number;
  planned_production: number;
  reserve_quota: number;
  sales_replenishment: number;
  projected_on_hand_end: number;
  projected_reserve_accumulated: number;
  stockout: boolean;
}

export interface SeasonPlanConfig {
  name?: string;
  target_date: string;
  target_weekly_capacity: number;
  ramp_weeks: number;
  ramp_profile: "linear" | "immediate" | "s_curve";
  seasonal_uplift: number;
  capacity_mode: "shared" | "per_category";
  baseline_weekly_capacity?: number | null;
  output_per_workshop?: number | null;
  targets: SeasonCategoryTarget[];
}

export const useSeasonPlan = () => {
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const [plan, setPlan] = useState<SeasonPlan | null>(null);
  const [targets, setTargets] = useState<SeasonCategoryTarget[]>([]);
  const [feasibility, setFeasibility] = useState<PlanFeasibility[]>([]);
  const [weeks, setWeeks] = useState<PlanWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  const fetchPlan = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data: planRow } = await db
        .from("season_production_plans")
        .select("*")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .maybeSingle();

      setPlan(planRow ?? null);

      if (planRow) {
        const [{ data: tg }, { data: feas }, { data: wk }] = await Promise.all([
          db.from("season_plan_category_targets").select("*").eq("plan_id", planRow.id),
          db
            .from("production_plan_feasibility")
            .select("*")
            .eq("plan_id", planRow.id)
            .eq("calculation_date", new Date().toISOString().split("T")[0]),
          db
            .from("v_production_plan_weeks")
            .select("*")
            .eq("plan_id", planRow.id)
            .eq("calculation_date", new Date().toISOString().split("T")[0])
            .order("category")
            .order("week_index"),
        ]);
        setTargets(tg ?? []);
        setFeasibility(feas ?? []);
        setWeeks(wk ?? []);
      } else {
        setTargets([]);
        setFeasibility([]);
        setWeeks([]);
      }
    } catch (error) {
      console.error("Error fetching season plan:", error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const savePlanConfig = useCallback(
    async (config: SeasonPlanConfig) => {
      if (!orgId) return;
      try {
        // upsert del plan activo (1 por org)
        const planPayload = {
          organization_id: orgId,
          name: config.name ?? "Temporada",
          target_date: config.target_date,
          target_weekly_capacity: config.target_weekly_capacity,
          ramp_weeks: config.ramp_weeks,
          ramp_profile: config.ramp_profile,
          seasonal_uplift: config.seasonal_uplift,
          capacity_mode: config.capacity_mode,
          baseline_weekly_capacity: config.baseline_weekly_capacity ?? null,
          output_per_workshop: config.output_per_workshop ?? null,
          status: "active" as const,
          updated_at: new Date().toISOString(),
        };

        let planId = plan?.id;
        if (planId) {
          const { error } = await db.from("season_production_plans").update(planPayload).eq("id", planId);
          if (error) throw error;
        } else {
          const { data, error } = await db
            .from("season_production_plans")
            .insert(planPayload)
            .select("id")
            .single();
          if (error) throw error;
          planId = data.id;
        }

        // reemplazar metas por categoría
        await db.from("season_plan_category_targets").delete().eq("plan_id", planId);
        if (config.targets.length > 0) {
          const { error: tErr } = await db.from("season_plan_category_targets").insert(
            config.targets.map((t) => ({
              plan_id: planId,
              organization_id: orgId,
              category: t.category,
              reserve_target: t.reserve_target,
            }))
          );
          if (tErr) throw tErr;
        }

        toast({ title: "Plan guardado", description: "La configuración del plan de temporada se guardó." });
        await fetchPlan();
      } catch (error: any) {
        console.error("Error saving season plan:", error);
        toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo guardar el plan" });
        throw error;
      }
    },
    [orgId, plan?.id, toast, fetchPlan]
  );

  const calculatePlan = useCallback(async () => {
    if (!orgId) return;
    setCalculating(true);
    try {
      // 1) refrescar reposición reactiva (snapshot de hoy que el plan reutiliza)
      const { error: e1 } = await db.rpc("refresh_inventory_replenishment", { org_id: orgId });
      if (e1) throw e1;
      // 2) calcular el plan de temporada
      const { data, error: e2 } = await db.rpc("refresh_season_production_plan", { org_id: orgId });
      if (e2) throw e2;
      if (data && data.ok === false) {
        toast({ variant: "destructive", title: "Sin plan activo", description: "Guarda primero la configuración del plan." });
      } else {
        toast({ title: "Plan calculado", description: "Se recalculó el plan semanal de producción." });
      }
      await fetchPlan();
    } catch (error: any) {
      console.error("Error calculating season plan:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo calcular el plan" });
    } finally {
      setCalculating(false);
    }
  }, [orgId, toast, fetchPlan]);

  return { plan, targets, feasibility, weeks, loading, calculating, fetchPlan, savePlanConfig, calculatePlan };
};
