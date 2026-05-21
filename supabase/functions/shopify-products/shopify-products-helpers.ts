export const extractNextPageInfo = (
  linkHeader: string | null,
): string | null => {
  if (!linkHeader) return null;

  const nextLink = linkHeader
    .split(",")
    .map((part) => part.trim())
    .find((part) => /rel="next"/.test(part));

  if (!nextLink) return null;

  const urlMatch = nextLink.match(/<([^>]+)>/);
  if (!urlMatch?.[1]) return null;

  try {
    return new URL(urlMatch[1]).searchParams.get("page_info");
  } catch (_error) {
    return null;
  }
};

const normalizeSearchableValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map(normalizeSearchableValue).join(" ");
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).toLowerCase();
};

export const productMatchesSearch = (
  product: any,
  searchTerm: string,
): boolean => {
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) return true;

  const variants = Array.isArray(product?.variants) ? product.variants : [];

  return (
    normalizeSearchableValue(product?.title).includes(needle) ||
    normalizeSearchableValue(product?.body_html).includes(needle) ||
    normalizeSearchableValue(product?.product_type).includes(needle) ||
    normalizeSearchableValue(product?.tags).includes(needle) ||
    variants.some((variant: any) =>
      normalizeSearchableValue(variant?.sku).includes(needle) ||
      normalizeSearchableValue(variant?.title).includes(needle)
    )
  );
};
