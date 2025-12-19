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
    <div className="fixed inset-0 z-50 bg-white">
      {/* Print controls - hidden when printing */}
      <div className="print:hidden flex items-center justify-between p-4 border-b bg-gray-100">
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
      <div className="p-4 print:p-2 max-w-[210mm] mx-auto">
        {/* Header */}
        <div className="border-2 border-black mb-2">
          <div className="flex justify-between items-start p-2 border-b border-black">
            <div>
              <h1 className="text-lg font-bold">
                {CARRIER_NAMES[manifest.carrier as CarrierCode] || manifest.carrier}
              </h1>
              <p className="text-xs">MANIFIESTO DE CARGA</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-bold">{manifest.manifest_number}</p>
              <p>{format(new Date(manifest.manifest_date), 'dd/MM/yyyy', { locale: es })}</p>
            </div>
          </div>
          
          <div className="flex text-xs p-2 border-b border-black">
            <div className="flex-1">
              <p><strong>Total de guías:</strong> {items.length}</p>
            </div>
            <div className="flex-1 text-right">
              <p><strong>Total paquetes:</strong> {items.length}</p>
            </div>
          </div>
        </div>

        {/* Two column table */}
        <table className="w-full border-collapse text-[9px] leading-tight">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black px-1 py-0.5 w-[5%] text-center">No.</th>
              <th className="border border-black px-1 py-0.5 w-[30%] text-left">Número de Guía</th>
              <th className="border border-black px-1 py-0.5 w-[10%] text-center">Paq.</th>
              <th className="border border-black px-1 py-0.5 w-[5%] text-center">No.</th>
              <th className="border border-black px-1 py-0.5 w-[30%] text-left">Número de Guía</th>
              <th className="border border-black px-1 py-0.5 w-[10%] text-center">Paq.</th>
            </tr>
          </thead>
          <tbody>
            {leftColumn.map((leftItem, idx) => {
              const rightItem = rightColumn[idx];
              const leftNum = idx + 1;
              const rightNum = halfLength + idx + 1;
              
              return (
                <tr key={leftItem.id} className="even:bg-gray-50">
                  <td className="border border-black px-1 py-0.5 text-center font-medium">
                    {String(leftNum).padStart(2, '0')}
                  </td>
                  <td className="border border-black px-1 py-0.5 font-mono">
                    {leftItem.tracking_number}
                  </td>
                  <td className="border border-black px-1 py-0.5 text-center">1</td>
                  
                  {rightItem ? (
                    <>
                      <td className="border border-black px-1 py-0.5 text-center font-medium">
                        {String(rightNum).padStart(2, '0')}
                      </td>
                      <td className="border border-black px-1 py-0.5 font-mono">
                        {rightItem.tracking_number}
                      </td>
                      <td className="border border-black px-1 py-0.5 text-center">1</td>
                    </>
                  ) : (
                    <>
                      <td className="border border-black px-1 py-0.5"></td>
                      <td className="border border-black px-1 py-0.5"></td>
                      <td className="border border-black px-1 py-0.5"></td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer */}
        <div className="mt-4 border-2 border-black p-2">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-bold mb-2">Total paquetes: {items.length}</p>
              <div className="border-t border-black pt-4 mt-4">
                <p>Firma del transportador: _______________________</p>
              </div>
            </div>
            <div>
              <p className="font-bold mb-2">Fecha de recogida:</p>
              <div className="border-t border-black pt-4 mt-4">
                <p>Fecha y hora: _______________________</p>
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
          .print\\:p-2 {
            padding: 0.5rem !important;
          }
        }
      `}</style>
    </div>
  );
};
