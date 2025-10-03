export type ProspectStage = 
  | 'lead'
  | 'videocall_scheduled'
  | 'videocall_completed'
  | 'visit_scheduled'
  | 'visit_completed'
  | 'sample_requested'
  | 'sample_in_progress'
  | 'sample_approved'
  | 'sample_rejected'
  | 'trial_production'
  | 'trial_approved'
  | 'trial_rejected'
  | 'approved_workshop'
  | 'rejected';

export type ProspectActivityType =
  | 'note'
  | 'call'
  | 'videocall'
  | 'visit'
  | 'email'
  | 'whatsapp'
  | 'stage_change'
  | 'sample_sent'
  | 'sample_received';

export type ProspectActivityStatus = 'pending' | 'completed' | 'cancelled';

export type ProspectFileCategory = 'facility_photo' | 'sample_photo' | 'contract' | 'other';

export interface WorkshopProspect {
  id: string;
  organization_id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  source?: string;
  stage: ProspectStage;
  quality_index?: number;
  specialties?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  assigned_to?: string;
  converted_workshop_id?: string;
}

export interface ProspectActivity {
  id: string;
  prospect_id: string;
  organization_id: string;
  activity_type: ProspectActivityType;
  title: string;
  description?: string;
  scheduled_date?: string;
  completed_date?: string;
  status: ProspectActivityStatus;
  created_by?: string;
  created_at: string;
}

export interface ProspectFile {
  id: string;
  prospect_id: string;
  organization_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_category: ProspectFileCategory;
  uploaded_by?: string;
  created_at: string;
}

export const STAGE_LABELS: Record<ProspectStage, string> = {
  lead: 'Contacto Inicial',
  videocall_scheduled: 'Videollamada Agendada',
  videocall_completed: 'Videollamada Realizada',
  visit_scheduled: 'Visita Agendada',
  visit_completed: 'Visita Realizada',
  sample_requested: 'Muestra Solicitada',
  sample_in_progress: 'Muestra en Proceso',
  sample_approved: 'Muestra Aprobada',
  sample_rejected: 'Muestra Rechazada',
  trial_production: 'Producción de Prueba',
  trial_approved: 'Prueba Aprobada',
  trial_rejected: 'Prueba Rechazada',
  approved_workshop: 'Taller Aprobado',
  rejected: 'Rechazado',
};

export const ACTIVITY_TYPE_LABELS: Record<ProspectActivityType, string> = {
  note: 'Nota',
  call: 'Llamada',
  videocall: 'Videollamada',
  visit: 'Visita',
  email: 'Email',
  whatsapp: 'WhatsApp',
  stage_change: 'Cambio de Etapa',
  sample_sent: 'Muestra Enviada',
  sample_received: 'Muestra Recibida',
};
