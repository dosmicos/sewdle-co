import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Printer, Package, User, MapPin, FileText, Loader2, Tags } from 'lucide-react';
import { OrderTagsManager } from '@/components/OrderTagsManager';
import { usePickingOrders, OperationalStatus, PickingOrder } from '@/hooks/usePickingOrders';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';

interface ShopifyLineItem {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  price: number;
  quantity: number;
  product_id: number | null;
  variant_id: number | null;
  image_url: string | null;
  shopify_line_item_id: number;
}

interface PickingOrderDetailsModalProps {
  orderId: string;
  onClose: () => void;
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  picking: 'bg-blue-100 text-blue-800',
  packing: 'bg-purple-100 text-purple-800',
  ready_to_ship: 'bg-green-100 text-green-800',
  shipped: 'bg-gray-100 text-gray-800',
};

const statusLabels = {
  pending: 'Por Procesar',
  picking: 'Picking en Proceso',
  packing: 'Empacando',
  ready_to_ship: 'Listo para Envío',
  shipped: 'Enviado',
};

export const PickingOrderDetailsModal: React.FC<PickingOrderDetailsModalProps> = ({ 
  orderId, 
  onClose 
}) => {
  const { orders, updateOrderStatus, updateOrderNotes } = usePickingOrders();
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lineItems, setLineItems] = useState<ShopifyLineItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [localOrder, setLocalOrder] = useState<PickingOrder | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  const order = orders.find(o => o.id === orderId);
  const effectiveOrder = (localOrder && localOrder.shopify_order?.raw_data) 
    ? localOrder 
    : order || localOrder;

  // Fetch order if not found in the orders array
  useEffect(() => {
    const fetchOrder = async () => {
      if (order || !orderId) return;
      
      setLoadingOrder(true);
      try {
        const { data, error } = await supabase
          .from('picking_packing_orders')
          .select(`
            *,
            shopify_order:shopify_orders(
              id,
              shopify_order_id,
              order_number,
              email,
              created_at_shopify,
              financial_status,
              fulfillment_status,
              customer_first_name,
              customer_last_name,
              customer_phone,
              customer_email,
              total_price,
              currency,
              note,
              tags,
              cancelled_at,
              raw_data
            )
          `)
          .eq('id', orderId)
          .single();

        if (error) throw error;
        
        setLocalOrder({
          ...data,
          line_items: []
        } as PickingOrder);
      } catch (error) {
        console.error('❌ Error fetching order:', error);
      } finally {
        setLoadingOrder(false);
      }
    };

    fetchOrder();
  }, [orderId, order]);

  useEffect(() => {
    if (effectiveOrder?.internal_notes) {
      setNotes(effectiveOrder.internal_notes);
    }
  }, [effectiveOrder]);

  // Fetch line items separately
  useEffect(() => {
    const fetchLineItems = async () => {
      if (!effectiveOrder?.shopify_order?.shopify_order_id) return;
      
      setLoadingItems(true);
      try {
        const { data, error } = await supabase
          .from('shopify_order_line_items')
          .select('id, title, variant_title, sku, price, quantity, product_id, variant_id, image_url, shopify_line_item_id')
          .eq('shopify_order_id', effectiveOrder.shopify_order.shopify_order_id);
        
        if (error) throw error;
        
        // Enrich line items with images from raw_data if not in database
        const rawLineItems = effectiveOrder.shopify_order.raw_data?.line_items || [];
        let enrichedItems = (data as ShopifyLineItem[]).map(item => {
          const rawItem = rawLineItems.find((ri: any) => ri.id === item.shopify_line_item_id);
          return {
            ...item,
            image_url: item.image_url || rawItem?.image?.src || rawItem?.featured_image || null
          };
        });
        
        // Final fallback: query product_variants for items still missing images
        const itemsWithoutImages = enrichedItems.filter(item => !item.image_url && item.sku);
        if (itemsWithoutImages.length > 0) {
          const skus = itemsWithoutImages.map(item => item.sku).filter((sku): sku is string => Boolean(sku));
          const variantResult = await supabase
            .from('product_variants')
            .select('sku_variant, products(image_url)')
            .in('sku_variant', skus);
          
          const variantData = variantResult.data as Array<{ sku_variant: string; products: { image_url: string | null } | null }> | null;
          
          if (variantData) {
            const skuToImageMap = new Map<string, string | null>();
            variantData.forEach((v) => {
              if (v.sku_variant) {
                skuToImageMap.set(v.sku_variant, v.products?.image_url || null);
              }
            });
            
            enrichedItems = enrichedItems.map(item => ({
              ...item,
              image_url: item.image_url || (item.sku ? skuToImageMap.get(item.sku) || null : null)
            }));
          }
        }
        
        setLineItems(enrichedItems);
      } catch (error) {
        console.error('Error fetching line items:', error);
        setLineItems([]);
      }
      setLoadingItems(false);
    };

    fetchLineItems();
  }, [effectiveOrder?.shopify_order?.shopify_order_id, effectiveOrder?.shopify_order?.raw_data]);

  const handleStatusChange = async (newStatus: OperationalStatus) => {
    await updateOrderStatus(orderId, newStatus);
  };

  const handleSaveNotes = async () => {
    setIsSaving(true);
    await updateOrderNotes(orderId, notes);
    setIsSaving(false);
  };

  const handlePrint = () => {
    window.open(`/picking-packing/print/${effectiveOrder?.shopify_order_id}`, '_blank');
  };

  const formatCurrency = (amount?: number, currency?: string) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Show loading state
  if (loadingOrder) {
    return (
      <Dialog open={!!orderId} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3">Cargando orden...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!effectiveOrder) {
    return (
      <Dialog open={!!orderId} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No se encontró la orden</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const shippingAddress = effectiveOrder.shopify_order?.raw_data?.shipping_address;
  const financialSummary = effectiveOrder.shopify_order?.raw_data || {};
  
  const rawPaymentGateways = effectiveOrder.shopify_order?.raw_data?.payment_gateway_names;
  const paymentGateways = Array.isArray(rawPaymentGateways) 
    ? rawPaymentGateways 
    : (typeof rawPaymentGateways === 'string' ? [rawPaymentGateways] : []);
  
  const formatPaymentMethod = (gateway: string): string => {
    if (gateway.toLowerCase().includes('cash on delivery')) {
      return 'Contraentrega';
    }
    return gateway;
  };
  
  const paymentMethod = paymentGateways.length > 0 
    ? formatPaymentMethod(paymentGateways[0]) 
    : null;

  console.log('🔍 DEBUG Payment Method:', {
    rawPaymentGateways,
    paymentGateways,
    paymentMethod,
    order_number: effectiveOrder.shopify_order?.order_number,
    has_raw_data: !!effectiveOrder.shopify_order?.raw_data
  });

  return (
    <Dialog open={!!orderId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-2xl">
                Orden #{effectiveOrder.shopify_order?.order_number}
              </DialogTitle>
              
              {effectiveOrder.shopify_order?.cancelled_at && (
                <Badge variant="destructive" className="bg-red-600">
                  ⚠️ ORDEN CANCELADA
                </Badge>
              )}
              
              <Badge className={statusColors[effectiveOrder.operational_status]}>
                {statusLabels[effectiveOrder.operational_status]}
              </Badge>
              {effectiveOrder.shopify_order?.financial_status === 'pending' && paymentMethod !== 'Contraentrega' && (
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                  Pago Pendiente
                </Badge>
              )}
              {paymentMethod && (
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                  💳 {paymentMethod}
                </Badge>
              )}
            </div>
            <Button onClick={handlePrint} variant="outline" className="gap-2">
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Left Column - Products */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Productos ({lineItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lineItems.map((item, index: number) => (
                  <div key={index} className="flex gap-4 p-4 border rounded-lg">
                    {/* Product Image */}
                    <div className="flex-shrink-0">
                      {item.image_url ? (
                        <img 
                          src={item.image_url} 
                          alt={item.title}
                          className="w-32 h-32 object-cover rounded-lg border"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = '<div class="w-32 h-32 bg-muted rounded-lg flex items-center justify-center"><svg class="w-12 h-12 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg></div>';
                          }}
                        />
                      ) : (
                        <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center border">
                          <Package className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 space-y-2">
                      <div>
                        <h4 className="font-semibold text-lg">
                          {item.title}
                        </h4>
                        {item.variant_title && (
                          <p className="text-sm text-muted-foreground">
                            {item.variant_title}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">SKU: </span>
                          <span className="font-medium">{item.sku || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Precio: </span>
                          <span className="font-medium">
                            {formatCurrency(item.price, effectiveOrder.shopify_order?.currency)}
                          </span>
                        </div>
                      </div>

                      {/* Quantity Highlighted */}
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Cantidad:</span>
                        <span className="text-3xl font-bold text-primary">
                          {item.quantity}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-sm text-muted-foreground">Total: </span>
                        <span className="font-semibold">
                          {formatCurrency(item.price * item.quantity, effectiveOrder.shopify_order?.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Status Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {effectiveOrder.shopify_order?.cancelled_at ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800 font-medium">
                      ⚠️ Esta orden fue cancelada en Shopify el {new Date(effectiveOrder.shopify_order.cancelled_at).toLocaleDateString('es-CO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    <p className="text-xs text-red-600 mt-2">
                      No se pueden realizar acciones de picking/packing en órdenes canceladas.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => handleStatusChange('picking')}
                      disabled={effectiveOrder.operational_status !== 'pending'}
                      variant={effectiveOrder.operational_status === 'picking' ? 'default' : 'outline'}
                    >
                      Iniciar Picking
                    </Button>
                    <Button
                      onClick={() => handleStatusChange('packing')}
                      disabled={effectiveOrder.operational_status !== 'picking'}
                      variant={effectiveOrder.operational_status === 'packing' ? 'default' : 'outline'}
                    >
                      Empacar
                    </Button>
                    <Button
                      onClick={() => handleStatusChange('ready_to_ship')}
                      disabled={effectiveOrder.operational_status !== 'packing'}
                      variant={effectiveOrder.operational_status === 'ready_to_ship' ? 'default' : 'outline'}
                      className="col-span-2"
                    >
                      Marcar Listo para Envío
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-4">
            {/* Financial Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumen Financiero</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(financialSummary.subtotal_price, effectiveOrder.shopify_order?.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Envío</span>
                  <span>{formatCurrency(financialSummary.total_shipping_price_set?.shop_money?.amount, effectiveOrder.shopify_order?.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Impuestos</span>
                  <span>{formatCurrency(financialSummary.total_tax, effectiveOrder.shopify_order?.currency)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(financialSummary.total_price, effectiveOrder.shopify_order?.currency)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium">
                  {effectiveOrder.shopify_order?.customer_first_name} {effectiveOrder.shopify_order?.customer_last_name}
                </p>
                <p className="text-muted-foreground">{effectiveOrder.shopify_order?.customer_email}</p>
                {effectiveOrder.shopify_order?.customer_phone && (
                  <p className="text-muted-foreground">{effectiveOrder.shopify_order.customer_phone}</p>
                )}
              </CardContent>
            </Card>

            {/* Shipping Address */}
            {shippingAddress && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Dirección de Envío
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="font-medium">{shippingAddress.name}</p>
                  <p>{shippingAddress.address1}</p>
                  {shippingAddress.address2 && <p>{shippingAddress.address2}</p>}
                  <p>
                    {shippingAddress.city}, {shippingAddress.province} {shippingAddress.zip}
                  </p>
                  <p>{shippingAddress.country}</p>
                  {shippingAddress.phone && (
                    <p className="text-muted-foreground">{shippingAddress.phone}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Notas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Agregar notas internas..."
                  rows={4}
                />
                <Button
                  onClick={handleSaveNotes}
                  disabled={isSaving}
                  size="sm"
                  className="w-full"
                >
                  {isSaving ? 'Guardando...' : 'Guardar Notas'}
                </Button>
              </CardContent>
            </Card>

            {/* Shopify Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Tags className="w-4 h-4" />
                  Etiquetas de Shopify
                </CardTitle>
              </CardHeader>
              <CardContent>
                <OrderTagsManager
                  orderId={effectiveOrder.id}
                  shopifyOrderId={effectiveOrder.shopify_order.shopify_order_id}
                  currentTags={effectiveOrder.shopify_order.tags || ''}
                  onTagsUpdate={(newTags) => {
                    setLocalOrder(prev => prev ? {
                      ...prev,
                      shopify_order: {
                        ...prev.shopify_order,
                        tags: newTags
                      }
                    } : prev);
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};