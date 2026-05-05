export interface UgcCreator {
  id: string;
  organization_id: string;
  name: string;
  instagram_handle: string | null;
  instagram_followers: number;
  email: string | null;
  phone: string | null;
  city: string | null;
  notes: string | null;
  status: CreatorStatus;
  engagement_rate: number | null;
  avg_likes: number;
  avg_views: number;
  avatar_url: string | null;
  platform: string | null;
  content_types: string[] | null;
  tiktok_handle: string | null;
  last_contact_date: string | null;
  access_code: string | null;
  created_at: string;
  updated_at: string;

  // Performance tracking (computed by compute-ugc-scores)
  overall_score?: number | null;
  roas_score?: number | null;
  engagement_score?: number | null;
  conversion_score?: number | null;
  consistency_score?: number | null;
  roi_score?: number | null;
  tier?: CreatorTier | null;
  lifetime_spend?: number | null;
  lifetime_revenue?: number | null;
  lifetime_roas?: number | null;
  lifetime_purchases?: number | null;
  total_ads?: number | null;
  avg_ctr?: number | null;
  avg_cpa?: number | null;
  avg_hook_rate?: number | null;
  avg_hold_rate?: number | null;
  avg_lp_conv_rate?: number | null;
  best_ad_id?: string | null;
  best_ad_roas?: number | null;
  worst_ad_id?: string | null;
  worst_ad_roas?: number | null;
  best_product?: string | null;
  best_product_roas?: number | null;
  best_angle?: string | null;
  best_angle_roas?: number | null;
  recommendation?: string | null;
  scores_computed_at?: string | null;
}

export type CreatorTier = 'S' | 'A' | 'B' | 'C' | 'D' | 'new';

export type CreatorStatus = 'prospecto' | 'contactado' | 'respondio_no' | 'respondio_si' | 'negociando' | 'activo' | 'inactivo';

export interface UgcCreatorChild {
  id: string;
  creator_id: string;
  organization_id: string;
  name: string;
  age_description: string | null;
  size: string | null;
  gender: 'masculino' | 'femenino' | 'otro' | null;
  birth_date: string | null;
  created_at: string;
  updated_at: string;
}

export type CampaignStatus =
  | 'contactado'
  | 'negociando'
  | 'aceptado'
  | 'producto_enviado'
  | 'producto_recibido'
  | 'video_en_revision'
  | 'video_aprobado'
  | 'publicado'
  | 'completado'
  | 'cancelado';

export interface UgcCampaign {
  id: string;
  creator_id: string;
  organization_id: string;
  name: string;
  status: CampaignStatus;
  order_number: string | null;
  product_sent: string | null;
  tracking_number: string | null;
  shipping_date: string | null;
  received_date: string | null;
  deadline: string | null;
  agreed_videos: number;
  agreed_payment: number;
  payment_type: 'producto' | 'efectivo' | 'mixto';
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  creator?: UgcCreator;
  videos?: UgcVideo[];
}

