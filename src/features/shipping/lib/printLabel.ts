import { getProxyLabelUrl } from './orderLabelUtils';

// Imprime el PDF de una guía sin abrir ventana nueva (sin popup blocker):
// descarga vía proxy (CORS *), crea un blob URL (hereda el origin de la app,
// así el iframe es same-origin) y dispara print() desde un iframe oculto.
// window.print() no requiere user-gesture, a diferencia de window.open().
// Devuelve false si algo falla — el caller debe dejar visible un botón
// "Imprimir guía" como fallback (en Firefox los PDFs en iframe pueden
// imprimir en blanco; ahí el fallback con window.open es el camino).
export async function printLabelInline(labelUrl: string): Promise<boolean> {
  try {
    const response = await fetch(getProxyLabelUrl(labelUrl));
    if (!response.ok) return false;

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const iframe = document.createElement('iframe');
    // width/height 0 en vez de display:none — display:none rompe la impresión
    // del visor PDF de Chrome.
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;

    const printed = await new Promise<boolean>(resolve => {
      const fail = setTimeout(() => resolve(false), 15_000);
      iframe.onload = () => {
        // Pequeño delay para que el visor PDF termine de renderizar
        setTimeout(() => {
          clearTimeout(fail);
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            resolve(true);
          } catch {
            resolve(false);
          }
        }, 300);
      };
      document.body.appendChild(iframe);
    });

    // Cleanup diferido: remover antes cierra el diálogo de impresión
    setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(url);
    }, 60_000);

    return printed;
  } catch {
    return false;
  }
}

// Fallback con user-gesture (click): abre el PDF en ventana y auto-imprime.
// Mismo patrón que handlePrintLabel de EnviaShippingButton.
export function printLabelInWindow(labelUrl: string): void {
  const printWindow = window.open(getProxyLabelUrl(labelUrl), '_blank', 'width=800,height=600');
  if (!printWindow) return;
  setTimeout(() => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch {
      /* el usuario imprime manualmente desde la ventana */
    }
  }, 1500);
}
