
export interface Material {
  id: string;
  sku: string;
  name: string;
  description?: string;
  unit: string;
  color?: string;
  category: string;
  min_stock_alert: number;
  current_stock: number;
  supplier?: string;
  unit_cost?: number;
  image_url?: string;
  stock_status?: string;
  created_at: string;
}

export interface CreateMaterialData {
  name: string;
  description?: string;
  category: string;
  unit: string;
  color?: string;
  min_stock_alert: number;
  supplier?: string;
  unit_cost?: number;
}
