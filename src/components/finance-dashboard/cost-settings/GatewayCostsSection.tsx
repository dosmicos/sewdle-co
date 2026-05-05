import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, CreditCard, Check } from 'lucide-react';
import type { GatewayCostSetting } from '@/hooks/useGatewayCosts';
import type { GatewayMode } from '@/hooks/useFinanceSettings';

interface GatewayCostsSectionProps {
  mode: GatewayMode;
  gatewayPercent: number;
  gateways: GatewayCostSetting[];
  detectedGateways: string[];
  isLoading: boolean;
  onModeChange: (mode: GatewayMode) => void;
  onPercentChange: (value: number) => void;
  onUpsertGateway: (data: {
    gateway_name: string;
    percent_fee?: number;
    flat_fee?: number;
    is_active?: boolean;
  }) => Promise<void>;
}

/** Small input that saves on blur instead of every keystroke */
const BlurSaveInput: React.FC<{
  value: number;
  onSave: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  className?: string;
}> = ({ value, onSave, step = 0.1, min = 0, max, className }) => {
  const [localValue, setLocalValue] = useState(value);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    if (localValue !== value) {
      onSave(localValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <Input
        type="number"
        value={localValue}
        onChange={(e) => setLocalValue(Number(e.target.value))}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={className}
        step={step}
        min={min}
        max={max}
      />
      {saved && (
        <Check className="h-3.5 w-3.5 text-green-500 absolute -right-5" />
      )}
    </div>
  );
};

export const GatewayCostsSection: React.FC<GatewayCostsSectionProps> = ({
  mode,
  gatewayPercent,
  gateways,
  detectedGateways,
  isLoading,
  onModeChange,
  onPercentChange,
  onUpsertGateway,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  // Merge detected gateways with saved settings
  const gatewayMap = new Map(gateways.map((g) => [g.gateway_name, g]));
  const detectedRows = detectedGateways.map((name) => ({
    name,
    settings: gatewayMap.get(name) || null,
    isUniversal: false,
  }));
  // Also include universal fees (applies_to_all) that aren't in detected gateways
  const universalRows = gateways
    .filter((g) => g.applies_to_all && !detectedGateways.includes(g.gateway_name))
    .map((g) => ({ name: g.gateway_name, settings: g, isUniversal: true }));
  const allGateways = [...detectedRows, ...universalRows];

  // Auto-create settings for newly detected gateways
  useEffect(() => {
    if (mode !== 'per_gateway') return;
    for (const name of detectedGateways) {
      if (!gatewayMap.has(name)) {
        onUpsertGateway({ gateway_name: name, percent_fee: 0, flat_fee: 0, is_active: true });
      }
    }
  }, [detectedGateways, mode]);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-base">Gateway Costs</CardTitle>
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
            {/* Mode toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-sm font-medium">Per-gateway configuration</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {mode === 'per_gateway'
                    ? 'Configuring fees for each detected payment gateway'
                    : 'Using a flat percentage for all gateways'}
                </p>
              </div>
              <Switch
                checked={mode === 'per_gateway'}
                onCheckedChange={(checked) =>
                  onModeChange(checked ? 'per_gateway' : 'percent')
                }
              />
            </div>

            {mode === 'percent' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Payment Gateway %</Label>
                  <div className="flex items-center gap-1.5">
                    <BlurSaveInput
                      value={gatewayPercent}
                      onSave={onPercentChange}
                      step={0.1}
                      min={0}
                      max={100}
                      className="w-20 h-7 text-sm text-right"
                    />
                    <span className="text-sm text-gray-400">%</span>
                  </div>
                </div>
                <Slider
                  value={[gatewayPercent]}
                  onValueChange={([v]) => onPercentChange(v)}
                  min={0}
                  max={10}
                  step={0.1}
                  className="cursor-pointer"
                />
                <p className="text-xs text-gray-400">
                  Average payment gateway fee as a percentage of order total
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {isLoading ? (
                  <div className="py-6 text-center text-sm text-gray-400">
                    Detecting payment gateways...
                  </div>
                ) : allGateways.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-400">
                    No payment gateways detected in recent orders.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Gateway</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">% Fee</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600 w-32">Flat Fee (COP)</th>
                          <th className="text-center px-3 py-2 font-medium text-gray-600 w-20">Active</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {allGateways.map(({ name, settings, isUniversal }) => (
                          <tr key={name} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">
                              {name}
                              {isUniversal && (
                                <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-normal">
                                  Todas las órdenes
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <BlurSaveInput
                                value={settings?.percent_fee ?? 0}
                                onSave={(v) =>
                                  onUpsertGateway({ gateway_name: name, percent_fee: v })
                                }
                                step={0.1}
                                min={0}
                                max={100}
                                className="w-24 h-7 text-sm text-right ml-auto"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <BlurSaveInput
                                value={settings?.flat_fee ?? 0}
                                onSave={(v) =>
                                  onUpsertGateway({ gateway_name: name, flat_fee: v })
                                }
                                step={100}
                                min={0}
                                className="w-28 h-7 text-sm text-right ml-auto"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Switch
                                checked={settings?.is_active ?? true}
                                onCheckedChange={(checked) =>
                                  onUpsertGateway({
                                    gateway_name: name,
                                    is_active: checked,
                                  })
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="text-xs text-gray-400">
                  Los gateways se auto-detectan de tus órdenes recientes de Shopify.
                  Edita los valores y sal del campo para guardar. ✓ indica que se guardó.
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
