import { useState, useEffect, useMemo } from "react";
import { Plus, Edit, Trash2, Filter, Percent, DollarSign, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useWorkshopPricing, WorkshopPricingInsert } from "@/hooks/useWorkshopPricing";
import { useWorkshops } from "@/hooks/useWorkshops";
import { useProducts } from "@/hooks/useProducts";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PricingFormData {
  workshop_id: string;
  product_id: string;
  unit_price: string;
  currency: string;
  effective_from: string;
  effective_until?: string;
  notes?: string;
}

const initialFormData: PricingFormData = {
  workshop_id: "",
  product_id: "",
  unit_price: "",
  currency: "COP",
  effective_from: new Date().toISOString().split('T')[0],
  effective_until: "",
  notes: ""
};

type BulkUpdateMode = 'percentage' | 'fixed' | 'absolute';

export const WorkshopPricingManager = () => {
  const { pricing, loading, createPricing, updatePricing, deletePricing, refetch } = useWorkshopPricing();
  const { workshops } = useWorkshops();
  const { products } = useProducts();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState<string | null>(null);
  const [formData, setFormData] = useState<PricingFormData>(initialFormData);
  const [workshopProductIds, setWorkshopProductIds] = useState<string[]>([]);
  
  // Filter state
  const [filterWorkshopId, setFilterWorkshopId] = useState<string>("all");
  
  // Selection state
  const [selectedPriceIds, setSelectedPriceIds] = useState<Set<string>>(new Set());
  
  // Bulk update state
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkUpdateMode, setBulkUpdateMode] = useState<BulkUpdateMode>('percentage');
  const [bulkUpdateValue, setBulkUpdateValue] = useState<string>("");
  const [bulkEffectiveFrom, setBulkEffectiveFrom] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Filtered pricing based on selected workshop
  const filteredPricing = useMemo(() => {
    if (filterWorkshopId === "all") return pricing;
    return pricing.filter(p => p.workshop_id === filterWorkshopId);
  }, [pricing, filterWorkshopId]);

  // Check if all visible items are selected
  const allVisibleSelected = filteredPricing.length > 0 && 
    filteredPricing.every(p => selectedPriceIds.has(p.id));

  // Handle select all toggle
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelection = new Set(selectedPriceIds);
      filteredPricing.forEach(p => newSelection.add(p.id));
      setSelectedPriceIds(newSelection);
    } else {
      const newSelection = new Set(selectedPriceIds);
      filteredPricing.forEach(p => newSelection.delete(p.id));
      setSelectedPriceIds(newSelection);
    }
  };

  // Handle individual checkbox toggle
  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedPriceIds);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedPriceIds(newSelection);
  };

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedPriceIds(new Set());
  }, [filterWorkshopId]);

  // Bulk update handler
  const handleBulkUpdate = async () => {
    if (!bulkUpdateValue || selectedPriceIds.size === 0) return;
    
    const value = parseFloat(bulkUpdateValue);
    if (isNaN(value)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor ingresa un valor numérico válido"
      });
      return;
    }

    setIsBulkUpdating(true);
    let successCount = 0;
    let errorCount = 0;

    for (const id of selectedPriceIds) {
      const price = pricing.find(p => p.id === id);
      if (!price) continue;

      let newPrice = price.unit_price;
      
      if (bulkUpdateMode === 'percentage') {
        newPrice = Math.round(price.unit_price * (1 + value / 100));
      } else if (bulkUpdateMode === 'fixed') {
        newPrice = Math.round(price.unit_price + value);
      } else {
        newPrice = Math.round(value);
      }

      // Ensure price doesn't go negative
      newPrice = Math.max(0, newPrice);

      try {
        await updatePricing(id, { 
          unit_price: newPrice,
          effective_from: bulkEffectiveFrom
        });
        successCount++;
      } catch (error) {
        errorCount++;
        console.error('Error updating price:', error);
      }
    }

    setIsBulkUpdating(false);
    setIsBulkDialogOpen(false);
    setSelectedPriceIds(new Set());
    setBulkUpdateValue("");

    toast({
      title: "Actualización masiva completada",
      description: `${successCount} precios actualizados${errorCount > 0 ? `, ${errorCount} errores` : ''}`
    });
  };

  // Get preview of price change
  const getPreviewPrice = (currentPrice: number): number => {
    const value = parseFloat(bulkUpdateValue) || 0;
    if (bulkUpdateMode === 'percentage') {
      return Math.round(currentPrice * (1 + value / 100));
    } else if (bulkUpdateMode === 'fixed') {
      return Math.round(currentPrice + value);
    }
    return Math.round(value);
  };

  // Filtrar productos disponibles para el taller seleccionado
  const getAvailableProducts = () => {
    if (!formData.workshop_id) return [];
    
    // Obtener productos que ya tienen precio asignado a este taller
    const productsWithPricing = pricing.filter(p => 
      p.workshop_id === formData.workshop_id && 
      isCurrentPrice(p.effective_from, p.effective_until)
    ).map(p => p.product_id);
    
    // Filtrar productos que no tienen precio asignado
    return products.filter(product => 
      !productsWithPricing.includes(product.id)
    );
  };

  // Obtener productos relacionados con el taller (via asignaciones o entregas)
  const getProductsForWorkshop = async (workshopId: string) => {
    try {
      const productIds = new Set<string>();

      // 1. Products from workshop_assignments
      const { data: workshopAssignments, error: assignError } = await supabase
        .from('workshop_assignments')
        .select(`
          order_id,
          orders!inner(
            id,
            order_items!inner(
              product_variant_id,
              product_variants!inner(
                product_id,
                products!inner(id, name)
              )
            )
          )
        `)
        .eq('workshop_id', workshopId);

      if (!assignError) {
        workshopAssignments?.forEach(assignment => {
          assignment.orders?.order_items?.forEach((item: any) => {
            if (item.product_variants?.products?.id) {
              productIds.add(item.product_variants.products.id);
            }
          });
        });
      }

      // 2. Products from actual deliveries (covers cases without workshop_assignments)
      const { data: deliveryProducts, error: deliveryError } = await supabase
        .from('delivery_items')
        .select(`
          deliveries!inner(workshop_id),
          order_items!inner(
            product_variants!inner(
              product_id,
              products!inner(id, name)
            )
          )
        `)
        .eq('deliveries.workshop_id', workshopId);

      if (!deliveryError) {
        deliveryProducts?.forEach((item: any) => {
          if (item.order_items?.product_variants?.products?.id) {
            productIds.add(item.order_items.product_variants.products.id);
          }
        });
      }

      return Array.from(productIds);
    } catch (error) {
      console.error('Error fetching products for workshop:', error);
      return [];
    }
  };

  // Cargar productos cuando se selecciona un taller
  useEffect(() => {
    if (formData.workshop_id) {
      getProductsForWorkshop(formData.workshop_id).then((productIds) => {
        setWorkshopProductIds(productIds as string[]);
      });
    } else {
      setWorkshopProductIds([]);
    }
  }, [formData.workshop_id]);

  // Filtrar productos finales considerando ambos criterios
  const getFilteredProducts = () => {
    if (!formData.workshop_id) return [];

    const availableProducts = getAvailableProducts();

    // Mostrar productos que el taller tiene asignados o ha entregado
    return availableProducts.filter(product =>
      workshopProductIds.includes(product.id)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const pricingData: WorkshopPricingInsert = {
      workshop_id: formData.workshop_id,
      product_id: formData.product_id,
      unit_price: parseFloat(formData.unit_price),
      currency: formData.currency,
      effective_from: formData.effective_from,
      effective_until: formData.effective_until || undefined,
      notes: formData.notes || undefined
    };

    try {
      if (editingPricing) {
        await updatePricing(editingPricing, pricingData);
      } else {
        await createPricing(pricingData);
      }
      setIsDialogOpen(false);
      setEditingPricing(null);
      setFormData(initialFormData);
    } catch (error) {
      console.error('Error saving pricing:', error);
    }
  };

  const handleEdit = (pricing: any) => {
    setEditingPricing(pricing.id);
    setFormData({
      workshop_id: pricing.workshop_id,
      product_id: pricing.product_id,
      unit_price: pricing.unit_price.toString(),
      currency: pricing.currency,
      effective_from: pricing.effective_from,
      effective_until: pricing.effective_until || "",
      notes: pricing.notes || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePricing(id);
    } catch (error) {
      console.error('Error deleting pricing:', error);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `COP $${new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)}`;
  };

  const isCurrentPrice = (effectiveFrom: string, effectiveUntil?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const isAfterStart = effectiveFrom <= today;
    const isBeforeEnd = !effectiveUntil || effectiveUntil > today;
    return isAfterStart && isBeforeEnd;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Precios por Taller</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {/* Workshop Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={filterWorkshopId} onValueChange={setFilterWorkshopId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por taller" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los talleres</SelectItem>
                  {workshops.map((workshop) => (
                    <SelectItem key={workshop.id} value={workshop.id}>
                      {workshop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingPricing(null);
                  setFormData(initialFormData);
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Precio
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingPricing ? 'Editar Precio' : 'Nuevo Precio'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="workshop_id">Taller</Label>
                     <Select
                       value={formData.workshop_id}
                       onValueChange={(value) => setFormData(prev => ({ ...prev, workshop_id: value, product_id: "" }))}
                     >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar taller" />
                      </SelectTrigger>
                      <SelectContent>
                        {workshops.map((workshop) => (
                          <SelectItem key={workshop.id} value={workshop.id}>
                            {workshop.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="product_id">Producto</Label>
                    <Select
                      value={formData.product_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, product_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilteredProducts().map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="unit_price">Precio Unitario</Label>
                    <Input
                      id="unit_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.unit_price}
                      onChange={(e) => setFormData(prev => ({ ...prev, unit_price: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="currency">Moneda</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COP">COP</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="effective_from">Vigente Desde</Label>
                    <Input
                      id="effective_from"
                      type="date"
                      value={formData.effective_from}
                      onChange={(e) => setFormData(prev => ({ ...prev, effective_from: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="effective_until">Vigente Hasta (Opcional)</Label>
                    <Input
                      id="effective_until"
                      type="date"
                      value={formData.effective_until}
                      onChange={(e) => setFormData(prev => ({ ...prev, effective_until: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="notes">Notas (Opcional)</Label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Notas adicionales"
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingPricing ? 'Actualizar' : 'Crear'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Bulk Actions Bar */}
        {selectedPriceIds.size > 0 && (
          <div className="mb-4 p-3 bg-muted rounded-lg flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                {selectedPriceIds.size} precio{selectedPriceIds.size !== 1 ? 's' : ''} seleccionado{selectedPriceIds.size !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedPriceIds(new Set())}
              >
                Deseleccionar
              </Button>
              <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Actualizar precios
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Actualización Masiva de Precios</DialogTitle>
                    <DialogDescription>
                      Actualizar {selectedPriceIds.size} precio{selectedPriceIds.size !== 1 ? 's' : ''} seleccionado{selectedPriceIds.size !== 1 ? 's' : ''}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label>Tipo de actualización</Label>
                      <Select value={bulkUpdateMode} onValueChange={(v) => setBulkUpdateMode(v as BulkUpdateMode)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">
                            <div className="flex items-center gap-2">
                              <Percent className="w-4 h-4" />
                              Por porcentaje
                            </div>
                          </SelectItem>
                          <SelectItem value="fixed">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              Por monto fijo
                            </div>
                          </SelectItem>
                          <SelectItem value="absolute">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              Valor fijo
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>
                        {bulkUpdateMode === 'percentage' ? 'Porcentaje (usar negativo para disminuir)' :
                         bulkUpdateMode === 'fixed' ? 'Monto a sumar/restar' :
                         'Nuevo precio fijo'}
                      </Label>
                      <Input
                        type="number"
                        step={bulkUpdateMode === 'percentage' ? '0.1' : '1'}
                        value={bulkUpdateValue}
                        onChange={(e) => setBulkUpdateValue(e.target.value)}
                        placeholder={
                          bulkUpdateMode === 'percentage' ? 'Ej: 10 para +10%, -5 para -5%' :
                          bulkUpdateMode === 'fixed' ? 'Ej: 500 para +$500' :
                          'Ej: 5000'
                        }
                      />
                    </div>

                    <div>
                      <Label>Nueva fecha de vigencia</Label>
                      <Input
                        type="date"
                        value={bulkEffectiveFrom}
                        onChange={(e) => setBulkEffectiveFrom(e.target.value)}
                      />
                    </div>

                    {/* Preview */}
                    {bulkUpdateValue && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-2">Vista previa:</p>
                        <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
                          {Array.from(selectedPriceIds).slice(0, 5).map(id => {
                            const price = pricing.find(p => p.id === id);
                            if (!price) return null;
                            const newPrice = getPreviewPrice(price.unit_price);
                            return (
                              <div key={id} className="flex justify-between">
                                <span className="text-muted-foreground truncate max-w-[150px]">{price.product_name}</span>
                                <span>
                                  ${price.unit_price.toLocaleString()} → 
                                  <span className={newPrice >= price.unit_price ? 'text-green-600' : 'text-red-600'}>
                                    ${newPrice.toLocaleString()}
                                  </span>
                                </span>
                              </div>
                            );
                          })}
                          {selectedPriceIds.size > 5 && (
                            <p className="text-muted-foreground">... y {selectedPriceIds.size - 5} más</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)} disabled={isBulkUpdating}>
                      Cancelar
                    </Button>
                    <Button onClick={handleBulkUpdate} disabled={!bulkUpdateValue || isBulkUpdating}>
                      {isBulkUpdating ? 'Actualizando...' : 'Aplicar cambios'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-4">Cargando precios...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox 
                    checked={allVisibleSelected && filteredPricing.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Taller</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPricing.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {filterWorkshopId !== "all" 
                      ? "No hay precios configurados para este taller" 
                      : "No hay precios configurados"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredPricing.map((price) => (
                  <TableRow key={price.id} className={selectedPriceIds.has(price.id) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedPriceIds.has(price.id)}
                        onCheckedChange={(checked) => handleSelectOne(price.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>{price.workshop_name}</TableCell>
                    <TableCell>{price.product_name}</TableCell>
                    <TableCell>{formatCurrency(price.unit_price, price.currency)}</TableCell>
                    <TableCell>
                      {price.effective_from}
                      {price.effective_until && ` - ${price.effective_until}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isCurrentPrice(price.effective_from, price.effective_until) ? "default" : "secondary"}>
                        {isCurrentPrice(price.effective_from, price.effective_until) ? "Vigente" : "Vencido"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(price)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar precio?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Se eliminará permanentemente este precio.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(price.id)}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
