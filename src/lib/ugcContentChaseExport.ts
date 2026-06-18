import { supabase } from '@/integrations/supabase/client';

// Row shape returned by the get_ugc_cmd_pending_content_report RPC.
interface CmdPendingRow {
  order_number: string | null;
  contact_phone: string | null;
  creator_name: string | null;
  username: string | null;
  order_date: string | null;
  delivered_date: string | null;
  days_since_order: number | null;
  product_items: string | null;
}

// Human-friendly elapsed time: "X semanas" once it's been 2+ weeks, else "X días".
const elapsedLabel = (days: number | null): string => {
  const d = days ?? 0;
  if (d >= 14) return `${Math.floor(d / 7)} semanas`;
  if (d === 1) return '1 día';
  return `${d} días`;
};

// Warm, on-brand WhatsApp message asking (subtly) for the content, referencing
// the actual product(s) the creator received and how long ago.
const buildMessage = (row: CmdPendingRow): string => {
  const firstName = (row.creator_name || '').trim().split(/\s+/)[0] || 'mami';
  const tiempo = elapsedLabel(row.days_since_order);
  const prod = row.product_items?.trim() ? row.product_items.trim() : 'tu pedido';
  return `¡Hola ${firstName}! 💛 Vimos que ya te llegó ${prod} hace ${tiempo} y nos encantaría ver a tu peque luciéndolo 🥰 ¿Nos compartes un videíto o unas foticos mostrándolo? Con eso ayudas a más mamis a conocernos ✨ ¡Mil gracias! 🐻`;
};

/**
 * Fetches the CMD "pending content" report and downloads it as an .xlsx file.
 * Returns the number of rows exported.
 */
export const exportCmdPendingContentReport = async (minDays = 7): Promise<number> => {
  const { data, error } = await supabase.rpc('get_ugc_cmd_pending_content_report', {
    p_min_days: minDays,
  });
  if (error) throw error;

  const rows = (data ?? []) as CmdPendingRow[];

  // Load SheetJS lazily so its ~700KB only ships when someone actually exports.
  const XLSX = await import('xlsx');

  const sheetRows = rows.map((r) => ({
    'Pedido': r.order_number ?? '',
    'Contacto': r.contact_phone ?? '',
    'Tiempo transcurrido': elapsedLabel(r.days_since_order),
    'Nombre': r.creator_name ?? '',
    'Usuario': r.username ?? '',
    'Productos del pedido': r.product_items ?? '',
    'Mensaje sugerido': buildMessage(r),
    'Fecha de entrega': r.delivered_date ?? '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  // Reasonable column widths so the sheet is readable on open.
  worksheet['!cols'] = [
    { wch: 10 }, // Pedido
    { wch: 16 }, // Contacto
    { wch: 18 }, // Tiempo transcurrido
    { wch: 26 }, // Nombre
    { wch: 22 }, // Usuario
    { wch: 38 }, // Productos del pedido
    { wch: 90 }, // Mensaje sugerido
    { wch: 14 }, // Fecha de entrega
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pendientes de contenido');

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `pendientes-contenido-cmd_${today}.xlsx`);

  return rows.length;
};
