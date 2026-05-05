import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_MEDIA_SIZE = 16 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getFileExtension(mimeType: string, messageType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'mp4',
    'audio/amr': 'amr',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'application/pdf': 'pdf',
  };

  if (mimeType && mimeToExt[mimeType.toLowerCase()]) return mimeToExt[mimeType.toLowerCase()];

  const typeDefaults: Record<string, string> = {
    image: 'jpg',
    audio: 'ogg',
    video: 'mp4',
    sticker: 'webp',
    document: 'bin',
  };
  return typeDefaults[messageType] || 'bin';
}

function getMediaSubfolder(messageType: string): string {
  const folders: Record<string, string> = {
    image: 'images',
    audio: 'audios',
    video: 'videos',
    sticker: 'stickers',
    document: 'documents',
  };
  return folders[messageType] || 'misc';
}

async function fetchAndCacheMedia(
  mediaId: string,
  messageType: string,
  conversationId: string,
  supabase: any,
): Promise<{ url: string | null; mimeType: string | null; error?: string }> {
  const accessToken = Deno.env.get('META_WHATSAPP_TOKEN');
  if (!accessToken) return { url: null, mimeType: null, error: 'META_WHATSAPP_TOKEN not configured' };

  try {
    // Step 1: get media info (temp URL)
    const infoController = new AbortController();
    const infoTimeout = setTimeout(() => infoController.abort(), DOWNLOAD_TIMEOUT_MS);
    let infoResp: Response;
    try {
      infoResp = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: infoController.signal,
      });
    } finally {
      clearTimeout(infoTimeout);
    }

    if (!infoResp.ok) {
      const t = await infoResp.text();
      console.error('Meta media info error:', infoResp.status, t.substring(0, 200));
      return { url: null, mimeType: null, error: `Meta info error: ${infoResp.status}` };
    }

    const info = await infoResp.json();
    const mimeType = (info?.mime_type || 'application/octet-stream') as string;
    const fileSize = Number(info?.file_size || 0);
    if (fileSize && fileSize > MAX_MEDIA_SIZE) {
      return { url: null, mimeType, error: 'File too large' };
    }

    if (!info?.url) return { url: null, mimeType, error: 'No URL returned by Meta' };

    // Step 2: download
    const dlController = new AbortController();
    const dlTimeout = setTimeout(() => dlController.abort(), DOWNLOAD_TIMEOUT_MS);
    let dlResp: Response;
    try {
      dlResp = await fetch(info.url, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: dlController.signal,
      });
    } finally {
      clearTimeout(dlTimeout);
    }

    if (!dlResp.ok) {
      const t = await dlResp.text();
      console.error('Meta media download error:', dlResp.status, t.substring(0, 200));
      return { url: null, mimeType, error: `Download error: ${dlResp.status}` };
    }

    const buf = await dlResp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.length === 0) return { url: null, mimeType, error: 'Empty file' };
    if (bytes.length > MAX_MEDIA_SIZE) return { url: null, mimeType, error: 'File too large' };

    // Step 3: upload
    const ext = getFileExtension(mimeType, messageType);
    const subfolder = getMediaSubfolder(messageType);
    const timestamp = Date.now();
    const path = `whatsapp-media/${subfolder}/${conversationId}/${timestamp}_${mediaId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('messaging-media')
      .upload(path, bytes, {
        contentType: mimeType,
        cacheControl: '31536000',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { url: null, mimeType, error: 'Storage upload failed' };
    }

    const { data: publicUrlData } = supabase.storage
      .from('messaging-media')
      .getPublicUrl(path);

    const publicUrl = publicUrlData?.publicUrl;
    if (!publicUrl) return { url: null, mimeType, error: 'No public URL' };

    return { url: publicUrl, mimeType };
  } catch (err: any) {
    if (err?.name === 'AbortError') return { url: null, mimeType: null, error: 'Timeout' };
    console.error('fetchAndCacheMedia error:', err);
    return { url: null, mimeType: null, error: err?.message || 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { message_id } = await req.json();
    if (!message_id || typeof message_id !== 'string') {
      return json({ success: false, error: 'message_id es requerido' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: msg, error: msgErr } = await supabase
      .from('messaging_messages')
      .select('id, channel_type, conversation_id, message_type, media_url, media_mime_type, metadata')
      .eq('id', message_id)
      .single();

    if (msgErr || !msg) {
      return json({ success: false, error: 'Mensaje no encontrado' }, 404);
    }

    if (msg.channel_type !== 'whatsapp') {
      return json({ success: false, error: 'Solo aplica para WhatsApp' }, 400);
    }

    if (msg.media_url) {
      return json({ success: true, media_url: msg.media_url, media_mime_type: msg.media_mime_type });
    }

    const messageType = (msg.message_type || 'document') as string;
    const metadata: any = (msg.metadata && typeof msg.metadata === 'object') ? msg.metadata : {};
    const conversationId = msg.conversation_id as string;

    const originalMediaId = metadata?.original_media_id
      || metadata?.original_message?.[messageType]?.id
      || metadata?.original_message?.image?.id
      || metadata?.original_message?.audio?.id
      || metadata?.original_message?.sticker?.id
      || metadata?.original_message?.video?.id
      || metadata?.original_message?.document?.id
      || null;

    if (!originalMediaId) {
      return json({ success: false, error: 'No hay original_media_id para reintentar' }, 400);
    }

    const res = await fetchAndCacheMedia(originalMediaId, messageType, conversationId, supabase);
    if (!res.url) {
      const updatedMeta = { ...metadata, original_media_id: originalMediaId, media_download_error: res.error || 'Download failed' };
      await supabase
        .from('messaging_messages')
        .update({ metadata: updatedMeta })
        .eq('id', message_id);

      return json({ success: false, error: res.error || 'No se pudo descargar el medio' }, 400);
    }

    const updatedMeta = { ...metadata, original_media_id: originalMediaId, media_download_error: null };

    const { error: updErr } = await supabase
      .from('messaging_messages')
      .update({
        media_url: res.url,
        media_mime_type: res.mimeType,
        metadata: updatedMeta,
      })
      .eq('id', message_id);

    if (updErr) {
      console.error('DB update error:', updErr);
      return json({ success: false, error: 'No se pudo actualizar el mensaje' }, 500);
    }

    return json({ success: true, media_url: res.url, media_mime_type: res.mimeType });
  } catch (err: any) {
    console.error('retry-whatsapp-media error:', err);
    return json({ success: false, error: err?.message || 'Error interno' }, 500);
  }
});
