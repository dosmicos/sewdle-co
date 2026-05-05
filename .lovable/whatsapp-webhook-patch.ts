/**
 * PARCHE PARA whatsapp-webhook (Supabase Dashboard)
 * 
 * Copia este código completo y reemplaza el contenido de tu edge function
 * whatsapp-webhook en el Dashboard de Supabase.
 * 
 * Este código incluye:
 * - Descarga de media desde Meta API usando media_id
 * - Subida a Supabase Storage (bucket: messaging-media)
 * - Persistencia de original_media_id en metadata para reintento
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============== CONFIGURACIÓN PRINCIPAL ==============
const DEFAULT_ORG_ID = 'cb497af2-3f29-4bb4-be53-91b7f19e5ffb';
const MAX_MEDIA_SIZE = 16 * 1024 * 1024;

// ============== MEDIA HELPERS ==============
function getFileExtension(mimeType: string, messageType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
    'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'mp4', 'audio/amr': 'amr',
    'video/mp4': 'mp4', 'video/3gpp': '3gp',
    'application/pdf': 'pdf',
  };
  if (mimeType && mimeToExt[mimeType.toLowerCase()]) return mimeToExt[mimeType.toLowerCase()];
  const typeDefaults: Record<string, string> = { image: 'jpg', audio: 'ogg', video: 'mp4', sticker: 'webp', document: 'bin' };
  return typeDefaults[messageType] || 'bin';
}

function getMediaSubfolder(messageType: string): string {
  const folders: Record<string, string> = { image: 'images', audio: 'audios', video: 'videos', sticker: 'stickers', document: 'documents' };
  return folders[messageType] || 'misc';
}

async function fetchMediaUrl(
  mediaId: string,
  messageType: string,
  conversationId: string,
  supabase: any
): Promise<{ url: string | null; mimeType: string | null; error?: string }> {
  const accessToken = Deno.env.get('META_WHATSAPP_TOKEN');
  if (!accessToken) return { url: null, mimeType: null, error: 'Token not configured' };
  if (!mediaId) return { url: null, mimeType: null, error: 'No media ID' };

  try {
    console.log(`📥 Fetching WhatsApp media: ${mediaId}`);
    const infoController = new AbortController();
    const infoTimeout = setTimeout(() => infoController.abort(), 10000);
    let infoResponse: Response;
    try {
      infoResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: infoController.signal,
      });
    } finally { clearTimeout(infoTimeout); }

    if (!infoResponse.ok) {
      const txt = await infoResponse.text();
      console.error('Meta info error:', infoResponse.status, txt.substring(0, 200));
      return { url: null, mimeType: null, error: `Meta API error: ${infoResponse.status}` };
    }
    const mediaInfo = await infoResponse.json();
    if (!mediaInfo.url) return { url: null, mimeType: null, error: 'No URL in response' };
    if (mediaInfo.file_size && mediaInfo.file_size > MAX_MEDIA_SIZE) return { url: null, mimeType: mediaInfo.mime_type, error: 'File too large' };

    const downloadController = new AbortController();
    const downloadTimeout = setTimeout(() => downloadController.abort(), 30000);
    let mediaResponse: Response;
    try {
      mediaResponse = await fetch(mediaInfo.url, { headers: { 'Authorization': `Bearer ${accessToken}` }, signal: downloadController.signal });
    } finally { clearTimeout(downloadTimeout); }

    if (!mediaResponse.ok) {
      const txt = await mediaResponse.text();
      console.error('Download error:', mediaResponse.status, txt.substring(0, 200));
      return { url: null, mimeType: mediaInfo.mime_type, error: `Download failed: ${mediaResponse.status}` };
    }

    const buf = await mediaResponse.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.length === 0) return { url: null, mimeType: mediaInfo.mime_type, error: 'Empty file' };

    const mimeType = mediaInfo.mime_type || 'application/octet-stream';
    const ext = getFileExtension(mimeType, messageType);
    const subfolder = getMediaSubfolder(messageType);
    const path = `whatsapp-media/${subfolder}/${conversationId}/${Date.now()}_${mediaId}.${ext}`;

    let uploadSuccess = false;
    for (let attempt = 0; attempt < 2 && !uploadSuccess; attempt++) {
      const { error: uploadError } = await supabase.storage.from('messaging-media').upload(path, bytes, { contentType: mimeType, cacheControl: '31536000', upsert: true });
      if (!uploadError) uploadSuccess = true;
      else if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
    }
    if (!uploadSuccess) return { url: null, mimeType, error: 'Upload failed' };

    const { data: pubUrl } = supabase.storage.from('messaging-media').getPublicUrl(path);
    if (!pubUrl?.publicUrl) return { url: null, mimeType, error: 'No public URL' };
    console.log(`✅ Media cached: ${pubUrl.publicUrl.substring(0, 60)}...`);
    return { url: pubUrl.publicUrl, mimeType };
  } catch (e: any) {
    if (e.name === 'AbortError') return { url: null, mimeType: null, error: 'Timeout' };
    console.error('fetchMediaUrl error:', e);
    return { url: null, mimeType: null, error: e.message || 'Unknown error' };
  }
}

// ============== AI RESPONSE (optional) ==============
async function generateAIResponse(userMessage: string, history: any[], aiConfig: any, mediaContext?: { type: string; url?: string }): Promise<string> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) return '';
  try {
    let prompt = aiConfig?.systemPrompt || 'Eres un asistente amigable.';
    const toneMap: Record<string, string> = { friendly: 'Usa un tono amigable.', formal: 'Usa un tono formal.', casual: 'Usa un tono casual.', professional: 'Usa un tono profesional.' };
    if (aiConfig?.tone && toneMap[aiConfig.tone]) prompt += '\n' + toneMap[aiConfig.tone];

    if (mediaContext?.type === 'sticker') return '¡Lindo sticker! 😊 ¿En qué puedo ayudarte?';
    let userMsg = userMessage || (mediaContext?.type === 'image' ? '[El cliente envió una imagen]' : mediaContext?.type === 'audio' ? '[El cliente envió un audio]' : '');

    const messages: any[] = [{ role: 'system', content: prompt }, ...history.slice(-10).map(m => ({ role: m.direction === 'inbound' ? 'user' : 'assistant', content: m.content }))];
    if (mediaContext?.type === 'image' && mediaContext.url) {
      messages.push({ role: 'user', content: [{ type: 'text', text: userMsg }, { type: 'image_url', image_url: { url: mediaContext.url, detail: 'auto' } }] });
    } else {
      messages.push({ role: 'user', content: userMsg });
    }

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-3-flash-preview', messages, max_tokens: 500 }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch { return ''; }
}

async function sendWhatsAppMessage(phoneNumberId: string, to: string, text: string): Promise<any> {
  const token = Deno.env.get('META_WHATSAPP_TOKEN');
  if (!token) return null;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body: text } }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// ============== MAIN HANDLER ==============
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === Deno.env.get('META_WEBHOOK_VERIFY_TOKEN')) return new Response(challenge, { status: 200 });
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('========== WHATSAPP WEBHOOK ==========', JSON.stringify(body).substring(0, 400));
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const toArray = (o: any) => (!o ? [] : Array.isArray(o) ? o : Object.values(o));

      if (body.object === 'whatsapp_business_account') {
        for (const entry of toArray(body.entry)) {
          for (const change of toArray(entry.changes)) {
            if (change.field !== 'messages') continue;
            const val = change.value;
            const phoneNumberId = val.metadata?.phone_number_id;

            for (const message of toArray(val.messages)) {
              const from = message.from;
              const extId = message.id;
              const ts = new Date(parseInt(message.timestamp) * 1000);
              const contact = toArray(val.contacts)?.find((c: any) => c.wa_id === from);
              const contactName = contact?.profile?.name || from;

              let content = '', messageType = 'text', mediaId: string | null = null, mediaMimeType: string | null = null;

              if (message.type === 'text') content = message.text?.body || '';
              else if (message.type === 'reaction') { content = `Reaccionó con ${message.reaction?.emoji || '👍'}`; messageType = 'reaction'; }
              else if (message.type === 'image') { content = message.image?.caption || '[Imagen]'; messageType = 'image'; mediaId = message.image?.id; mediaMimeType = message.image?.mime_type; }
              else if (message.type === 'audio') { content = '[audio]'; messageType = 'audio'; mediaId = message.audio?.id; mediaMimeType = message.audio?.mime_type; }
              else if (message.type === 'video') { content = message.video?.caption || '[video]'; messageType = 'video'; mediaId = message.video?.id; mediaMimeType = message.video?.mime_type; }
              else if (message.type === 'document') { content = message.document?.filename || '[documento]'; messageType = 'document'; mediaId = message.document?.id; mediaMimeType = message.document?.mime_type; }
              else if (message.type === 'sticker') { content = '[sticker]'; messageType = 'sticker'; mediaId = message.sticker?.id; mediaMimeType = message.sticker?.mime_type; }
              else if (message.type === 'location') { const l = message.location; content = l?.name || l?.address || `[Ubicación]`; messageType = 'location'; }
              else { content = `[${message.type}]`; messageType = message.type; }

              // Find or create channel
              let { data: channel } = await supabase.from('messaging_channels').select('*').eq('meta_phone_number_id', phoneNumberId).eq('channel_type', 'whatsapp').single();
              if (!channel) {
                const { data: fallback } = await supabase.from('messaging_channels').select('*').eq('organization_id', DEFAULT_ORG_ID).eq('channel_type', 'whatsapp').eq('is_active', true).limit(1).single();
                if (fallback) { await supabase.from('messaging_channels').update({ meta_phone_number_id: phoneNumberId }).eq('id', fallback.id); channel = fallback; }
                else {
                  const { data: newCh } = await supabase.from('messaging_channels').insert({ organization_id: DEFAULT_ORG_ID, channel_type: 'whatsapp', channel_name: 'WhatsApp', meta_phone_number_id: phoneNumberId, is_active: true, ai_enabled: true, webhook_verified: true }).select().single();
                  channel = newCh;
                }
              }
              if (!channel) continue;

              // Find or create conversation
              let { data: conv } = await supabase.from('messaging_conversations').select('*').eq('channel_id', channel.id).eq('external_user_id', from).single();
              if (!conv) {
                const { data: newConv } = await supabase.from('messaging_conversations').insert({ channel_id: channel.id, organization_id: channel.organization_id, channel_type: 'whatsapp', external_user_id: from, user_identifier: from, user_name: contactName, last_message_preview: content, last_message_at: ts.toISOString(), unread_count: 1, status: 'active', ai_managed: channel.ai_enabled !== false }).select().single();
                conv = newConv;
              } else {
                const preview = mediaId ? (messageType === 'image' ? '📷 Imagen' : messageType === 'audio' ? '🎵 Audio' : messageType === 'video' ? '🎬 Video' : content) : content;
                await supabase.from('messaging_conversations').update({ last_message_preview: preview, last_message_at: ts.toISOString(), unread_count: (conv.unread_count || 0) + 1, user_name: contactName }).eq('id', conv.id);
              }
              if (!conv) continue;

              // Fetch media
              let mediaUrl: string | null = null, mediaError: string | undefined;
              if (mediaId) {
                const res = await fetchMediaUrl(mediaId, messageType, conv.id, supabase);
                mediaUrl = res.url; mediaMimeType = res.mimeType || mediaMimeType; mediaError = res.error;
              }

              // Insert message
              if (messageType !== 'reaction') {
                await supabase.from('messaging_messages').insert({
                  conversation_id: conv.id, external_message_id: extId, channel_type: 'whatsapp', direction: 'inbound', sender_type: 'user',
                  content, message_type: messageType, media_url: mediaUrl, media_mime_type: mediaMimeType,
                  metadata: { ...message, original_media_id: mediaId, media_download_error: mediaError },
                  sent_at: ts.toISOString()
                });

                // AI auto-reply
                const aiConfig = channel.ai_config as any;
                const { data: freshConv } = await supabase.from('messaging_conversations').select('ai_managed').eq('id', conv.id).single();
                const shouldReply = channel.ai_enabled !== false && (freshConv?.ai_managed ?? conv.ai_managed) !== false && aiConfig?.autoReply !== false;
                if (shouldReply) {
                  const { data: history } = await supabase.from('messaging_messages').select('content, direction').eq('conversation_id', conv.id).order('sent_at', { ascending: false }).limit(10);
                  const ctx = mediaId ? { type: messageType, url: mediaUrl || undefined } : undefined;
                  if (ctx?.type === 'image' && ctx.url && !ctx.url.includes('supabase')) ctx.url = undefined;
                  const aiResp = await generateAIResponse(content, (history || []).reverse(), aiConfig, ctx);
                  if (aiResp) {
                    const sent = await sendWhatsAppMessage(phoneNumberId, from, aiResp);
                    if (sent) {
                      await supabase.from('messaging_messages').insert({ conversation_id: conv.id, external_message_id: sent.messages?.[0]?.id, channel_type: 'whatsapp', direction: 'outbound', sender_type: 'ai', content: aiResp, message_type: 'text', sent_at: new Date().toISOString() });
                      await supabase.from('messaging_conversations').update({ last_message_preview: aiResp.substring(0, 100), last_message_at: new Date().toISOString() }).eq('id', conv.id);
                    }
                  }
                }
              }
            }

            // status updates
            for (const st of toArray(val.statuses)) {
              const upd: any = {};
              if (st.status === 'delivered') upd.delivered_at = new Date(parseInt(st.timestamp) * 1000).toISOString();
              if (st.status === 'read') upd.read_at = new Date(parseInt(st.timestamp) * 1000).toISOString();
              if (Object.keys(upd).length) await supabase.from('messaging_messages').update(upd).eq('external_message_id', st.id);
            }
          }
        }
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    } catch (e: any) {
      console.error('Webhook error:', e);
      return new Response(JSON.stringify({ error: e.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
  }
  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