export interface UgcVideo {
  id: string;
  campaign_id: string;
  creator_id: string;
  organization_id: string;
  video_url: string | null;
  status: 'pendiente' | 'en_revision' | 'aprobado' | 'rechazado' | 'publicado';
  published_organic?: boolean;
  published_organic_at?: string | null;
  published_ads?: boolean;
  published_ads_at?: string | null;
  likes: number;
  views: number;
  comments: number;
  platform: 'instagram_reel' | 'instagram_story' | 'tiktok' | 'instagram_post' | 'instagram_carousel' | null;
  published_date: string | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface UgcCreatorFormData {
  name: string;
  instagram_handle?: string;
  instagram_followers?: number;
  email?: string;
  phone?: string;
  city?: string;
  engagement_rate?: number;
  notes?: string;
  platform?: string;
  content_types?: string[];
  tiktok_handle?: string;
  tagIds?: string[];
}

export interface UgcCampaignFormData {
  name: string;
  order_number?: string;
  agreed_videos: number;
  agreed_payment?: number;
  payment_type: 'producto' | 'efectivo' | 'mixto';
  notes?: string;
}

export interface UgcVideoFormData {
  video_url: string;
  platform: 'instagram_reel' | 'instagram_story' | 'tiktok' | 'instagram_post' | 'instagram_carousel';
  likes?: number;
  views?: number;
  comments?: number;
}

export const CREATOR_STATUS_CONFIG: Record<CreatorStatus, { label: string; color: string; bgClass: string; textClass: string }> = {
  prospecto: { label: 'Prospecto', color: '#9ca3af', bgClass: 'bg-gray-100', textClass: 'text-gray-700' },
  contactado: { label: 'Contactado', color: '#9ca3af', bgClass: 'bg-gray-100', textClass: 'text-gray-700' },
  respondio_no: { label: 'Rechazó', color: '#ef4444', bgClass: 'bg-red-100', textClass: 'text-red-700' },
  respondio_si: { label: 'Interesado', color: '#3b82f6', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
  negociando: { label: 'Negociando', color: '#f59e0b', bgClass: 'bg-yellow-100', textClass: 'text-yellow-700' },
  activo: { label: 'Activo', color: '#22c55e', bgClass: 'bg-green-100', textClass: 'text-green-700' },
  inactivo: { label: 'Inactivo', color: '#6b7280', bgClass: 'bg-gray-100', textClass: 'text-gray-600' },
};

export const CAMPAIGN_STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; bgClass: string; textClass: string }> = {
  contactado: { label: 'Contactado', color: '#9ca3af', bgClass: 'bg-gray-100', textClass: 'text-gray-700' },
  negociando: { label: 'Negociando', color: '#f59e0b', bgClass: 'bg-yellow-100', textClass: 'text-yellow-700' },
  aceptado: { label: 'Aceptado', color: '#3b82f6', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
  producto_enviado: { label: 'Producto Enviado', color: '#f59e0b', bgClass: 'bg-yellow-100', textClass: 'text-yellow-700' },
  producto_recibido: { label: 'Producto Recibido', color: '#3b82f6', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
  video_en_revision: { label: 'Video en Revisión', color: '#f97316', bgClass: 'bg-orange-100', textClass: 'text-orange-700' },
  video_aprobado: { label: 'Video Aprobado', color: '#22c55e', bgClass: 'bg-green-100', textClass: 'text-green-700' },
  publicado: { label: 'Publicado', color: '#22c55e', bgClass: 'bg-green-100', textClass: 'text-green-700' },
  completado: { label: 'Completado', color: '#22c55e', bgClass: 'bg-green-100', textClass: 'text-green-700' },
  cancelado: { label: 'Cancelado', color: '#ef4444', bgClass: 'bg-red-100', textClass: 'text-red-700' },
};

export const PROSPECT_KANBAN_COLUMNS: CreatorStatus[] = [
  'prospecto',
  'contactado',
  'negociando',
];

export const KANBAN_COLUMNS: CampaignStatus[] = [
  'aceptado',
  'producto_enviado',
  'producto_recibido',
  'video_en_revision',
  'completado',
];

// ─── Performance Tracking Types ──────────────────────────────────

export const TIER_CONFIG: Record<CreatorTier, { label: string; color: string; bgClass: string; textClass: string; emoji: string }> = {
  S: { label: 'S — Elite', color: '#8b5cf6', bgClass: 'bg-purple-100', textClass: 'text-purple-700', emoji: '🟣' },
  A: { label: 'A — Excelente', color: '#3b82f6', bgClass: 'bg-blue-100', textClass: 'text-blue-700', emoji: '🔵' },
  B: { label: 'B — Buena', color: '#22c55e', bgClass: 'bg-green-100', textClass: 'text-green-700', emoji: '🟢' },
  C: { label: 'C — Regular', color: '#eab308', bgClass: 'bg-yellow-100', textClass: 'text-yellow-700', emoji: '🟡' },
  D: { label: 'D — Bajo', color: '#ef4444', bgClass: 'bg-red-100', textClass: 'text-red-700', emoji: '🔴' },
  new: { label: 'New', color: '#9ca3af', bgClass: 'bg-gray-100', textClass: 'text-gray-600', emoji: '⚪' },
};

export const RECOMMENDATION_CONFIG: Record<string, { label: string; description: string; bgClass: string; textClass: string }> = {
  assign_more_work: { label: 'Asignar Mas Trabajo', description: 'Top performer, prioridad para nuevo contenido', bgClass: 'bg-green-100', textClass: 'text-green-700' },
  test_new_product: { label: 'Probar Producto', description: 'Buen rendimiento, ampliar rango de productos', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
  pause_collaboration: { label: 'Pausar', description: 'Rendimiento bajo consistente', bgClass: 'bg-red-100', textClass: 'text-red-700' },
  needs_direction: { label: 'Necesita Direccion', description: 'Buen hook pero baja conversion', bgClass: 'bg-amber-100', textClass: 'text-amber-700' },
  new_creator_watch: { label: 'Observar', description: 'Datos insuficientes, monitorear', bgClass: 'bg-gray-100', textClass: 'text-gray-600' },
};

export interface UgcCreatorAd {
  id: string;
  organization_id: string;
  creator_id: string;
  ad_id: string;
  ad_name: string | null;
  total_spend: number;
  total_revenue: number;
  total_purchases: number;
  roas: number;
  cpa: number;
  avg_ctr: number | null;
  avg_hook_rate: number | null;
  avg_hold_rate: number | null;
  avg_lp_conv_rate: number | null;
  product: string | null;
  sales_angle: string | null;
  creative_type: string | null;
  first_seen: string | null;
  last_seen: string | null;
  days_active: number | null;
  current_status: string | null;
  computed_at: string | null;
}
