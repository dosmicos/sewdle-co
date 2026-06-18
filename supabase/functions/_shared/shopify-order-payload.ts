export type ShopifyOrderLineItem = {
  variant_id: number;
  quantity: number;
};

export type ShopifyOrderPayloadOrderData = {
  customerName: string;
  cedula?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  department: string;
  neighborhood?: string;
  notes?: string;
  shippingMethod?: string;
  shippingCost?: number;
  paymentMethod?: string;
};

export type BuildShopifyOrderPayloadParams = {
  orderData: ShopifyOrderPayloadOrderData;
  validatedLineItems: ShopifyOrderLineItem[];
  customerId?: number | string | null;
  totalAmount?: number;
};

export const SHOPIFY_COD_GATEWAY = "Cash on Delivery (COD)";

function normalizeOrderText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasExpressShippingSignal(orderData: ShopifyOrderPayloadOrderData): boolean {
  const shippingCost = Number(orderData.shippingCost || 0);
  return normalizeOrderText([
    orderData.shippingMethod,
    orderData.notes,
  ].join(" ")).includes("express") || shippingCost === 15000 || shippingCost === 14000;
}

function customerFirstName(customerName: string): string {
  return customerName.trim().split(/\s+/)[0] || customerName.trim();
}

function customerLastName(customerName: string): string {
  return customerName.trim().split(/\s+/).slice(1).join(" ");
}

function appendNote(baseNote: string | undefined, suffix: string): string {
  return (baseNote ? `${baseNote} | ` : "") + suffix;
}

function formatShopifyAmount(amount: unknown): string | undefined {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return numeric.toFixed(2);
}

export function buildShopifyOrderPayload(params: BuildShopifyOrderPayloadParams): any {
  const { orderData, validatedLineItems, customerId, totalAmount } = params;
  const isContraEntrega = orderData.paymentMethod === "contra_entrega";
  const isLinkDePago = orderData.paymentMethod === "link_de_pago";
  const isAddi = orderData.paymentMethod === "addi";
  const isExpressShipping = hasExpressShippingSignal(orderData);
  const isBankTransfer = ["bank_transfer", "bancolombia", "nequi", "manual_transfer"].includes(
    String(orderData.paymentMethod || ""),
  );

  const orderTags = ["whatsapp", "messaging"];
  if (isContraEntrega) orderTags.push("Contraentrega");
  if (isLinkDePago) orderTags.push("Link de pago", "Bold");
  if (isAddi) orderTags.push("Addi", "Financiación");
  if (isBankTransfer) orderTags.push("Transferencia", "Pago recibido");
  if (isExpressShipping) orderTags.push("Express");

  const firstName = customerFirstName(orderData.customerName);
  const lastName = customerLastName(orderData.customerName);

  const payload: any = {
    order: {
      line_items: validatedLineItems,
      customer: customerId ? { id: customerId } : undefined,
      email: orderData.email,
      shipping_address: {
        first_name: firstName,
        last_name: lastName,
        company: orderData.cedula || "",
        address1: orderData.address,
        city: orderData.city,
        province: orderData.department,
        country: "CO",
        phone: orderData.phone,
      },
      billing_address: {
        first_name: firstName,
        last_name: lastName,
        company: orderData.cedula || "",
        address1: orderData.address,
        city: orderData.city,
        province: orderData.department,
        country: "CO",
        phone: orderData.phone,
      },
      shipping_lines: orderData.shippingCost && orderData.shippingCost > 0
        ? [{
          title: isExpressShipping ? "Envío express" : "Envío",
          price: String(orderData.shippingCost),
          code: isExpressShipping ? "EXPRESS_SHIPPING" : "SHIPPING",
        }]
        : [],
      note: orderData.notes || "Pedido creado desde WhatsApp",
      tags: orderTags.join(", "),
      financial_status: isLinkDePago || isAddi || isBankTransfer ? "paid" : "pending",
    },
  };

  if (isContraEntrega) {
    payload.order.gateway = SHOPIFY_COD_GATEWAY;
    payload.order.note = appendNote(orderData.notes, "Pedido creado desde WhatsApp - Pago contra entrega");

    const transactionAmount = formatShopifyAmount(totalAmount);
    if (transactionAmount) {
      payload.order.transactions = [{
        kind: "sale",
        status: "pending",
        amount: transactionAmount,
        gateway: SHOPIFY_COD_GATEWAY,
      }];
    }
  }

  if (isLinkDePago) {
    payload.order.gateway = "Bold";
    payload.order.note = appendNote(orderData.notes, "Pedido creado desde WhatsApp - Pagado via Bold");
  }

  if (isAddi) {
    payload.order.gateway = "Addi Payment";
    payload.order.note = appendNote(orderData.notes, "Pedido creado desde WhatsApp - Aprobado via Addi");
  }

  if (isBankTransfer) {
    payload.order.gateway = "Bancolombia / Transferencia";
    payload.order.note = appendNote(orderData.notes, "Pedido creado desde WhatsApp - Pago recibido por transferencia");
  }

  return payload;
}
