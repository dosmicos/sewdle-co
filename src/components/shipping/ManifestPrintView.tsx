/**
 * Opens a new browser window with the manifest content and triggers print.
 *
 * Uses window.open() instead of a React portal overlay — avoids conflicts with
 * Radix Sheet's onPointerDownOutside closing the manifests panel and the
 * React 18 event delegation issue (listeners on #root, not document.body).
 */
import { ManifestWithItems } from '@/hooks/useShippingManifests';

const CARRIER_NAMES: Record<string, string> = {
  coordinadora: 'Coordinadora',
  interrapidisimo: 'Interrapidísimo',
  deprisa: 'Deprisa',
  servientrega: 'Servientrega',
  tcc: 'TCC',
  envia: 'Envía',
  otro: 'Otro',
};

function fmtDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return dateStr;
  }
}

export function openManifestPrintWindow(manifest: ManifestWithItems): void {
  const items = manifest.items;
  const halfLength = Math.ceil(items.length / 2);
  const leftColumn = items.slice(0, halfLength);
  const rightColumn = items.slice(halfLength);

  const carrierName = CARRIER_NAMES[manifest.carrier] || manifest.carrier;

  const tableRows = leftColumn.map((leftItem, idx) => {
    const rightItem = rightColumn[idx];
    const leftNum = String(idx + 1).padStart(2, '0');
    const rightNum = String(halfLength + idx + 1).padStart(2, '0');
    const bgColor = idx % 2 === 0 ? '#ffffff' : '#f9f9f9';

    const rightCells = rightItem
      ? `<td style="border:1px solid #000;padding:2px 3px;text-align:center;font-weight:600;">${rightNum}</td>
         <td style="border:1px solid #000;padding:2px 3px;font-family:monospace;font-size:9px;">${rightItem.tracking_number}</td>
         <td style="border:1px solid #000;padding:2px 3px;text-align:center;">1</td>`
      : `<td style="border:1px solid #000;padding:2px 3px;"></td>
         <td style="border:1px solid #000;padding:2px 3px;"></td>
         <td style="border:1px solid #000;padding:2px 3px;"></td>`;

    return `<tr style="background:${bgColor};">
      <td style="border:1px solid #000;padding:2px 3px;text-align:center;font-weight:600;">${leftNum}</td>
      <td style="border:1px solid #000;padding:2px 3px;font-family:monospace;font-size:9px;">${leftItem.tracking_number}</td>
      <td style="border:1px solid #000;padding:2px 3px;text-align:center;">1</td>
      ${rightCells}
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Manifiesto ${manifest.manifest_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      font-size: 10px;
      padding: 8px;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: letter; margin: 5mm; }
    @media print { body { padding: 0; } }
    table { border-collapse: collapse; }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="border:2px solid #000;margin-bottom:6px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:6px 8px;border-bottom:1px solid #000;">
      <div>
        <div style="font-size:14px;font-weight:700;text-transform:uppercase;">${carrierName}</div>
        <div style="font-size:9px;font-weight:600;">MANIFIESTO DE CARGA</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:13px;font-weight:700;">${manifest.manifest_number}</div>
        <div style="font-size:9px;">${fmtDate(manifest.manifest_date)}</div>
      </div>
    </div>

    <!-- Remitente / Destinatario -->
    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000;">
      <div style="padding:5px 8px;border-right:1px solid #000;font-size:8px;">
        <div style="font-weight:700;">REMITENTE:</div>
        <div>Dosmicos S.A.S</div>
        <div>Bogotá D.C.</div>
        <div>dosmicos.sas@gmail.com</div>
      </div>
      <div style="padding:5px 8px;font-size:8px;">
        <div style="font-weight:700;">DESTINATARIO:</div>
        <div>Múltiples destinos</div>
        <div>Ver detalle por guía</div>
      </div>
    </div>

    <div style="display:flex;padding:4px 8px;font-size:9px;">
      <div style="flex:1;"><strong>Total de guías:</strong> ${items.length}</div>
      <div style="text-align:right;"><strong>Total paquetes:</strong> ${items.length}</div>
    </div>
  </div>

  <!-- Guide table -->
  <table style="width:100%;font-size:8px;line-height:1.2;margin-bottom:8px;">
    <thead>
      <tr style="background:#e0e0e0;">
        <th style="border:1px solid #000;padding:2px 3px;width:5%;text-align:center;">No.</th>
        <th style="border:1px solid #000;padding:2px 3px;width:37%;text-align:left;">Número de Guía</th>
        <th style="border:1px solid #000;padding:2px 3px;width:8%;text-align:center;">Paq.</th>
        <th style="border:1px solid #000;padding:2px 3px;width:5%;text-align:center;">No.</th>
        <th style="border:1px solid #000;padding:2px 3px;width:37%;text-align:left;">Número de Guía</th>
        <th style="border:1px solid #000;padding:2px 3px;width:8%;text-align:center;">Paq.</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <!-- Footer -->
  <div style="border:2px solid #000;">
    <div style="padding:6px 8px;border-bottom:1px solid #000;font-size:9px;">
      <strong>Total Paquetes:</strong> ${items.length}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;font-size:8px;">
      <div style="padding:8px;border-right:1px solid #000;">
        <div style="font-weight:700;margin-bottom:36px;">Transportadora: ${carrierName}</div>
        <div style="border-top:1px solid #000;padding-top:2px;"></div>
      </div>
      <div style="padding:8px;">
        <div style="margin-bottom:10px;">
          <strong>Tipo de vehículo:</strong><br/>
          <div style="border-bottom:1px solid #000;margin-top:14px;"></div>
        </div>
        <div style="margin-bottom:10px;">
          <strong>Placa de vehículo:</strong><br/>
          <div style="border-bottom:1px solid #000;margin-top:14px;"></div>
        </div>
        <div>
          <strong>Cédula conductor/destino:</strong><br/>
          <div style="border-bottom:1px solid #000;margin-top:14px;"></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    window.addEventListener('load', function() {
      window.focus();
      window.print();
    });
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    console.warn('Popup blocked — allow popups for this site to print manifests');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
}
