import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Truck } from 'lucide-react';
import type { ShippingMode } from '@/hooks/useFinanceSettings';

interface ShippingSectionProps {
  mode: ShippingMode;
  shippingPercent: number;
  onModeChange: (mode: ShippingMode) => void;
  onPercentChange: (value: number) => void;
}

export const ShippingSection: React.FC<ShippingSectionProps> = ({
  mode,
  shippingPercent,
  onModeChange,
  onPercentChange,
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
            {/* Mode toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-sm font-medium">Use Shipping Charges from Orders</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {mode === 'shopify_charges'
                    ? 'Using actual shipping charges collected from Shopify orders'
                    : 'Using a flat percentage estimate of net sales'}
                </p>
              </div>
              <Switch
                checked={mode === 'shopify_charges'}
                onCheckedChange={(checked) =>
                  onModeChange(checked ? 'shopify_charges' : 'percent')
                }
              />
            </div>

            {mode === 'percent' ? (
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
                  Estimated shipping cost as a percentage of net sales
                </p>
              </div>
            ) : (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800">
                  Shipping costs will be calculated from the <strong>total_shipping</strong> field
                  in each Shopify order. This reflects the actual shipping charges collected from
                  customers.
                </p>
                <p className="text-xs text-green-600 mt-2">
                  Note: This represents what customers paid for shipping, not your actual carrier
                  costs. For accurate profit calculation, consider using the flat percentage mode
                  with your actual carrier cost ratio.
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
