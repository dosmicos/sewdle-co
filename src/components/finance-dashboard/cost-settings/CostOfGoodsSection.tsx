import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, RefreshCw, Package, Search } from 'lucide-react';
import type { ProductCost } from '@/hooks/useProductCosts';
import type { CostMode } from '@/hooks/useFinanceSettings';

interface CostOfGoodsSectionProps {
  mode: CostMode;
  cogsPercent: number;
  products: ProductCost[];
  isLoading: boolean;
  isSyncing: boolean;
  onModeChange: (mode: CostMode) => void;
  onPercentChange: (value: number) => void;
  onSyncFromShopify: () => Promise<void>;
  onUpdateProductCost: (id: string, updates: { product_cost?: number; handling_fee?: number }) => Promise<void>;
}

export const CostOfGoodsSection: React.FC<CostOfGoodsSectionProps> = ({
  mode,
  cogsPercent,
  products,
  isLoading,
  isSyncing,
  onModeChange,
  onPercentChange,
  onSyncFromShopify,
  onUpdateProductCost,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ product_cost: number; handling_fee: number }>({
    product_cost: 0,
    handling_fee: 0,
  });

  const filteredProducts = products.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const totalCOGS = products.reduce(
    (sum, p) => sum + (p.product_cost + p.handling_fee),
    0
  );

  const startEdit = (product: ProductCost) => {
    setEditingId(product.id);
    setEditValues({
      product_cost: product.product_cost,
      handling_fee: product.handling_fee,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await onUpdateProductCost(editingId, editValues);
    setEditingId(null);
  };

  const formatCOP = (value: number) =>
    `COP ${new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(value))}`;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-base">Cost of Goods (COGS)</CardTitle>
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
                <Label className="text-sm font-medium">Per-product costs from Shopify</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {mode === 'per_product'
                    ? 'Using individual product costs synced from Shopify'
                    : 'Using a flat percentage of net sales'}
                </p>
              </div>
              <Switch
                checked={mode === 'per_product'}
                onCheckedChange={(checked) =>
                  onModeChange(checked ? 'per_product' : 'percent')
                }
              />
            </div>

            {mode === 'percent' ? (
              /* Flat % mode */
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">COGS %</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      value={cogsPercent}
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
                  value={[cogsPercent]}
                  onValueChange={([v]) => onPercentChange(v)}
                  min={0}
                  max={50}
                  step={0.5}
                  className="cursor-pointer"
                />
                <p className="text-xs text-gray-400">
                  Cost of goods sold as a flat percentage of net sales
                </p>
              </div>
            ) : (
              /* Per-product mode */
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSyncFromShopify}
                    disabled={isSyncing}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync from Shopify'}
                  </Button>
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search products..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                </div>

                {isLoading ? (
                  <div className="py-8 text-center text-sm text-gray-400">Loading products...</div>
                ) : products.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">
                    No products synced yet. Click "Sync from Shopify" to import product costs.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-[400px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Product</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">SKU</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">Price</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">Cost</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">Handling</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-600 w-20">Margin</th>
                            <th className="w-16" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredProducts.map((product) => {
                            const isEditing = editingId === product.id;
                            const totalCost = product.product_cost + product.handling_fee;
                            const margin =
                              product.price > 0
                                ? ((product.price - totalCost) / product.price) * 100
                                : 0;

                            return (
                              <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2">
                                  <div className="truncate max-w-[200px]" title={product.title}>
                                    {product.title}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-gray-500">{product.sku || '—'}</td>
                                <td className="px-3 py-2 text-right">{formatCOP(product.price)}</td>
                                <td className="px-3 py-2 text-right">
                                  {isEditing ? (
                                    <Input
                                      type="number"
                                      value={editValues.product_cost}
                                      onChange={(e) =>
                                        setEditValues((v) => ({
                                          ...v,
                                          product_cost: Number(e.target.value),
                                        }))
                                      }
                                      className="w-24 h-7 text-sm text-right"
                                      min={0}
                                    />
                                  ) : (
                                    formatCOP(product.product_cost)
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {isEditing ? (
                                    <Input
                                      type="number"
                                      value={editValues.handling_fee}
                                      onChange={(e) =>
                                        setEditValues((v) => ({
                                          ...v,
                                          handling_fee: Number(e.target.value),
                                        }))
                                      }
                                      className="w-24 h-7 text-sm text-right"
                                      min={0}
                                    />
                                  ) : (
                                    formatCOP(product.handling_fee)
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span
                                    className={
                                      margin >= 50
                                        ? 'text-green-600'
                                        : margin >= 20
                                        ? 'text-yellow-600'
                                        : 'text-red-600'
                                    }
                                  >
                                    {margin.toFixed(0)}%
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {isEditing ? (
                                    <div className="flex gap-1">
                                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={saveEdit}>
                                        Save
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => setEditingId(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => startEdit(product)}
                                    >
                                      Edit
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-gray-50 px-3 py-2 flex justify-between text-sm border-t">
                      <span className="text-gray-600">
                        {filteredProducts.length} products
                      </span>
                      <span className="font-medium">
                        Avg Cost: {formatCOP(products.length > 0 ? totalCOGS / products.length : 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
