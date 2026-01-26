import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders } from '../_shared/cors.ts'

// ============= ALEGRA API CONFIGURATION =============
const ALEGRA_API_URL = 'https://api.alegra.com/api/v1'

function getAlegraAuthHeader(): string {
  const email = Deno.env.get('ALEGRA_USER_EMAIL')
  const token = Deno.env.get('ALEGRA_API_TOKEN')
  if (!email || !token) {
    throw new Error('Credenciales de Alegra no configuradas')
  }
  return `Basic ${btoa(`${email}:${token}`)}`
}

// ============= HELPER FUNCTIONS =============
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function normalizeWhitespace(input: unknown): string {
  return String(input ?? '').trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ')
}

function normalizeDigits(input: unknown): string {
  return String(input ?? '').replace(/\D/g, '')
}

function normalizeCOPhone(input: unknown): string {
  const digits = normalizeDigits(input)
  if (!digits) return ''
  if (digits.startsWith('57') && digits.length > 10) return digits.slice(-10)
  return digits.length > 10 ? digits.slice(-10) : digits
}

// ============= ALEGRA CITY NORMALIZATIONS FOR DIAN (fallback estático) =============
const ALEGRA_CITY_NORMALIZATIONS: Record<string, { city: string; department: string }> = {
  'bogota': { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' },
  'bogotá': { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' },
  'bogota dc': { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' },
  'bogota d.c.': { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' },
  'bogotá dc': { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' },
  'bogotá d.c.': { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' },
  'medellin': { city: 'Medellín', department: 'Antioquia' },
  'medellín': { city: 'Medellín', department: 'Antioquia' },
  'cali': { city: 'Cali', department: 'Valle del Cauca' },
  'barranquilla': { city: 'Barranquilla', department: 'Atlántico' },
  'cartagena': { city: 'Cartagena de Indias', department: 'Bolívar' },
  'bucaramanga': { city: 'Bucaramanga', department: 'Santander' },
  'soacha': { city: 'Soacha', department: 'Cundinamarca' },
  'chia': { city: 'Chía', department: 'Cundinamarca' },
  'chía': { city: 'Chía', department: 'Cundinamarca' },
}

// ============= NUEVA FUNCIÓN: Normalización de ciudad desde shipping_coverage =============
async function normalizeAlegraCityFromDB(
  supabase: any,
  organizationId: string,
  cityName: string,
  provinceName: string
): Promise<{ city: string; department: string }> {
  const normalizedCity = cityName?.toLowerCase().trim()
  
  if (!normalizedCity) {
    console.log('⚠️ Ciudad vacía, usando Bogotá por defecto')
    return { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' }
  }
  
  // 1. Buscar en shipping_coverage (tiene 1,100+ municipios colombianos)
  try {
    const { data: match } = await supabase
      .from('shipping_coverage')
      .select('municipality, department')
      .eq('organization_id', organizationId)
      .ilike('municipality', normalizedCity)
      .limit(1)
      .maybeSingle()

    if (match) {
      console.log(`📍 Ciudad normalizada desde DB: ${cityName} → ${match.municipality}, ${match.department}`)
      return { city: match.municipality, department: match.department }
    }
  } catch (e: any) {
    console.warn(`⚠️ Error consultando shipping_coverage: ${e.message}`)
  }

  // 2. Usar provincia de Shopify como departamento (si disponible y no es Bogotá)
  if (provinceName && !provinceName.toLowerCase().includes('bogot')) {
    console.log(`📍 Usando provincia de Shopify: ${cityName}, ${provinceName}`)
    return { city: cityName, department: provinceName }
  }

  // 3. Fallback a diccionario estático
  const cityKey = normalizedCity
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,]/g, '').trim()
  
  const staticMatch = ALEGRA_CITY_NORMALIZATIONS[cityKey]
  if (staticMatch) {
    console.log(`📍 Ciudad encontrada en diccionario estático: ${cityName} → ${staticMatch.city}`)
    return staticMatch
  }

  // 4. Bogotá fallback
  if (/\bbogot[aá]\b/i.test(normalizedCity)) {
    return { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' }
  }

  console.log(`⚠️ Ciudad no encontrada, usando como está: ${cityName}`)
  return { city: cityName, department: provinceName || 'Bogotá D.C.' }
}

function normalizeIdentificationType(type: unknown): string {
  const t = String(type || '').toUpperCase().trim()
  const validTypes = ['RC', 'TI', 'CC', 'TE', 'CE', 'NIT', 'PP', 'PEP', 'DIE', 'NUIP', 'FOREIGN_NIT']
  if (validTypes.includes(t)) return t
  if (t === 'CEDULA' || t === 'CÉDULA') return 'CC'
  if (t === 'PASAPORTE') return 'PP'
  return 'CC'
}

// ============= ALEGRA API REQUESTS =============
async function makeAlegraRequest(endpoint: string, method = 'GET', body?: any, maxRetries = 3) {
  const url = `${ALEGRA_API_URL}${endpoint}`
  let lastError: any = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[Alegra] ${method} ${endpoint} (intento ${attempt}/${maxRetries})`)

    try {
      const options: RequestInit = {
        method,
        headers: {
          Authorization: getAlegraAuthHeader(),
          'Content-Type': 'application/json',
        },
      }

      if (body && method !== 'GET') {
        options.body = JSON.stringify(body)
      }

      const response = await fetch(url, options)
      let data: any
      try {
        data = await response.json()
      } catch {
        data = await response.text()
      }

      // Retry on transient errors
      if ([429, 502, 503, 504].includes(response.status) && attempt < maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000)
        console.warn(`[Alegra] ${response.status} transitorio. Reintentando en ${delayMs}ms...`)
        await sleep(delayMs)
        continue
      }

      if (!response.ok) {
        const errorMessage = (data as any)?.message || 
          (data as any)?.error?.[0]?.message || 
          `Error ${response.status} from Alegra API`
        const err = new Error(errorMessage)
        ;(err as any).status = response.status
        ;(err as any).alegra = data
        throw err
      }

      return data
    } catch (fetchError: any) {
      lastError = fetchError
      if (fetchError.status) throw fetchError
      if (attempt < maxRetries) {
        await sleep(1000 * attempt)
        continue
      }
      throw fetchError
    }
  }

  throw lastError || new Error('Error desconocido en Alegra API')
}

// ============= CONTACT MANAGEMENT =============
async function findContactInAlegra(params: { phone?: string; identification?: string; email?: string }) {
  const phone = normalizeCOPhone(params.phone)
  const identification = normalizeDigits(params.identification)
  const email = normalizeWhitespace(params.email).toLowerCase()

  console.log('findContactInAlegra - Buscando:', { email, identification, phone })

  // 1. Search by email
  if (email) {
    try {
      const byEmail = await makeAlegraRequest(`/contacts?type=client&query=${encodeURIComponent(email)}&start=0&limit=10`)
      if (Array.isArray(byEmail) && byEmail.length > 0) {
        const match = byEmail.find((c: any) => normalizeWhitespace(c.email).toLowerCase() === email)
        if (match) {
          console.log('findContactInAlegra - Encontrado por email:', match.id)
          return { found: true, matchedBy: 'email', contact: match }
        }
      }
    } catch (e: any) {
      console.error('Error buscando por email:', e.message)
    }
  }

  // 2. Search by identification
  if (identification) {
    try {
      const byId = await makeAlegraRequest(`/contacts?type=client&identification=${encodeURIComponent(identification)}&start=0&limit=10`)
      if (Array.isArray(byId) && byId.length > 0) {
        console.log('findContactInAlegra - Encontrado por identificación:', byId[0].id)
        return { found: true, matchedBy: 'identification', contact: byId[0] }
      }
    } catch (e: any) {
      console.error('Error buscando por identificación:', e.message)
    }
  }

  // 3. Search by phone
  if (phone) {
    try {
      const byPhone = await makeAlegraRequest(`/contacts?type=client&query=${encodeURIComponent(phone)}&start=0&limit=10`)
      if (Array.isArray(byPhone) && byPhone.length > 0) {
        const match = byPhone.find((c: any) => {
          const p1 = normalizeCOPhone(c.phonePrimary)
          const p2 = normalizeCOPhone(c.mobile)
          return (p1 && p1 === phone) || (p2 && p2 === phone)
        })
        if (match) {
          console.log('findContactInAlegra - Encontrado por teléfono:', match.id)
          return { found: true, matchedBy: 'phone', contact: match }
        }
      }
    } catch (e: any) {
      console.error('Error buscando por teléfono:', e.message)
    }
  }

  return { found: false, matchedBy: 'created', contact: null }
}

async function createContact(orderData: any, supabase: any, organizationId: string): Promise<any> {
  const billingAddress = orderData.billing_address || orderData.shipping_address || {}
  const shippingAddress = orderData.shipping_address || orderData.billing_address || {}
  
  // Get identification from company field (priority) or phone
  const identification = normalizeDigits(
    billingAddress.company || shippingAddress.company || orderData.customer_phone || Date.now()
  )
  
  const fullName = normalizeWhitespace(
    `${orderData.customer_first_name || ''} ${orderData.customer_last_name || ''}`.trim() || 
    billingAddress.name || 
    shippingAddress.name || 
    'Cliente Shopify'
  )
  
  const nameParts = fullName.split(' ').filter(Boolean)
  const firstName = nameParts[0] || 'Cliente'
  const lastName = nameParts.slice(1).join(' ') || 'Sin Apellido'
  
  // NUEVA: Normalización de ciudad desde shipping_coverage
  const cityName = shippingAddress.city || billingAddress.city || ''
  const provinceName = shippingAddress.province || billingAddress.province || ''
  const addressNormalized = await normalizeAlegraCityFromDB(supabase, organizationId, cityName, provinceName)
  
  const contactPayload = {
    name: fullName,
    nameObject: { firstName, lastName },
    email: orderData.customer_email || orderData.email || undefined,
    phonePrimary: normalizeCOPhone(orderData.customer_phone || billingAddress.phone || shippingAddress.phone),
    mobile: normalizeCOPhone(shippingAddress.phone || billingAddress.phone),
    address: {
      address: shippingAddress.address1 || billingAddress.address1 || 'Sin dirección',
      city: addressNormalized.city,
      department: addressNormalized.department,
      country: 'Colombia',
    },
    // Formato plano (requerido para creación)
    identificationType: 'CC',
    identificationNumber: String(identification).slice(0, 20),
    identification: String(identification).slice(0, 20),
    // Formato objeto (por compatibilidad)
    identificationObject: {
      type: 'CC',
      number: String(identification).slice(0, 20),
    },
    kindOfPerson: 'PERSON_ENTITY',
    type: ['client'],
  }

  console.log('Creando contacto:', JSON.stringify(contactPayload, null, 2))
  
  try {
    return await makeAlegraRequest('/contacts', 'POST', contactPayload)
  } catch (e: any) {
    // If contact already exists, fetch it
    if (e.alegra?.code === 2006 && e.alegra?.contactId) {
      console.log('Contacto ya existe, obteniendo:', e.alegra.contactId)
      return await makeAlegraRequest(`/contacts/${e.alegra.contactId}`)
    }
    throw e
  }
}

// ============= INVOICE CREATION =============
async function createInvoice(
  orderData: any, 
  lineItems: any[], 
  contactId: string, 
  mappings: any[],
  alegraItems: any[]
): Promise<any> {
  const items: any[] = []
  const missingItems: string[] = []

  // Helper to find best match by name similarity
  const findBestMatch = (title: string) => {
    const titleLower = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    for (const item of alegraItems) {
      const nameLower = item.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (nameLower.includes(titleLower) || titleLower.includes(nameLower)) {
        return item
      }
    }
    return null
  }

  for (const item of lineItems) {
    const productTitle = item.title
    const variantTitle = item.variant_title || null
    const sku = item.sku || null
    const quantity = item.quantity || 1
    const price = parseFloat(item.price) || 0
    const totalDiscount = parseFloat(item.total_discount) || 0

    // Skip if zero quantity
    if (quantity <= 0) continue

    // Find Alegra mapping
    let mapping = sku ? mappings.find(m => m.shopify_sku === sku) : null
    if (!mapping) {
      mapping = mappings.find(m => 
        m.shopify_product_title === productTitle && 
        (m.shopify_variant_title === variantTitle || (!m.shopify_variant_title && !variantTitle))
      )
    }
    if (!mapping) {
      mapping = mappings.find(m => m.shopify_product_title === productTitle && !m.shopify_variant_title)
    }

    let alegraItemId = mapping?.alegra_item_id

    // Auto-match if no mapping found
    if (!alegraItemId && alegraItems.length > 0) {
      const fullTitle = variantTitle ? `${productTitle} ${variantTitle}` : productTitle
      const match = findBestMatch(fullTitle)
      if (match) {
        alegraItemId = match.id
        console.log(`🔍 Auto-match: "${fullTitle}" → "${match.name}"`)
      }
    }

    if (alegraItemId) {
      const precioOriginal = price * quantity
      const itemDiscount = totalDiscount
      const precioFinal = precioOriginal - itemDiscount
      const discountPercentage = precioOriginal > 0 && itemDiscount > 0
        ? Math.round((1 - (precioFinal / precioOriginal)) * 100 * 100) / 100
        : 0
      const precioOriginalSinIva = Math.round(price / 1.19)

      items.push({
        id: alegraItemId,
        price: precioOriginalSinIva,
        quantity,
        discount: discountPercentage,
        tax: [{ id: 3 }], // IVA 19%
      })
    } else {
      missingItems.push(`${productTitle}${variantTitle ? ` - ${variantTitle}` : ''}`)
    }
  }

  // Add shipping as separate item
  const shippingLines = orderData.raw_data?.shipping_lines || []
  const shippingCost = shippingLines.reduce((sum: number, line: any) => sum + (parseFloat(line.price) || 0), 0)
  
  if (shippingCost > 0) {
    let shippingMapping = mappings.find(m => 
      m.shopify_sku === 'ENVIO' || 
      m.shopify_product_title?.toLowerCase() === 'envío' ||
      m.shopify_product_title?.toLowerCase() === 'envio'
    )
    
    let shippingItemId = shippingMapping?.alegra_item_id
    if (!shippingItemId) {
      const match = findBestMatch('Envío')
      if (match) shippingItemId = match.id
    }

    if (shippingItemId) {
      items.push({
        id: shippingItemId,
        price: Math.round(shippingCost),
        quantity: 1,
        tax: [], // Sin impuesto
      })
    } else {
      missingItems.push('Envío')
    }
  }

  // If any items are missing, throw error with tag
  if (missingItems.length > 0) {
    const error = new Error(`Productos sin mapeo: ${missingItems.join(', ')}`)
    ;(error as any).missingProducts = true
    throw error
  }

  if (items.length === 0) {
    throw new Error('No hay items válidos para facturar')
  }

  const today = new Date().toISOString().split('T')[0]
  
  const invoicePayload = {
    client: contactId,
    date: today,
    dueDate: today,
    items,
    observations: `Pedido Shopify #${orderData.order_number}`,
    status: 'open',
    paymentMethod: 'CASH',
    paymentForm: 'CASH',
    numberTemplate: { id: '21' }, // Numeración 2025-2026
  }

  console.log('Creando factura:', JSON.stringify(invoicePayload, null, 2))
  return await makeAlegraRequest('/invoices', 'POST', invoicePayload)
}

async function stampInvoice(invoiceId: number): Promise<any> {
  console.log(`Emitiendo factura ${invoiceId} con DIAN...`)
  const stampResult = await makeAlegraRequest('/invoices/stamp', 'POST', { ids: [invoiceId] })
  
  // Fetch full invoice to get CUFE
  await sleep(2000) // Wait for DIAN processing
  const fullInvoice = await makeAlegraRequest(`/invoices/${invoiceId}`)
  
  return {
    ...fullInvoice,
    _stampSuccess: true,
  }
}

async function registerPayment(invoiceId: number, amount: number, orderNumber: string): Promise<void> {
  try {
    const paymentPayload = {
      date: new Date().toISOString().split('T')[0],
      type: 'in',
      bankAccount: 1,
      paymentMethod: 'transfer',
      invoices: [{ id: invoiceId, amount }],
      observations: `Pago pedido Shopify #${orderNumber}`,
    }
    
    console.log('Registrando pago:', JSON.stringify(paymentPayload, null, 2))
    await makeAlegraRequest('/payments', 'POST', paymentPayload)
    console.log(`✅ Pago registrado para factura ${invoiceId}`)
  } catch (e: any) {
    console.error('⚠️ Error registrando pago:', e.message)
    // Don't throw - payment failure shouldn't stop the process
  }
}

// ============= SHOPIFY TAG UPDATE =============
async function addFacturadoTag(shopifyOrderId: number, shopDomain: string): Promise<void> {
  const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')
  if (!shopifyAccessToken) {
    console.warn('⚠️ SHOPIFY_ACCESS_TOKEN no configurado')
    return
  }

  try {
    // Get current tags
    const getResponse = await fetch(
      `https://${shopDomain}/admin/api/2024-01/orders/${shopifyOrderId}.json`,
      {
        headers: { 'X-Shopify-Access-Token': shopifyAccessToken },
      }
    )
    
    if (!getResponse.ok) {
      console.error('Error obteniendo orden de Shopify:', getResponse.status)
      return
    }
    
    const orderData = await getResponse.json()
    const currentTags = (orderData.order?.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean)
    
    // Check if FACTURADO already exists
    if (currentTags.some((t: string) => t.toUpperCase() === 'FACTURADO')) {
      console.log('🏷️ Tag FACTURADO ya existe')
      return
    }
    
    // Add FACTURADO tag
    const newTags = [...currentTags, 'FACTURADO'].join(', ')
    
    const updateResponse = await fetch(
      `https://${shopDomain}/admin/api/2024-01/orders/${shopifyOrderId}.json`,
      {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': shopifyAccessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order: { tags: newTags } }),
      }
    )
    
    if (updateResponse.ok) {
      console.log(`✅ Tag FACTURADO agregado a orden ${shopifyOrderId}`)
    } else {
      console.error('Error agregando tag FACTURADO:', updateResponse.status)
    }
  } catch (e: any) {
    console.error('Error en addFacturadoTag:', e.message)
  }
}

async function addErrorTag(shopifyOrderId: number, shopDomain: string, errorMessage: string): Promise<void> {
  const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')
  if (!shopifyAccessToken) return

  try {
    const getResponse = await fetch(
      `https://${shopDomain}/admin/api/2024-01/orders/${shopifyOrderId}.json`,
      { headers: { 'X-Shopify-Access-Token': shopifyAccessToken } }
    )
    
    if (!getResponse.ok) return
    
    const orderData = await getResponse.json()
    const currentTags = (orderData.order?.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean)
    
    // Add error tag if not exists
    if (!currentTags.some((t: string) => t.toUpperCase() === 'AUTO_INVOICE_FAILED')) {
      const newTags = [...currentTags, 'AUTO_INVOICE_FAILED'].join(', ')
      
      await fetch(
        `https://${shopDomain}/admin/api/2024-01/orders/${shopifyOrderId}.json`,
        {
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': shopifyAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ order: { tags: newTags } }),
        }
      )
      console.log(`⚠️ Tag AUTO_INVOICE_FAILED agregado a orden ${shopifyOrderId}`)
    }
  } catch (e: any) {
    console.error('Error agregando tag de error:', e.message)
  }
}

// ============= BATCH PROCESSING: Find pending orders =============
async function findPendingOrders(supabase: any): Promise<Array<{shopify_order_id: number, organization_id: string, order_number: string}>> {
  // Buscar pedidos pendientes de facturación (últimos 7 días)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  
  const { data, error } = await supabase
    .from('shopify_orders')
    .select('shopify_order_id, organization_id, order_number, tags, source_name')
    .eq('financial_status', 'paid')
    .is('alegra_invoice_id', null)
    .is('alegra_stamped', null)
    .neq('source_name', 'pos')  // Excluir POS
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: true })  // Más antiguo primero
    .limit(10)  // Máximo 10 por ejecución para evitar timeouts
  
  if (error) {
    console.error('Error buscando pedidos pendientes:', error.message)
    return []
  }
  
  // Filtrar por tags (contraentrega, facturado, auto_invoice_failed)
  const filtered = (data || []).filter(order => {
    const tags = (order.tags || '').toLowerCase()
    return !tags.includes('contraentrega') 
        && !tags.includes('facturado')
        && !tags.includes('auto_invoice_failed')
  })
  
  return filtered.map(o => ({
    shopify_order_id: o.shopify_order_id,
    organization_id: o.organization_id,
    order_number: o.order_number
  }))
}

// ============= MAIN PROCESS (single order) =============
async function processAutoInvoice(
  shopifyOrderId: number,
  organizationId: string,
  supabase: any
): Promise<{ success: boolean; invoiceId?: number; cufe?: string; error?: string }> {
  console.log(`\n🧾 ========== AUTO-INVOICE para pedido ${shopifyOrderId} ==========`)

  try {
    // 1. Load order data
    const { data: orderData, error: orderError } = await supabase
      .from('shopify_orders')
      .select('*')
      .eq('shopify_order_id', shopifyOrderId)
      .eq('organization_id', organizationId)
      .single()

    if (orderError || !orderData) {
      throw new Error(`No se encontró el pedido ${shopifyOrderId}: ${orderError?.message}`)
    }

    console.log(`📦 Pedido: ${orderData.order_number} - Total: $${orderData.total_price}`)

    // 2. Get organization for shop domain
    const { data: orgData } = await supabase
      .from('organizations')
      .select('shopify_store_url')
      .eq('id', organizationId)
      .single()

    const shopDomain = orgData?.shopify_store_url?.replace('https://', '') || ''

    // 3. Double-check eligibility
    const tags = (orderData.tags || '').toLowerCase()
    
    if (orderData.financial_status !== 'paid') {
      console.log('⏭️ Pedido no está pagado, saltando')
      return { success: false, error: 'Pedido no pagado' }
    }
    
    // CAMBIO: Ahora solo excluimos POS (antes excluíamos todo lo que no fuera 'web')
    if (orderData.source_name === 'pos') {
      console.log(`⏭️ Pedido es POS, saltando`)
      return { success: false, error: 'Pedido POS' }
    }
    
    if (tags.includes('contraentrega')) {
      console.log('⏭️ Pedido es contraentrega, saltando')
      return { success: false, error: 'Pedido contraentrega' }
    }
    
    if (tags.includes('facturado')) {
      console.log('⏭️ Pedido ya tiene tag FACTURADO, saltando')
      return { success: false, error: 'Ya facturado' }
    }
    
    if (orderData.alegra_stamped || orderData.alegra_invoice_id) {
      console.log('⏭️ Pedido ya tiene factura Alegra, saltando')
      return { success: false, error: 'Ya tiene factura' }
    }

    // 4. Load line items
    const { data: lineItems } = await supabase
      .from('shopify_order_line_items')
      .select('*')
      .eq('shopify_order_id', shopifyOrderId)

    if (!lineItems || lineItems.length === 0) {
      throw new Error('No hay items en el pedido')
    }

    console.log(`📋 ${lineItems.length} items en el pedido`)

    // 5. Search or create contact
    console.log('👤 Buscando contacto en Alegra...')
    
    const billingAddress = orderData.billing_address || orderData.shipping_address || {}
    const shippingAddress = orderData.shipping_address || orderData.billing_address || {}
    
    const searchResult = await findContactInAlegra({
      email: orderData.customer_email || orderData.email,
      identification: billingAddress.company || shippingAddress.company,
      phone: orderData.customer_phone || billingAddress.phone || shippingAddress.phone,
    })

    let contact: any
    if (searchResult.found) {
      contact = searchResult.contact
      console.log(`✅ Contacto encontrado: ${contact.name} (ID: ${contact.id})`)
    } else {
      console.log('➕ Creando nuevo contacto...')
      // CAMBIO: Pasar supabase y organizationId para normalización de ciudad desde DB
      contact = await createContact(orderData, supabase, organizationId)
      console.log(`✅ Contacto creado: ${contact.name} (ID: ${contact.id})`)
    }

    // 6. Load product mappings
    const { data: mappings } = await supabase
      .from('alegra_product_mapping')
      .select('*')
      .eq('organization_id', organizationId)

    // 7. Load Alegra catalog for auto-matching
    console.log('📦 Cargando catálogo de Alegra para auto-match...')
    let alegraItems: any[] = []
    try {
      const catalogResult = await makeAlegraRequest('/items?start=0&limit=100')
      alegraItems = Array.isArray(catalogResult) ? catalogResult : []
      console.log(`📦 ${alegraItems.length} productos en catálogo Alegra`)
    } catch (e) {
      console.warn('⚠️ No se pudo cargar catálogo Alegra, usando solo mappings')
    }

    // 8. Create invoice
    console.log('🧾 Creando factura en Alegra...')
    const invoice = await createInvoice(orderData, lineItems, contact.id, mappings || [], alegraItems)
    console.log(`✅ Factura creada: ID ${invoice.id}`)

    // 9. Register invoice in alegra_invoices
    await supabase.from('alegra_invoices').upsert({
      organization_id: organizationId,
      shopify_order_id: shopifyOrderId,
      shopify_order_number: orderData.order_number,
      alegra_invoice_id: invoice.id,
      alegra_invoice_number: invoice.numberTemplate?.fullNumber || String(invoice.id),
      stamped: false,
      cufe: null,
    }, { onConflict: 'organization_id,shopify_order_id,alegra_invoice_id' })

    // 10. Stamp with DIAN
    console.log('📡 Emitiendo con DIAN...')
    let stampedInvoice: any
    let cufe: string | undefined
    let invoiceNumber: string
    
    try {
      stampedInvoice = await stampInvoice(invoice.id)
      cufe = stampedInvoice.stamp?.cufe
      invoiceNumber = stampedInvoice.numberTemplate?.fullNumber || String(invoice.id)
      console.log(`✅ Factura emitida: ${invoiceNumber}`)
      if (cufe) {
        console.log(`✅ CUFE: ${cufe.substring(0, 30)}...`)
      }
    } catch (stampError: any) {
      // CAMBIO: Si el stamp falla, guardar factura sin emitir (no duplicar)
      console.error(`❌ Error emitiendo factura ${invoice.id}:`, stampError.message)
      
      // Guardar factura como "pendiente de emisión" (no emitida)
      invoiceNumber = invoice.numberTemplate?.fullNumber || String(invoice.id)
      await supabase.from('shopify_orders').update({
        alegra_invoice_id: invoice.id,
        alegra_invoice_number: invoiceNumber,
        alegra_stamped: false,  // No emitida
      }).eq('shopify_order_id', shopifyOrderId)
        .eq('organization_id', organizationId)
      
      // Marcar en alegra_invoices como no emitida
      await supabase.from('alegra_invoices').update({
        stamped: false,
      }).eq('organization_id', organizationId)
        .eq('shopify_order_id', shopifyOrderId)
        .eq('alegra_invoice_id', invoice.id)
      
      // NO agregar tag de error ni lanzar excepción (la factura existe, solo falta emitirla)
      console.log(`⚠️ Factura ${invoiceNumber} creada pero pendiente de emisión DIAN`)
      
      return {
        success: false,
        invoiceId: invoice.id,
        error: `DIAN rechazó: ${stampError.message}`,
      }
    }

    // 11. Update alegra_invoices with CUFE
    await supabase.from('alegra_invoices').update({
      stamped: true,
      cufe: cufe || null,
      stamped_at: new Date().toISOString(),
    }).eq('organization_id', organizationId)
      .eq('shopify_order_id', shopifyOrderId)
      .eq('alegra_invoice_id', invoice.id)

    // 12. Update shopify_orders
    await supabase.from('shopify_orders').update({
      alegra_invoice_id: invoice.id,
      alegra_invoice_number: invoiceNumber,
      alegra_stamped: true,
      alegra_cufe: cufe || null,
      alegra_synced_at: new Date().toISOString(),
    }).eq('shopify_order_id', shopifyOrderId)
      .eq('organization_id', organizationId)

    // 13. Register payment (since order is paid)
    await registerPayment(invoice.id, orderData.total_price, orderData.order_number)

    // 14. Add FACTURADO tag to Shopify
    if (shopDomain) {
      await addFacturadoTag(shopifyOrderId, shopDomain)
      
      // Update local tags
      const currentTags = (orderData.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean)
      if (!currentTags.some((t: string) => t.toUpperCase() === 'FACTURADO')) {
        const newTags = [...currentTags, 'FACTURADO'].join(', ')
        await supabase.from('shopify_orders').update({ tags: newTags })
          .eq('shopify_order_id', shopifyOrderId)
          .eq('organization_id', organizationId)
      }
    }

    console.log(`🎉 ========== FACTURACIÓN AUTOMÁTICA COMPLETADA ==========\n`)

    return {
      success: true,
      invoiceId: invoice.id,
      cufe: cufe || undefined,
    }
  } catch (processError: any) {
    console.error(`❌ Error procesando pedido ${shopifyOrderId}:`, processError.message)
    throw processError
  }
}

// ============= HTTP HANDLER (soporta batch y single) =============
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Variables de entorno de Supabase no configuradas' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body = await req.json().catch(() => ({}))
    
    // ============= MODO 1: Pedido específico (para reintento manual) =============
    if (body.shopifyOrderId && body.organizationId) {
      console.log(`🧾 Auto-invoice request (single): order=${body.shopifyOrderId}, org=${body.organizationId}`)
      
      // Get shop domain for error tagging
      const { data: orgData } = await supabase
        .from('organizations')
        .select('shopify_store_url')
        .eq('id', body.organizationId)
        .single()
      const shopDomain = orgData?.shopify_store_url?.replace('https://', '') || ''

      try {
        const result = await processAutoInvoice(body.shopifyOrderId, body.organizationId, supabase)

        // Log to sync_control_logs
        await supabase.from('sync_control_logs').insert({
          sync_type: 'auto_invoice',
          sync_mode: 'manual',
          status: result.success ? 'completed' : 'skipped',
          execution_details: {
            shopify_order_id: body.shopifyOrderId,
            organization_id: body.organizationId,
            invoice_id: result.invoiceId,
            cufe: result.cufe,
            error: result.error,
            timestamp: new Date().toISOString(),
          },
        })

        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (processError: any) {
        console.error('❌ Error en auto-invoice (single):', processError.message)

        // Add error tag to Shopify order
        if (shopDomain) {
          await addErrorTag(body.shopifyOrderId, shopDomain, processError.message)
        }

        // Log error
        await supabase.from('sync_control_logs').insert({
          sync_type: 'auto_invoice',
          sync_mode: 'manual',
          status: 'error',
          error_message: processError.message,
          execution_details: {
            shopify_order_id: body.shopifyOrderId,
            organization_id: body.organizationId,
            timestamp: new Date().toISOString(),
          },
        })

        return new Response(
          JSON.stringify({ success: false, error: processError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // ============= MODO 2: Batch automático (cron) =============
    console.log('🔄 Iniciando procesamiento batch de facturas...')
    const pendingOrders = await findPendingOrders(supabase)
    
    if (pendingOrders.length === 0) {
      console.log('✅ No hay pedidos pendientes de facturación')
      return new Response(
        JSON.stringify({ processed: 0, success: 0, failed: 0, message: 'No pending orders' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Encontrados ${pendingOrders.length} pedidos pendientes`)
    
    const results: Array<{ orderId: number; orderNumber: string; success: boolean; invoiceId?: number; error?: string }> = []
    
    for (const order of pendingOrders) {
      try {
        console.log(`\n🧾 Procesando pedido ${order.order_number} (${order.shopify_order_id})...`)
        const result = await processAutoInvoice(order.shopify_order_id, order.organization_id, supabase)
        results.push({ 
          orderId: order.shopify_order_id, 
          orderNumber: order.order_number,
          success: result.success,
          invoiceId: result.invoiceId,
          error: result.error 
        })
        
        // Log batch result
        await supabase.from('sync_control_logs').insert({
          sync_type: 'auto_invoice',
          sync_mode: 'batch',
          status: result.success ? 'completed' : (result.invoiceId ? 'partial' : 'skipped'),
          execution_details: {
            shopify_order_id: order.shopify_order_id,
            organization_id: order.organization_id,
            invoice_id: result.invoiceId,
            cufe: result.cufe,
            error: result.error,
            timestamp: new Date().toISOString(),
          },
        })
        
        // Esperar 2 segundos entre pedidos para no saturar Alegra
        await sleep(2000)
      } catch (err: any) {
        console.error(`❌ Error procesando ${order.order_number}:`, err.message)
        results.push({ 
          orderId: order.shopify_order_id, 
          orderNumber: order.order_number,
          success: false, 
          error: err.message 
        })
        
        // Get shop domain for error tag
        try {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('shopify_store_url')
            .eq('id', order.organization_id)
            .single()
          const shopDomain = orgData?.shopify_store_url?.replace('https://', '') || ''
          if (shopDomain) {
            await addErrorTag(order.shopify_order_id, shopDomain, err.message)
          }
        } catch {}
        
        // Log error
        await supabase.from('sync_control_logs').insert({
          sync_type: 'auto_invoice',
          sync_mode: 'batch',
          status: 'error',
          error_message: err.message,
          execution_details: {
            shopify_order_id: order.shopify_order_id,
            organization_id: order.organization_id,
            timestamp: new Date().toISOString(),
          },
        })
        
        // Continuar con siguiente pedido
        await sleep(2000)
      }
    }

    const summary = {
      processed: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    }
    
    console.log(`\n📊 Resumen batch: ${summary.success} exitosos, ${summary.failed} fallidos de ${summary.processed} procesados`)

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('❌ Error en handler:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
