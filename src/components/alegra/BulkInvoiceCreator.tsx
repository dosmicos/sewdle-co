import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { 
  Receipt, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Search,
  FileText,
  User,
  Package,
  ShoppingCart
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
  line_items: Array<{
    id: string;
    title: string;
    variant_title: string | null;
    sku: string | null;
    quantity: number;
    price: number;
  }>;
}

interface InvoiceResult {
  orderId: string;
  orderNumber: string;
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  error?: string;
}

const BulkInvoiceCreator = () => {
  const [orders, setOrders] = useState<ShopifyOrderForInvoice[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<InvoiceResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchShopifyOrders();
  }, []);

  const fetchShopifyOrders = async () => {
    setIsLoading(true);
    try {
      // Fetch Shopify orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('shopify_orders')
        .select('*')
        .eq('financial_status', 'paid')
        .order('created_at_shopify', { ascending: false })
        .limit(100);

      if (ordersError) throw ordersError;

      // Fetch line items for each order
      const ordersWithItems: ShopifyOrderForInvoice[] = [];
      
      for (const order of ordersData || []) {
        const { data: lineItems } = await supabase
          .from('shopify_order_line_items')
          .select('id, title, variant_title, sku, quantity, price')
          .eq('shopify_order_id', order.shopify_order_id);

        ordersWithItems.push({
          ...order,
          line_items: lineItems || []
        });
      }

      setOrders(ordersWithItems);
    } catch (error: any) {
      console.error('Error fetching Shopify orders:', error);
      toast.error('Error al cargar pedidos: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const toggleAll = () => {
    const filteredOrders = getFilteredOrders();
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const getFilteredOrders = () => {
    if (!searchTerm) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(order => 
      order.order_number?.toLowerCase().includes(term) ||
      order.customer_email?.toLowerCase().includes(term) ||
      order.customer_first_name?.toLowerCase().includes(term) ||
      order.customer_last_name?.toLowerCase().includes(term)
    );
  };

  const searchOrCreateContact = async (order: ShopifyOrderForInvoice) => {
    const customerName = `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || order.email || 'Cliente';
    const customerEmail = order.customer_email || order.email;

    // Search for existing contact in Alegra by email
    const { data: searchResult } = await supabase.functions.invoke('alegra-api', {
      body: { action: 'get-contacts' }
    });

    if (searchResult?.success && searchResult.data) {
      // Try to find by email first
      const existingContact = searchResult.data.find((c: any) => 
        c.email?.toLowerCase() === customerEmail?.toLowerCase() ||
        c.name?.toLowerCase() === customerName.toLowerCase()
      );
      
      if (existingContact) {
        return { id: existingContact.id, isNew: false, name: existingContact.name };
      }
    }

    // Extract address from billing or shipping
    const address = order.billing_address || order.shipping_address || {};
    
    // Create new contact if not found
    const { data: createResult, error } = await supabase.functions.invoke('alegra-api', {
      body: {
        action: 'create-contact',
        data: {
          contact: {
            name: customerName,
            email: customerEmail || undefined,
            phonePrimary: order.customer_phone || address.phone || '',
            address: {
              address: address.address1 ? `${address.address1} ${address.address2 || ''}`.trim() : '',
              city: address.city || ''
            },
            type: ['client']
          }
        }
      }
    });

    if (error || !createResult?.success) {
      throw new Error('No se pudo crear el contacto en Alegra: ' + (createResult?.error || error?.message));
    }

    return { id: createResult.data.id, isNew: true, name: customerName };
  };

  const createInvoice = async (order: ShopifyOrderForInvoice, contactId: string) => {
    const items = order.line_items.map(item => ({
      id: 1, // Default Alegra item
      name: `${item.title}${item.variant_title ? ' - ' + item.variant_title : ''}`,
      price: item.price,
      quantity: item.quantity,
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
            observations: `Pedido Shopify #${order.order_number}`,
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
    if (selectedOrders.size === 0) {
      toast.warning('Selecciona al menos un pedido');
      return;
    }

    setIsProcessing(true);
    setResults([]);
    const newResults: InvoiceResult[] = [];

    for (const orderId of selectedOrders) {
      const order = orders.find(o => o.id === orderId);
      if (!order) continue;

      try {
        // Search or create contact
        const contact = await searchOrCreateContact(order);
        
        // Create invoice
        const invoice = await createInvoice(order, contact.id);
        
        newResults.push({
          orderId,
          orderNumber: order.order_number,
          success: true,
          invoiceId: invoice.id,
          invoiceNumber: invoice.numberTemplate?.fullNumber || invoice.id
        });

        toast.success(`Factura creada para pedido #${order.order_number}`);
      } catch (error: any) {
        newResults.push({
          orderId,
          orderNumber: order.order_number,
          success: false,
          error: error.message
        });
        toast.error(`Error en pedido #${order.order_number}: ${error.message}`);
      }
    }

    setResults(newResults);
    setIsProcessing(false);
    
    const successCount = newResults.filter(r => r.success).length;
    if (successCount > 0) {
      toast.success(`${successCount} facturas creadas exitosamente`);
    }
  };

  const filteredOrders = getFilteredOrders();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por número de pedido, email o nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Checkbox
            checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
            onCheckedChange={toggleAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedOrders.size} de {filteredOrders.length} pedidos seleccionados
          </span>
        </div>
        
        <Button 
          onClick={processInvoices} 
          disabled={selectedOrders.size === 0 || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Receipt className="h-4 w-4 mr-2" />
              Crear {selectedOrders.size} Facturas
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

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No hay pedidos pagados</p>
          <p className="text-sm">Los pedidos pagados de Shopify aparecerán aquí para facturar.</p>
        </div>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {filteredOrders.map(order => {
              const result = results.find(r => r.orderId === order.id);
              const customerName = `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim();
              
              return (
                <Card 
                  key={order.id}
                  className={`cursor-pointer transition-colors ${
                    selectedOrders.has(order.id) ? 'border-primary bg-primary/5' : ''
                  } ${result?.success ? 'border-green-500 bg-green-50' : ''} ${
                    result && !result.success ? 'border-red-500 bg-red-50' : ''
                  }`}
                  onClick={() => !result?.success && toggleOrder(order.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={selectedOrders.has(order.id)}
                        disabled={result?.success}
                        onCheckedChange={() => toggleOrder(order.id)}
                        onClick={e => e.stopPropagation()}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              #{order.order_number}
                            </span>
                            <Badge variant="outline" className="text-green-600">
                              {order.financial_status}
                            </Badge>
                            {order.fulfillment_status && (
                              <Badge variant="secondary">
                                {order.fulfillment_status}
                              </Badge>
                            )}
                          </div>
                          <span className="font-bold text-lg">
                            ${order.total_price?.toLocaleString('es-CO')} {order.currency}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {customerName || order.customer_email || 'Sin cliente'}
                          </div>
                          <div>
                            {order.created_at_shopify && format(
                              new Date(order.created_at_shopify), 
                              'dd MMM yyyy HH:mm', 
                              { locale: es }
                            )}
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-muted-foreground">
                          <Package className="h-3 w-3 inline mr-1" />
                          {order.line_items.length} productos • {order.customer_email}
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
