import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Receipt, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Search,
  FileText,
  User,
  Package
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DeliveryForInvoice {
  id: string;
  delivery_date: string;
  status: string;
  tracking_number: string | null;
  recipient_name: string | null;
  recipient_address: string | null;
  recipient_phone: string | null;
  order: {
    id: string;
    order_number: string;
    total_amount: number | null;
  };
  workshop: {
    id: string;
    name: string;
  };
  items: Array<{
    id: string;
    quantity_delivered: number;
    quantity_approved: number;
    order_item: {
      unit_price: number;
      product_variant: {
        size: string | null;
        color: string | null;
        product: {
          name: string;
          sku: string;
        };
      };
    };
  }>;
}

interface InvoiceResult {
  deliveryId: string;
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  error?: string;
}

const BulkInvoiceCreator = () => {
  const [deliveries, setDeliveries] = useState<DeliveryForInvoice[]>([]);
  const [selectedDeliveries, setSelectedDeliveries] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<InvoiceResult[]>([]);

  useEffect(() => {
    fetchApprovedDeliveries();
  }, []);

  const fetchApprovedDeliveries = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          id,
          delivery_date,
          status,
          tracking_number,
          recipient_name,
          recipient_address,
          recipient_phone,
          order:orders!deliveries_order_id_fkey (
            id,
            order_number,
            total_amount
          ),
          workshop:workshops!deliveries_workshop_id_fkey (
            id,
            name
          ),
          items:delivery_items (
            id,
            quantity_delivered,
            quantity_approved,
            order_item:order_items!delivery_items_order_item_id_fkey (
              unit_price,
              product_variant:product_variants!order_items_product_variant_id_fkey (
                size,
                color,
                product:products!product_variants_product_id_fkey (
                  name,
                  sku
                )
              )
            )
          )
        `)
        .eq('status', 'approved')
        .order('delivery_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Type assertion to handle the Supabase response
      setDeliveries((data || []) as unknown as DeliveryForInvoice[]);
    } catch (error: any) {
      console.error('Error fetching deliveries:', error);
      toast.error('Error al cargar entregas: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDelivery = (deliveryId: string) => {
    const newSelected = new Set(selectedDeliveries);
    if (newSelected.has(deliveryId)) {
      newSelected.delete(deliveryId);
    } else {
      newSelected.add(deliveryId);
    }
    setSelectedDeliveries(newSelected);
  };

  const toggleAll = () => {
    if (selectedDeliveries.size === deliveries.length) {
      setSelectedDeliveries(new Set());
    } else {
      setSelectedDeliveries(new Set(deliveries.map(d => d.id)));
    }
  };

  const searchOrCreateContact = async (delivery: DeliveryForInvoice) => {
    // Search for existing contact in Alegra
    const { data: searchResult } = await supabase.functions.invoke('alegra-api', {
      body: { action: 'get-contacts' }
    });

    if (searchResult?.success && searchResult.data) {
      // Try to find by name (case-insensitive)
      const existingContact = searchResult.data.find((c: any) => 
        c.name?.toLowerCase() === delivery.recipient_name?.toLowerCase()
      );
      
      if (existingContact) {
        return { id: existingContact.id, isNew: false };
      }
    }

    // Create new contact if not found
    const { data: createResult, error } = await supabase.functions.invoke('alegra-api', {
      body: {
        action: 'create-contact',
        data: {
          contact: {
            name: delivery.recipient_name || 'Cliente Sin Nombre',
            phonePrimary: delivery.recipient_phone || '',
            address: {
              address: delivery.recipient_address || ''
            },
            type: ['client']
          }
        }
      }
    });

    if (error || !createResult?.success) {
      throw new Error('No se pudo crear el contacto en Alegra');
    }

    return { id: createResult.data.id, isNew: true };
  };

  const createInvoice = async (delivery: DeliveryForInvoice, contactId: string) => {
    const items = delivery.items.map(item => ({
      id: 1, // Default Alegra item (service)
      name: `${item.order_item.product_variant.product.name} - ${item.order_item.product_variant.size || ''} ${item.order_item.product_variant.color || ''}`.trim(),
      price: item.order_item.unit_price,
      quantity: item.quantity_approved || item.quantity_delivered,
      tax: [] // Adjust based on your tax configuration
    }));

    const { data, error } = await supabase.functions.invoke('alegra-api', {
      body: {
        action: 'create-invoice',
        data: {
          invoice: {
            client: contactId,
            date: format(new Date(), 'yyyy-MM-dd'),
            dueDate: format(new Date(), 'yyyy-MM-dd'),
            items,
            observations: `Entrega: ${delivery.tracking_number || delivery.id} - Pedido: ${delivery.order?.order_number || 'N/A'}`,
            status: 'open'
          }
        }
      }
    });

    if (error || !data?.success) {
      throw new Error(data?.error || 'Error al crear factura');
    }

    return data.data;
  };

  const processInvoices = async () => {
    if (selectedDeliveries.size === 0) {
      toast.warning('Selecciona al menos una entrega');
      return;
    }

    setIsProcessing(true);
    setResults([]);
    const newResults: InvoiceResult[] = [];

    for (const deliveryId of selectedDeliveries) {
      const delivery = deliveries.find(d => d.id === deliveryId);
      if (!delivery) continue;

      try {
        // Search or create contact
        const contact = await searchOrCreateContact(delivery);
        
        // Create invoice
        const invoice = await createInvoice(delivery, contact.id);
        
        newResults.push({
          deliveryId,
          success: true,
          invoiceId: invoice.id,
          invoiceNumber: invoice.numberTemplate?.fullNumber || invoice.id
        });

        toast.success(`Factura creada para ${delivery.order?.order_number}`);
      } catch (error: any) {
        newResults.push({
          deliveryId,
          success: false,
          error: error.message
        });
        toast.error(`Error en ${delivery.order?.order_number}: ${error.message}`);
      }
    }

    setResults(newResults);
    setIsProcessing(false);
    
    const successCount = newResults.filter(r => r.success).length;
    if (successCount > 0) {
      toast.success(`${successCount} facturas creadas exitosamente`);
    }
  };

  const calculateDeliveryTotal = (delivery: DeliveryForInvoice) => {
    return delivery.items.reduce((sum, item) => {
      const qty = item.quantity_approved || item.quantity_delivered;
      return sum + (qty * item.order_item.unit_price);
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Checkbox
            checked={selectedDeliveries.size === deliveries.length && deliveries.length > 0}
            onCheckedChange={toggleAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedDeliveries.size} de {deliveries.length} entregas seleccionadas
          </span>
        </div>
        
        <Button 
          onClick={processInvoices} 
          disabled={selectedDeliveries.size === 0 || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Receipt className="h-4 w-4 mr-2" />
              Crear {selectedDeliveries.size} Facturas
            </>
          )}
        </Button>
      </div>

      {/* Results Summary */}
      {results.length > 0 && (
        <Alert className={results.every(r => r.success) ? 'border-green-500' : 'border-yellow-500'}>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            {results.filter(r => r.success).length} facturas creadas exitosamente, {' '}
            {results.filter(r => !r.success).length} con errores
          </AlertDescription>
        </Alert>
      )}

      {/* Deliveries List */}
      {deliveries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No hay entregas aprobadas</p>
          <p className="text-sm">Las entregas aprobadas aparecerán aquí para facturar.</p>
        </div>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {deliveries.map(delivery => {
              const result = results.find(r => r.deliveryId === delivery.id);
              const total = calculateDeliveryTotal(delivery);
              
              return (
                <Card 
                  key={delivery.id}
                  className={`cursor-pointer transition-colors ${
                    selectedDeliveries.has(delivery.id) ? 'border-primary bg-primary/5' : ''
                  } ${result?.success ? 'border-green-500 bg-green-50' : ''} ${
                    result && !result.success ? 'border-red-500 bg-red-50' : ''
                  }`}
                  onClick={() => !result?.success && toggleDelivery(delivery.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={selectedDeliveries.has(delivery.id)}
                        disabled={result?.success}
                        onCheckedChange={() => toggleDelivery(delivery.id)}
                        onClick={e => e.stopPropagation()}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {delivery.order?.order_number || 'Sin pedido'}
                            </span>
                            <Badge variant="outline">
                              {delivery.tracking_number || 'Sin tracking'}
                            </Badge>
                          </div>
                          <span className="font-bold text-lg">
                            ${total.toLocaleString('es-CO')}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {delivery.recipient_name || 'Sin destinatario'}
                          </div>
                          <div>
                            {delivery.delivery_date && format(
                              new Date(delivery.delivery_date), 
                              'dd MMM yyyy', 
                              { locale: es }
                            )}
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-muted-foreground">
                          {delivery.items.length} productos • Taller: {delivery.workshop?.name}
                        </div>

                        {result && (
                          <div className={`mt-2 text-sm flex items-center gap-1 ${
                            result.success ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {result.success ? (
                              <>
                                <CheckCircle className="h-4 w-4" />
                                Factura #{result.invoiceNumber} creada
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-4 w-4" />
                                {result.error}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default BulkInvoiceCreator;
