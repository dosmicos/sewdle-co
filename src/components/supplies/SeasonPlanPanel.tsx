import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, CalendarClock, Factory, RefreshCw, Save } from "lucide-react";
import { useSeasonPlan, SeasonCategoryTarget } from "@/hooks/useSeasonPlan";

const PLAN_CATEGORIES = ["Ruanas", "Sleepings"] as const;

const fmt = (n: number) => new Intl.NumberFormat("es-CO").format(Math.round(n || 0));

export const SeasonPlanPanel = () => {
  const { plan, targets, feasibility, weeks, loading, calculating, savePlanConfig, calculatePlan } = useSeasonPlan();

  const [targetDate, setTargetDate] = useState("2026-11-01");
  const [targetCapacity, setTargetCapacity] = useState("4000");
  const [rampWeeks, setRampWeeks] = useState("6");
  const [uplift, setUplift] = useState("1.0");
  const [capacityMode, setCapacityMode] = useState<"shared" | "per_category">("shared");
  const [reserves, setReserves] = useState<Record<string, string>>({ Ruanas: "30000", Sleepings: "10000" });
  const [saving, setSaving] = useState(false);

  // Prefill desde el plan guardado
  useEffect(() => {
    if (plan) {
      setTargetDate(plan.target_date);
      setTargetCapacity(String(plan.target_weekly_capacity ?? ""));
      setRampWeeks(String(plan.ramp_weeks ?? 6));
      setUplift(String(plan.seasonal_uplift ?? 1));
      setCapacityMode(plan.capacity_mode);
    }
  }, [plan]);

  useEffect(() => {
    if (targets.length > 0) {
      setReserves((prev) => {
        const next = { ...prev };
        targets.forEach((t) => {
          next[t.category] = String(t.reserve_target);
        });
        return next;
      });
    }
  }, [targets]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const cfg = {
        target_date: targetDate,
        target_weekly_capacity: parseInt(targetCapacity || "0", 10),
        ramp_weeks: parseInt(rampWeeks || "0", 10),
        ramp_profile: "linear" as const,
        seasonal_uplift: parseFloat(uplift || "1"),
        capacity_mode: capacityMode,
        targets: PLAN_CATEGORIES.map<SeasonCategoryTarget>((c) => ({
          category: c,
          reserve_target: parseInt(reserves[c] || "0", 10),
        })),
      };
      await savePlanConfig(cfg);
    } finally {
      setSaving(false);
    }
  };

  const feasByCat = useMemo(() => {
    const map: Record<string, (typeof feasibility)[number]> = {};
    feasibility.forEach((f) => (map[f.category] = f));
    return map;
  }, [feasibility]);

  const weeksByCat = useMemo(() => {
    const map: Record<string, typeof weeks> = {};
    weeks.forEach((w) => {
      (map[w.category] ||= []).push(w);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.week_index - b.week_index));
    return map;
  }, [weeks]);

  const all = feasByCat["ALL"];

  return (
    <div className="space-y-6">
      {/* Configuración del plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5" />
            Configuración del Plan de Temporada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="target_date">Fecha objetivo</Label>
              <Input id="target_date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="target_cap">Capacidad semanal meta (uds/sem)</Label>
              <Input id="target_cap" type="number" min="0" value={targetCapacity} onChange={(e) => setTargetCapacity(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ramp">Semanas de rampa</Label>
              <Input id="ramp" type="number" min="0" value={rampWeeks} onChange={(e) => setRampWeeks(e.target.value)} />
            </div>
            {PLAN_CATEGORIES.map((c) => (
              <div key={c}>
                <Label htmlFor={`reserve_${c}`}>Reserva {c} (uds a fecha objetivo)</Label>
                <Input
                  id={`reserve_${c}`}
                  type="number"
                  min="0"
                  value={reserves[c] ?? ""}
                  onChange={(e) => setReserves((prev) => ({ ...prev, [c]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <Label htmlFor="uplift">Factor estacional (1 = ventas actuales)</Label>
              <Input id="uplift" type="number" step="0.1" min="0" value={uplift} onChange={(e) => setUplift(e.target.value)} />
            </div>
            <div>
              <Label>Capacidad</Label>
              <Select value={capacityMode} onValueChange={(v) => setCapacityMode(v as "shared" | "per_category")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared">Compartida (un pool de talleres)</SelectItem>
                  <SelectItem value="per_category">Por categoría</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={saving} variant="outline">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Guardando…" : "Guardar configuración"}
            </Button>
            <Button onClick={calculatePlan} disabled={calculating || !plan}>
              <RefreshCw className={`w-4 h-4 mr-2 ${calculating ? "animate-spin" : ""}`} />
              {calculating ? "Calculando…" : "Calcular Plan"}
            </Button>
            {!plan && <span className="text-sm text-muted-foreground self-center">Guarda la configuración para habilitar el cálculo.</span>}
          </div>
        </CardContent>
      </Card>

      {/* Banner de factibilidad */}
      {all && (
        <Card className={all.feasible ? "border-emerald-300 bg-emerald-50/50" : "border-red-300 bg-red-50/50"}>
          <CardContent className="p-4 flex items-start gap-3">
            {all.feasible ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5 shrink-0" />
            )}
            <div className="text-sm">
              {all.feasible ? (
                <p className="font-medium text-emerald-900">
                  Plan alcanzable: con la capacidad configurada llegas a la reserva el {plan?.target_date}.
                </p>
              ) : (
                <>
                  <p className="font-medium text-red-900">
                    Meta inalcanzable al ritmo actual. Faltan {fmt(all.shortfall)} unidades en {all.horizon_weeks} semanas.
                  </p>
                  <p className="text-red-800">
                    Necesitas una capacidad meta de ≈ <strong>{fmt(all.min_target_weekly_capacity || 0)} uds/semana</strong> (hoy
                    la base es ~{fmt(all.baseline_weekly_capacity)}/sem). Producción total requerida:{" "}
                    {fmt(all.production_needed)} uds.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detalle por categoría */}
      {PLAN_CATEGORIES.map((cat) => {
        const f = feasByCat[cat];
        const wk = weeksByCat[cat] || [];
        if (!f && wk.length === 0) return null;
        return (
          <Card key={cat}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Factory className="w-4 h-4" />
                {cat}
                {f && (
                  <Badge variant={f.feasible ? "default" : "destructive"} className="ml-2">
                    {f.feasible ? "Alcanzable" : `Faltan ${fmt(f.shortfall)}`}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {f && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mb-4">
                  <Metric label="Pipeline actual" value={fmt(f.current_pipeline)} />
                  <Metric label="Ventas esperadas" value={fmt(f.expected_sales_total)} />
                  <Metric label="Reserva objetivo" value={fmt(f.reserve_target)} />
                  <Metric label="Producción necesaria" value={fmt(f.production_needed)} />
                  <Metric label="Cap. mín. requerida" value={f.min_target_weekly_capacity ? `${fmt(f.min_target_weekly_capacity)}/sem` : "—"} />
                </div>
              )}
              {wk.length > 0 ? (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Semana</TableHead>
                        <TableHead className="text-right">Capacidad</TableHead>
                        <TableHead className="text-right">Ventas est.</TableHead>
                        <TableHead className="text-right">Producir</TableHead>
                        <TableHead className="text-right">→ Reserva</TableHead>
                        <TableHead className="text-right">Reserva acum.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wk.map((w) => (
                        <TableRow key={w.week_index} className={w.week_index === 0 ? "bg-primary/5 font-medium" : ""}>
                          <TableCell>
                            {w.week_index === 0 ? "Esta semana" : `Sem ${w.week_index + 1}`}
                            <span className="text-xs text-muted-foreground ml-2">{w.week_start}</span>
                            {w.stockout && (
                              <Badge variant="destructive" className="ml-2 text-[10px]">
                                Riesgo agotado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{fmt(w.weekly_capacity)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{fmt(w.expected_sales)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(w.planned_production)}</TableCell>
                          <TableCell className="text-right text-emerald-700">{fmt(w.reserve_quota)}</TableCell>
                          <TableCell className="text-right">{fmt(w.projected_reserve_accumulated)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {loading ? "Cargando…" : 'Sin plan calculado todavía. Guarda la configuración y presiona "Calcular Plan".'}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border p-2">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className="font-semibold">{value}</p>
  </div>
);

export default SeasonPlanPanel;
