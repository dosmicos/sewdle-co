import React from 'react';
import { ManifestWithItems } from '@/hooks/useShippingManifests';
import { CARRIER_NAMES, type CarrierCode } from '@/features/shipping/types/envia';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ManifestPrintViewProps {
  manifest: ManifestWithItems;
  onClose: () => void;
}

export const ManifestPrintView: React.FC<ManifestPrintViewProps> = ({
  manifest,
  onClose,
}) => {
  const items = manifest.items;
  const halfLength = Math.ceil(items.length / 2);
  const leftColumn = items.slice(0, halfLength);
  const rightColumn = items.slice(halfLength);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      {/* Print controls - hidden when printing */}
      <div className="print:hidden flex items-center justify-between p-4 border-b bg-gray-100 sticky top-0">
        <h2 className="font-semibold">Vista previa de impresión</h2>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded hover:bg-gray-200"
          >
            Cancelar
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
          >
            Imprimir
          </button>
        </div>
      </div>

      {/* Printable content */}
      <div className="p-4 print:p-0 max-w-[210mm] mx-auto print:max-w-none">
        {/* Header */}
        <div className="border-2 border-black mb-2">
          <div className="flex justify-between items-start p-2 border-b border-black">
            <div>
              <h1 className="text-base font-bold uppercase">
                {CARRIER_NAMES[manifest.carrier as CarrierCode] || manifest.carrier}
              </h1>
              <p className="text-[10px] font-semibold">MANIFIESTO DE CARGA</p>
            </div>
            <div className="text-right text-[10px]">
              <p className="font-bold text-sm">{manifest.manifest_number}</p>
              <p>{format(new Date(manifest.manifest_date), 'dd/MM/yyyy', { locale: es })}</p>
            </div>
          </div>
          
          {/* Remitente/Destinatario info */}
          <div className="grid grid-cols-2 text-[9px] border-b border-black">
            <div className="p-1.5 border-r border-black">
              <p className="font-bold">REMITENTE:</p>
              <p>Dosmicos S.A.S</p>
              <p>Bogotá D.C.</p>
              <p>dosmicos.sas@gmail.com</p>
            </div>
            <div className="p-1.5">
              <p className="font-bold">DESTINATARIO:</p>
              <p>Múltiples destinos</p>
              <p>Ver detalle por guía</p>
            </div>
          </div>
          
          <div className="flex text-[10px] p-1.5">
            <div className="flex-1">
              <p><strong>Total de guías:</strong> {items.length}</p>
            </div>
            <div className="flex-1 text-right">
              <p><strong>Total paquetes:</strong> {items.length}</p>
            </div>
          </div>
        </div>

        {/* Two column table */}
        <table className="w-full border-collapse text-[8px] leading-tight">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black px-0.5 py-0.5 w-[4%] text-center">No.</th>
              <th className="border border-black px-0.5 py-0.5 w-[32%] text-left">Número de Guía</th>
              <th className="border border-black px-0.5 py-0.5 w-[8%] text-center">Paq.</th>
              <th className="border border-black px-0.5 py-0.5 w-[4%] text-center">No.</th>
              <th className="border border-black px-0.5 py-0.5 w-[32%] text-left">Número de Guía</th>
              <th className="border border-black px-0.5 py-0.5 w-[8%] text-center">Paq.</th>
            </tr>
          </thead>
          <tbody>
            {leftColumn.map((leftItem, idx) => {
              const rightItem = rightColumn[idx];
              const leftNum = idx + 1;
              const rightNum = halfLength + idx + 1;
              
              return (
                <tr key={leftItem.id} className="even:bg-gray-50">
                  <td className="border border-black px-0.5 py-0.5 text-center font-medium">
                    {String(leftNum).padStart(2, '0')}
                  </td>
                  <td className="border border-black px-0.5 py-0.5 font-mono text-[7px]">
                    {leftItem.tracking_number}
                  </td>
                  <td className="border border-black px-0.5 py-0.5 text-center">1</td>
                  
                  {rightItem ? (
                    <>
                      <td className="border border-black px-0.5 py-0.5 text-center font-medium">
                        {String(rightNum).padStart(2, '0')}
                      </td>
                      <td className="border border-black px-0.5 py-0.5 font-mono text-[7px]">
                        {rightItem.tracking_number}
                      </td>
                      <td className="border border-black px-0.5 py-0.5 text-center">1</td>
                    </>
                  ) : (
                    <>
                      <td className="border border-black px-0.5 py-0.5"></td>
                      <td className="border border-black px-0.5 py-0.5"></td>
                      <td className="border border-black px-0.5 py-0.5"></td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer with signature fields */}
        <div className="mt-3 border-2 border-black">
          {/* Totals row */}
          <div className="p-2 border-b border-black text-[10px]">
            <p><strong>Total Paquetes:</strong> {items.length}</p>
          </div>
          
          {/* Signatures section */}
          <div className="grid grid-cols-2 text-[9px]">
            {/* Left: Transportadora signature */}
            <div className="p-2 border-r border-black">
              <p className="font-bold mb-4">Transportadora:</p>
              <div className="border-t border-black pt-1 mt-12"></div>
            </div>
            
            {/* Right: Driver/vehicle info */}
            <div className="p-2 space-y-2">
              <div>
                <p><strong>Tipo de vehículo:</strong></p>
                <p className="border-b border-black mt-1 pb-1">_____________________________</p>
              </div>
              <div>
                <p><strong>Placa de vehículo:</strong></p>
                <p className="border-b border-black mt-1 pb-1">_____________________________</p>
              </div>
              <div>
                <p><strong>Cédula conductor/destino:</strong></p>
                <p className="border-b border-black mt-1 pb-1">_____________________________</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: letter;
            margin: 5mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:max-w-none {
            max-width: none !important;
          }
        }
      `}</style>
    </div>
  );
};
