import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const PrintableOrderView = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        navigate('/picking-packing');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('shopify_orders')
          .select('*')
          .eq('shopify_order_id', parseInt(orderId))
          .single();

        if (error) throw error;
        setOrder(data);

        // Auto print after a small delay
        setTimeout(() => {
          window.print();
        }, 500);
      } catch (error) {
        console.error('Error fetching order:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Orden no encontrada</p>
      </div>
    );
  }

  const shippingAddress = order.raw_data?.shipping_address;
  const paymentGateways = order.raw_data?.payment_gateway_names || [];
  const isCOD = paymentGateways.some((gateway: string) => 
    gateway && gateway.toLowerCase().includes('cash on delivery')
  );

  const formatPaymentMethod = (gateway: string): string => {
    if (gateway.toLowerCase().includes('cash on delivery')) {
      return 'Contraentrega';
    }
    return gateway;
  };

  const paymentMethod = paymentGateways.length > 0 
    ? formatPaymentMethod(paymentGateways[0]) 
    : null;

  return (
    <div className="printable-order max-w-3xl mx-auto p-8 bg-white">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="text-4xl font-bold text-primary mb-2">DOSMICOS</div>
        <div className="text-sm text-muted-foreground">www.dosmicos.co</div>
      </div>

      {/* Order Number */}
      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold">ORDEN #{order.order_number}</h1>
          {paymentMethod && (
            <span className="payment-badge px-4 py-2 bg-yellow-100 text-yellow-800 border-2 border-yellow-300 font-semibold text-base rounded">
              {paymentMethod}
            </span>
          )}
        </div>
      </div>

      {/* Shipping Address */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">ENVÍE A:</h2>
        <div className="text-base space-y-1">
          <p className="font-medium">{shippingAddress?.name || `${order.customer_first_name} ${order.customer_last_name}`}</p>
          {shippingAddress?.company && <p>{shippingAddress.company}</p>}
          {shippingAddress?.address1 && <p>{shippingAddress.address1}</p>}
          {shippingAddress?.address2 && <p>{shippingAddress.address2}</p>}
          {shippingAddress?.city && (
            <p>
              {shippingAddress.city}
              {shippingAddress.province && `, ${shippingAddress.province}`}
              {shippingAddress.zip && ` ${shippingAddress.zip}`}
            </p>
          )}
          {shippingAddress?.country && <p>{shippingAddress.country}</p>}
          {shippingAddress?.phone && <p>{shippingAddress.phone}</p>}
        </div>
      </div>

      {/* COD Banner */}
      {isCOD && (
        <div className="cod-banner my-6 p-4 bg-black text-white text-center font-bold text-xl rounded">
          PAGO CONTRA ENTREGA
        </div>
      )}

      {/* Notes */}
      {order.note && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">NOTES</h2>
          <div className="whitespace-pre-wrap text-base border-l-4 border-primary pl-4">
            {order.note}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-6 border-t text-center">
        <p className="text-lg font-semibold mb-1">GRACIAS POR SU COMPRA</p>
        <p className="text-sm text-muted-foreground">www.dosmicos.co</p>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .printable-order {
            padding: 20mm;
            max-width: 100%;
          }

          .cod-banner {
            background-color: #000 !important;
            color: #fff !important;
            padding: 12mm !important;
            margin: 8mm 0 !important;
            border-radius: 0 !important;
            page-break-inside: avoid;
          }

          .payment-badge {
            background-color: #fef3c7 !important;
            color: #92400e !important;
            border: 2px solid #fcd34d !important;
            padding: 4mm 8mm !important;
            font-weight: 600 !important;
            border-radius: 4px !important;
            page-break-inside: avoid;
          }

          h1, h2 {
            page-break-after: avoid;
          }

          @page {
            size: A4;
            margin: 15mm;
          }
        }

        @media screen {
          .printable-order {
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            margin: 2rem auto;
          }
        }
      `}</style>
    </div>
  );
};

export default PrintableOrderView;