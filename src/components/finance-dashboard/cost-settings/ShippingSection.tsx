import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Truck, Check } from 'lucide-react';
import type { ShippingMode } from '@/hooks/useFinanceSettings';

interface ShippingSectionProps {
  mode: ShippingMode;
  shippingPercent: number;
  shippingCostPerOrder: number;
  onModeChange: (mode: ShippingMode) => void;
  onPercentChange: (value: number) => void;
  onCostPerOrderChange: (value: number) => void;
}

const MODE_OPTIONS: { value: ShippingMode; label: string; description: string }[] = [
  {
    value: 'per_order_cost',
    label: 'Costo real por envío',
    description: 'Tu costo promedio real del carrier menos lo cobrado al cliente',
  },
  {
    value: 'percent',
    label: 'Porcentaje plano',
    description: 'Porcentaje estimado sobre ventas netas',
  },
];

/** Input that saves on blur, not on every keystroke */
const ShippingCostInput: React.FC<{
  value: number;
  onSave: (value: number) => void;
}> = ({ value, onSave }) => {
  const [localValue, setLocalValue] = useState(value);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    if (localValue !== value) {
      onSave(localValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const formatCOP = (v: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Costo promedio real por envío (COP)</Label>
        <div className="relative">
          <Input
            type="number"
            value={localValue}
            onChange={(e) => setLocalValue(Number(e.target.value))}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="h-9 pr-8"
            step={100}
            min={0}
            placeholder="9421"
          />
          {saved && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-green-600">
              <Check className="h-4 w-4" />
              <span className="text-xs">Guardado</span>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400">
          Lo que te cobra el carrier (Envia, Servientrega, etc.) en promedio por envío.
          Edita y sal del campo para guardar.
        </p>
      </div>

      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
        <p className="text-sm text-green-800">
          <strong>Cálculo:</strong> (Costo real × # órdenes) − Shipping cobrado al cliente
        </p>
        <p className="text-xs text-green-600 mt-1">
          Si cobras {formatCOP(12000)} de envío al cliente pero tu costo real es {formatCOP(localValue || 9421)},
          el costo neto de shipping es {formatCOP((localValue || 9421) - 12000)} por orden
          {(localValue || 9421) < 12000 && ' (ganancia en shipping)'}
        </p>
      </div>
    </>
  );
};

export const ShippingSection: React.FC<ShippingSectionProps> = ({
  mode,
  shippingPercent,
  shippingCostPerOrder,
  onModeChange,
  onPercentChange,
  onCostPerOrderChange,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-green-600" />
                <CardTitle className="text-base">Shipping Costs</CardTitle>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Mode selector */}
            <div className="space-y-2">
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onModeChange(option.value)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                    mode === option.value
                      ? 'bg-green-50 border-green-300'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-medium ${mode === option.value ? 'text-green-800' : 'text-gray-700'}`}>
                      {option.label}
                    </p>
                    <p className={`text-xs mt-0.5 ${mode === option.value ? 'text-green-600' : 'text-gray-500'}`}>
                      {option.description}
                    </p>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      mode === option.value ? 'border-green-600' : 'border-gray-300'
                    }`}
                  >
                    {mode === option.value && (
                      <div className="w-2 h-2 rounded-full bg-green-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {mode === 'per_order_cost' ? (
              <div className="space-y-3">
                <ShippingCostInput
                  value={shippingCostPerOrder}
                  onSave={onCostPerOrderChange}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Shipping Cost %</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      value={shippingPercent}
                      onChange={(e) => onPercentChange(Number(e.target.value))}
                      className="w-20 h-7 text-sm text-right"
                      step={0.5}
                      min={0}
                      max={100}
                    />
                    <span className="text-sm text-gray-400">%</span>
                  </div>
                </div>
                <Slider
                  value={[shippingPercent]}
                  onValueChange={([v]) => onPercentChange(v)}
                  min={0}
                  max={30}
                  step={0.5}
                  className="cursor-pointer"
                />
                <p className="text-xs text-gray-400">
                  Costo estimado de envío como porcentaje de ventas netas
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
