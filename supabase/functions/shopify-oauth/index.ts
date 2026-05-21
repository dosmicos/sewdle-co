/**
 * shopify-oauth — Generic OAuth handler for any Shopify store
 *
 * Flow A (initiate): called by frontend button
 *   GET /shopify-oauth?shop={myshopify-domain}&state={storeId}
 *   → redirects to Shopify authorization page
 *
 * Flow B (callback): called by Shopify after merchant authorizes
 *   GET /shopify-oauth?code={code}&shop={shop}&state={storeId}&hmac=...
 *   → exchanges code for permanent token → saves to stores table → shows success
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CALLBACK_URL = 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/shopify-oauth'
const SHOPIFY_SCOPES = [
  'read_fulfillments', 'write_fulfillments',
  'read_inventory',    'write_inventory',
  'read_orders',       'write_orders',
  'read_products',     'write_products',
].join(',')

const IS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

serve(async (req) => {
  const url  = new URL(req.url)
  const code = url.searchParams.get('code')
  const shop = url.searchParams.get('shop')   // e.g. "bviks6-1y.myshopify.com"
  const state = url.searchParams.get('state') ?? ''

  // Support generic or store-specific credentials (backward compatible)
  const clientId     = Deno.env.get('SHOPIFY_CLIENT_ID')     || Deno.env.get('SHOPIFY_USA_CLIENT_ID')
  const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET') || Deno.env.get('SHOPIFY_USA_CLIENT_SECRET')

  console.log(`[shopify-oauth] shop=${shop} code=${code ? '✓' : '✗'} state=${state}`)

  if (!clientId || !clientSecret) {
    return html(500, errorHtml('Credenciales de OAuth no configuradas en el servidor. Contacta al administrador.'))
  }

  /* ── A: Initiate OAuth ──────────────────────────────────────── */
  if (shop && !code) {
    const authUrl =
      `https://${shop}/admin/oauth/authorize` +
      `?client_id=${clientId}` +
      `&scope=${encodeURIComponent(SHOPIFY_SCOPES)}` +
      `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}` +
      `&state=${encodeURIComponent(state)}`

    console.log(`[shopify-oauth] Redirecting to authorization: ${authUrl}`)
    return Response.redirect(authUrl, 302)
  }

  /* ── B: OAuth Callback ──────────────────────────────────────── */
  if (code && shop) {
    // 1. Exchange code → permanent access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      console.error(`[shopify-oauth] Token exchange failed ${tokenRes.status}: ${errText}`)
      return html(500, errorHtml(`Error al obtener el token de Shopify (${tokenRes.status}). ${errText}`))
    }

    const { access_token } = await tokenRes.json()
    if (!access_token) return html(500, errorHtml('Shopify no devolvió un token de acceso.'))

    console.log(`[shopify-oauth] ✅ Token obtained: ${access_token.substring(0, 10)}...`)

    // 2. Save token to stores table
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const credentials = { access_token, configured_at: new Date().toISOString() }
    const shopUrl     = `https://${shop}`
    let   storeName   = shop
    let   savedToDb   = false

    // Try by storeId UUID in state first (most reliable)
    if (IS_UUID.test(state)) {
      const { data: store } = await supabase
        .from('stores').select('id, name').eq('id', state).single()

      if (store) {
        storeName = store.name
        const { error } = await supabase
          .from('stores')
          .update({
            shopify_credentials: credentials,
            shopify_store_url:   shopUrl,  // also updates the real myshopify domain
            updated_at:          new Date().toISOString(),
          })
          .eq('id', store.id)

        savedToDb = !error
        if (error) console.error('[shopify-oauth] Update by id error:', error)
      }
    }

    // Fallback: look up by shopify_store_url
    if (!savedToDb) {
      const { data: stores } = await supabase
        .from('stores').select('id, name')
        .or(`shopify_store_url.eq.${shopUrl},shopify_store_url.eq.${shopUrl}/`)

      if (stores?.length) {
        storeName = stores[0].name
        const { error } = await supabase
          .from('stores')
          .update({ shopify_credentials: credentials, updated_at: new Date().toISOString() })
          .eq('id', stores[0].id)
        savedToDb = !error
        if (error) console.error('[shopify-oauth] Update by url error:', error)
      }
    }

    if (!savedToDb) {
      console.warn(`[shopify-oauth] No store found for shop=${shop} state=${state}`)
    }

    return html(200, savedToDb
      ? successHtml(storeName, shop)
      : warningHtml(shop, access_token.substring(0, 10))
    )
  }

  /* ── No valid params ────────────────────────────────────────── */
  return html(400, errorHtml('Parámetros faltantes. Esta URL debe ser llamada desde Shopify o desde el botón de Sewdle.'))
})

/* ── HTML helpers ──────────────────────────────────────────────── */

const STYLE = `
  <style>
    body{font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:20px;color:#1e293b}
    h1{font-size:1.4rem;margin-bottom:1.5rem}
    .box{border-radius:10px;padding:22px;margin-top:16px}
    .success{background:#d1fae5;border:1px solid #6ee7b7}
    .warning{background:#fef3c7;border:1px solid #fcd34d}
    .error  {background:#fee2e2;border:1px solid #fca5a5}
    h2{margin:0 0 10px}
    p{margin:6px 0;font-size:.95rem}
    code{background:#f1f5f9;border-radius:4px;padding:1px 6px;font-family:monospace}
    .close{margin-top:18px;font-size:.85rem;color:#64748b}
  </style>`

function successHtml(name: string, shop: string): string {
  return `${STYLE}
  <h1>🔗 Sewdle × Shopify</h1>
  <div class="box success">
    <h2>✅ ¡Conexión exitosa!</h2>
    <p><strong>Tienda:</strong> ${name}</p>
    <p><strong>Dominio:</strong> <code>${shop}</code></p>
    <p>El token fue guardado automáticamente. Ya puedes importar productos y sincronizar órdenes.</p>
  </div>
  <p class="close">Esta ventana se cerrará en 3 segundos…</p>
  <script>
    if (window.opener) window.opener.postMessage('shopify-oauth-success', '*');
    setTimeout(() => window.close(), 3000);
  </script>`
}

function warningHtml(shop: string, tokenPreview: string): string {
  return `${STYLE}
  <h1>🔗 Sewdle × Shopify</h1>
  <div class="box warning">
    <h2>⚠️ Token obtenido pero no guardado</h2>
    <p>No se encontró una tienda con dominio <code>${shop}</code> en la base de datos.</p>
    <p>Token: <code>${tokenPreview}***</code></p>
    <p>Asegúrate de guardar la tienda primero en Sewdle → Ajustes → Tiendas, luego vuelve a conectar.</p>
  </div>`
}

function errorHtml(message: string): string {
  return `${STYLE}
  <h1>🔗 Sewdle × Shopify</h1>
  <div class="box error">
    <h2>❌ Error</h2>
    <p>${message}</p>
  </div>`
}

function html(status: number, body: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Shopify OAuth — Sewdle</title></head><body>${body}</body></html>`,
    { status, headers: { 'Content-Type': 'text/html' } }
  )
}
