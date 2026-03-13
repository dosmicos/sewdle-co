import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, PackageCheck, Check } from 'lucide-react';
import type { HandlingMode } from '@/hooks/useFinanceSettings';

interface HandlingSectionProps {
  mode: HandlingMode;
  handlingPercent: number;
  handlingFeePerOrder: number;
  handlingFeePerItem: number;
  onModeChange: (mode: HandlingMode) => void;
  onPercentChange: (value: number) => void;
  onFeePerOrderChange: (value: number) => void;
  onFeePerItemChange: (value: number) => void;
}

/** Input that saves on blur */
const BlurInput: React.FC<{
  value: number;
  onSave: (v: number) => void;
  step?: number;
  min?: number;
  placeholder?: string;
  className?: string;
}> = ({ value, onSave, step = 100, min = 0, placeholder, className = 'h-9' }) => {
  const [local, setLocal] = useState(value);
  const [saved, setSaved] = useState(false);

  useEffect(() => setLocal(value), [value]);

  const handleBlur = () => {
    if (local !== value) {
      onSave(local);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="relative">
      <Input
        type="number"
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className={`${className} pr-20`}
        step={step}
        min={min}
        placeholder={placeholder}
      />
      {saved && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-green-600">
          <Check className="h-4 w-4" />
          <span className="text-xs">Guardado</span>
        </div>
      )}
    </div>
  );
};

export const HandlingSection: React.FC<HandlingSectionProps> = ({
  mode,
  handlingPercent,
  handlingFeePerOrder,
  handlingFeePerItem,
  onModeChange,
  onPercentChange,
  onFeePerOrderChange,
  onFeePerItemChange,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const isFixedFee = mode === 'per_order' || mode === 'per_item';

  const formatCOP = (v: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-base">Handling Fee</CardTitle>
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
            {/* Enable fixed fee toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-sm font-medium">Costo fijo de alistamiento</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isFixedFee
                    ? 'Costo fijo por alistar cada pedido o por cada ítem'
                    : 'Porcentaje plano sobre ventas netas'}
                </p>
              </div>
              <Switch
                checked={isFixedFee}
                onCheckedChange={(checked) =>
                  onModeChange(checked ? 'per_order' : 'percent')
                }
              />
            </div>

            {isFixedFee ? (
              <div className="space-y-4">
                {/* Per Order / Per Item toggle */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => onModeChange('per_order')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      mode === 'per_order'
                        ? 'bg-amber-50 border-amber-300 text-amber-800 font-medium'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                        mode === 'per_order' ? 'border-amber-600' : 'border-gray-300'
                      }`}
                    >
                      {mode === 'per_order' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                      )}
                    </div>
                    Por Orden
                  </button>
                  <button
                    onClick={() => onModeChange('per_item')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      mode === 'per_item'
                        ? 'bg-amber-50 border-amber-300 text-amber-800 font-medium'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                        mode === 'per_item' ? 'border-amber-600' : 'border-gray-300'
                      }`}
                    >
                      {mode === 'per_item' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                      )}
                    </div>
                    Por Ítems en la Orden
                  </button>
                </div>

                {/* Fee input */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {mode === 'per_order'
                      ? 'Costo de alistamiento por orden (COP)'
                      : 'Costo de alistamiento por ítem (COP)'}
                  </Label>
                  <BlurInput
                    value={mode === 'per_order' ? handlingFeePerOrder : handlingFeePerItem}
                    onSave={mode === 'per_order' ? onFeePerOrderChange : onFeePerItemChange}
                    step={500}
                    placeholder="4000"
                  />
                  <p className="text-xs text-gray-400">
                    {mode === 'per_order'
                      ? 'Costo fijo por alistar cada pedido (picking, packing, materiales)'
                      : 'Costo por cada ítem dentro de la orden (picking individual por producto)'}
                  </p>
                </div>

                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800">
                    <strong>Cálculo:</strong>{' '}
                    {mode === 'per_order'
                      ? `${formatCOP(handlingFeePerOrder)} × # órdenes`
                      : `${formatCOP(handlingFeePerItem)} × # ítems vendidos`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Handling Cost %</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      value={handlingPercent}
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
                  value={[handlingPercent]}
                  onValueChange={([v]) => onPercentChange(v)}
                  min={0}
                  max={15}
                  step={0.5}
                  className="cursor-pointer"
                />
                <p className="text-xs text-gray-400">
                  Costo estimado de alistamiento como porcentaje de ventas netas
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
