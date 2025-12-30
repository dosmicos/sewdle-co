import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { 
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
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
  RefreshCw,
  Eye,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import InvoiceDetailsModal, { EditedInvoiceData } from './InvoiceDetailsModal';
import BulkValidationResultsModal, { BulkValidationResult } from './BulkValidationResultsModal';
import { validateOrderForInvoice } from '@/hooks/useInvoiceValidation';

// ==================== AUTO-MATCH ALEGRA PRODUCTS ====================

interface AlegraItem {
  id: string;
  name: string;
  reference?: string;
  price?: number[] | { price: number }[];
}

// Normalize product name for matching - remove accents, TOG, sizes, common words
const normalizeProductName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/tog\s*[\d.]+/gi, "") // Remove TOG
    .replace(/talla?\s*\w+/gi, "") // Remove sizes like "talla 2" or "talla XL"
    .replace(/-?\s*(navidad|halloween|pascua|dia de|año nuevo|san valentin)/gi, "") // Remove seasonal
    .replace(/\s*-\s*/g, " ") // Replace hyphens with spaces
    .replace(/[.,]/g, "") // Remove punctuation
    .replace(/\s+/g, " ")
    .trim();
};

// Extract keywords from product name
const extractKeywords = (name: string): string[] => {
  const normalized = normalizeProductName(name);
  // Common words to exclude
  const stopWords = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'con', 'para', 'por', 'en']);
  return normalized.split(' ').filter(word => word.length > 2 && !stopWords.has(word));
};

// Calculate similarity score between two sets of keywords
const calculateSimilarity = (keywords1: string[], keywords2: string[]): number => {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;
  
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  
  let matchCount = 0;
  for (const word of set1) {
    // Check exact match or partial match (word contained in another)
    if (set2.has(word)) {
      matchCount += 1;
    } else {
      // Check if any word in set2 contains this word or vice versa
      for (const word2 of set2) {
        if (word.includes(word2) || word2.includes(word)) {
          matchCount += 0.5;
          break;
        }
      }
    }
  }
  
  // Jaccard-like score weighted by match quality
  const union = new Set([...set1, ...set2]).size;
  return matchCount / union;
};

// Find best matching Alegra item for a Shopify product
const findBestAlegraMatch = (
  shopifyTitle: string, 
  allAlegraItems: AlegraItem[],
  minScore: number = 0.3
): AlegraItem | null => {
  const shopifyKeywords = extractKeywords(shopifyTitle);
  
  if (shopifyKeywords.length === 0) return null;
  
  let bestMatch: AlegraItem | null = null;
  let bestScore = 0;
  
  for (const item of allAlegraItems) {
    const alegraKeywords = extractKeywords(item.name);
    const score = calculateSimilarity(shopifyKeywords, alegraKeywords);
    
    if (score > bestScore && score >= minScore) {
      bestScore = score;
      bestMatch = item;
    }
  }
  
  if (bestMatch) {
    console.log(`🔍 Auto-match: "${shopifyTitle}" → "${bestMatch.name}" (score: ${bestScore.toFixed(2)})`);
  }
  
  return bestMatch;
};

const ITEMS_PER_PAGE = 10;

// Helper function to generate page numbers with ellipsis
const generatePageNumbers = (currentPage: number, totalPages: number): (number | '...')[] => {
  const pages: (number | '...')[] = [];
  
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    
    for (let i = start; i <= end; i++) pages.push(i);
    
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }
  
  return pages;
};

export interface ShopifyOrderForInvoice {
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
  total_discounts: number; // Descuento total de la orden
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  created_at_shopify: string;
  tags?: string;
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
    price: number; // Precio original del item (sin descuento)
    total_discount: number; // Descuento específico de este item
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
  | 'already_stamped'
  | 'invoice_mismatch';

interface InvoiceDiscrepancy {
  type: 'total' | 'items' | 'client';
  expected: any;
  actual: any;
  message: string;
}

interface InvoiceValidationResult {
  isValid: boolean;
  discrepancies: InvoiceDiscrepancy[];
  existingInvoice: any;
  clientFromInvoice?: { id: string; name: string };
}

interface InvoiceResult {
  orderId: string;
  orderNumber: string;
  status: ProcessingStatus;
  invoiceId?: number;
  invoiceNumber?: string;
  cufe?: string;
  error?: string;
  discrepancies?: InvoiceDiscrepancy[];
  existingInvoice?: any;
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

