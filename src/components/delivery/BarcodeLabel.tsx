import React from 'react';
import Barcode from 'react-barcode';

interface BarcodeLabelProps {
  sku: string;
  productName: string;
  variant: string;
  index?: number;
}

const BarcodeLabel = ({ sku, productName, variant, index }: BarcodeLabelProps) => {
  // Combinar nombre y variante en una sola línea compacta
  const compactText = variant ? `${productName} - ${variant}` : productName;
  
  return (
    <div className="barcode-label flex flex-col items-center justify-center p-1 border border-dashed border-border rounded bg-background" style={{ width: '120px', height: '75px' }}>
      <div className="w-full overflow-hidden flex justify-center">
        <Barcode 
          value={sku} 
          format="CODE128"
          width={1.5}
          height={35}
          fontSize={6}
          margin={1}
          displayValue={true}
          textMargin={0}
        />
      </div>
      <p className="text-center w-full truncate" style={{ fontSize: '5px', lineHeight: 1, marginTop: '1px' }} title={compactText}>
        {compactText}
      </p>
    </div>
  );
};

export default BarcodeLabel;
