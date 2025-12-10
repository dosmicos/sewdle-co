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
}

export interface CreateLabelResponse {
  success: boolean;
  label?: ShippingLabel;
  error?: string;
  tracking_number?: string;
  label_url?: string;
  carrier?: string;
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
