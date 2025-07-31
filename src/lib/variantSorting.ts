
/**
 * Función utilitaria para ordenar variantes de productos de manera inteligente
 */

export interface VariantForSorting {
  size?: string;
  color?: string;
  title?: string;
}

/**
 * Extrae números de un string para comparación numérica
 */
const extractNumber = (str: string): number => {
  const match = str.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
};

/**
 * Extrae rango de edad (ej: "0 a 3 meses" -> 0, "3 a 6 meses" -> 3, "6 (3-4 años)" -> 36)
 */
const extractAgeRangeStart = (str: string): number => {
  const lowerStr = str.toLowerCase();
  
  // Primero revisar si hay paréntesis con rangos de edad
  const parenthesesMatch = lowerStr.match(/\(([^)]+)\)/);
  if (parenthesesMatch) {
    const insideParentheses = parenthesesMatch[1];
    
    // Patrones dentro de paréntesis
    const parenthesesPatterns = [
      /(\d+)\s*a\s*\d+\s*mes/i,     // "12 a 24 meses"
      /(\d+)\s*-\s*\d+\s*mes/i,     // "12-24 meses"
      /(\d+)\s*a\s*\d+\s*año/i,     // "3 a 4 años"
      /(\d+)\s*-\s*\d+\s*año/i,     // "3-4 años"
      /(\d+)\s*to\s*\d+\s*month/i,  // "12 to 24 months"
      /(\d+)\s*to\s*\d+\s*year/i,   // "3 to 4 years"
    ];

    for (const pattern of parenthesesPatterns) {
      const match = insideParentheses.match(pattern);
      if (match) {
        const ageValue = parseInt(match[1]);
        // Si son años, convertir a meses
        if (pattern.source.includes('año') || pattern.source.includes('year')) {
          return ageValue * 12;
        }
        return ageValue;
      }
    }
  }
  
  // Patrones normales de edad (sin paréntesis)
  const agePatterns = [
    /(\d+)\s*a\s*\d+\s*mes/i,     // "0 a 3 meses", "3 a 6 meses"
    /(\d+)\s*-\s*\d+\s*mes/i,     // "0-3 meses", "3-6 meses"
    /(\d+)\s*a\s*\d+\s*año/i,     // "1 a 2 años"
    /(\d+)\s*-\s*\d+\s*año/i,     // "1-2 años"
    /(\d+)\s*to\s*\d+\s*month/i,  // "0 to 3 months"
    /(\d+)\s*to\s*\d+\s*year/i,   // "1 to 2 years"
    /(\d+)\s*mes/i,               // "3 meses"
    /(\d+)\s*año/i,               // "2 años"
    /(\d+)m/i,                    // "3m", "6m"
    /(\d+)y/i,                    // "2y", "3y"
  ];

  for (const pattern of agePatterns) {
    const match = lowerStr.match(pattern);
    if (match) {
      const ageValue = parseInt(match[1]);
      // Si son años, convertir a meses
      if (pattern.source.includes('año') || pattern.source.includes('year') || pattern.source.includes('y')) {
        return ageValue * 12;
      }
      return ageValue;
    }
  }

  return extractNumber(str);
};

/**
 * Determina el orden de una talla estándar
 */
const getStandardSizeOrder = (size: string): number => {
  const lowerSize = size.toLowerCase().trim();
  
  const sizeOrder: { [key: string]: number } = {
    'xxxs': 1, '3xs': 1,
    'xxs': 2, '2xs': 2,
    'xs': 3,
    's': 4, 'small': 4,
    'm': 5, 'medium': 5,
    'l': 6, 'large': 6,
    'xl': 7, 'x-large': 7,
    'xxl': 8, '2xl': 8, '2x-large': 8,
    'xxxl': 9, '3xl': 9, '3x-large': 9,
    '4xl': 10, '5xl': 11, '6xl': 12
  };

  return sizeOrder[lowerSize] || 999;
};

/**
 * Determina si un string representa una edad/rango de edad
 */
const isAgeVariant = (str: string): boolean => {
  const lowerStr = str.toLowerCase();
  
  // Revisar patrones con paréntesis primero (ej: "6 (3-4 años)")
  if (/\([^)]*\d+[^)]*\)/i.test(lowerStr)) {
    const parenthesesMatch = lowerStr.match(/\(([^)]+)\)/);
    if (parenthesesMatch) {
      const insideParentheses = parenthesesMatch[1];
      return /\d+\s*(a|to|-)\s*\d+\s*(mes|month|año|year)|^\d+\s*(mes|month|m|año|year|y)/.test(insideParentheses);
    }
  }
  
  // Patrones normales de edad
  return /\d+\s*(a|to|-)\s*\d+\s*(mes|month|año|year)|^\d+\s*(mes|month|m|año|year|y)/.test(lowerStr);
};

/**
 * Determina si un string representa una talla estándar
 */
const isStandardSize = (str: string): boolean => {
  const lowerStr = str.toLowerCase().trim();
  return ['xxxs', '3xs', 'xxs', '2xs', 'xs', 's', 'small', 'm', 'medium', 'l', 'large', 'xl', 'x-large', 'xxl', '2xl', '2x-large', 'xxxl', '3xl', '3x-large', '4xl', '5xl', '6xl'].includes(lowerStr);
};

/**
 * Función principal para ordenar variantes
 */
export const sortVariants = <T extends VariantForSorting>(variants: T[]): T[] => {
  return [...variants].sort((a, b) => {
    // Usar el campo más relevante para ordenar
    const aValue = a.size || a.title || a.color || '';
    const bValue = b.size || b.title || b.color || '';

    // Si ambos son vacíos, mantener orden original
    if (!aValue && !bValue) return 0;
    if (!aValue) return 1;
    if (!bValue) return -1;

    // Caso 1: Ambos son variantes de edad
    if (isAgeVariant(aValue) && isAgeVariant(bValue)) {
      const aAge = extractAgeRangeStart(aValue);
      const bAge = extractAgeRangeStart(bValue);
      return aAge - bAge;
    }

    // Caso 2: Ambos son tallas estándar
    if (isStandardSize(aValue) && isStandardSize(bValue)) {
      const aOrder = getStandardSizeOrder(aValue);
      const bOrder = getStandardSizeOrder(bValue);
      return aOrder - bOrder;
    }

    // Caso 3: Ambos son números
    const aNum = extractNumber(aValue);
    const bNum = extractNumber(bValue);
    if (aNum > 0 && bNum > 0) {
      return aNum - bNum;
    }

    // Caso 4: Uno es edad y otro no (edad primero)
    if (isAgeVariant(aValue) && !isAgeVariant(bValue)) return -1;
    if (!isAgeVariant(aValue) && isAgeVariant(bValue)) return 1;

    // Caso 5: Uno es talla estándar y otro no (talla estándar primero)
    if (isStandardSize(aValue) && !isStandardSize(bValue)) return -1;
    if (!isStandardSize(aValue) && isStandardSize(bValue)) return 1;

    // Caso por defecto: orden alfabético
    return aValue.localeCompare(bValue, 'es', { numeric: true });
  });
};

/**
 * Función específica para ordenar variantes de Shopify
 */
export const sortShopifyVariants = (variants: any[]): any[] => {
  return sortVariants(variants.map(v => ({
    ...v,
    title: v.title || v.size || '',
    size: v.size || v.title || ''
  })));
};

/**
 * Función específica para ordenar variantes de productos locales
 */
export const sortProductVariants = (variants: any[]): any[] => {
  return sortVariants(variants);
};
