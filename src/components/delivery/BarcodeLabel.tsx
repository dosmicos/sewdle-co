import React from 'react';
import Barcode from 'react-barcode';

interface BarcodeLabelProps {
  sku: string;
  productName: string;
  variant: string;
  index?: number;
}

const BarcodeLabel = ({ sku, productName, variant, index }: BarcodeLabelProps) => {
  return (
    <div className="barcode-label flex flex-col items-center justify-center p-2 border border-dashed border-border rounded bg-background">
      <div className="w-full overflow-hidden">
        <Barcode 
          value={sku} 
          format="CODE128"
          width={1.2}
          height={40}
          fontSize={10}
          margin={2}
          displayValue={true}
        />
      </div>
      <div className="text-center mt-1 w-full">
        <p className="text-xs font-medium truncate" title={productName}>
          {productName}
        </p>
        <p className="text-xs text-muted-foreground truncate" title={variant}>
          {variant}
        </p>
      </div>
    </div>
  );
};

export default BarcodeLabel;
