import { useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useWorkshopPricing, WorkshopPricingInsert } from "@/hooks/useWorkshopPricing";
import { useWorkshops } from "@/hooks/useWorkshops";
import { useProducts } from "@/hooks/useProducts";

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
  currency: "USD",
  effective_from: new Date().toISOString().split('T')[0],
  effective_until: "",
  notes: ""
};

export const WorkshopPricingManager = () => {
  const { pricing, loading, createPricing, updatePricing, deletePricing } = useWorkshopPricing();
  const { workshops } = useWorkshops();
  const { products } = useProducts();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState<string | null>(null);
  const [formData, setFormData] = useState<PricingFormData>(initialFormData);

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
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency
    }).format(amount);
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
        <div className="flex items-center justify-between">
          <CardTitle>Precios por Taller</CardTitle>
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
                    onValueChange={(value) => setFormData(prev => ({ ...prev, workshop_id: value }))}
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
                      {products.map((product) => (
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
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="COP">COP</SelectItem>
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
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Cargando precios...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Taller</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricing.map((price) => (
                <TableRow key={price.id}>
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
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};