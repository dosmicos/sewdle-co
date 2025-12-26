import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  User, 
  MapPin, 
  Package, 
  Calculator, 
  Loader2,
  Save,
  Send,
  Trash2,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';

interface ShopifyOrderForInvoice {
  id: string;
  shopify_order_id: number;
  order_number: string;
  email: string | null;
  customer_email: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_phone: string | null;
  billing_address: any;
  shipping_address: any;
  total_price: number;
  subtotal_price: number;
  total_tax: number;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  created_at_shopify: string;
  alegra_invoice_id: number | null;
  alegra_invoice_number: string | null;
  alegra_invoice_status: string | null;
  alegra_stamped: boolean | null;
  alegra_cufe: string | null;
  alegra_synced_at: string | null;
  line_items: Array<{
    id: string;
    title: string;
    variant_title: string | null;
    sku: string | null;
    quantity: number;
    price: number;
  }>;
}

export interface EditedInvoiceData {
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    identificationType: 'CC' | 'NIT' | 'CE' | 'PAS';
    identificationNumber: string;
  };
  address: {
    address: string;
    city: string;
    department: string;
  };
  lineItems: Array<{
    id: string;
    title: string;
    quantity: number;
    price: number;
    isShipping?: boolean;
  }>;
}

interface InvoiceDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ShopifyOrderForInvoice | null;
  onSave: (editedData: EditedInvoiceData) => void;
  onSaveAndEmit: (editedData: EditedInvoiceData) => Promise<void>;
}

// Colombian departments with their main cities
const COLOMBIAN_LOCATIONS = [
  { department: 'Bogotá D.C.', city: 'Bogotá, DC' },
  { department: 'Antioquia', city: 'Medellín' },
  { department: 'Valle del Cauca', city: 'Cali' },
  { department: 'Atlántico', city: 'Barranquilla' },
  { department: 'Bolívar', city: 'Cartagena de Indias' },
  { department: 'Santander', city: 'Bucaramanga' },
  { department: 'Cundinamarca', city: 'Chía' },
  { department: 'Norte de Santander', city: 'Cúcuta' },
  { department: 'Risaralda', city: 'Pereira' },
  { department: 'Tolima', city: 'Ibagué' },
  { department: 'Caldas', city: 'Manizales' },
  { department: 'Meta', city: 'Villavicencio' },
  { department: 'Huila', city: 'Neiva' },
  { department: 'Nariño', city: 'Pasto' },
  { department: 'Córdoba', city: 'Montería' },
  { department: 'Boyacá', city: 'Tunja' },
  { department: 'Cauca', city: 'Popayán' },
  { department: 'Magdalena', city: 'Santa Marta' },
  { department: 'Cesar', city: 'Valledupar' },
  { department: 'Quindío', city: 'Armenia' },
];

const IDENTIFICATION_TYPES = [
  { value: 'CC', label: 'Cédula de Ciudadanía (CC)' },
  { value: 'NIT', label: 'NIT' },
  { value: 'CE', label: 'Cédula de Extranjería (CE)' },
  { value: 'PAS', label: 'Pasaporte (PAS)' },
];

