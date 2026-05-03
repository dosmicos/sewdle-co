#!/usr/bin/env node
/**
 * Ask Elsa-Hermes to distill an anonymized corpus into reusable support learnings,
 * then persist them to Supabase and Elsa's workspace.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ELSA_ORGANIZATION_ID
 *   HERMES_API_URL=http://127.0.0.1:8644/v1
 *   HERMES_API_KEY=<Elsa API_SERVER_KEY>
 * Optional:
 *   ELSA_CORPUS_PATH=/Users/.../knowledge/elsa-human-replies-corpus-YYYY-MM-DD.md
 *   HERMES_MODEL=elsa
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORGANIZATION_ID = process.env.ELSA_ORGANIZATION_ID;
const HERMES_API_URL = (process.env.HERMES_API_URL || 'http://127.0.0.1:8644/v1').replace(/\/$/, '');
const HERMES_API_KEY = process.env.HERMES_API_KEY;
const HERMES_MODEL = process.env.HERMES_MODEL || 'elsa';
const KNOWLEDGE_DIR = process.env.ELSA_OUTPUT_DIR || '/Users/juliancastro/.hermes/profiles/elsa/workspace/knowledge';
const CORPUS_PATH = process.env.ELSA_CORPUS_PATH || '';

if (!SUPABASE_URL || !SERVICE_ROLE || !ORGANIZATION_ID || !HERMES_API_KEY) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELSA_ORGANIZATION_ID, or HERMES_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function newestCorpusPath() {
  if (CORPUS_PATH) return CORPUS_PATH;
  const entries = await fs.readdir(KNOWLEDGE_DIR);
  const candidates = entries
    .filter((name) => /^elsa-human-replies-corpus-.*\.md$/.test(name))
    .sort();
  if (!candidates.length) throw new Error(`No corpus markdown found in ${KNOWLEDGE_DIR}`);
  return path.join(KNOWLEDGE_DIR, candidates.at(-1));
}

function chunkText(text, maxChars = 22000) {
  const chunks = [];
  let rest = text;
  while (rest.length > maxChars) {
    const cut = rest.lastIndexOf('\n## Example ', maxChars);
    const idx = cut > 1000 ? cut : maxChars;
    chunks.push(rest.slice(0, idx));
    rest = rest.slice(idx);
  }
  if (rest.trim()) chunks.push(rest);
  return chunks;
}

function extractJsonArray(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidates = [trimmed, fenced].filter(Boolean);
  const first = trimmed.indexOf('[');
  const last = trimmed.lastIndexOf(']');
  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  throw new Error(`Could not parse JSON array from Hermes output: ${trimmed.slice(0, 500)}`);
}

async function callElsaForLearnings(chunk, index, total) {
  const prompt = `Analiza este corpus anonimizado de respuestas humanas reales de Dosmicos en Sewdle.\n\nTu trabajo: extraer aprendizajes reutilizables para Elsa, NO copiar chats completos.\n\nDevuelve SOLO un JSON array. Cada item debe tener:\n{\n  "category": "sizes|shipping|payments|order_creation|changes|pricing|general|escalation",\n  "situation": "situación corta donde aplica",\n  "recommended_response": "respuesta/patrón recomendado en español colombiano",\n  "avoid_response": "qué evitar si aplica",\n  "confidence": 0.0\n}\n\nReglas:\n- Máximo 20 aprendizajes.\n- No incluyas PII, nombres, teléfonos, emails, direcciones ni IDs.\n- Si un ejemplo contradice políticas vigentes, marca confidence bajo o ignóralo.\n- Enfócate en patrones que mejoran atención/ventas.\n\nChunk ${index}/${total}:\n\n${chunk}`;

  const response = await fetch(`${HERMES_API_URL}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HERMES_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: HERMES_MODEL,
      input: prompt,
      store: true,
      metadata: { source: 'elsa-learning-corpus' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Hermes API error ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }

  const data = await response.json();
  const outputText =
    data.output_text ||
    data.output?.flatMap((item) => item.content || [])
      ?.map((c) => c.text || '')
      ?.join('\n') ||
    '';
  return extractJsonArray(outputText);
}

const corpusPath = await newestCorpusPath();
const corpus = await fs.readFile(corpusPath, 'utf8');
const chunks = chunkText(corpus);
const allLearnings = [];

for (let i = 0; i < chunks.length; i++) {
  const learnings = await callElsaForLearnings(chunks[i], i + 1, chunks.length);
  allLearnings.push(...learnings);
}

const cleanLearnings = allLearnings
  .filter((l) => l?.situation && l?.recommended_response)
  .map((l) => ({
    organization_id: ORGANIZATION_ID,
    category: String(l.category || 'general').slice(0, 80),
    situation: String(l.situation).slice(0, 1000),
    recommended_response: String(l.recommended_response).slice(0, 2000),
    avoid_response: l.avoid_response ? String(l.avoid_response).slice(0, 1000) : null,
    confidence: Math.max(0, Math.min(1, Number(l.confidence ?? 0.6))),
    status: 'active',
    metadata: { source: 'elsa-learn-from-corpus', corpus_path: corpusPath },
  }));

if (cleanLearnings.length) {
  const { error } = await supabase.from('elsa_response_learnings').insert(cleanLearnings);
  if (error) throw error;
}

await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const outPath = path.join(KNOWLEDGE_DIR, `elsa-learnings-${stamp}.json`);
await fs.writeFile(outPath, JSON.stringify(cleanLearnings, null, 2));

console.log(JSON.stringify({
  ok: true,
  corpus: corpusPath,
  chunks: chunks.length,
  learnings: cleanLearnings.length,
  output: outPath,
}, null, 2));
