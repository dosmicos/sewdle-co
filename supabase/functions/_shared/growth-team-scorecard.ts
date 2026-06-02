export type KpiStatus = "green" | "yellow" | "red" | "missing";
export type KpiDirection = "higher_better" | "lower_better";

export interface Kpi {
  actual: number | null;
  target: number | null;
  gap: number | null;
  progress: number | null;
  status: KpiStatus;
  direction: KpiDirection;
}

export interface DriveIdentityMapRow {
  email?: string | null;
  display_name_pattern?: string | null;
  person_key: string;
  person_label: string;
  priority?: number | null;
}

export interface DriveAttributionInput {
  owner_email?: string | null;
  owner_name?: string | null;
  last_modifying_user_email?: string | null;
  last_modifying_user_name?: string | null;
}

export interface StaticDriveFolderRow {
  product_key: string;
  product_name: string;
  drive_folder_id: string;
}

export interface StaticDriveAssetRow {
  drive_file_id: string;
  product_key: string;
  product_name: string;
  source_folder_id: string;
  file_name: string;
  created_time: string;
  attributed_person_key: string;
  attributed_person_label: string;
  web_view_link?: string | null;
}

export interface StaticCreativeProductSummary {
  productKey: string;
  productName: string;
  total: number;
  byPerson: Record<string, number>;
  folderId: string;
  folderUrl: string;
  lastUploadAt: string | null;
}

export interface StaticCreativeSummary {
  total: number;
  target: number;
  byPerson: Record<string, number>;
  byProduct: StaticCreativeProductSummary[];
  latestAssets: Array<{
    name: string;
    productName: string;
    personLabel: string;
    createdTime: string;
    webViewLink: string | null;
  }>;
}

export interface BogotaWeekWindow {
  label: string;
  start: string;
  end: string;
}

const JUNE_2026_WINDOWS: BogotaWeekWindow[] = [
  { label: "Semana 1 · Jun 1–7", start: "2026-06-01", end: "2026-06-08" },
  { label: "Semana 2 · Jun 8–14", start: "2026-06-08", end: "2026-06-15" },
  { label: "Semana 3 · Jun 15–21", start: "2026-06-15", end: "2026-06-22" },
  { label: "Semana 4 · Jun 22–28", start: "2026-06-22", end: "2026-06-29" },
  { label: "Final · Jun 29–30", start: "2026-06-29", end: "2026-07-01" },
];

export function buildKpi(actual: number | null | undefined, target: number | null | undefined, direction: KpiDirection): Kpi {
  const safeActual = typeof actual === "number" && Number.isFinite(actual) ? actual : null;
  const safeTarget = typeof target === "number" && Number.isFinite(target) ? target : null;

  if (safeActual === null || safeTarget === null || safeTarget === 0) {
    return {
      actual: safeActual,
      target: safeTarget,
      gap: safeActual !== null && safeTarget !== null ? safeActual - safeTarget : null,
      progress: null,
      status: "missing",
      direction,
    };
  }

  const ratio = direction === "higher_better" ? safeActual / safeTarget : safeTarget / safeActual;
  const progress = ratio * 100;
  const status: KpiStatus = progress >= 95 ? "green" : progress >= 85 ? "yellow" : "red";

  return {
    actual: safeActual,
    target: safeTarget,
    gap: safeActual - safeTarget,
    progress,
    status,
    direction,
  };
}

export function attributeDrivePerson(input: DriveAttributionInput, maps: DriveIdentityMapRow[]) {
  const normalizedMaps = [...maps]
    .filter((m) => m.person_key && m.person_label)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  const emailCandidates = [input.owner_email, input.last_modifying_user_email]
    .filter(Boolean)
    .map((email) => String(email).trim().toLowerCase());
  for (const email of emailCandidates) {
    const found = normalizedMaps.find((m) => m.email?.trim().toLowerCase() === email);
    if (found) return { personKey: found.person_key, personLabel: found.person_label };
  }

  const nameCandidates = [input.owner_name, input.last_modifying_user_name]
    .filter(Boolean)
    .map((name) => String(name).trim().toLowerCase());
  for (const displayName of nameCandidates) {
    const found = normalizedMaps.find((m) => {
      const pattern = m.display_name_pattern?.trim().toLowerCase();
      return pattern ? displayName.includes(pattern) : false;
    });
    if (found) return { personKey: found.person_key, personLabel: found.person_label };
  }

  return { personKey: "unknown", personLabel: "Sin asignar" };
}

export function summarizeStaticCreatives(
  assets: StaticDriveAssetRow[],
  folders: StaticDriveFolderRow[],
  periodStart: string,
  periodEnd: string,
  target: number,
): StaticCreativeSummary {
  const windowAssets = assets.filter((asset) => {
    const created = asset.created_time.slice(0, 10);
    return created >= periodStart && created < periodEnd;
  });

  const byPerson: Record<string, number> = {};
  for (const asset of windowAssets) {
    byPerson[asset.attributed_person_key] = (byPerson[asset.attributed_person_key] ?? 0) + 1;
  }

  const byProduct = folders.map((folder) => {
    const productAssets = windowAssets.filter((asset) => asset.product_key === folder.product_key);
    const productByPerson: Record<string, number> = {};
    let lastUploadAt: string | null = null;

    for (const asset of productAssets) {
      productByPerson[asset.attributed_person_key] = (productByPerson[asset.attributed_person_key] ?? 0) + 1;
      if (!lastUploadAt || asset.created_time > lastUploadAt) lastUploadAt = asset.created_time;
    }

    return {
      productKey: folder.product_key,
      productName: folder.product_name,
      total: productAssets.length,
      byPerson: productByPerson,
      folderId: folder.drive_folder_id,
      folderUrl: `https://drive.google.com/drive/folders/${folder.drive_folder_id}`,
      lastUploadAt,
    };
  });

  const latestAssets = [...windowAssets]
    .sort((a, b) => b.created_time.localeCompare(a.created_time))
    .slice(0, 8)
    .map((asset) => ({
      name: asset.file_name,
      productName: asset.product_name,
      personLabel: asset.attributed_person_label,
      createdTime: asset.created_time,
      webViewLink: asset.web_view_link ?? null,
    }));

  return {
    total: windowAssets.length,
    target,
    byPerson,
    byProduct,
    latestAssets,
  };
}

function toBogotaDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return date.toISOString().slice(0, 10);
}

export function resolveBogotaWeek(now = new Date()): BogotaWeekWindow {
  const today = toBogotaDateString(now);
  const configured = JUNE_2026_WINDOWS.find((week) => today >= week.start && today < week.end);
  if (configured) return configured;

  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const start = addDays(today, -daysFromMonday);
  const end = addDays(start, 7);
  return { label: `Semana actual · ${start} → ${addDays(end, -1)}`, start, end };
}

export function toBogotaIsoWindow(periodStart: string, periodEndExclusive: string): { start: string; end: string } {
  return {
    start: `${periodStart}T05:00:00.000Z`,
    end: `${periodEndExclusive}T04:59:59.999Z`,
  };
}

export function statusRank(status: KpiStatus): number {
  if (status === "red") return 3;
  if (status === "yellow") return 2;
  if (status === "missing") return 1;
  return 0;
}

export function worstStatus(statuses: KpiStatus[]): KpiStatus {
  return statuses.reduce((worst, status) => statusRank(status) > statusRank(worst) ? status : worst, "green" as KpiStatus);
}
