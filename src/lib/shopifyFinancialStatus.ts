export const SHOPIFY_ANALYTICS_SALE_STATUSES = [
  'paid',
  'partially_paid',
  'partially_refunded',
] as const;

const SHOPIFY_ANALYTICS_SALE_STATUS_SET = new Set<string>(SHOPIFY_ANALYTICS_SALE_STATUSES);

export function isShopifyAnalyticsSaleStatus(status: string | null | undefined): boolean {
  return !!status && SHOPIFY_ANALYTICS_SALE_STATUS_SET.has(status);
}

export function filterShopifyAnalyticsSaleOrders<T extends { financial_status?: string | null }>(rows: T[]): T[] {
  return rows.filter((row) => isShopifyAnalyticsSaleStatus(row.financial_status));
}
