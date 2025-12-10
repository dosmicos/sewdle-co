// Envia.com API Types

export interface EnviaShipmentRequest {
  origin: EnviaAddress;
  destination: EnviaAddress;
  packages: EnviaPackage[];
  shipment: {
    carrier: string;
    service: string;
    type: number;
  };
  settings: {
    printFormat: string;
    printSize: string;
    currency: string;
  };
}

export interface EnviaAddress {
  name: string;
  company?: string;
  email: string;
  phone: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  reference?: string;
}

export interface EnviaPackage {
  content: string;
  amount: number;
  type: string;
  weight: number;
  insurance: number;
  declaredValue: number;
  weightUnit: string;
  lengthUnit: string;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
}

export interface EnviaShipmentResponse {
  meta: string;
  data: Array<{
    carrier: string;
    service: string;
    trackingNumber: string;
    trackUrl: string;
    label: string;
    additionalFiles: any[];
    createdAt: string;
    shipmentId: number;
    totalPrice: number;
    currency: string;
  }>;
}

export interface ShippingLabel {
  id: string;
  organization_id: string;
  shopify_order_id: number;
  order_number: string;
  carrier: string;
  tracking_number: string | null;
  label_url: string | null;
  shipment_id: string | null;
  total_price: number | null;
  status: string;
  destination_city: string | null;
  destination_department: string | null;
  destination_address: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  raw_response: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_tracking_update?: string | null;
  tracking_events?: TrackingEvent[] | null;
}

export interface ShippingCoverage {
  id: string;
  organization_id: string;
  municipality: string;
  department: string;
  dane_code: string | null;
  postal_code: string | null;
  coordinadora: boolean;
  interrapidisimo: boolean;
  deprisa: boolean;
  priority_carrier: string | null;
}

export interface CreateLabelRequest {
  shopify_order_id: number;
  organization_id: string;
  order_number: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string;
  destination_address: string;
  destination_city: string;
  destination_department: string;
  destination_postal_code?: string;
  package_content?: string;
  package_weight?: number;
  declared_value?: number;
  preferred_carrier?: string;
  is_cod?: boolean; // Cash on Delivery (Contraentrega)
  cod_amount?: number; // Amount to collect on delivery
}

export interface CreateLabelResponse {
  success: boolean;
  label?: ShippingLabel;
  error?: string;
  tracking_number?: string;
  label_url?: string;
  carrier?: string;
}

// Quote types
export interface QuoteRequest {
  destination_city: string;
  destination_department: string;
  destination_postal_code?: string;
  package_weight?: number;
  declared_value?: number;
}

export interface CarrierQuote {
  carrier: string;
  service: string;
  price: number;
  currency: string;
  estimated_days: number;
  deliveryEstimate?: string;
}

export interface QuoteResponse {
  success: boolean;
  quotes: CarrierQuote[];
  destination: {
    city: string;
    department: string;
    state_code: string;
  };
  error?: string;
}

// Tracking types
export interface TrackingEvent {
  date: string;
  time: string;
  description: string;
  location: string;
  status: string;
}

export interface TrackingRequest {
  tracking_number: string;
  carrier?: string;
}

export interface TrackingResponse {
  success: boolean;
  tracking_number: string;
  carrier: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'returned' | 'exception';
  origin?: string;
  destination?: string;
  last_update?: string;
  estimated_delivery?: string;
  events: TrackingEvent[];
  error?: string;
}

// Cancel types
export interface CancelLabelResponse {
  success: boolean;
  message?: string;
  balanceReturned?: boolean;
  error?: string;
}

// Carriers available in Colombia
export type CarrierCode = 'coordinadora' | 'interrapidisimo' | 'deprisa' | 'servientrega' | 'tcc' | 'envia' | 'otro';

export const CARRIER_NAMES: Record<CarrierCode, string> = {
  coordinadora: 'Coordinadora',
  interrapidisimo: 'Interrapidísimo',
  deprisa: 'Deprisa',
  servientrega: 'Servientrega',
  tcc: 'TCC',
  envia: 'Envía',
  otro: 'Otro'
};

export const CARRIER_ENVIA_CODES: Record<CarrierCode, string> = {
  coordinadora: 'coordinadora',
  interrapidisimo: 'interrapidisimo',
  deprisa: 'deprisa',
  servientrega: 'servientrega',
  tcc: 'tcc',
  envia: 'envia',
  otro: 'otro'
};

// Tracking status labels in Spanish
export const TRACKING_STATUS_LABELS: Record<string, string> = {
  'pending': 'Pendiente',
  'in_transit': 'En tránsito',
  'delivered': 'Entregado',
  'returned': 'Devuelto',
  'exception': 'Con novedad'
};

// Tracking status colors
export const TRACKING_STATUS_COLORS: Record<string, string> = {
  'pending': 'bg-yellow-100 text-yellow-800',
  'in_transit': 'bg-blue-100 text-blue-800',
  'delivered': 'bg-green-100 text-green-800',
  'returned': 'bg-red-100 text-red-800',
  'exception': 'bg-orange-100 text-orange-800'
};
