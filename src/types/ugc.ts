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
  created_at: string;
  updated_at: string;
}

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
  likes: number;
  views: number;
  comments: number;
  platform: 'instagram_reel' | 'instagram_story' | 'tiktok' | null;
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
  platform: 'instagram_reel' | 'instagram_story' | 'tiktok';
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
