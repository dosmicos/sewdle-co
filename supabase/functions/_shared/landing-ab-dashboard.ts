// Shared types + statistics for the Landing A/B dashboard.
// Mirror of the _shared/growth-team-scorecard.ts pattern: pure helpers, no I/O.

export type VariantRole = "control" | "challenger";

export interface VariantStats {
  lpVersion: string;
  label: string;
  role: VariantRole;
  visits: number;
  orders: number;
  revenue: number;
  cvr: number | null; // orders / visits
  aov: number | null; // revenue / orders
  rpv: number | null; // revenue / visits — the fair cross-variant metric (traffic & spend are shared)
}

export interface SignificanceResult {
  upliftPct: number | null; // (cvr_challenger - cvr_control) / cvr_control * 100
  z: number | null;
  pValue: number | null;
  confidencePct: number | null; // (1 - pValue) * 100
  significant: boolean; // confidence >= 95%
  winner: VariantRole | "tie" | null;
}

export interface TimePoint {
  day: string; // YYYY-MM-DD
  controlVisits: number;
  controlOrders: number;
  controlCvr: number | null;
  challengerVisits: number;
  challengerOrders: number;
  challengerCvr: number | null;
}

export interface ExperimentSummary {
  slug: string;
  name: string;
  destinationPath: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  daysRunning: number;
  control: VariantStats;
  challenger: VariantStats;
  significance: SignificanceResult;
  timeseries: TimePoint[];
}

export interface LandingAbDashboardResponse {
  period: { start: string; end: string };
  experiments: ExperimentSummary[];
  metadata: { computedAt: string; notes: string[] };
}

// Standard normal CDF (Abramowitz & Stegun 7.1.26) — for two-sided p-values without deps.
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  let p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  if (x > 0) p = 1 - p;
  return p;
}

// Two-proportion z-test (two-sided). control = baseline, challenger = variant.
export function proportionTest(
  controlOrders: number,
  controlVisits: number,
  challengerOrders: number,
  challengerVisits: number,
): SignificanceResult {
  const empty: SignificanceResult = { upliftPct: null, z: null, pValue: null, confidencePct: null, significant: false, winner: null };
  if (controlVisits <= 0 || challengerVisits <= 0) return empty;
  const p1 = controlOrders / controlVisits;
  const p2 = challengerOrders / challengerVisits;
  const upliftPct = p1 > 0 ? ((p2 - p1) / p1) * 100 : null;
  const pPool = (controlOrders + challengerOrders) / (controlVisits + challengerVisits);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / controlVisits + 1 / challengerVisits));
  if (!Number.isFinite(se) || se === 0) return { ...empty, upliftPct };
  const z = (p2 - p1) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  const confidencePct = (1 - pValue) * 100;
  const significant = confidencePct >= 95;
  const winner: SignificanceResult["winner"] = significant ? (p2 > p1 ? "challenger" : "control") : "tie";
  return { upliftPct, z, pValue, confidencePct, significant, winner };
}

export function buildVariantStats(
  lpVersion: string,
  label: string,
  role: VariantRole,
  visits: number,
  orders: number,
  revenue: number,
): VariantStats {
  return {
    lpVersion,
    label,
    role,
    visits,
    orders,
    revenue,
    cvr: visits > 0 ? orders / visits : null,
    aov: orders > 0 ? revenue / orders : null,
    rpv: visits > 0 ? revenue / visits : null,
  };
}

export function daysBetween(startIso: string, endIso?: string | null): number {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}
