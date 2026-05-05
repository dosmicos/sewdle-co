#!/usr/bin/env node
/**
 * Export anonymized Sewdle messaging examples for Elsa-Hermes learning.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * Optional env:
 *   ELSA_ORGANIZATION_ID
 *   ELSA_MAX_CONVERSATIONS=250
 *   ELSA_OUTPUT_DIR=/Users/juliancastro/.hermes/profiles/elsa/workspace/knowledge
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORGANIZATION_ID = process.env.ELSA_ORGANIZATION_ID || '';
const MAX_CONVERSATIONS = Number(process.env.ELSA_MAX_CONVERSATIONS || 250);
const OUTPUT_DIR = process.env.ELSA_OUTPUT_DIR || '/Users/juliancastro/.hermes/profiles/elsa/workspace/knowledge';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function anonymize(text = '') {
  return String(text)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    .replace(/\+?57\s?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/g, '[PHONE]')
    .replace(/\b3\d{9}\b/g, '[PHONE]')
    .replace(/\b\d{7,10}\b/g, '[ID_OR_PHONE]')
    .replace(/\b(?:cc|c\.c\.|cedula|cédula|nit)\s*[:#-]?\s*\d[\d. -]{5,}\b/gi, '[DOCUMENT]')
    .replace(/\b(?:calle|cll|carrera|cra|kr|avenida|av|diagonal|dg|transversal|tv)\s+[^\n,.;]{3,80}/gi, '[ADDRESS]')
    .replace(/#[0-9]{4,}/g, '#[ORDER]')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyConversation(messages) {
  const text = messages.map((m) => m.content || '').join(' ').toLowerCase();
  if (/talla|tallas|meses|años|tog/.test(text)) return 'sizes';
  if (/env[ií]o|entrega|express|direcci[oó]n|ciudad/.test(text)) return 'shipping';
  if (/pago|nequi|daviplata|pse|addi|transferencia|link/.test(text)) return 'payments';
  if (/pedido|orden|comprar|datos|c[eé]dula/.test(text)) return 'order_creation';
  if (/cambio|devoluci[oó]n|garant[ií]a|reembolso/.test(text)) return 'changes';
  if (/precio|cu[aá]nto|vale|costo/.test(text)) return 'pricing';
  return 'general';
}

async function fetchCandidateConversations() {
  let query = supabase
    .from('messaging_conversations')
    .select('id, organization_id, channel_type, customer_name, customer_phone, last_message_at, metadata')
    .eq('channel_type', 'whatsapp')
    .order('last_message_at', { ascending: false })
    .limit(MAX_CONVERSATIONS * 3);

  if (ORGANIZATION_ID) query = query.eq('organization_id', ORGANIZATION_ID);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function fetchMessages(conversationId) {
  const { data, error } = await supabase
    .from('messaging_messages')
    .select('id, direction, sender_type, content, message_type, sent_at')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true })
    .limit(80);

  if (error) throw error;
  return data || [];
}

function isHumanOutbound(message) {
  if (message.direction !== 'outbound') return false;
  const sender = String(message.sender_type || '').toLowerCase();
  return !['ai', 'bot', 'system', 'automation'].includes(sender);
}

function toMarkdownExample(conversation, messages, idx) {
  const category = classifyConversation(messages);
  const lines = messages
    .filter((m) => m.content && String(m.content).trim().length > 0)
    .map((m) => {
      const speaker = m.direction === 'inbound' ? 'Cliente' : (isHumanOutbound(m) ? 'Humano Dosmicos' : 'AI/Automatización');
      return `- ${speaker}: ${anonymize(m.content)}`;
    });

  return [
    `## Example ${idx} — ${category}`,
    '',
    `- conversation_id: ${conversation.id}`,
    `- organization_id: ${conversation.organization_id}`,
    `- last_message_at: ${conversation.last_message_at}`,
    '',
    ...lines,
    '',
  ].join('\n');
}

const conversations = await fetchCandidateConversations();
const examples = [];
const jsonl = [];

for (const conversation of conversations) {
  if (examples.length >= MAX_CONVERSATIONS) break;

  const messages = await fetchMessages(conversation.id);
  const humanReplies = messages.filter(isHumanOutbound);
  const inbound = messages.filter((m) => m.direction === 'inbound');

  // Prioritize conversations where a human actually replied to a customer.
  if (humanReplies.length === 0 || inbound.length === 0) continue;

  const category = classifyConversation(messages);
  examples.push(toMarkdownExample(conversation, messages, examples.length + 1));
  jsonl.push(JSON.stringify({
    conversation_id: conversation.id,
    organization_id: conversation.organization_id,
    category,
    last_message_at: conversation.last_message_at,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.direction === 'inbound' ? 'customer' : (isHumanOutbound(m) ? 'human' : 'ai_or_automation'),
      message_type: m.message_type,
      sent_at: m.sent_at,
      content: anonymize(m.content || ''),
    })).filter((m) => m.content),
  }));
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const mdPath = path.join(OUTPUT_DIR, `elsa-human-replies-corpus-${stamp}.md`);
const jsonlPath = path.join(OUTPUT_DIR, `elsa-human-replies-corpus-${stamp}.jsonl`);

await fs.writeFile(mdPath, `# Elsa Human Reply Corpus — ${stamp}\n\nAnonymized Sewdle conversations where humans replied to customers. Use as examples, not as absolute policy.\n\n${examples.join('\n')}`);
await fs.writeFile(jsonlPath, jsonl.join('\n') + '\n');

console.log(JSON.stringify({
  ok: true,
  conversations_scanned: conversations.length,
  examples_exported: examples.length,
  markdown: mdPath,
  jsonl: jsonlPath,
}, null, 2));
