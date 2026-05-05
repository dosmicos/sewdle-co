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
    <div className="barcode-label flex flex-col items-center justify-center p-1 border border-dashed border-border rounded bg-background" style={{ width: '240px', height: '94px' }}>
      <div className="w-full overflow-hidden flex justify-center">
        <Barcode
          value={sku}
          format="CODE128"
          width={4}
          height={45}
          fontSize={14}
          margin={1}
          displayValue={true}
          textMargin={0}
        />
      </div>
      <p className="text-center w-full truncate" style={{ fontSize: '12px', lineHeight: 1, marginTop: '1px' }} title={productName}>
        {productName}
      </p>
      {variant && (
        <p className="text-center w-full truncate text-muted-foreground" style={{ fontSize: '11px', lineHeight: 1, marginTop: '1px' }} title={variant}>
          {variant}
        </p>
      )}
    </div>
  );
};

export default BarcodeLabel;
