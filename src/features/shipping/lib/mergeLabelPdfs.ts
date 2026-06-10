import { PDFDocument } from 'pdf-lib';
import { getProxyLabelUrl } from './orderLabelUtils';

const FETCH_CONCURRENCY = 4;

export interface MergeLabelsResult {
  blob: Blob | null;
  includedCount: number;
  skippedCount: number;
}

// Une los PDFs de las guías (formato etiqueta 4x6 se preserva página a página).
// Una etiqueta que falle al descargar o cargar se omite sin abortar el merge.
export async function mergeLabelPdfs(labelUrls: string[]): Promise<MergeLabelsResult> {
  const buffers: (ArrayBuffer | null)[] = new Array(labelUrls.length).fill(null);

  const queue = labelUrls.map((url, index) => ({ url, index }));
  const workers = Array.from({ length: Math.min(FETCH_CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      try {
        const response = await fetch(getProxyLabelUrl(next.url));
        if (response.ok) {
          buffers[next.index] = await response.arrayBuffer();
        }
      } catch {
        // se omite esta etiqueta
      }
    }
  });
  await Promise.all(workers);

  const merged = await PDFDocument.create();
  let includedCount = 0;

  for (const buffer of buffers) {
    if (!buffer) continue;
    try {
      const source = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach(page => merged.addPage(page));
      includedCount++;
    } catch {
      // PDF corrupto: se omite
    }
  }

  if (includedCount === 0) {
    return { blob: null, includedCount: 0, skippedCount: labelUrls.length };
  }

  const bytes = await merged.save();
  return {
    blob: new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }),
    includedCount,
    skippedCount: labelUrls.length - includedCount,
  };
}

// La ventana debe abrirse de forma síncrona en el click handler (popup blocker);
// aquí solo se le asigna el contenido ya generado.
export function openPdfForPrint(blob: Blob, targetWindow?: Window | null): void {
  const url = URL.createObjectURL(blob);
  const printWindow = targetWindow || window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    URL.revokeObjectURL(url);
    return;
  }
  printWindow.location.href = url;
  setTimeout(() => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch {
      /* noop */
    }
  }, 1500);
  // Revocar después de que la ventana haya cargado e impreso
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