  // Bogotá - formato DIAN: city="Bogotá, DC", department="Bogotá D.C."
  if (
    cityLower.includes('bogota') ||
    provinceLower.includes('bogota') ||
    provinceLower.includes('cundinamarca')
  ) {
    return { city: 'Bogotá, DC', department: 'Bogotá D.C.' };
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
  return { city: 'Bogotá, DC', department: 'Bogotá D.C.' };
};

// Helper function to add FACTURADO tag to Shopify order after successful DIAN stamp
// Uses add_tags action which merges using Shopify as source of truth
const addFacturadoTag = async (shopifyOrderId: number): Promise<void> => {
  try {
    console.log(`🏷️ Agregando etiqueta FACTURADO a orden ${shopifyOrderId} usando merge...`);
    
    // Use add_tags action - it reads from Shopify, merges, and updates
    const { data, error } = await supabase.functions.invoke('update-shopify-order', {
      body: {
        orderId: shopifyOrderId,
        action: 'add_tags',
        data: { tags: ['FACTURADO'] }
      }
    });

    if (error || !data?.success) {
      console.error('⚠️ Error al agregar etiqueta FACTURADO:', error || data?.error);
      toast.error('Error al agregar etiqueta FACTURADO en Shopify');
      return;
    }

    // Update local database with final tags from Shopify
    if (data.finalTags) {
      const finalTagsString = Array.isArray(data.finalTags) 
        ? data.finalTags.join(', ') 
        : data.finalTags;
      
      await supabase
        .from('shopify_orders')
        .update({ tags: finalTagsString })
        .eq('shopify_order_id', shopifyOrderId);
      
      console.log(`✅ Etiqueta FACTURADO agregada. Tags finales: ${finalTagsString}`);
    } else {
      console.log(`✅ Etiqueta FACTURADO enviada a Shopify (sin finalTags en respuesta)`);
    }
  } catch (error) {
    console.error('⚠️ Error al agregar etiqueta FACTURADO:', error);
    toast.error('Error al agregar etiqueta FACTURADO');
    // Don't throw - tag failure shouldn't stop the invoice process
  }
};

// ==================== REGISTRO DE FACTURAS EN alegra_invoices ====================

// Validar coherencia entre factura existente en Alegra y pedido de Shopify
const validateExistingInvoice = async (
  order: ShopifyOrderForInvoice,
  existingInvoice: any
): Promise<InvoiceValidationResult> => {
  const discrepancies: InvoiceDiscrepancy[] = [];
  
  // Calcular total esperado incluyendo envío
  const expectedTotal = order.total_price;
  
  // Obtener total de la factura en Alegra
  const invoiceTotal = parseFloat(existingInvoice.total || existingInvoice.totalAmount || 0);
  
  // Tolerancia de $500 para diferencias de redondeo
  const tolerance = 500;
  const totalDiff = Math.abs(expectedTotal - invoiceTotal);
  
  if (totalDiff > tolerance) {
    discrepancies.push({
      type: 'total',
      expected: expectedTotal,
      actual: invoiceTotal,
      message: `Total Alegra: $${invoiceTotal.toLocaleString()} vs Shopify: $${expectedTotal.toLocaleString()} (diferencia: $${totalDiff.toLocaleString()})`
    });
  }
  
  // Validar número de items (productos + envío si aplica)
  const invoiceItems = existingInvoice.items || [];
  const expectedItemCount = order.line_items.length + (order.total_price > order.subtotal_price ? 1 : 0); // +1 para envío
  
  if (invoiceItems.length !== expectedItemCount && invoiceItems.length !== order.line_items.length) {
    discrepancies.push({
      type: 'items',
      expected: expectedItemCount,
      actual: invoiceItems.length,
      message: `Items en factura: ${invoiceItems.length} vs esperados: ${expectedItemCount}`
    });
  }
  
  // Extraer cliente de la factura
  const clientFromInvoice = existingInvoice.client ? {
    id: String(existingInvoice.client.id || existingInvoice.client),
    name: existingInvoice.client.name || 'Cliente'
  } : undefined;
  
  return {
    isValid: discrepancies.length === 0,
    discrepancies,
    existingInvoice,
    clientFromInvoice
  };
};

// Verificar si ya existe factura emitida para este pedido (tabla local + Alegra API)
// Ahora también valida coherencia para facturas no emitidas
const verifyNoExistingInvoice = async (
  order: ShopifyOrderForInvoice,
  searchInvoiceFn: (orderNumber: string, order?: ShopifyOrderForInvoice) => Promise<any>,
  getInvoiceDetailsFn?: (invoiceId: number) => Promise<any>
): Promise<{ 
  exists: boolean; 
  invoice?: any; 
  source?: 'local' | 'alegra';
  validation?: InvoiceValidationResult;
  needsValidation?: boolean;
}> => {
  try {
    // 1. Buscar en tabla local alegra_invoices (solo emitidas con CUFE)
    const { data: localRecord } = await supabase
      .from('alegra_invoices')
      .select('*')
      .eq('shopify_order_id', order.shopify_order_id)
      .eq('stamped', true)
      .not('cufe', 'is', null)
      .maybeSingle();
    
    if (localRecord && localRecord.cufe) {
      console.log(`⚠️ Factura ya registrada localmente para orden ${order.order_number}:`, localRecord.alegra_invoice_number, 'CUFE:', localRecord.cufe);
      return { exists: true, invoice: localRecord, source: 'local' };
    }

    // 2. Si hay registro local SIN CUFE, verificar directamente en Alegra si ya fue emitida
    const { data: localRecordAny } = await supabase
      .from('alegra_invoices')
      .select('*')
      .eq('shopify_order_id', order.shopify_order_id)
      .maybeSingle();
    
    if (localRecordAny?.alegra_invoice_id) {
      console.log(`📋 Encontrado registro local para ${order.order_number}, verificando estado en Alegra...`);
      
      // Verificar directamente en Alegra el estado actual de la factura
      if (getInvoiceDetailsFn) {
        try {
          const alegraInvoice = await getInvoiceDetailsFn(localRecordAny.alegra_invoice_id);
          if (alegraInvoice?.stamp?.cufe) {
            // La factura YA está emitida en Alegra, sincronizar y bloquear
            console.log(`✅ Factura ${alegraInvoice.numberTemplate?.fullNumber} ya está emitida en Alegra con CUFE`);
            await registerInvoice(order, alegraInvoice, true, alegraInvoice.stamp.cufe);
            
            // También actualizar shopify_orders
            await supabase
              .from('shopify_orders')
              .update({
                alegra_stamped: true,
                alegra_cufe: alegraInvoice.stamp.cufe,
                alegra_invoice_number: alegraInvoice.numberTemplate?.fullNumber
              })
              .eq('id', order.id);
            
            return { exists: true, invoice: alegraInvoice, source: 'alegra' };
          }
        } catch (e) {
          console.warn('Error verificando factura en Alegra:', e);
        }
      }
    }

    // 3. Buscar en Alegra API (con fallback por cliente)
    const existingInvoice = await searchInvoiceFn(order.order_number, order);
    
    if (existingInvoice) {
      // Siempre obtener detalles completos para verificar CUFE
      let invoiceDetails = existingInvoice;
      if (getInvoiceDetailsFn && existingInvoice.id) {
        try {
          invoiceDetails = await getInvoiceDetailsFn(existingInvoice.id);
        } catch (e) {
          console.warn('No se pudieron obtener detalles de factura, usando datos básicos');
        }
      }
      
      if (invoiceDetails.stamp?.cufe) {
        // Ya emitida con CUFE - sincronizar y marcar como existente
        console.log(`⚠️ Factura ya existe en Alegra para orden ${order.order_number}:`, invoiceDetails.numberTemplate?.fullNumber);
        await registerInvoice(order, invoiceDetails, true, invoiceDetails.stamp.cufe);
        
        // También actualizar shopify_orders
        await supabase
          .from('shopify_orders')
          .update({
            alegra_stamped: true,
            alegra_cufe: invoiceDetails.stamp.cufe,
            alegra_invoice_number: invoiceDetails.numberTemplate?.fullNumber
          })
          .eq('id', order.id);
        
        return { exists: true, invoice: invoiceDetails, source: 'alegra' };
      }
      
      // Existe factura pero NO está emitida - validar coherencia
      console.log(`📋 Factura existente sin emitir para orden ${order.order_number}, validando coherencia...`);
      
      const validation = await validateExistingInvoice(order, invoiceDetails);
      
      return { 
        exists: false, // No bloqueamos, pero indicamos que necesita validación
        invoice: invoiceDetails, 
        source: 'alegra',
        validation,
        needsValidation: true
      };
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Error verificando factura existente:', error);
    // En caso de error, permitir continuar pero loguear
    return { exists: false };
  }
};

// Registrar factura emitida en tabla alegra_invoices
const registerInvoice = async (
  order: ShopifyOrderForInvoice,
  invoice: any,
  stamped: boolean = false,
  cufe?: string
): Promise<void> => {
  try {
    // Obtener organization_id del usuario actual
    const { data: orgData } = await supabase.rpc('get_current_organization_safe');
    const organizationId = orgData;
    
    if (!organizationId) {
      console.error('No se pudo obtener organization_id para registrar factura');
      return;
    }

    const invoiceRecord = {
      organization_id: organizationId,
      shopify_order_id: order.shopify_order_id,
      shopify_order_number: order.order_number,
      alegra_invoice_id: invoice.id,
      alegra_invoice_number: invoice.numberTemplate?.fullNumber || String(invoice.id),
      stamped,
      cufe: cufe || null,
      stamped_at: stamped ? new Date().toISOString() : null
    };

    const { error } = await supabase
      .from('alegra_invoices')
      .upsert(invoiceRecord, {
        onConflict: 'organization_id,shopify_order_id,alegra_invoice_id'
      });

    if (error) {
      console.error('Error registrando factura en alegra_invoices:', error);
    } else {
      console.log(`✅ Factura registrada en alegra_invoices: ${invoiceRecord.alegra_invoice_number} (stamped: ${stamped})`);
    }
  } catch (error) {
    console.error('Error registrando factura:', error);
  }
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
  invoice_mismatch: { label: 'Factura con diferencias', icon: <AlertTriangle className="h-4 w-4" />, color: 'text-amber-600' },
};

const BulkInvoiceCreator = () => {
  const [orders, setOrders] = useState<ShopifyOrderForInvoice[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<Map<string, InvoiceResult>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'stamped'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modal state
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<ShopifyOrderForInvoice | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [editedOrders, setEditedOrders] = useState<Map<string, EditedInvoiceData>>(new Map());
  
  // Bulk validation state
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<BulkValidationResult[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [manualDeliveryConfirmations, setManualDeliveryConfirmations] = useState<Map<string, boolean>>(new Map());
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Alegra catalog cache
  const alegraItemsCache = useRef<AlegraItem[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  
  // Load full Alegra catalog (once)
  const loadAlegraFullCatalog = async (): Promise<AlegraItem[]> => {
    if (alegraItemsCache.current.length > 0) {
      console.log(`📦 Usando catálogo Alegra en cache: ${alegraItemsCache.current.length} productos`);
      return alegraItemsCache.current;
    }
    
    setIsCatalogLoading(true);
    console.log('📦 Cargando catálogo completo de Alegra...');
    
    const allItems: AlegraItem[] = [];
    let start = 0;
    const limit = 30; // Alegra API limit
    
    try {
      while (true) {
        const { data, error } = await supabase.functions.invoke('alegra-api', {
          body: { action: 'get-items', data: { start, limit } }
        });
        
        if (error || !data?.success) {
          console.error('Error cargando catálogo Alegra:', error || data?.error);
          break;
        }
        
        const items = data.data || [];
        if (items.length === 0) break;
        
        allItems.push(...items);
        console.log(`  → Cargados ${allItems.length} productos...`);
        
        start += limit;
        
        if (items.length < limit) break;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      alegraItemsCache.current = allItems;
      console.log(`✅ Catálogo Alegra cargado: ${allItems.length} productos`);
    } catch (err) {
      console.error('Error cargando catálogo Alegra:', err);
    } finally {
      setIsCatalogLoading(false);
    }
    
    return allItems;
  };
  
  // Auto-match and optionally save mapping
  const autoMatchProduct = async (
    productTitle: string, 
    variantTitle: string | null,
    sku: string | null,
    alegraItems: AlegraItem[]
  ): Promise<{ alegraItemId: string; alegraItemName: string } | null> => {
    // Build full title for matching
    const fullTitle = variantTitle ? `${productTitle} ${variantTitle}` : productTitle;
    
    const match = findBestAlegraMatch(fullTitle, alegraItems);
    if (!match) return null;
    
    // Auto-save mapping for future use (ignore if already exists)
    try {
      const { data: orgData } = await supabase.rpc('get_current_organization_safe');
      if (orgData) {
        // Check if mapping already exists
        const { data: existing } = await supabase
          .from('alegra_product_mapping')
          .select('id')
          .eq('organization_id', orgData)
          .eq('shopify_product_title', productTitle)
          .eq('shopify_variant_title', variantTitle || '')
          .maybeSingle();
        
        if (!existing) {
          await supabase.from('alegra_product_mapping').insert({
            organization_id: orgData,
            shopify_product_title: productTitle,
            shopify_variant_title: variantTitle,
            shopify_sku: sku,
            alegra_item_id: match.id,
            alegra_item_name: match.name
          });
          console.log(`💾 Auto-guardado mapeo: "${productTitle}" → "${match.name}"`);
        }
      }
    } catch (err) {
      console.warn('No se pudo guardar mapeo automático:', err);
    }
    
    return { alegraItemId: match.id, alegraItemName: match.name };
  };

  // Sync pending invoices - fetch CUFE from Alegra for invoices that were stamped but not synced
  const syncPendingInvoices = async () => {
    console.log('🔄 Sincronizando facturas pendientes...');
    
    try {
      // 1. Find local records with alegra_invoice_id but no CUFE
      const { data: pendingInvoices } = await supabase
        .from('alegra_invoices')
        .select('*')
        .eq('stamped', false)
        .not('alegra_invoice_id', 'is', null);
      
      if (!pendingInvoices?.length) {
        console.log('✅ No hay facturas pendientes de sincronización');
        return 0;
      }
      
      console.log(`📋 Encontradas ${pendingInvoices.length} facturas pendientes de CUFE`);
      let syncedCount = 0;
      
      for (const invoice of pendingInvoices) {
        try {
          // 2. Fetch current state from Alegra
          const { data, error } = await supabase.functions.invoke('alegra-api', {
            body: { action: 'get-invoice', data: { id: invoice.alegra_invoice_id } }
          });
          
          if (error || !data?.success) {
            console.warn(`⚠️ Error obteniendo factura ${invoice.alegra_invoice_id}:`, error || data?.error);
            continue;
          }
          
          const alegraInvoice = data.data;
          const cufe = alegraInvoice?.stamp?.cufe;
          
          if (cufe) {
            console.log(`✅ CUFE encontrado para factura ${invoice.alegra_invoice_id}: ${cufe.substring(0, 20)}...`);
            
            // 3. Update alegra_invoices
            await supabase.from('alegra_invoices').update({
              stamped: true,
              cufe: cufe,
              stamped_at: new Date().toISOString()
            }).eq('id', invoice.id);
            
            // 4. Update shopify_orders
            await supabase.from('shopify_orders').update({
              alegra_stamped: true,
              alegra_cufe: cufe
            }).eq('shopify_order_id', invoice.shopify_order_id);
            
            // 5. Add FACTURADO tag if not already present
            await addFacturadoTag(invoice.shopify_order_id);
            
            syncedCount++;
          } else {
            console.log(`⏳ Factura ${invoice.alegra_invoice_id} aún sin CUFE en Alegra`);
          }
        } catch (err) {
          console.error(`Error sincronizando factura ${invoice.alegra_invoice_id}:`, err);
        }
      }
      
      if (syncedCount > 0) {
        toast.success(`${syncedCount} factura(s) sincronizada(s) correctamente`);
      }
      
      return syncedCount;
    } catch (err) {
      console.error('Error en syncPendingInvoices:', err);
      return 0;
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  useEffect(() => {
    fetchShopifyOrders();
    // Preload Alegra catalog in background for faster invoice creation
    loadAlegraFullCatalog();
    // Sync pending invoices in background (don't block loading)
    syncPendingInvoices();
  }, []);

  const fetchShopifyOrders = async () => {
    setIsLoading(true);
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('shopify_orders')
        .select('*')
        .in('financial_status', ['paid', 'pending'])
        .gte('created_at_shopify', '2025-12-01T00:00:00Z')
        .order('created_at_shopify', { ascending: false })
        .limit(3000);

      if (ordersError) throw ordersError;

      // Batch load ALL line_items in a single query instead of 500 individual queries
      const orderIds = ordersData?.map(o => o.shopify_order_id) || [];
      
      const { data: allLineItems } = await supabase
        .from('shopify_order_line_items')
        .select('shopify_order_id, id, title, variant_title, sku, quantity, price, total_discount')
        .in('shopify_order_id', orderIds);

      // Group line_items by order using a Map for O(1) lookups
      const lineItemsByOrder = new Map<number, any[]>();
      for (const item of allLineItems || []) {
        const existing = lineItemsByOrder.get(item.shopify_order_id) || [];
        existing.push(item);
        lineItemsByOrder.set(item.shopify_order_id, existing);
      }

      // Build ordersWithItems without additional queries
      const ordersWithItems: ShopifyOrderForInvoice[] = (ordersData || []).map(order => ({
        ...order,
        total_discounts: order.total_discounts || 0,
        line_items: (lineItemsByOrder.get(order.shopify_order_id) || []).map(item => ({
          ...item,
          total_discount: item.total_discount || 0
        }))
      }));

      setOrders(ordersWithItems);
      
      // Clean up selectedOrders: keep only IDs that exist in loaded orders, are not stamped, and don't have an invoice number
      const validOrderIds = new Set(
        ordersWithItems.filter(o => !o.alegra_stamped && !o.alegra_invoice_number).map(o => o.id)
      );
      setSelectedOrders(prev => {
        const cleaned = new Set([...prev].filter(id => validOrderIds.has(id)));
        return cleaned;
      });
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
    // Only use orders from the current page, excluding stamped or already invoiced
    const selectablePageOrders = paginatedOrders.filter(o => !o.alegra_stamped && !o.alegra_invoice_number);
    const currentPageIds = new Set(selectablePageOrders.map(o => o.id));
    
    // Check if all selectable orders on current page are selected
    const allPageSelected = selectablePageOrders.length > 0 && selectablePageOrders.every(o => selectedOrders.has(o.id));
    
    if (allPageSelected) {
      // Deselect only current page orders
      setSelectedOrders(prev => {
        const newSet = new Set(prev);
        for (const id of currentPageIds) {
          newSet.delete(id);
        }
        return newSet;
      });
    } else {
      // Select only current page orders (add to existing selection)
      setSelectedOrders(prev => {
        const newSet = new Set(prev);
        for (const id of currentPageIds) {
          newSet.add(id);
        }
        return newSet;
      });
    }
  };

  const getFilteredOrders = useMemo(() => {
    let filtered = orders;
    
    // Filter by status
    if (filterStatus === 'pending') {
      // Pending = no stamped AND no invoice number
      filtered = filtered.filter(o => !o.alegra_stamped && !o.alegra_invoice_number);
    } else if (filterStatus === 'stamped') {
      // Stamped = has invoice number OR is stamped
      filtered = filtered.filter(o => o.alegra_stamped || o.alegra_invoice_number);
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
  }, [orders, filterStatus, searchTerm]);

  // Compute valid selected count - only count orders that exist, are not stamped, and don't have an invoice number
  const validSelectedCount = useMemo(() => {
    const validOrderIds = new Set(orders.filter(o => !o.alegra_stamped && !o.alegra_invoice_number).map(o => o.id));
    return [...selectedOrders].filter(id => validOrderIds.has(id)).length;
  }, [selectedOrders, orders]);

  // Pagination calculations
  const totalPages = Math.ceil(getFilteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return getFilteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [getFilteredOrders, currentPage]);

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

  // Search for existing invoice - now accepts order for client-based fallback search
  const searchInvoiceByOrderNumber = async (orderNumber: string, order?: ShopifyOrderForInvoice) => {
    console.log(`🔍 Buscando factura existente para orden ${orderNumber}...`);
    
    // Method 1: Search by "Pedido Shopify #X" in observations (our format)
    const { data, error } = await supabase.functions.invoke('alegra-api', {
      body: { 
        action: 'search-invoices', 
        data: { orderNumber }
      }
    });

    if (!error && data?.success && data.data?.length > 0) {
      const invoices = data.data;
      console.log(`📋 Encontradas ${invoices.length} facturas por observations para orden ${orderNumber}`);
      
      // Sort: prefer unstamped (drafts) first, then oldest first within same status
      const sorted = invoices.sort((a: any, b: any) => {
        const aStamped = !!a.stamp?.cufe;
        const bStamped = !!b.stamp?.cufe;
        if (!aStamped && bStamped) return -1;
        if (aStamped && !bStamped) return 1;
        const aDate = new Date(a.date || a.createdAt || 0).getTime();
        const bDate = new Date(b.date || b.createdAt || 0).getTime();
        return aDate - bDate;
      });
      
      const selected = sorted[0];
      console.log(`✅ Seleccionada factura ${selected.numberTemplate?.fullNumber || selected.id} (CUFE: ${selected.stamp?.cufe ? 'Sí' : 'No'})`);
      return selected;
    }
    
    console.log(`❌ No se encontró factura por observations, intentando búsqueda por cliente...`);
    
    // Method 2: Search by client identification + amount (for Shopify-created invoices)
    if (order) {
      const addressForId = order.billing_address || order.shipping_address || {};
      const identificationNumber = (addressForId.company || '').replace(/[^0-9]/g, '');
      const email = order.customer_email || order.email;
      
      if (identificationNumber || email) {
        const { data: clientData, error: clientError } = await supabase.functions.invoke('alegra-api', {
          body: { 
            action: 'search-invoices-by-client', 
            data: { 
              identificationNumber,
              email,
              totalAmount: order.total_price,
              dateRange: 60 // Search last 60 days
            }
          }
        });
        
        if (!clientError && clientData?.success && clientData.data?.length > 0) {
          const invoices = clientData.data;
          console.log(`📋 Encontradas ${invoices.length} facturas por cliente para orden ${orderNumber}`);
          
          // Sort: prefer unstamped first
          const sorted = invoices.sort((a: any, b: any) => {
            const aStamped = !!a.stamp?.cufe;
            const bStamped = !!b.stamp?.cufe;
            if (!aStamped && bStamped) return -1;
            if (aStamped && !bStamped) return 1;
            const aDate = new Date(a.date || a.createdAt || 0).getTime();
            const bDate = new Date(b.date || b.createdAt || 0).getTime();
            return aDate - bDate;
          });
          
          const selected = sorted[0];
          console.log(`✅ Factura encontrada por cliente: ${selected.numberTemplate?.fullNumber || selected.id} (CUFE: ${selected.stamp?.cufe ? 'Sí' : 'No'})`);
          return selected;
        }
      }
    }
    
    console.log(`❌ No se encontró factura para orden ${orderNumber}`);
    return null;
  };

  // Obtener detalles completos de una factura en Alegra
  const getInvoiceDetails = async (invoiceId: number): Promise<any> => {
    const { data, error } = await supabase.functions.invoke('alegra-api', {
      body: { action: 'get-invoice', data: { invoiceId } }
    });

    if (error || !data?.success) {
      console.error('Error getting invoice details:', error || data?.error);
      return null;
    }

    return data.data;
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
    
    // Get identification from company field (cedula) - this is where Colombian stores put the ID number
    const addressForId = order.billing_address || order.shipping_address || {};
    const identificationFromCompany = (addressForId.company || '').replace(/[^0-9]/g, '');
    
    // Use company field (cedula) as primary, then phone as fallback, then email-derived
    const identificationNumber = identificationFromCompany || 
                                  customerPhone?.replace(/[^0-9]/g, '') || 
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
    
    // Use company (cedula) as primary identification, then phone, then fallback
    const finalIdentificationNumber = identificationFromCompany || 
                                       customerPhone?.replace(/[^0-9]/g, '') ||
                                       customerEmail?.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15) ||
                                       `CLI${Date.now()}`;
    
    console.log('Creating new contact:', customerName, 'with identification:', finalIdentificationNumber, '(from company:', identificationFromCompany || 'N/A', ')');
    
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
    // Load Alegra catalog for auto-matching
    const alegraItems = await loadAlegraFullCatalog();
    
    // Fetch product mappings for this organization
    const { data: mappings } = await supabase
      .from('alegra_product_mapping')
      .select('*');
    
    const missingItems: Array<{ title: string; variant: string | null; sku: string | null }> = [];
    
    // Build items - ALL items MUST have an Alegra catalog ID
    // Shopify prices include IVA (taxes_included: true), so divide by 1.19 and add tax: [{ id: 3 }] (19% IVA)
    const items: Array<{ id: string; price: number; quantity: number; tax: Array<{ id: number }> }> = [];
    
    // Calcular el factor de descuento proporcional basado en descuentos a nivel de orden
    // subtotal_price ya tiene los descuentos aplicados, así que lo usamos para calcular el factor
    const itemsTotalOriginal = order.line_items.reduce(
      (sum, item) => sum + (Number(item.price) * item.quantity), 0
    );
    const discountFactor = itemsTotalOriginal > 0 
      ? Number(order.subtotal_price) / itemsTotalOriginal 
      : 1;
    
    console.log(`📊 Cálculo de descuento: Original=$${itemsTotalOriginal}, Subtotal=$${order.subtotal_price}, Factor=${discountFactor.toFixed(4)}`);
    
    for (const item of order.line_items) {
      const productTitle = item.title;
      const variantTitle = item.variant_title || null;
      const sku = item.sku || null;
      
      // Priority 1: Match by SKU (most reliable)
      let mapping = sku ? mappings?.find(m => m.shopify_sku === sku) : null;
      
      // Priority 2: Match by exact product+variant
      if (!mapping) {
        mapping = mappings?.find(m => 
          m.shopify_product_title === productTitle && 
          (m.shopify_variant_title === variantTitle || (!m.shopify_variant_title && !variantTitle))
        );
      }
      
      // Priority 3: Match by product title only (no variant)
      if (!mapping) {
        mapping = mappings?.find(m => 
          m.shopify_product_title === productTitle && !m.shopify_variant_title
        );
      }
      
      // Priority 4: AUTO-MATCH by name similarity
      let alegraItemId = mapping?.alegra_item_id;
      if (!alegraItemId && alegraItems.length > 0) {
        const autoMatch = await autoMatchProduct(productTitle, variantTitle, sku, alegraItems);
        if (autoMatch) {
          alegraItemId = autoMatch.alegraItemId;
        }
      }
      
      if (alegraItemId) {
        // 1. Precio original del item
        let precioFinal = Number(item.price);
        
        // 2. Aplicar descuento específico del line item (si existe)
        const itemDiscount = item.total_discount || 0;
        if (itemDiscount > 0) {
          precioFinal = precioFinal - (itemDiscount / item.quantity);
        }
        
        // 3. Aplicar factor de descuento proporcional de la orden
        precioFinal = precioFinal * discountFactor;
        
        // 4. Dividir por 1.19 para obtener precio sin IVA
        const precioSinIva = Math.round(precioFinal / 1.19);
        
        console.log(`🔗 Mapeo: "${productTitle}" → Alegra ID ${alegraItemId} (original: $${item.price}, con descuento: $${precioFinal.toFixed(0)}, sin IVA: $${precioSinIva})`);
        items.push({
          id: alegraItemId,
          price: precioSinIva,
          quantity: item.quantity,
          tax: [{ id: 3 }], // IVA 19% en Alegra Colombia
        });
      } else {
        // No mapping found - track missing item
        missingItems.push({ title: productTitle, variant: variantTitle, sku });
      }
    }

    // Add shipping as separate item
    const shippingCost = order.total_price - order.subtotal_price;
    if (shippingCost > 0) {
      // Look for shipping mapping by SKU 'ENVIO' or title 'Envío'
      let shippingMapping = mappings?.find(m => 
        m.shopify_sku === 'ENVIO' || 
        m.shopify_product_title?.toLowerCase() === 'envío' ||
        m.shopify_product_title?.toLowerCase() === 'envio'
      );
      
      // Auto-match shipping if no mapping exists
      let shippingItemId = shippingMapping?.alegra_item_id;
      if (!shippingItemId && alegraItems.length > 0) {
        const autoMatch = await autoMatchProduct('Envío', null, 'ENVIO', alegraItems);
        if (autoMatch) {
          shippingItemId = autoMatch.alegraItemId;
        }
      }
      
      if (shippingItemId) {
        // Shipping does NOT have tax - use full price without IVA calculation
        const shippingPrice = Math.round(Number(shippingCost));
        console.log(`🔗 Mapeo de envío: Alegra ID ${shippingItemId} (sin impuesto: ${shippingPrice})`);
        items.push({
          id: shippingItemId,
          price: shippingPrice,
          quantity: 1,
          tax: [], // Sin impuesto
        });
      } else {
        missingItems.push({ title: 'Envío', variant: null, sku: 'ENVIO' });
      }
    }
    
    // Block if any items are missing mapping
    if (missingItems.length > 0) {
      const missingList = missingItems.map(m => 
        `• ${m.title}${m.variant ? ` - ${m.variant}` : ''}${m.sku ? ` (SKU: ${m.sku})` : ''}`
      ).join('\n');
      
      throw new Error(`No se encontró en Alegra ${missingItems.length} producto(s):\n${missingList}\n\nCréalos en Alegra o mapéalos manualmente.`);
    }
    
    console.log(`📦 Creando factura para orden ${order.order_number} con ${items.length} items mapeados`);

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
            paymentForm: 'CASH',
            // Numeración 2025 y 2026 (ID 21) - vigente hasta 2027-10-29
            numberTemplate: { id: '21' }
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

    // Normalize response: ensure always returns an array
    const result = data.data;
    if (Array.isArray(result)) {
      return result;
    } else if (result && typeof result === 'object') {
      return [result]; // Wrap single object in array
    }
    return [];
  };

  // Handler to open invoice details modal
  const handleOrderClick = (order: ShopifyOrderForInvoice) => {
    setSelectedOrderForDetails(order);
    setDetailsModalOpen(true);
  };

  // Handler to save edited data locally
  const handleSaveDetails = (editedData: EditedInvoiceData) => {
    if (!selectedOrderForDetails) return;
    
    setEditedOrders(prev => {
      const newMap = new Map(prev);
      newMap.set(selectedOrderForDetails.id, editedData);
      return newMap;
    });
    
    // Do NOT auto-select - user must manually check the order they want to emit
    setDetailsModalOpen(false);
    toast.success('Cambios guardados.');
  };

  // Handler to save and emit immediately
  const handleSaveAndEmit = async (editedData: EditedInvoiceData) => {
    if (!selectedOrderForDetails) return;
    
    // Save to edited orders
    setEditedOrders(prev => {
      const newMap = new Map(prev);
      newMap.set(selectedOrderForDetails.id, editedData);
      return newMap;
    });
    
    // Process single order with edited data
    await processSingleOrder(selectedOrderForDetails, editedData);
    setDetailsModalOpen(false);
  };

  // Process a single order with optional edited data
  const processSingleOrder = async (order: ShopifyOrderForInvoice, editedData?: EditedInvoiceData) => {
    setIsProcessing(true);
    setResults(new Map());
    
    updateResult(order.id, { orderNumber: order.order_number, status: 'searching_contact' });
    
    try {
      // 1. Verificar solo en tabla local si ya tiene CUFE (ya emitida)
      const { data: localRecord } = await supabase
        .from('alegra_invoices')
        .select('*')
        .eq('shopify_order_id', order.shopify_order_id)
        .eq('stamped', true)
        .not('cufe', 'is', null)
        .maybeSingle();
      
      if (localRecord && localRecord.cufe) {
        console.log(`⚠️ Factura ya registrada para orden ${order.order_number}:`, localRecord.alegra_invoice_number);
        updateResult(order.id, { 
          status: 'already_stamped',
          invoiceId: localRecord.alegra_invoice_id,
          invoiceNumber: localRecord.alegra_invoice_number || undefined,
          cufe: localRecord.cufe
        });
        await addFacturadoTag(order.shopify_order_id);
        toast.info('Esta factura ya fue emitida');
        setIsProcessing(false);
        return;
      }
      
      // Check legacy fields as fallback
      if (order.alegra_stamped && order.alegra_cufe) {
        updateResult(order.id, { 
          status: 'already_stamped',
          invoiceId: order.alegra_invoice_id || undefined,
          invoiceNumber: order.alegra_invoice_number || undefined,
          cufe: order.alegra_cufe
        });
        await addFacturadoTag(order.shopify_order_id);
        toast.info('Esta factura ya fue emitida');
        setIsProcessing(false);
        return;
      }

      // 2. Crear contacto
      updateResult(order.id, { status: 'searching_contact' });
      const contact = await searchOrCreateContactWithData(order, editedData);
      
      if (contact.isNew) {
        updateResult(order.id, { status: 'creating_contact' });
      }

      // 3. Crear factura
      updateResult(order.id, { status: 'creating_invoice' });
      const invoice = await createInvoiceWithData(order, contact.id, editedData);
      
      // Registrar factura creada (antes de stamp)
      await registerInvoice(order, invoice, false);
      
      // Update DB with invoice ID
      await updateOrderAlegraStatus(order.id, invoice.id, invoice.numberTemplate?.fullNumber || String(invoice.id), false);

      // 4. Emitir con DIAN
      updateResult(order.id, { status: 'stamping' });
      
      if (editedData) {
        await updateContactAddress(contact.id, editedData.address);
      }
      
      const stampResult = await stampInvoices([invoice.id]);
      
      if (stampResult && stampResult.length > 0) {
        const stampedInvoice = stampResult[0];
        const cufe = stampedInvoice.stamp?.cufe;
        const invoiceNumber = stampedInvoice.numberTemplate?.fullNumber || String(stampedInvoice.id);
        
        // Actualizar registro con CUFE
        await registerInvoice(order, stampedInvoice, true, cufe);
        
        await updateOrderAlegraStatus(order.id, stampedInvoice.id, invoiceNumber, true, cufe);
        
        // Update local state
        const orderIndex = orders.findIndex(o => o.id === order.id);
        if (orderIndex >= 0) {
          orders[orderIndex].alegra_stamped = true;
          orders[orderIndex].alegra_cufe = cufe;
          orders[orderIndex].alegra_invoice_number = invoiceNumber;
        }
        
        updateResult(order.id, { 
          status: 'success',
          invoiceId: stampedInvoice.id,
          invoiceNumber,
          cufe
        });
        
        // Add FACTURADO tag
        console.log(`🏷️ Agregando etiqueta FACTURADO a orden ${order.order_number}`);
        await addFacturadoTag(order.shopify_order_id);
        
        // Registrar pago automáticamente si el pedido está pagado
        if (order.financial_status === 'paid') {
          try {
            console.log(`💰 Registrando pago para factura ${invoiceNumber}`);
            const { data: paymentResult, error: paymentError } = await supabase.functions.invoke('alegra-api', {
              body: {
                action: 'create-payment',
                data: {
                  payment: {
                    invoiceId: stampedInvoice.id,
                    amount: order.total_price,
                    paymentMethod: 'transfer',
                    observations: `Pago pedido Shopify #${order.order_number}`
                  }
                }
              }
            });
            
            if (paymentError || !paymentResult?.success) {
              console.error('⚠️ Error registrando pago:', paymentError || paymentResult?.error);
            } else {
              console.log(`✅ Pago registrado en Alegra para factura ${invoiceNumber}`);
            }
          } catch (paymentErr) {
            console.error('⚠️ Error al registrar pago:', paymentErr);
          }
        }
        
        toast.success(`Factura ${invoiceNumber} emitida exitosamente`);
        fetchShopifyOrders();
      } else {
        console.error('⚠️ stampInvoices no devolvió resultados para factura', invoice.id);
        throw new Error('No se recibió confirmación de emisión DIAN');
      }
    } catch (error: any) {
      updateResult(order.id, { status: 'error', error: error.message });
      toast.error(`Error: ${error.message}`);
    }
    
    setIsProcessing(false);
  };

  // Create contact using edited data if available
  const searchOrCreateContactWithData = async (order: ShopifyOrderForInvoice, editedData?: EditedInvoiceData) => {
    if (!editedData) {
      return searchOrCreateContact(order);
    }

    const customerName = `${editedData.customer.firstName} ${editedData.customer.lastName}`.trim();
    const identificationNumber = editedData.customer.identificationNumber;

    // Search for existing contact
    const { data: searchResult } = await supabase.functions.invoke('alegra-api', {
      body: { action: 'get-contacts' }
    });

    if (searchResult?.success && searchResult.data) {
      // Search by identification number
      if (identificationNumber) {
        const contactByIdentification = searchResult.data.find((c: any) => {
          const contactId = c.identificationNumber || c.identification || c.identificationObject?.number || '';
          return String(contactId).replace(/\D/g, '') === identificationNumber.replace(/\D/g, '');
        });
        if (contactByIdentification) {
          await updateContactAddress(String(contactByIdentification.id), editedData.address);
          return { id: contactByIdentification.id, isNew: false, name: contactByIdentification.name };
        }
      }
    }

    // Create new contact with edited data
    const { data: createResult, error } = await supabase.functions.invoke('alegra-api', {
      body: {
        action: 'create-contact',
        data: {
          contact: {
            name: customerName,
            identification: {
              type: editedData.customer.identificationType,
              number: String(identificationNumber).slice(0, 20),
            },
            identificationType: editedData.customer.identificationType,
            identificationNumber: String(identificationNumber).slice(0, 20),
            email: editedData.customer.email || undefined,
            phonePrimary: editedData.customer.phone,
            address: {
              address: editedData.address.address,
              city: editedData.address.city,
              department: editedData.address.department,
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

  // Update contact address
  const updateContactAddress = async (contactId: string, address: EditedInvoiceData['address']) => {
    const { data, error } = await supabase.functions.invoke('alegra-api', {
      body: {
        action: 'update-contact',
        data: {
          contactId,
          patch: {
            address: {
              address: address.address,
              city: address.city,
              department: address.department,
              country: 'Colombia',
            },
          },
        },
      },
    });

    if (error || !data?.success) {
      throw new Error(data?.error || error?.message || 'No se pudo actualizar la dirección');
    }
  };

  // Create invoice using edited data if available
  const createInvoiceWithData = async (order: ShopifyOrderForInvoice, contactId: string, editedData?: EditedInvoiceData) => {
    // Load Alegra catalog for auto-matching
    const alegraItems = await loadAlegraFullCatalog();
    
    // Si hay datos editados, usamos el precio editado directamente (ya contiene el descuento aplicado)
    // Si no, usamos los line_items originales con el cálculo de descuento proporcional
    const useEditedData = !!editedData?.lineItems;
    const sourceItems = editedData?.lineItems || order.line_items;
    
    // Fetch product mappings for this organization
    const { data: mappings } = await supabase
      .from('alegra_product_mapping')
      .select('*');
    
    const missingItems: Array<{ title: string; variant: string | null; sku: string | null }> = [];
    
    // Build items - ALL items MUST have an Alegra catalog ID
    const items: Array<{ id: string; price: number; quantity: number; tax: Array<{ id: number }> }> = [];
    
    // Calcular factor de descuento solo si usamos datos originales (no editados)
    let discountFactor = 1;
    if (!useEditedData) {
      const itemsTotalOriginal = order.line_items.reduce(
        (sum, item) => sum + (Number(item.price) * item.quantity), 0
      );
      discountFactor = itemsTotalOriginal > 0 
        ? Number(order.subtotal_price) / itemsTotalOriginal 
        : 1;
      console.log(`📊 Cálculo de descuento: Original=$${itemsTotalOriginal}, Subtotal=$${order.subtotal_price}, Factor=${discountFactor.toFixed(4)}`);
    }
    
    for (const item of sourceItems) {
      // Check if it's an edited item (has 'title') or Shopify line item
      const isEditedItem = 'title' in item && !('variant_title' in item);
      const productTitle = item.title;
      const variantTitle = isEditedItem ? null : (item as any).variant_title || null;
      const sku = (item as any).sku || null;
      
      // Skip shipping items - handled separately below
      if ((item as any).isShipping === true || 
          productTitle?.toLowerCase() === 'envío' || 
          productTitle?.toLowerCase() === 'envio') {
        continue;
      }
      
      // Priority 1: Match by SKU (most reliable)
      let mapping = sku ? mappings?.find(m => m.shopify_sku === sku) : null;
      
      // Priority 2: Match by exact product+variant
      if (!mapping) {
        mapping = mappings?.find(m => 
          m.shopify_product_title === productTitle && 
          (m.shopify_variant_title === variantTitle || (!m.shopify_variant_title && !variantTitle))
        );
      }
      
      // Priority 3: Match by product title only (no variant)
      if (!mapping) {
        mapping = mappings?.find(m => 
          m.shopify_product_title === productTitle && !m.shopify_variant_title
        );
      }
      
      // Priority 4: AUTO-MATCH by name similarity
      let alegraItemId = mapping?.alegra_item_id;
      if (!alegraItemId && alegraItems.length > 0) {
        const autoMatch = await autoMatchProduct(productTitle, variantTitle, sku, alegraItems);
        if (autoMatch) {
          alegraItemId = autoMatch.alegraItemId;
        }
      }
      
      if (alegraItemId) {
        let precioFinal = Number(item.price);
        
        if (!useEditedData) {
          // Datos originales: aplicar descuento de línea y factor proporcional
          const itemDiscount = (item as any).total_discount || 0;
          if (itemDiscount > 0) {
            precioFinal = precioFinal - (itemDiscount / item.quantity);
          }
          precioFinal = precioFinal * discountFactor;
        }
        // Si son datos editados, el precio ya viene correcto del modal
        
        // Dividir por 1.19 para obtener precio sin IVA
        const precioSinIva = Math.round(precioFinal / 1.19);
        
        console.log(`🔗 Mapeo: "${productTitle}" → Alegra ID ${alegraItemId} (precio final: $${precioFinal.toFixed(0)}, sin IVA: $${precioSinIva})`);
        items.push({
          id: alegraItemId,
          price: precioSinIva,
          quantity: item.quantity,
          tax: [{ id: 3 }], // IVA 19% en Alegra Colombia
        });
      } else {
        // No mapping found - track missing item
        missingItems.push({ title: productTitle, variant: variantTitle, sku });
      }
    }

    // Check if shipping already exists in edited items
    const hasShippingItem = sourceItems.some((item: any) => 
      item.isShipping === true || 
      item.title?.toLowerCase() === 'envío' || 
      item.title?.toLowerCase() === 'envio'
    );

    // Add shipping only if not already present and there's a shipping cost
    const shippingCost = order.total_price - order.subtotal_price;
    if (shippingCost > 0 && !hasShippingItem) {
      // Look for shipping mapping by SKU 'ENVIO' or title 'Envío'
      let shippingMapping = mappings?.find(m => 
        m.shopify_sku === 'ENVIO' || 
        m.shopify_product_title?.toLowerCase() === 'envío' ||
        m.shopify_product_title?.toLowerCase() === 'envio'
      );
      
      // Auto-match shipping if no mapping exists
      let shippingItemId = shippingMapping?.alegra_item_id;
      if (!shippingItemId && alegraItems.length > 0) {
        const autoMatch = await autoMatchProduct('Envío', null, 'ENVIO', alegraItems);
        if (autoMatch) {
          shippingItemId = autoMatch.alegraItemId;
        }
      }
      
      if (shippingItemId) {
        // Shipping does NOT have tax - use full price without IVA calculation
        const shippingPrice = Math.round(Number(shippingCost));
        console.log(`🔗 Mapeo de envío: Alegra ID ${shippingItemId} (sin impuesto: ${shippingPrice})`);
        items.push({
          id: shippingItemId,
          price: shippingPrice,
          quantity: 1,
          tax: [], // Sin impuesto
        });
      } else {
        missingItems.push({ title: 'Envío', variant: null, sku: 'ENVIO' });
      }
    }
    
    // Block if any items are missing mapping
    if (missingItems.length > 0) {
      const missingList = missingItems.map(m => 
        `• ${m.title}${m.variant ? ` - ${m.variant}` : ''}${m.sku ? ` (SKU: ${m.sku})` : ''}`
      ).join('\n');
      
      throw new Error(`No se encontró en Alegra ${missingItems.length} producto(s):\n${missingList}\n\nCréalos en Alegra o mapéalos manualmente.`);
    }
    
    console.log(`📦 Creando factura (editada) para orden ${order.order_number} con ${items.length} items mapeados`);

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
            paymentForm: 'CASH',
            numberTemplate: { id: '21' }
          }
        }
      }
    });

    if (error || !data?.success) {
      throw new Error(data?.error || 'Error al crear factura');
    }

    return data.data;
  };

  const processInvoices = async (orderIdsToProcess?: string[]) => {
    const idsToProcess = orderIdsToProcess || Array.from(selectedOrders);
    if (idsToProcess.length === 0) return;
    
    setIsProcessing(true);
    setResults(new Map());

    const invoicesToStamp: { orderId: string; invoiceId: number; orderNumber: string; order: ShopifyOrderForInvoice }[] = [];

    // 1. Verificar y crear facturas para cada orden
    for (const orderId of idsToProcess) {
      const order = orders.find(o => o.id === orderId);
      if (!order) continue;

      updateResult(orderId, { orderNumber: order.order_number, status: 'searching_contact' });
      
      try {
        // Verificar solo en tabla local si ya tiene CUFE
        const { data: localRecord } = await supabase
          .from('alegra_invoices')
          .select('*')
          .eq('shopify_order_id', order.shopify_order_id)
          .eq('stamped', true)
          .not('cufe', 'is', null)
          .maybeSingle();
        
        if (localRecord && localRecord.cufe) {
          console.log(`⚠️ Factura ya registrada para orden ${order.order_number}`);
          updateResult(orderId, { 
            status: 'already_stamped',
            invoiceId: localRecord.alegra_invoice_id,
            invoiceNumber: localRecord.alegra_invoice_number || undefined,
            cufe: localRecord.cufe
          });
          await addFacturadoTag(order.shopify_order_id);
          continue;
        }
        
        // Fallback: check legacy fields
        if (order.alegra_stamped && order.alegra_cufe) {
          updateResult(orderId, { 
            status: 'already_stamped',
            invoiceId: order.alegra_invoice_id || undefined,
            invoiceNumber: order.alegra_invoice_number || undefined,
            cufe: order.alegra_cufe
          });
          await addFacturadoTag(order.shopify_order_id);
          continue;
        }

        // 2. Crear contacto
        updateResult(orderId, { status: 'searching_contact' });
        const contact = await searchOrCreateContact(order);
        
        if (contact.isNew) {
          updateResult(orderId, { status: 'creating_contact' });
        }

        // 3. Crear factura con todos los datos correctos
        updateResult(orderId, { status: 'creating_invoice' });
        const invoice = await createInvoice(order, contact.id);
        
        // Registrar factura creada
        await registerInvoice(order, invoice, false);
        
        await updateOrderAlegraStatus(orderId, invoice.id, invoice.numberTemplate?.fullNumber || String(invoice.id), false);
        invoicesToStamp.push({ orderId, invoiceId: invoice.id, orderNumber: order.order_number, order });
        
        // Agregar etiqueta FACTURADO inmediatamente después de crear la factura
        console.log(`🏷️ Agregando etiqueta FACTURADO a orden ${order.order_number} (factura creada)`);
        await addFacturadoTag(order.shopify_order_id);
        
        // Deseleccionar orden inmediatamente ya que tiene factura creada
        setSelectedOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });

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
        batch.forEach(item => {
          updateResult(item.orderId, { status: 'stamping' });
        });

        try {
          // Ensure client addresses before stamping
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

          if (Array.isArray(stampResult)) {
            for (const stampedInvoice of stampResult) {
              const matchingItem = batch.find(b => b.invoiceId === stampedInvoice.id);
              if (matchingItem) {
                const cufe = stampedInvoice.stamp?.cufe;
                const invoiceNumber = stampedInvoice.numberTemplate?.fullNumber || String(stampedInvoice.id);
                
                // Actualizar registro con CUFE
                await registerInvoice(matchingItem.order, stampedInvoice, true, cufe);
                
                await updateOrderAlegraStatus(matchingItem.orderId, stampedInvoice.id, invoiceNumber, true, cufe);
                
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
                
                // Deseleccionar orden después de éxito completo
                setSelectedOrders(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(matchingItem.orderId);
                  return newSet;
                });
                
                await addFacturadoTag(matchingItem.order.shopify_order_id);
                
                // Registrar pago automáticamente si el pedido está pagado
                if (matchingItem.order.financial_status === 'paid') {
                  try {
                    console.log(`💰 Registrando pago para factura ${invoiceNumber}`);
                    const { data: paymentResult, error: paymentError } = await supabase.functions.invoke('alegra-api', {
                      body: {
                        action: 'create-payment',
                        data: {
                          payment: {
                            invoiceId: stampedInvoice.id,
                            amount: matchingItem.order.total_price,
                            paymentMethod: 'transfer',
                            observations: `Pago pedido Shopify #${matchingItem.order.order_number}`
                          }
                        }
                      }
                    });
                    
                    if (paymentError || !paymentResult?.success) {
                      console.error('⚠️ Error registrando pago:', paymentError || paymentResult?.error);
                    } else {
                      console.log(`✅ Pago registrado en Alegra para factura ${invoiceNumber}`);
                    }
                  } catch (paymentErr) {
                    console.error('⚠️ Error al registrar pago:', paymentErr);
                    // No bloquear el proceso, solo advertir
                  }
                }
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
      fetchShopifyOrders();
    }
  };

  // Validate all selected orders before emitting
  const validateSelectedOrders = async () => {
    // Build valid selection: only IDs that exist in orders, are not stamped, and don't have an invoice number
    const validOrderIds = new Set(orders.filter(o => !o.alegra_stamped && !o.alegra_invoice_number).map(o => o.id));
    const validSelection = [...selectedOrders].filter(id => validOrderIds.has(id));
    
    if (validSelection.length === 0) {
      toast.info('No hay órdenes válidas seleccionadas');
      return;
    }
    
    setIsValidating(true);
    const results: BulkValidationResult[] = [];
    
    for (const orderId of validSelection) {
      const order = orders.find(o => o.id === orderId);
      if (!order) continue;
      
      // Already stamped or has invoice number = skip validation with error
      if (order.alegra_stamped || order.alegra_invoice_number) {
        results.push({
          orderId,
          orderNumber: order.order_number,
          customerName: `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || 'Sin nombre',
          total: order.total_price,
          validationResult: {
            valid: false,
            errors: ['Ya tiene factura emitida en DIAN'],
            warnings: [],
            checks: {
              clientCheck: { passed: true, message: 'N/A' },
              priceCheck: { passed: true, invoiceTotal: order.total_price, shopifyTotal: order.total_price, message: 'N/A' },
              paymentCheck: { passed: true, message: 'N/A' },
            }
          }
        });
        continue;
      }
      
      // Use edited data if available
      const editedData = editedOrders.get(orderId);
      
      try {
        // Convert order to validation format - include subtotal_price for accurate price validation
        const orderForValidation = {
          id: order.id,
          shopify_order_id: order.shopify_order_id,
          order_number: order.order_number,
          customer_phone: order.customer_phone,
          customer_email: order.customer_email,
          billing_address: order.billing_address,
          shipping_address: order.shipping_address,
          total_price: order.total_price,
          subtotal_price: order.subtotal_price,
          total_tax: order.total_tax,
          financial_status: order.financial_status,
          tags: order.tags,
          line_items: order.line_items,
        };
        
        // Convert edited data to validation format if exists
        const editedDataForValidation = editedData ? {
          customer: {
            identificationNumber: editedData.customer.identificationNumber,
            phone: editedData.customer.phone,
            email: editedData.customer.email,
          },
          lineItems: editedData.lineItems,
        } : undefined;
        
        const validationResult = await validateOrderForInvoice(orderForValidation, editedDataForValidation);
        
        results.push({
          orderId,
          orderNumber: order.order_number,
          customerName: `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || 'Sin nombre',
          total: order.total_price,
          validationResult
        });
      } catch (error: any) {
        results.push({
          orderId,
          orderNumber: order.order_number,
          customerName: `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || 'Sin nombre',
          total: order.total_price,
          validationResult: {
            valid: false,
            errors: ['Error al validar: ' + error.message],
            warnings: [],
            checks: {
              clientCheck: { passed: false, message: 'Error de validación' },
              priceCheck: { passed: false, invoiceTotal: 0, shopifyTotal: order.total_price, message: 'Error' },
              paymentCheck: { passed: false, message: 'Error' },
            }
          }
        });
      }
    }
    
    setValidationResults(results);
    setIsValidating(false);
    
    // Auto-emit if single valid order with no errors (UX improvement)
    const validResults = results.filter(r => r.validationResult.valid);
    const hasErrors = results.some(r => !r.validationResult.valid);
    
    if (validResults.length === 1 && !hasErrors && selectedOrders.size === 1) {
      // Single valid order - emit directly without showing modal
      console.log(`🚀 Auto-emitiendo factura única válida: ${validResults[0].orderNumber}`);
      await processInvoices([validResults[0].orderId]);
      return;
    }
    
    // Multiple orders or has errors/warnings - show modal for confirmation
    setShowValidationModal(true);
  };
  
  // Handle manual delivery confirmation change - re-validate order with new confirmation status
  const handleManualDeliveryChange = async (orderId: string, confirmed: boolean) => {
    // Update the map
    setManualDeliveryConfirmations(prev => {
      const newMap = new Map(prev);
      if (confirmed) {
        newMap.set(orderId, true);
      } else {
        newMap.delete(orderId);
      }
      return newMap;
    });
    
    // Find order and re-validate with the new confirmation status
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    const editedData = editedOrders.get(orderId);
    
    try {
      const orderForValidation = {
        id: order.id,
        shopify_order_id: order.shopify_order_id,
        order_number: order.order_number,
        customer_phone: order.customer_phone,
        customer_email: order.customer_email,
        billing_address: order.billing_address,
        shipping_address: order.shipping_address,
        total_price: order.total_price,
        subtotal_price: order.subtotal_price,
        total_tax: order.total_tax,
        financial_status: order.financial_status,
        tags: order.tags,
        line_items: order.line_items,
      };
      
      const editedDataForValidation = editedData ? {
        customer: {
          identificationNumber: editedData.customer.identificationNumber,
          phone: editedData.customer.phone,
          email: editedData.customer.email,
        },
        lineItems: editedData.lineItems,
      } : undefined;
      
      const validationResult = await validateOrderForInvoice(orderForValidation, editedDataForValidation, confirmed);
      
      // Update the specific result in validationResults
      setValidationResults(prev => prev.map(r => 
        r.orderId === orderId 
          ? { ...r, validationResult }
          : r
      ));
    } catch (error: any) {
      console.error('Error re-validating order:', error);
    }
  };
  
  // Emit only the valid orders after validation (includes manual confirmations)
  const emitValidOrders = async () => {
    // Filter valid orders - consider manual confirmations
    const validOrderIds = validationResults
      .filter(r => {
        // If already valid, include it
        if (r.validationResult.valid) return true;
        
        // Check if the only error is delivery-related and manual confirmation is provided
        const hasManualConfirmation = manualDeliveryConfirmations.get(r.orderId);
        if (!hasManualConfirmation) return false;
        
        // Check if delivery error is the only blocking issue
        const deliveryCheck = r.validationResult.checks.deliveryCheck;
        const isDeliveryOnlyError = deliveryCheck && !deliveryCheck.passed &&
          r.validationResult.errors.every(e => 
            e.includes('contraentrega') || e.includes('guía') || e.includes('entrega')
          );
        
        return isDeliveryOnlyError;
      })
      .map(r => r.orderId);
    
    if (validOrderIds.length === 0) {
      toast.error('No hay facturas válidas para emitir');
      return;
    }
    
    setShowValidationModal(false);
    await processInvoices(validOrderIds);
  };

  const pendingCount = orders.filter(o => !o.alegra_stamped && !o.alegra_invoice_number).length;
  const stampedCount = orders.filter(o => o.alegra_stamped || o.alegra_invoice_number).length;

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
            checked={(() => {
              const selectablePageOrders = paginatedOrders.filter(o => !o.alegra_stamped && !o.alegra_invoice_number);
              return selectablePageOrders.length > 0 && selectablePageOrders.every(o => selectedOrders.has(o.id));
            })()}
            onCheckedChange={toggleAll}
          />
          <span className="text-sm text-muted-foreground">
            {validSelectedCount} seleccionados (pág. {currentPage}/{totalPages})
          </span>
          <span className="text-xs text-muted-foreground border-l pl-3">
            Desde 1 dic 2025
          </span>
          <Button variant="ghost" size="sm" onClick={fetchShopifyOrders} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={async () => {
              setIsSyncing(true);
              const synced = await syncPendingInvoices();
              if (synced > 0) {
                await fetchShopifyOrders();
              }
              setIsSyncing(false);
            }} 
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar CUFE'}
          </Button>
        </div>
        
        <Button 
          onClick={validateSelectedOrders} 
          disabled={validSelectedCount === 0 || isProcessing || isValidating}
        >
          {isValidating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Validando...
            </>
          ) : isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Emitiendo...
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Validar y Emitir {validSelectedCount} Facturas
            </>
          )}
        </Button>
      </div>

      {/* Orders List */}
      {getFilteredOrders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No hay pedidos</p>
          <p className="text-sm">Los pedidos pagados y contra entrega de Shopify aparecerán aquí.</p>
        </div>
      ) : (
        <>
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {paginatedOrders.map(order => {
                const result = results.get(order.id);
                const customerName = `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim();
                // Consider an order as "invoiced" if it has a stamped flag OR if it already has an invoice number
                const hasExistingInvoice = !!order.alegra_invoice_number;
                const isStamped = order.alegra_stamped || hasExistingInvoice || result?.status === 'success' || result?.status === 'already_stamped';
                const cufe = result?.cufe || order.alegra_cufe;
                const invoiceNumber = result?.invoiceNumber || order.alegra_invoice_number;
                const currentStatus = result?.status || (isStamped ? 'already_stamped' : 'idle');
                const pendingCufe = hasExistingInvoice && !order.alegra_cufe && !order.alegra_stamped;
                const statusInfo = statusLabels[currentStatus];
                
                return (
                  <Card 
                    key={order.id}
                    className={`transition-colors ${
                      selectedOrders.has(order.id) ? 'border-primary bg-primary/5' : ''
                    } ${isStamped ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : ''}`}
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
                              <button
                                onClick={() => handleOrderClick(order)}
                                className="font-medium hover:text-primary hover:underline cursor-pointer"
                              >
                                #{order.order_number}
                              </button>
                              <Badge variant="outline" className={order.financial_status === 'paid' ? 'text-green-600' : 'text-amber-600'}>
                                {order.financial_status === 'paid' ? 'Pagado' : 'Contra entrega'}
                              </Badge>
                              {isStamped && order.alegra_cufe && (
                                <Badge className="bg-green-600">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  DIAN
                                </Badge>
                              )}
                              {pendingCufe && (
                                <Badge className="bg-amber-500">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pendiente CUFE
                                </Badge>
                              )}
                              {editedOrders.has(order.id) && !isStamped && (
                                <Badge variant="secondary" className="text-xs">
                                  Editado
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOrderClick(order)}
                                className="h-7 px-2"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Ver
                              </Button>
                              <span className="font-bold text-lg">
                                ${order.total_price?.toLocaleString('es-CO')} {order.currency}
                              </span>
                            </div>
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
                              {/* Discrepancies for invoice_mismatch status */}
                              {result?.status === 'invoice_mismatch' && result.discrepancies && (
                                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800">
                                  <div className="text-amber-700 dark:text-amber-400 text-xs font-medium mb-1">
                                    Diferencias encontradas:
                                  </div>
                                  <ul className="text-xs text-amber-600 dark:text-amber-500 space-y-1">
                                    {result.discrepancies.map((d, idx) => (
                                      <li key={idx}>• {d.message}</li>
                                    ))}
                                  </ul>
                                  <div className="mt-2 text-xs text-muted-foreground">
                                    Edite los datos del pedido para corregir o contacte a soporte.
                                  </div>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 space-y-2">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {generatePageNumbers(currentPage, totalPages).map((page, i) => (
                    <PaginationItem key={i}>
                      {page === '...' ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink 
                          isActive={currentPage === page}
                          onClick={() => setCurrentPage(page as number)}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
              
              <p className="text-sm text-muted-foreground text-center">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, getFilteredOrders.length)} de {getFilteredOrders.length} pedidos
              </p>
            </div>
          )}
        </>
      )}

      {/* Invoice Details Modal */}
      <InvoiceDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        order={selectedOrderForDetails}
        onSave={handleSaveDetails}
        onSaveAndEmit={handleSaveAndEmit}
      />
      
      {/* Bulk Validation Results Modal */}
      <BulkValidationResultsModal
        open={showValidationModal}
        onOpenChange={setShowValidationModal}
        results={validationResults}
        isEmitting={isProcessing}
        onEmitValid={emitValidOrders}
        manualDeliveryConfirmations={manualDeliveryConfirmations}
        onManualDeliveryChange={handleManualDeliveryChange}
      />
    </div>
  );
};

export default BulkInvoiceCreator;
