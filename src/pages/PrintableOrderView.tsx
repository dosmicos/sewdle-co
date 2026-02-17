import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import dosmicosLogo from '@/assets/dosmicos-logo.png';

const PrintableOrderView = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  
  // Guard to prevent double print in React StrictMode
  const hasAutoPrintedRef = useRef(false);

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

        // Auto print after a small delay - only once per mount
        if (!hasAutoPrintedRef.current) {
          hasAutoPrintedRef.current = true;
          setTimeout(() => {
            window.print();
          }, 500);
        }
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

  const formatPaymentMethod = (gateway: string): string => {
    if (gateway.toLowerCase().includes('cash on delivery')) {
      return 'Contraentrega';
    }
    return gateway;
  };

  // El ÚLTIMO método de pago en el array es el efectivo (orden cronológico de Shopify)
  const paymentMethod = paymentGateways.length > 0 
    ? formatPaymentMethod(paymentGateways[paymentGateways.length - 1]) 
    : null;

  // isCOD is true if the LAST payment method is COD
  const isCOD = paymentMethod === 'Contraentrega';

  return (
    <div className="printable-order mx-auto p-2 bg-white">
      {/* Logo */}
      <div className="text-center mb-1.5">
        <img 
          src={dosmicosLogo} 
          alt="Dosmicos" 
          className="logo-image mx-auto mb-0.5"
          style={{ maxWidth: '130px', height: 'auto' }}
        />
      </div>

      {/* Order Number */}
      <div className="mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-sm font-bold">ORDEN #{order.order_number}</h1>
          {paymentMethod && (
          <span className="payment-badge px-1.5 py-0.5 bg-transparent text-black border-2 border-black font-semibold text-sm rounded">
            {paymentMethod}
          </span>
          )}
        </div>
      </div>

      {/* Shipping Address */}
      <div className="mb-1">
        <h2 className="text-sm font-semibold mb-0.5">ENVÍE A:</h2>
        <div className="space-y-0.5" style={{ fontSize: '0.825rem' }}>
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
        <div className="cod-banner my-1 p-1 bg-black text-white text-center font-semibold text-sm rounded">
          PAGO CONTRA ENTREGA
        </div>
      )}

      {/* Notes */}
      {order.note && (
        <div className="mb-1">
          <h2 className="text-sm font-semibold mb-0.5">NOTES</h2>
          <div className="whitespace-pre-wrap border-l-2 border-primary pl-2" style={{ fontSize: '0.75rem' }}>
            {order.note}
          </div>
        </div>
      )}


      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .printable-order {
            padding: 4mm 5mm;
            max-width: 100%;
          }

          .logo-image {
            max-width: 27mm !important;
            height: auto !important;
          }

          .cod-banner {
            background-color: #000 !important;
            color: #fff !important;
            padding: 1.5mm !important;
            margin: 1.5mm 0 !important;
            border-radius: 0 !important;
            page-break-inside: avoid;
            font-size: 11pt !important;
          }

          .payment-badge {
            background-color: transparent !important;
            color: #000 !important;
            border: 2px solid #000 !important;
            padding: 0.5mm 1.5mm !important;
            font-weight: 600 !important;
            border-radius: 3px !important;
            page-break-inside: avoid;
          }

          h1, h2 {
            page-break-after: avoid;
          }

          @page {
            size: 100mm 100mm;
            margin: 2.5mm;
          }
          
          html {
            margin: 0;
          }
          
          body {
            margin: 0;
          }
        }

        @media screen {
          body {
            background-color: #f3f4f6;
            min-height: 100vh;
          }
          
          .printable-order {
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            margin: 2rem auto;
            max-width: 100mm;
            width: 100mm;
            min-height: 100mm;
            background: white;
          }
        }
      `}</style>
    </div>
  );
};

export default PrintableOrderView;
