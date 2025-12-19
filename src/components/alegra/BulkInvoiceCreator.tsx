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
  ShoppingCart,
  Send,
  Clock,
  RefreshCw
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
  // Alegra fields
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

type ProcessingStatus = 
  | 'idle' 
  | 'searching_invoice' 
  | 'searching_contact' 
  | 'creating_contact'
  | 'creating_invoice' 
  | 'stamping' 
  | 'success' 
  | 'error'
  | 'already_stamped';

interface InvoiceResult {
  orderId: string;
  orderNumber: string;
  status: ProcessingStatus;
  invoiceId?: number;
  invoiceNumber?: string;
  cufe?: string;
  error?: string;
}

const normalizeForAlegra = (city?: string, province?: string) => {
  const cityLower = (city || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const provinceLower = (province || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Bogotá D.C.
  if (
    cityLower.includes('bogota') ||
    provinceLower.includes('bogota') ||
    provinceLower.includes('cundinamarca')
  ) {
    return { city: 'Bogotá, D.C.', department: 'Bogotá' };
  }
  // Medellín
  if (cityLower.includes('medellin') || provinceLower.includes('antioquia')) {
    return { city: 'Medellín', department: 'Antioquia' };
  }
  // Cali
  if (cityLower.includes('cali') || provinceLower.includes('valle')) {
    return { city: 'Cali', department: 'Valle del Cauca' };
  }
  // Barranquilla
  if (cityLower.includes('barranquilla') || provinceLower.includes('atlantico')) {
    return { city: 'Barranquilla', department: 'Atlántico' };
  }
  // Cartagena
  if (cityLower.includes('cartagena') || provinceLower.includes('bolivar')) {
    return { city: 'Cartagena de Indias', department: 'Bolívar' };
  }
  // Bucaramanga
  if (cityLower.includes('bucaramanga') || provinceLower.includes('santander')) {
    return { city: 'Bucaramanga', department: 'Santander' };
  }

  // Default: Bogotá (most common in Colombia)
  return { city: 'Bogotá, D.C.', department: 'Bogotá' };
};

const statusLabels: Record<ProcessingStatus, { label: string; icon: React.ReactNode; color: string }> = {
  idle: { label: 'Pendiente', icon: <Clock className="h-4 w-4" />, color: 'text-muted-foreground' },
  searching_invoice: { label: 'Buscando factura...', icon: <Loader2 className="h-4 w-4 animate-spin" />, color: 'text-blue-600' },
  searching_contact: { label: 'Buscando cliente...', icon: <Loader2 className="h-4 w-4 animate-spin" />, color: 'text-blue-600' },
  creating_contact: { label: 'Creando cliente...', icon: <Loader2 className="h-4 w-4 animate-spin" />, color: 'text-blue-600' },
  creating_invoice: { label: 'Creando factura...', icon: <Loader2 className="h-4 w-4 animate-spin" />, color: 'text-blue-600' },
  stamping: { label: 'Emitiendo con DIAN...', icon: <Send className="h-4 w-4 animate-pulse" />, color: 'text-orange-600' },
  success: { label: 'Factura electrónica emitida', icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600' },
  error: { label: 'Error', icon: <AlertCircle className="h-4 w-4" />, color: 'text-red-600' },
  already_stamped: { label: 'Ya emitida', icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600' },
};

const BulkInvoiceCreator = () => {
  const [orders, setOrders] = useState<ShopifyOrderForInvoice[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<Map<string, InvoiceResult>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'stamped'>('all');

  useEffect(() => {
    fetchShopifyOrders();
  }, []);

  const fetchShopifyOrders = async () => {
    setIsLoading(true);
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('shopify_orders')
        .select('*')
        .eq('financial_status', 'paid')
        .order('created_at_shopify', { ascending: false })
        .limit(100);

      if (ordersError) throw ordersError;

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
    const selectableOrders = filteredOrders.filter(o => !o.alegra_stamped);
    if (selectedOrders.size === selectableOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(selectableOrders.map(o => o.id)));
    }
  };

  const getFilteredOrders = () => {
    let filtered = orders;
    
    // Filter by status
    if (filterStatus === 'pending') {
      filtered = filtered.filter(o => !o.alegra_stamped);
    } else if (filterStatus === 'stamped') {
      filtered = filtered.filter(o => o.alegra_stamped);
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        order.order_number?.toLowerCase().includes(term) ||
        order.customer_email?.toLowerCase().includes(term) ||
        order.customer_first_name?.toLowerCase().includes(term) ||
        order.customer_last_name?.toLowerCase().includes(term) ||
        order.alegra_invoice_number?.toLowerCase().includes(term) ||
        order.alegra_cufe?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  };

  const updateResult = (orderId: string, result: Partial<InvoiceResult>) => {
    setResults(prev => {
      const newResults = new Map(prev);
      const existing = newResults.get(orderId) || { orderId, orderNumber: '', status: 'idle' as ProcessingStatus };
      newResults.set(orderId, { ...existing, ...result });
      return newResults;
    });
  };

  const updateOrderAlegraStatus = async (
    orderId: string, 
    invoiceId: number, 
    invoiceNumber: string,
    stamped: boolean,
    cufe?: string
  ) => {
    const { error } = await supabase
      .from('shopify_orders')
      .update({
        alegra_invoice_id: invoiceId,
        alegra_invoice_number: invoiceNumber,
        alegra_stamped: stamped,
        alegra_cufe: cufe || null,
        alegra_synced_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) {
      console.error('Error updating order Alegra status:', error);
    }
  };

  const searchInvoiceByOrderNumber = async (orderNumber: string) => {
    const { data, error } = await supabase.functions.invoke('alegra-api', {
      body: { 
        action: 'search-invoices', 
        data: { query: `Pedido Shopify #${orderNumber}` } 
      }
    });

    if (error || !data?.success) {
      console.log('No existing invoice found for order:', orderNumber);
      return null;
    }

    // Find invoice that matches this order in observations
    const matchingInvoice = data.data?.find((inv: any) => 
      inv.observations?.includes(`Pedido Shopify #${orderNumber}`)
    );

    return matchingInvoice || null;
  };

  const ensureContactAddress = async (contactId: string, order: ShopifyOrderForInvoice) => {
    const address = order.billing_address || order.shipping_address || {};
    const alegraAddress = normalizeForAlegra(address.city, address.province || address.province_code);

    const { data, error } = await supabase.functions.invoke('alegra-api', {
      body: {
        action: 'update-contact',
        data: {
          contactId,
          patch: {
            address: {
              address: address.address1 ? `${address.address1} ${address.address2 || ''}`.trim() : '',
              city: alegraAddress.city,
              department: alegraAddress.department,
              country: 'Colombia',
            },
          },
        },
      },
    });

    if (error || !data?.success) {
      throw new Error(
        data?.error ||
          error?.message ||
          'No se pudo actualizar la dirección del cliente en Alegra'
      );
    }
  };

  const searchOrCreateContact = async (order: ShopifyOrderForInvoice) => {
    const customerName = `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || order.email || 'Cliente';
    const customerEmail = order.customer_email || order.email;
    const customerPhone = order.customer_phone || (order.billing_address || order.shipping_address || {}).phone || '';
    
    // Generate identification number (same logic as creation)
    const identificationNumber = customerPhone?.replace(/[^0-9]/g, '') || 
                                  customerEmail?.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15) || 
                                  '';

    // Search for existing contact in Alegra
    const { data: searchResult } = await supabase.functions.invoke('alegra-api', {
      body: { action: 'get-contacts' }
    });

    if (searchResult?.success && searchResult.data) {
      // 1. First search by identification number (most reliable)
      if (identificationNumber) {
        const contactByIdentification = searchResult.data.find((c: any) => {
          // Check multiple possible field names for identification
          const contactId =
            c.identificationNumber || c.identification || c.identificationObject?.number || '';
          return String(contactId).replace(/\D/g, '') === identificationNumber;
        });
        if (contactByIdentification) {
          console.log('Contact found by identification:', contactByIdentification.name);
          await ensureContactAddress(String(contactByIdentification.id), order);
          return {
            id: contactByIdentification.id,
            isNew: false,
            name: contactByIdentification.name,
          };
        }
      }

      // 2. Then search by phone number
      if (customerPhone) {
        const phoneClean = customerPhone.replace(/[^0-9]/g, '');
        const contactByPhone = searchResult.data.find(
          (c: any) =>
            c.phonePrimary?.replace(/[^0-9]/g, '') === phoneClean ||
            c.mobile?.replace(/[^0-9]/g, '') === phoneClean
        );
        if (contactByPhone) {
          console.log('Contact found by phone:', contactByPhone.name);
          await ensureContactAddress(String(contactByPhone.id), order);
          return { id: contactByPhone.id, isNew: false, name: contactByPhone.name };
        }
      }

      // 3. Then search by email
      if (customerEmail) {
        const contactByEmail = searchResult.data.find(
          (c: any) => c.email?.toLowerCase() === customerEmail.toLowerCase()
        );
        if (contactByEmail) {
          console.log('Contact found by email:', contactByEmail.name);
          await ensureContactAddress(String(contactByEmail.id), order);
          return { id: contactByEmail.id, isNew: false, name: contactByEmail.name };
        }
      }

      // 4. Finally search by name (normalized comparison)
      const normalizedName = customerName.toLowerCase().trim();
      const contactByName = searchResult.data.find(
        (c: any) => c.name?.toLowerCase().trim() === normalizedName
      );
      if (contactByName) {
        console.log('Contact found by name:', contactByName.name);
        await ensureContactAddress(String(contactByName.id), order);
        return { id: contactByName.id, isNew: false, name: contactByName.name };
      }
    }

    // Create new contact if not found by any method
    const address = order.billing_address || order.shipping_address || {};
    
    // Use phone as primary identification, fallback to email-derived
    const finalIdentificationNumber = identificationNumber || `CLI${Date.now()}`;
    
    console.log('Creating new contact:', customerName, 'with identification:', finalIdentificationNumber);
    
    const alegraAddress = normalizeForAlegra(address.city, address.province || address.province_code);

    const { data: createResult, error } = await supabase.functions.invoke('alegra-api', {
      body: {
        action: 'create-contact',
        data: {
          contact: {
            name: customerName,
            // Alegra requiere el objeto identification para crear contactos
            identification: {
              type: 'CC',
              number: String(finalIdentificationNumber).slice(0, 20),
            },
            // Mantener también los campos legacy por compatibilidad
            identificationType: 'CC',
            identificationNumber: String(finalIdentificationNumber).slice(0, 20),
            email: customerEmail || undefined,
            phonePrimary: customerPhone,
            address: {
              address: address.address1 ? `${address.address1} ${address.address2 || ''}`.trim() : '',
              city: alegraAddress.city,
              department: alegraAddress.department,
              country: 'Colombia'
            },
            type: ['client']
          }
        }
      }
    });

    if (error || !createResult?.success) {
      throw new Error('No se pudo crear el contacto: ' + (createResult?.error || error?.message));
    }

    return { id: createResult.data.id, isNew: true, name: customerName };
  };

  const createInvoice = async (order: ShopifyOrderForInvoice, contactId: string) => {
    const items = order.line_items.map(item => ({
      id: 1,
      name: `${item.title}${item.variant_title ? ' - ' + item.variant_title : ''}`,
      price: item.price,
      quantity: item.quantity,
      tax: []
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
            status: 'open',
            paymentMethod: 'CASH',
            paymentForm: 'CASH'
          }
        }
      }
    });

    if (error || !data?.success) {
      throw new Error(data?.error || 'Error al crear factura');
    }

    return data.data;
  };

  const stampInvoices = async (invoiceIds: number[]) => {
    const { data, error } = await supabase.functions.invoke('alegra-api', {
      body: {
        action: 'stamp-invoices',
        data: { ids: invoiceIds }
      }
    });

    if (error || !data?.success) {
      throw new Error(data?.error || 'Error al emitir factura con DIAN');
    }

    return data.data;
  };

  const processInvoices = async () => {
    if (selectedOrders.size === 0) {
      toast.warning('Selecciona al menos un pedido');
      return;
    }

    setIsProcessing(true);
    setResults(new Map());

    const invoicesToStamp: { orderId: string; invoiceId: number; orderNumber: string }[] = [];

    for (const orderId of selectedOrders) {
      const order = orders.find(o => o.id === orderId);
      if (!order) continue;

      updateResult(orderId, { orderNumber: order.order_number, status: 'searching_invoice' });

      try {
        // 1. Check if already stamped
        if (order.alegra_stamped && order.alegra_cufe) {
          updateResult(orderId, { 
            status: 'already_stamped',
            invoiceId: order.alegra_invoice_id || undefined,
            invoiceNumber: order.alegra_invoice_number || undefined,
            cufe: order.alegra_cufe
          });
          continue;
        }

        // 2. Check if has invoice linked but not stamped
        if (order.alegra_invoice_id && !order.alegra_stamped) {
          invoicesToStamp.push({ orderId, invoiceId: order.alegra_invoice_id, orderNumber: order.order_number });
          continue;
        }

        // 3. Search for existing invoice in Alegra
        const existingInvoice = await searchInvoiceByOrderNumber(order.order_number);
        
        if (existingInvoice) {
          // Invoice exists - check if already stamped
          if (existingInvoice.stamp?.cufe) {
            await updateOrderAlegraStatus(
              orderId, 
              existingInvoice.id, 
              existingInvoice.numberTemplate?.fullNumber || String(existingInvoice.id),
              true,
              existingInvoice.stamp.cufe
            );
            updateResult(orderId, { 
              status: 'already_stamped',
              invoiceId: existingInvoice.id,
              invoiceNumber: existingInvoice.numberTemplate?.fullNumber || String(existingInvoice.id),
              cufe: existingInvoice.stamp.cufe
            });
          } else {
            // Invoice exists but not stamped - queue for stamping
            await updateOrderAlegraStatus(orderId, existingInvoice.id, existingInvoice.numberTemplate?.fullNumber || String(existingInvoice.id), false);
            invoicesToStamp.push({ orderId, invoiceId: existingInvoice.id, orderNumber: order.order_number });
          }
          continue;
        }

        // 4. No invoice exists - create everything
        updateResult(orderId, { status: 'searching_contact' });
        const contact = await searchOrCreateContact(order);
        
        if (contact.isNew) {
          updateResult(orderId, { status: 'creating_contact' });
        }

        updateResult(orderId, { status: 'creating_invoice' });
        const invoice = await createInvoice(order, contact.id);
        
        await updateOrderAlegraStatus(orderId, invoice.id, invoice.numberTemplate?.fullNumber || String(invoice.id), false);
        invoicesToStamp.push({ orderId, invoiceId: invoice.id, orderNumber: order.order_number });

      } catch (error: any) {
        updateResult(orderId, { status: 'error', error: error.message });
        toast.error(`Error en #${order.order_number}: ${error.message}`);
      }
    }

    // 5. Stamp all pending invoices in batches of 10
    if (invoicesToStamp.length > 0) {
      const batches = [];
      for (let i = 0; i < invoicesToStamp.length; i += 10) {
        batches.push(invoicesToStamp.slice(i, i + 10));
      }

      for (const batch of batches) {
        // Update status to stamping
        batch.forEach(item => {
          updateResult(item.orderId, { status: 'stamping' });
        });

        try {
          // Ensure the invoice's client has a valid city/department before stamping
          await Promise.all(
            batch.map(async (item) => {
              const order = orders.find((o) => o.id === item.orderId);
              if (!order) return;

              const { data: invResp, error: invErr } = await supabase.functions.invoke('alegra-api', {
                body: { action: 'get-invoice', data: { invoiceId: item.invoiceId } },
              });

              if (invErr || !invResp?.success) {
                throw new Error(invResp?.error || invErr?.message || 'No se pudo consultar la factura en Alegra');
              }

              const invoice = invResp.data;
              const clientId =
                invoice?.client?.id ??
                invoice?.client?.idClient ??
                invoice?.client ??
                invoice?.clientId ??
                invoice?.client_id;

              if (!clientId) return;
              await ensureContactAddress(String(clientId), order);
            })
          );

          const stampResult = await stampInvoices(batch.map(b => b.invoiceId));

          // Process stamp results
          if (Array.isArray(stampResult)) {
            for (const stampedInvoice of stampResult) {
              const matchingItem = batch.find(b => b.invoiceId === stampedInvoice.id);
              if (matchingItem) {
                const cufe = stampedInvoice.stamp?.cufe;
                const invoiceNumber = stampedInvoice.numberTemplate?.fullNumber || String(stampedInvoice.id);
                
                await updateOrderAlegraStatus(matchingItem.orderId, stampedInvoice.id, invoiceNumber, true, cufe);
                
                // Update local order state
                const orderIndex = orders.findIndex(o => o.id === matchingItem.orderId);
                if (orderIndex >= 0) {
                  orders[orderIndex].alegra_stamped = true;
                  orders[orderIndex].alegra_cufe = cufe;
                  orders[orderIndex].alegra_invoice_number = invoiceNumber;
                }
                
                updateResult(matchingItem.orderId, { 
                  status: 'success',
                  invoiceId: stampedInvoice.id,
                  invoiceNumber,
                  cufe
                });
              }
            }
          }
        } catch (error: any) {
          batch.forEach(item => {
            updateResult(item.orderId, { status: 'error', error: error.message });
          });
          toast.error(`Error al emitir lote: ${error.message}`);
        }
      }
    }

    setIsProcessing(false);
    
    const successCount = Array.from(results.values()).filter(r => r.status === 'success' || r.status === 'already_stamped').length;
    if (successCount > 0) {
      toast.success(`${successCount} facturas electrónicas emitidas`);
      fetchShopifyOrders(); // Refresh orders
    }
  };

  const filteredOrders = getFilteredOrders();
  const pendingCount = orders.filter(o => !o.alegra_stamped).length;
  const stampedCount = orders.filter(o => o.alegra_stamped).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, email, CUFE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('all')}
          >
            Todos ({orders.length})
          </Button>
          <Button
            variant={filterStatus === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('pending')}
          >
            Pendientes ({pendingCount})
          </Button>
          <Button
            variant={filterStatus === 'stamped' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('stamped')}
          >
            Emitidas ({stampedCount})
          </Button>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Checkbox
            checked={selectedOrders.size > 0 && selectedOrders.size === filteredOrders.filter(o => !o.alegra_stamped).length}
            onCheckedChange={toggleAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedOrders.size} seleccionados
          </span>
          <Button variant="ghost" size="sm" onClick={fetchShopifyOrders}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Actualizar
          </Button>
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
              <Send className="h-4 w-4 mr-2" />
              Emitir {selectedOrders.size} Facturas DIAN
            </>
          )}
        </Button>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No hay pedidos</p>
          <p className="text-sm">Los pedidos pagados de Shopify aparecerán aquí.</p>
        </div>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {filteredOrders.map(order => {
              const result = results.get(order.id);
              const customerName = `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim();
              const isStamped = order.alegra_stamped || result?.status === 'success' || result?.status === 'already_stamped';
              const cufe = result?.cufe || order.alegra_cufe;
              const invoiceNumber = result?.invoiceNumber || order.alegra_invoice_number;
              const currentStatus = result?.status || (isStamped ? 'already_stamped' : 'idle');
              const statusInfo = statusLabels[currentStatus];
              
              return (
                <Card 
                  key={order.id}
                  className={`cursor-pointer transition-colors ${
                    selectedOrders.has(order.id) ? 'border-primary bg-primary/5' : ''
                  } ${isStamped ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : ''}`}
                  onClick={() => !isStamped && toggleOrder(order.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={selectedOrders.has(order.id)}
                        disabled={isStamped}
                        onCheckedChange={() => toggleOrder(order.id)}
                        onClick={e => e.stopPropagation()}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">#{order.order_number}</span>
                            <Badge variant="outline" className="text-green-600">
                              {order.financial_status}
                            </Badge>
                            {isStamped && (
                              <Badge className="bg-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                DIAN
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

                        {/* Alegra Status */}
                        {(invoiceNumber || cufe || result) && (
                          <div className="mt-3 p-2 bg-muted/50 rounded-md text-sm space-y-1">
                            <div className={`flex items-center gap-1 ${statusInfo.color}`}>
                              {statusInfo.icon}
                              <span>{statusInfo.label}</span>
                            </div>
                            {invoiceNumber && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <FileText className="h-3 w-3" />
                                Factura: <span className="font-mono">{invoiceNumber}</span>
                              </div>
                            )}
                            {cufe && (
                              <div className="text-xs text-muted-foreground font-mono truncate" title={cufe}>
                                CUFE: {cufe.substring(0, 20)}...
                              </div>
                            )}
                            {result?.error && (
                              <div className="text-red-600 text-xs">
                                {result.error}
                              </div>
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
