export interface FilterOption {
  id: string;
  label: string;
  type: 'select' | 'multiselect' | 'daterange' | 'pricerange';
  options?: { value: string; label: string }[];
}

export interface ActiveFilter {
  id: string;
  label: string;
  value: string | string[];
  displayText: string;
}

export const FILTER_OPTIONS: FilterOption[] = [
  {
    id: 'operational_status',
    label: 'Estado de preparación del pedido',
    type: 'multiselect',
    options: [
      { value: 'pending', label: 'No preparado' },
      { value: 'picking', label: 'Picking' },
      { value: 'packing', label: 'Empacando' },
      { value: 'ready_to_ship', label: 'Empacado' },
    ]
  },
  {
    id: 'financial_status',
    label: 'Estado del pago',
    type: 'multiselect',
    options: [
      { value: 'paid', label: 'Pagado' },
      { value: 'pending', label: 'Pago pendiente' },
      { value: 'partially_paid', label: 'Pagado parcialmente' },
    ]
  },
  {
    id: 'fulfillment_status',
    label: 'Estado de la entrega',
    type: 'multiselect',
    options: [
      { value: 'fulfilled', label: 'Confirmado' },
      { value: 'partial', label: 'Parcial' },
      { value: 'unfulfilled', label: 'Sin confirmar' },
    ]
  },
  {
    id: 'tags',
    label: 'Incluir etiquetas',
    type: 'multiselect',
    options: [
      { value: 'confirmado', label: 'Confirmado' },
      { value: 'empacado', label: 'Empacado' },
      { value: 'urgente', label: 'Urgente' },
    ]
  },
  {
    id: 'exclude_tags',
    label: 'Excluir etiquetas',
    type: 'multiselect',
    options: [
      { value: 'empacado', label: 'Empacado' },
      { value: 'enviado', label: 'Enviado' },
      { value: 'cancelado', label: 'Cancelado' },
    ]
  },
  {
    id: 'price_range',
    label: 'Total del pedido',
    type: 'select',
    options: [
      { value: '0-50000', label: 'Menos de $50,000' },
      { value: '50000-100000', label: '$50,000 - $100,000' },
      { value: '100000-200000', label: '$100,000 - $200,000' },
      { value: '200000-500000', label: '$200,000 - $500,000' },
      { value: '500000-999999999', label: 'Más de $500,000' },
    ]
  },
  {
    id: 'date_range',
    label: 'Fecha de creación',
    type: 'select',
    options: [
      { value: 'today', label: 'Hoy' },
      { value: 'yesterday', label: 'Ayer' },
      { value: 'last_7_days', label: 'Últimos 7 días' },
      { value: 'last_30_days', label: 'Últimos 30 días' },
    ]
  },
];
