
/**
 * Utility functions for safe date handling without timezone issues
 */

/**
 * Safely formats a date string (YYYY-MM-DD) to a localized date string
 * Treats the input as a local date, not UTC
 */
export const formatDateSafe = (dateString: string): string => {
  if (!dateString) return '';
  
  // Parse the date components manually to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Create date using local timezone (month is 0-indexed)
  const date = new Date(year, month - 1, day);
  
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Safely parses a date string to a Date object using local timezone
 */
export const parseDateSafe = (dateString: string): Date => {
  if (!dateString) return new Date();
  
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Formats a date to YYYY-MM-DD string format
 */
export const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};