const normalizeForAlegra = (city?: string, province?: string) => {
  const cityLower = (city || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const provinceLower = (province || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Match against known locations
  for (const loc of COLOMBIAN_LOCATIONS) {
    const deptLower = loc.department.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const cityLocLower = loc.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    if (cityLower.includes(cityLocLower.split(',')[0]) || 
        provinceLower.includes(deptLower) ||
        deptLower.includes(provinceLower)) {
      return { city: loc.city, department: loc.department };
    }
  }

  // Default: Bogotá
  return { city: 'Bogotá, DC', department: 'Bogotá D.C.' };
};

const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({
  open,
  onOpenChange,
  order,
  onSave,
  onSaveAndEmit,
}) => {
  const [isEmitting, setIsEmitting] = useState(false);
  const [formData, setFormData] = useState<EditedInvoiceData>({
    customer: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      identificationType: 'CC',
      identificationNumber: '',
    },
    address: {
      address: '',
      city: 'Bogotá, DC',
      department: 'Bogotá D.C.',
    },
    lineItems: [],
  });

  // Initialize form when order changes
  useEffect(() => {
    if (order) {
      const address = order.billing_address || order.shipping_address || {};
      const normalized = normalizeForAlegra(address.city, address.province || address.province_code);
      
      // Get identification from company field (cedula)
      const identificationFromCompany = (address.company || '').replace(/[^0-9]/g, '');
      const phone = order.customer_phone || address.phone || '';
      const email = order.customer_email || order.email || '';
      
      const identificationNumber = identificationFromCompany || 
                                    phone?.replace(/[^0-9]/g, '') || 
                                    email?.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15) || 
                                    '';

      // Create base line items
      const baseItems = order.line_items.map(item => ({
        id: item.id,
        title: `${item.title}${item.variant_title ? ' - ' + item.variant_title : ''}`,
        quantity: item.quantity,
        price: item.price,
        isShipping: false,
      }));

      // Add shipping as a product if exists
      const shippingCost = order.total_price - order.subtotal_price;
      if (shippingCost > 0) {
        baseItems.push({
          id: 'shipping',
          title: 'Envío',
          quantity: 1,
          price: shippingCost,
          isShipping: true,
        });
      }

      setFormData({
        customer: {
          firstName: order.customer_first_name || '',
          lastName: order.customer_last_name || '',
          email: email,
          phone: phone,
          identificationType: 'CC',
          identificationNumber: identificationNumber,
        },
        address: {
          address: address.address1 ? `${address.address1} ${address.address2 || ''}`.trim() : '',
          city: normalized.city,
          department: normalized.department,
        },
        lineItems: baseItems,
      });
    }
  }, [order]);

  const handleCustomerChange = (field: keyof typeof formData.customer, value: string) => {
    setFormData(prev => ({
      ...prev,
      customer: { ...prev.customer, [field]: value },
    }));
  };

  const handleAddressChange = (field: keyof typeof formData.address, value: string) => {
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value },
    }));
  };

  const handleDepartmentChange = (department: string) => {
    const location = COLOMBIAN_LOCATIONS.find(loc => loc.department === department);
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        department,
        city: location?.city || prev.address.city,
      },
    }));
  };

  const handleLineItemChange = (index: number, field: 'title' | 'quantity' | 'price', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleRemoveLineItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index),
    }));
  };

  const handleAddLineItem = () => {
    setFormData(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, {
        id: `new-${Date.now()}`,
        title: 'Nuevo producto',
        quantity: 1,
        price: 0,
        isShipping: false,
      }],
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.customer.firstName.trim()) {
      toast.error('El nombre es requerido');
      return false;
    }
    if (!formData.customer.lastName.trim()) {
      toast.error('El apellido es requerido');
      return false;
    }
    if (!formData.customer.identificationNumber.trim()) {
      toast.error('El número de documento es requerido');
      return false;
    }
    if (!formData.address.city.trim()) {
      toast.error('La ciudad es requerida');
      return false;
    }
    if (!formData.address.department.trim()) {
      toast.error('El departamento es requerido');
      return false;
    }
    return true;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
    }
  };

  const handleSaveAndEmit = async () => {
    if (!validateForm()) return;
    
    setIsEmitting(true);
    try {
      await onSaveAndEmit(formData);
    } finally {
      setIsEmitting(false);
    }
  };

  const subtotal = formData.lineItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Detalles de Factura - Pedido #{order.order_number}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Customer Information */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Información del Cliente</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nombre *</Label>
                  <Input
                    id="firstName"
                    value={formData.customer.firstName}
                    onChange={(e) => handleCustomerChange('firstName', e.target.value)}
                    placeholder="Nombre"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Apellido *</Label>
                  <Input
                    id="lastName"
                    value={formData.customer.lastName}
                    onChange={(e) => handleCustomerChange('lastName', e.target.value)}
                    placeholder="Apellido"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="identificationType">Tipo de Documento</Label>
                  <Select
                    value={formData.customer.identificationType}
                    onValueChange={(value) => handleCustomerChange('identificationType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IDENTIFICATION_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="identificationNumber">Número de Documento *</Label>
                  <Input
                    id="identificationNumber"
                    value={formData.customer.identificationNumber}
                    onChange={(e) => handleCustomerChange('identificationNumber', e.target.value)}
                    placeholder="1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.customer.email}
                    onChange={(e) => handleCustomerChange('email', e.target.value)}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={formData.customer.phone}
                    onChange={(e) => handleCustomerChange('phone', e.target.value)}
                    placeholder="3001234567"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Billing Address */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Dirección de Facturación</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Input
                    id="address"
                    value={formData.address.address}
                    onChange={(e) => handleAddressChange('address', e.target.value)}
                    placeholder="Cra 10 #20-30 Apt 401"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">Departamento *</Label>
                    <Select
                      value={formData.address.department}
                      onValueChange={handleDepartmentChange}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLOMBIAN_LOCATIONS.map(loc => (
                          <SelectItem key={loc.department} value={loc.department}>
                            {loc.department}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Ciudad *</Label>
                    <Input
                      id="city"
                      value={formData.address.city}
                      onChange={(e) => handleAddressChange('city', e.target.value)}
                      placeholder="Bogotá, DC"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Products */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Productos</h3>
                </div>
                <Button variant="outline" size="sm" onClick={handleAddLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Producto</th>
                      <th className="text-center p-2 w-20">Cant.</th>
                      <th className="text-right p-2 w-28">Precio</th>
                      <th className="text-right p-2 w-28">Total</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.lineItems.map((item, index) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2">
                          <Input
                            value={item.title}
                            onChange={(e) => handleLineItemChange(index, 'title', e.target.value)}
                            className="h-8"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleLineItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="h-8 text-center"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            value={item.price}
                            onChange={(e) => handleLineItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                            className="h-8 text-right"
                          />
                        </td>
                        <td className="text-right p-2 font-medium whitespace-nowrap">
                          ${(item.price * item.quantity).toLocaleString('es-CO')}
                        </td>
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveLineItem(index)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Totales</h3>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${subtotal.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>IVA (19%):</span>
                  <span>$0</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>${subtotal.toLocaleString('es-CO')} {order.currency}</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Guardar Cambios
          </Button>
          <Button onClick={handleSaveAndEmit} disabled={isEmitting}>
            {isEmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Emitiendo...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Guardar y Emitir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDetailsModal;
