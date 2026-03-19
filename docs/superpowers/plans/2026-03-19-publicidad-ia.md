# Publicidad IA Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Publicidad" section to Sewdle that lets admins generate product photos and ad creatives using Nano Banana 2 (Gemini 3.1 Flash Image), with seed images, templates, saved prompts, skills, and generation history.

**Architecture:** Supabase Edge Function calls Nano Banana 2 API, uploads result to temp storage, returns signed URL. Frontend is a new page with tabs (Generate, History, Settings). All config (seeds, prompts, skills, templates) stored in Supabase tables with RLS.

**Tech Stack:** React, TypeScript, shadcn/ui, Tailwind CSS, Supabase (DB + Storage + Edge Functions), Nano Banana 2 API (Gemini 3.1 Flash Image)

**Spec:** `docs/superpowers/specs/2026-03-19-publicidad-ia-design.md`

---

## Chunk 1: Database, Storage & Routing Shell

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260319000000_publicidad_ia.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260319000000_publicidad_ia.sql` with the full SQL from the spec. This includes all 7 tables (`ai_templates`, `ai_seed_images`, `ai_saved_prompts`, `ai_skills`, `ai_skill_seeds`, `ai_image_generations`, `ai_generation_seeds`), RLS policies, indexes, triggers, storage buckets, and seed data for templates.

Copy the complete SQL from the spec's "Base de Datos" section, including:
- All CREATE TABLE statements
- All RLS policies (ALTER TABLE ENABLE ROW LEVEL SECURITY + CREATE POLICY)
- All indexes
- Both storage buckets (`publicidad-seeds` public, `publicidad-temp` private)
- Storage bucket policies
- Updated_at triggers using `moddatetime`
- INSERT statements for the 8 default templates (4 product + 4 advertising) from the spec's "Templates Iniciales" table. Use `NULL` for `organization_id` (global defaults).

- [ ] **Step 2: Run migration on Supabase**

Execute the migration SQL directly in the Supabase SQL Editor (the project uses hosted Supabase, not local). Verify each section succeeds.

Run: Execute the SQL in Supabase SQL Editor
Expected: "Success. No rows returned" for DDL, row counts for INSERTs

- [ ] **Step 3: Verify tables exist**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'ai_%'
ORDER BY table_name;
```

Expected: 7 tables listed (ai_generation_seeds, ai_image_generations, ai_saved_prompts, ai_seed_images, ai_skill_seeds, ai_skills, ai_templates)

- [ ] **Step 4: Verify templates seeded**

```sql
SELECT id, name, category FROM ai_templates ORDER BY category, sort_order;
```

Expected: 8 rows (4 product + 4 advertising)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260319000000_publicidad_ia.sql
git commit -m "feat(publicidad): add database migration for AI image generation"
```

---

### Task 2: Sidebar & Routing

**Files:**
- Modify: `src/components/AppSidebar.tsx`
- Modify: `src/App.tsx`
- Create: `src/pages/PublicidadPage.tsx`

- [ ] **Step 1: Create empty PublicidadPage**

Create `src/pages/PublicidadPage.tsx`:

```tsx
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wand2, History, Settings } from 'lucide-react';

const PublicidadPage = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Publicidad</h1>
        <p className="text-muted-foreground">Genera imágenes con IA para productos y publicidad</p>
      </div>

      <Tabs defaultValue="generate" className="w-full">
        <TabsList>
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Generar
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Ajustes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <div className="text-center py-12 text-muted-foreground">
            Workspace de generación — próximamente
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="text-center py-12 text-muted-foreground">
            Historial de generaciones — próximamente
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <div className="text-center py-12 text-muted-foreground">
            Ajustes — próximamente
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PublicidadPage;
```

- [ ] **Step 2: Add to AppSidebar.tsx**

In `src/components/AppSidebar.tsx`:

1. Add `Megaphone` to the lucide-react import on line 7
2. Add to `allMenuItems` array (after UGC Creators, before APIs):
```tsx
{ title: 'Publicidad', url: '/publicidad', icon: Megaphone, module: 'publicidad', alwaysShow: false },
```
3. Add to `moduleToPermissionMap`:
```tsx
'publicidad': 'publicidad',
```

- [ ] **Step 3: Add route to App.tsx**

In `src/App.tsx`:

1. Add import at top:
```tsx
import PublicidadPage from "@/pages/PublicidadPage";
```
2. Add route inside the `MainLayout` routes, after UGC creators route:
```tsx
<Route path="publicidad" element={
  <PermissionRoute module="publicidad" action="view">
    <PublicidadPage />
  </PermissionRoute>
} />
```

- [ ] **Step 4: Build and verify no errors**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/PublicidadPage.tsx src/components/AppSidebar.tsx src/App.tsx
git commit -m "feat(publicidad): add page shell, sidebar item, and route"
```

---

## Chunk 2: Settings — Seed Images, Prompts, Templates

### Task 3: Seed Images Hook & Manager

**Files:**
- Create: `src/hooks/useSeedImages.ts`
- Create: `src/components/publicidad/SeedImageManager.tsx`

- [ ] **Step 1: Create useSeedImages hook**

Create `src/hooks/useSeedImages.ts`. Follow the pattern from `useProducts.ts`:
- Use `useState` + `useEffect` for data fetching (not react-query — match existing pattern)
- Import `supabase` from `@/integrations/supabase/client`
- Import `useOrganization` from `@/contexts/OrganizationContext` for `currentOrganization.id`

Interface:
```tsx
interface SeedImage {
  id: string;
  organization_id: string;
  type: 'product' | 'advertising';
  name: string;
  image_url: string;
  category: string | null;
  created_by: string | null;
  created_at: string;
}
```

Hook signature: `useSeedImages(type?: 'product' | 'advertising')`

Returns: `{ seedImages, loading, error, refetch, createSeedImage, deleteSeedImage, uploadSeedImage }`

Functions:
- `fetchSeedImages()`: SELECT from `ai_seed_images` WHERE `organization_id = orgId`, optionally filtered by `type`. Order by `created_at DESC`.
- `uploadSeedImage(file: File, type: 'product' | 'advertising')`: Validate (max 5MB, JPG/PNG/WEBP), upload to `publicidad-seeds` bucket at path `${type}s/${orgId}/${Date.now()}-${random}.${ext}`, get public URL.
- `createSeedImage(data: { name, type, image_url, category? })`: INSERT into `ai_seed_images` with `organization_id` and `created_by` from auth user.
- `deleteSeedImage(id: string)`: DELETE from `ai_seed_images`, also delete file from storage bucket.

- [ ] **Step 2: Create SeedImageManager component**

Create `src/components/publicidad/SeedImageManager.tsx`:

Props: `{ type: 'product' | 'advertising' }`

UI structure:
- Header with title ("Semillas de Producto" or "Semillas de Publicidad") and "Agregar" button
- Grid of cards showing uploaded seed images (image thumbnail, name, category badge, delete button)
- Dialog for adding new seed: drag-and-drop upload area (reuse pattern from `ProductImageUpload.tsx`), name input, category input
- Use `Card`, `CardContent` from shadcn. Use `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` for the add form.
- Use `AlertDialog` for delete confirmation
- Use `useToast()` for notifications
- Loading skeleton while fetching

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useSeedImages.ts src/components/publicidad/SeedImageManager.tsx
git commit -m "feat(publicidad): add seed images hook and manager component"
```

---

### Task 4: Saved Prompts Hook & Manager

**Files:**
- Create: `src/hooks/useSavedPrompts.ts`
- Create: `src/components/publicidad/SavedPromptsManager.tsx`

- [ ] **Step 1: Create useSavedPrompts hook**

Create `src/hooks/useSavedPrompts.ts`. Same pattern as `useSeedImages`.

Interface:
```tsx
interface SavedPrompt {
  id: string;
  organization_id: string;
  name: string;
  prompt: string;
  category: 'product' | 'advertising' | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
```

Hook signature: `useSavedPrompts(category?: 'product' | 'advertising')`

Returns: `{ prompts, loading, error, refetch, createPrompt, updatePrompt, deletePrompt, duplicatePrompt }`

Functions:
- `fetchPrompts()`: SELECT from `ai_saved_prompts` WHERE `organization_id = orgId`, optionally filtered by `category`.
- `createPrompt(data: { name, prompt, category? })`: INSERT into `ai_saved_prompts`.
- `updatePrompt(id, data: { name?, prompt?, category? })`: UPDATE `ai_saved_prompts`.
- `deletePrompt(id)`: DELETE from `ai_saved_prompts`.
- `duplicatePrompt(id)`: Fetch the prompt, INSERT a copy with name + " (copia)".

- [ ] **Step 2: Create SavedPromptsManager component**

Create `src/components/publicidad/SavedPromptsManager.tsx`:

UI structure:
- Header with title "Prompts Guardados" and "Nuevo Prompt" button
- Table/list of saved prompts: name, category badge, truncated prompt preview, action buttons (edit, duplicate, delete)
- Dialog for create/edit: name input, prompt textarea, category select (producto/publicidad)
- Use `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` from shadcn
- Use `AlertDialog` for delete confirmation
- Use `Select` for category filter
- Use `useToast()` for notifications

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useSavedPrompts.ts src/components/publicidad/SavedPromptsManager.tsx
git commit -m "feat(publicidad): add saved prompts hook and manager component"
```

---

### Task 5: Templates Hook

**Files:**
- Create: `src/hooks/useAiTemplates.ts`

- [ ] **Step 1: Create useAiTemplates hook**

Create `src/hooks/useAiTemplates.ts`:

Interface:
```tsx
interface AiTemplate {
  id: string;
  organization_id: string | null;
  name: string;
  category: 'product' | 'advertising';
  prompt_base: string;
  resolution: string;
  dimensions: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}
```

Hook signature: `useAiTemplates(category?: 'product' | 'advertising')`

Returns: `{ templates, loading, error, refetch }`

Fetch: SELECT from `ai_templates` WHERE `is_active = true` AND (`organization_id = orgId` OR `organization_id IS NULL`), optionally filtered by `category`. Order by `sort_order ASC`.

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAiTemplates.ts
git commit -m "feat(publicidad): add AI templates hook"
```

---

### Task 6: Skills Hook & Manager

**Files:**
- Create: `src/hooks/useAiSkills.ts`
- Create: `src/components/publicidad/SkillsManager.tsx`

- [ ] **Step 1: Create useAiSkills hook**

Create `src/hooks/useAiSkills.ts`:

Interface:
```tsx
interface AiSkill {
  id: string;
  organization_id: string;
  name: string;
  prompt: string;
  mode: 'template' | 'free' | 'edit';
  template_id: string | null;
  resolution: string;
  config: Record<string, any>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  seed_images?: SeedImage[]; // joined from ai_skill_seeds
}
```

Hook signature: `useAiSkills()`

Returns: `{ skills, loading, error, refetch, createSkill, updateSkill, deleteSkill }`

Key implementation details:
- `fetchSkills()`: Two queries — first fetch skills, then fetch `ai_skill_seeds` joined with `ai_seed_images` for each skill. Merge the seed images into the skill objects.
- `createSkill(data, seedImageIds: string[])`: INSERT into `ai_skills`, then INSERT into `ai_skill_seeds` for each seed image ID.
- `updateSkill(id, data, seedImageIds: string[])`: UPDATE `ai_skills`, DELETE old `ai_skill_seeds` for this skill, INSERT new ones.
- `deleteSkill(id)`: DELETE from `ai_skills` (cascade deletes `ai_skill_seeds`).

- [ ] **Step 2: Create SkillsManager component**

Create `src/components/publicidad/SkillsManager.tsx`:

UI structure:
- Header with title "Skills" and "Nuevo Skill" button
- Grid of cards: name, mode badge, resolution, prompt preview, seed image thumbnails, action buttons (edit, delete)
- Dialog for create/edit:
  - Name input
  - Mode select (Template / Prompt Libre / Edición)
  - Template select (if mode = template, populated from `useAiTemplates`)
  - Prompt textarea
  - Resolution select (1K/2K/4K)
  - Seed image multi-select (show thumbnails from `useSeedImages`, checkboxes to toggle)
- Use `AlertDialog` for delete confirmation

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAiSkills.ts src/components/publicidad/SkillsManager.tsx
git commit -m "feat(publicidad): add skills hook and manager component"
```

---

### Task 7: Settings Panel & Wire to Page

**Files:**
- Create: `src/components/publicidad/SettingsPanel.tsx`
- Modify: `src/pages/PublicidadPage.tsx`

- [ ] **Step 1: Create SettingsPanel**

Create `src/components/publicidad/SettingsPanel.tsx`:

```tsx
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SeedImageManager from './SeedImageManager';
import SavedPromptsManager from './SavedPromptsManager';
import SkillsManager from './SkillsManager';

const SettingsPanel = () => {
  return (
    <Tabs defaultValue="product-seeds" className="w-full">
      <TabsList>
        <TabsTrigger value="product-seeds">Semillas de Producto</TabsTrigger>
        <TabsTrigger value="ad-seeds">Semillas de Publicidad</TabsTrigger>
        <TabsTrigger value="prompts">Prompts Guardados</TabsTrigger>
        <TabsTrigger value="skills">Skills</TabsTrigger>
      </TabsList>

      <TabsContent value="product-seeds">
        <SeedImageManager type="product" />
      </TabsContent>
      <TabsContent value="ad-seeds">
        <SeedImageManager type="advertising" />
      </TabsContent>
      <TabsContent value="prompts">
        <SavedPromptsManager />
      </TabsContent>
      <TabsContent value="skills">
        <SkillsManager />
      </TabsContent>
    </Tabs>
  );
};

export default SettingsPanel;
```

- [ ] **Step 2: Update PublicidadPage to use SettingsPanel**

In `src/pages/PublicidadPage.tsx`, replace the settings placeholder:

```tsx
import SettingsPanel from '@/components/publicidad/SettingsPanel';
// ...
<TabsContent value="settings">
  <SettingsPanel />
</TabsContent>
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit and push**

```bash
git add src/components/publicidad/SettingsPanel.tsx src/pages/PublicidadPage.tsx
git commit -m "feat(publicidad): wire settings panel with seed images, prompts, and skills"
```

---

## Chunk 3: Edge Function & Generation Workspace

### Task 8: Edge Function — generate-ai-image

**Files:**
- Create: `supabase/functions/generate-ai-image/index.ts`

- [ ] **Step 1: Create the edge function**

Create `supabase/functions/generate-ai-image/index.ts`. Follow the pattern from `create-checkout/index.ts`:

Structure:
```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-AI-IMAGE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // 1. Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // 2. Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    logStep("User authenticated", { userId: user.id });

    // 3. Get profile and verify admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();
    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const orgId = profile.organization_id;
    logStep("Admin verified", { orgId });

    // 4. Rate limit check
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from('ai_image_generations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('created_at', today.toISOString());
    if ((count ?? 0) >= 50) {
      return new Response(JSON.stringify({ error: 'Daily limit reached (50/day)', count }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    logStep("Rate limit OK", { used: count, limit: 50 });

    // 5. Parse request
    const { mode, prompt, resolution = '2K', output_format = 'png', seed_image_ids = [], base_image, template_id } = await req.json();
    if (!mode || !prompt) throw new Error("mode and prompt are required");
    logStep("Request parsed", { mode, resolution, seedCount: seed_image_ids.length });

    // 6. Fetch template if needed
    let finalPrompt = prompt;
    if (mode === 'template' && template_id) {
      const { data: template } = await supabaseAdmin
        .from('ai_templates')
        .select('prompt_base')
        .eq('id', template_id)
        .single();
      if (template) {
        finalPrompt = `${template.prompt_base}. ${prompt}`;
      }
    }

    // 7. Fetch seed image URLs
    let seedImageUrls: string[] = [];
    if (seed_image_ids.length > 0) {
      const { data: seeds } = await supabaseAdmin
        .from('ai_seed_images')
        .select('image_url')
        .in('id', seed_image_ids);
      seedImageUrls = (seeds || []).map(s => s.image_url);
      if (seedImageUrls.length > 0) {
        finalPrompt = `Use these reference images as style guide. ${finalPrompt}`;
      }
    }
    logStep("Prompt built", { promptLength: finalPrompt.length, seedUrls: seedImageUrls.length });

    // 8. Call Nano Banana 2 API (Gemini 3.1 Flash Image)
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

    // Build request parts
    const parts: any[] = [];

    // Add seed images as inline_data if provided
    for (const url of seedImageUrls) {
      try {
        const imgResponse = await fetch(url);
        const imgBuffer = await imgResponse.arrayBuffer();
        const base64Img = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
        const mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';
        parts.push({ inline_data: { mime_type: mimeType, data: base64Img } });
      } catch (e) {
        logStep("Failed to fetch seed image", { url, error: e.message });
      }
    }

    // Add base image for edit mode
    if (mode === 'edit' && base_image) {
      parts.push({ inline_data: { mime_type: 'image/jpeg', data: base_image } });
    }

    // Add text prompt
    parts.push({ text: finalPrompt });

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      logStep("Gemini API error", { status: geminiResponse.status, error: errorText });
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    logStep("Gemini response received");

    // Extract image from response
    let imageBase64 = '';
    let imageMimeType = 'image/png';
    const candidates = geminiData.candidates || [];
    for (const candidate of candidates) {
      for (const part of (candidate.content?.parts || [])) {
        if (part.inlineData || part.inline_data) {
          const inlineData = part.inlineData || part.inline_data;
          imageBase64 = inlineData.data;
          imageMimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';
          break;
        }
      }
    }

    if (!imageBase64) {
      throw new Error("No image generated — the API returned text only. Try a more specific prompt.");
    }
    logStep("Image extracted", { mimeType: imageMimeType, size: imageBase64.length });

    // 9. Upload to temp storage
    const imageBuffer = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
    const ext = imageMimeType.includes('png') ? 'png' : 'jpeg';
    const fileName = `${orgId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('publicidad-temp')
      .upload(fileName, imageBuffer, {
        contentType: imageMimeType,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);
    logStep("Image uploaded to temp storage", { path: uploadData.path });

    // 10. Create signed URL (1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('publicidad-temp')
      .createSignedUrl(uploadData.path, 3600);

    if (signedUrlError) throw new Error(`Signed URL error: ${signedUrlError.message}`);
    logStep("Signed URL created");

    // 11. Save generation record
    const { data: generation, error: genError } = await supabaseAdmin
      .from('ai_image_generations')
      .insert({
        organization_id: orgId,
        user_id: user.id,
        mode,
        prompt: finalPrompt,
        template_id: template_id || null,
        base_image_url: base_image ? 'base64-provided' : null,
        resolution,
        output_format: ext,
        config: { seed_image_ids }
      })
      .select('id')
      .single();

    if (genError) logStep("Failed to save generation record", { error: genError.message });

    // Save seed junction records
    if (generation && seed_image_ids.length > 0) {
      const junctionRows = seed_image_ids.map((seedId: string) => ({
        generation_id: generation.id,
        seed_image_id: seedId
      }));
      await supabaseAdmin.from('ai_generation_seeds').insert(junctionRows);
    }

    logStep("Generation record saved", { generationId: generation?.id });

    // 12. Return
    return new Response(JSON.stringify({
      image_url: signedUrlData.signedUrl,
      generation_id: generation?.id,
      generations_today: (count ?? 0) + 1
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```

**Important:** The `GEMINI_API_KEY` must be added to Supabase Edge Function secrets. The user will need to set this via `supabase secrets set GEMINI_API_KEY=<key>` or via Supabase Dashboard > Edge Functions > Secrets.

- [ ] **Step 2: Deploy edge function**

Run: `npx supabase functions deploy generate-ai-image --no-verify-jwt`
(or deploy via Supabase Dashboard)

- [ ] **Step 3: Set GEMINI_API_KEY secret**

The user needs to provide their Gemini API key. Set it via:
```bash
npx supabase secrets set GEMINI_API_KEY=<user-provides-key>
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/generate-ai-image/index.ts
git commit -m "feat(publicidad): add generate-ai-image edge function"
```

---

### Task 9: Generation Hook

**Files:**
- Create: `src/hooks/useAiGeneration.ts`

- [ ] **Step 1: Create useAiGeneration hook**

Create `src/hooks/useAiGeneration.ts`:

```tsx
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GenerationRequest {
  mode: 'template' | 'free' | 'edit';
  prompt: string;
  resolution?: string;
  output_format?: string;
  seed_image_ids?: string[];
  base_image?: string; // base64
  template_id?: string;
}

interface GenerationResult {
  image_url: string;
  generation_id: string;
  generations_today: number;
}

export const useAiGeneration = () => {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationsToday, setGenerationsToday] = useState<number>(0);
  const { toast } = useToast();

  const generate = async (request: GenerationRequest): Promise<GenerationResult | null> => {
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No authenticated session');

      const response = await supabase.functions.invoke('generate-ai-image', {
        body: request,
      });

      if (response.error) {
        throw new Error(response.error.message || 'Generation failed');
      }

      const data = response.data as GenerationResult;

      if (data.error) {
        // Handle specific errors
        if (response.data.error.includes('Daily limit')) {
          toast({ title: 'Límite alcanzado', description: 'Has alcanzado el límite diario de generaciones (50/día).', variant: 'destructive' });
        } else if (response.data.error.includes('Admin access')) {
          toast({ title: 'Sin permisos', description: 'Solo administradores pueden generar imágenes.', variant: 'destructive' });
        } else {
          toast({ title: 'Error', description: data.error, variant: 'destructive' });
        }
        setError(data.error);
        return null;
      }

      setResult(data);
      setGenerationsToday(data.generations_today);
      toast({ title: '¡Imagen generada!', description: 'Tu imagen está lista para descargar.' });
      return data;
    } catch (err: any) {
      const message = err.message || 'Error generating image';
      setError(message);
      toast({ title: 'Error de generación', description: message, variant: 'destructive' });
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const downloadImage = async (url: string, filename?: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename || `sewdle-ai-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo descargar la imagen', variant: 'destructive' });
    }
  };

  const clearResult = () => {
    setResult(null);
    setError(null);
  };

  return { generate, generating, result, error, generationsToday, downloadImage, clearResult };
};
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAiGeneration.ts
git commit -m "feat(publicidad): add AI generation hook with rate limiting"
```

---

### Task 10: Generation Workspace Components

**Files:**
- Create: `src/components/publicidad/GenerateWorkspace.tsx`
- Create: `src/components/publicidad/TemplateSelector.tsx`
- Create: `src/components/publicidad/PromptEditor.tsx`
- Create: `src/components/publicidad/ImageEditor.tsx`
- Create: `src/components/publicidad/ImagePreview.tsx`

- [ ] **Step 1: Create ImagePreview component**

Create `src/components/publicidad/ImagePreview.tsx`:

Shows the generated image with download button. Props:
```tsx
interface ImagePreviewProps {
  imageUrl: string | null;
  generating: boolean;
  onDownload: () => void;
  onClear: () => void;
}
```

UI: If `generating`, show a skeleton/spinner. If `imageUrl`, show the image in a Card with "Descargar" button (Download icon) and "Limpiar" button. If neither, show empty state.

- [ ] **Step 2: Create TemplateSelector component**

Create `src/components/publicidad/TemplateSelector.tsx`:

Props:
```tsx
interface TemplateSelectorProps {
  onSelect: (template: AiTemplate) => void;
  selectedTemplateId: string | null;
}
```

Uses `useAiTemplates()`. Shows two sections: "Producto" and "Publicidad" templates as a grid of clickable cards. Each card shows: name, dimensions (if ad), resolution. Selected card has border highlight.

- [ ] **Step 3: Create PromptEditor component**

Create `src/components/publicidad/PromptEditor.tsx`:

Props:
```tsx
interface PromptEditorProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  resolution: string;
  onResolutionChange: (res: string) => void;
  selectedSeedIds: string[];
  onSeedIdsChange: (ids: string[]) => void;
  onSelectSavedPrompt: (prompt: SavedPrompt) => void;
}
```

UI:
- Textarea for prompt
- Dropdown to select saved prompt (from `useSavedPrompts()`) — selecting one fills the textarea
- Resolution select: 1K / 2K / 4K
- Seed image selector: shows thumbnails from `useSeedImages()` with checkboxes, can select multiple

- [ ] **Step 4: Create ImageEditor component**

Create `src/components/publicidad/ImageEditor.tsx`:

Props:
```tsx
interface ImageEditorProps {
  baseImage: string | null; // base64
  onBaseImageChange: (base64: string | null) => void;
  instructions: string;
  onInstructionsChange: (text: string) => void;
  selectedAdSeedIds: string[];
  onAdSeedIdsChange: (ids: string[]) => void;
}
```

UI:
- Drag-and-drop area for uploading base product image (max 5MB, JPG/PNG/WEBP). Shows thumbnail preview when uploaded. Reuse pattern from `ProductImageUpload.tsx`: validate file type/size, convert to base64 via FileReader.
- Textarea for editing instructions
- Selector for advertising seed images (backgrounds/scenes) from `useSeedImages('advertising')`

- [ ] **Step 5: Create GenerateWorkspace component**

Create `src/components/publicidad/GenerateWorkspace.tsx`:

This is the main workspace that ties everything together.

State:
```tsx
const [mode, setMode] = useState<'template' | 'free' | 'edit'>('template');
const [prompt, setPrompt] = useState('');
const [resolution, setResolution] = useState('2K');
const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
const [selectedSeedIds, setSelectedSeedIds] = useState<string[]>([]);
const [baseImage, setBaseImage] = useState<string | null>(null);
const [editInstructions, setEditInstructions] = useState('');
const [selectedAdSeedIds, setSelectedAdSeedIds] = useState<string[]>([]);
```

Uses `useAiGeneration()` and `useAiSkills()`.

UI layout (two columns on desktop):
- Left column: mode selector (3 buttons: Templates / Prompt Libre / Editar), then mode-specific content:
  - template: TemplateSelector + prompt input for customization details
  - free: PromptEditor
  - edit: ImageEditor
- Right column: ImagePreview + rate limit counter ("X/50 generaciones hoy")
- Top: skill selector dropdown (from `useAiSkills()`) — selecting a skill populates mode, prompt, seeds, resolution
- Bottom of left column: "Generar" button (disabled while generating)

On generate click:
```tsx
const handleGenerate = async () => {
  await generate({
    mode,
    prompt: mode === 'edit' ? editInstructions : prompt,
    resolution,
    seed_image_ids: mode === 'edit' ? selectedAdSeedIds : selectedSeedIds,
    base_image: mode === 'edit' ? baseImage : undefined,
    template_id: mode === 'template' ? selectedTemplateId : undefined,
  });
};
```

- [ ] **Step 6: Build and verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/components/publicidad/GenerateWorkspace.tsx src/components/publicidad/TemplateSelector.tsx src/components/publicidad/PromptEditor.tsx src/components/publicidad/ImageEditor.tsx src/components/publicidad/ImagePreview.tsx
git commit -m "feat(publicidad): add generation workspace with template, free prompt, and edit modes"
```

---

## Chunk 4: History & Final Wiring

### Task 11: Generation History

**Files:**
- Create: `src/hooks/useGenerationHistory.ts`
- Create: `src/components/publicidad/GenerationHistory.tsx`

- [ ] **Step 1: Create useGenerationHistory hook**

Create `src/hooks/useGenerationHistory.ts`:

Interface:
```tsx
interface GenerationRecord {
  id: string;
  mode: 'template' | 'free' | 'edit';
  prompt: string;
  template_id: string | null;
  skill_id: string | null;
  resolution: string | null;
  output_format: string | null;
  config: Record<string, any>;
  created_at: string;
  user_id: string | null;
}
```

Hook signature: `useGenerationHistory(filters?: { mode?: string; dateFrom?: string; dateTo?: string })`

Returns: `{ history, loading, error, refetch }`

Fetch: SELECT from `ai_image_generations` WHERE `organization_id = orgId`, apply optional filters. Order by `created_at DESC`. LIMIT 100.

- [ ] **Step 2: Create GenerationHistory component**

Create `src/components/publicidad/GenerationHistory.tsx`:

Props:
```tsx
interface GenerationHistoryProps {
  onReuse: (record: GenerationRecord) => void;
}
```

UI:
- Filter row: mode select (all/template/free/edit), date range picker
- Table with columns: Fecha, Modo (badge), Prompt (truncated), Resolución, Acciones
- Action column: "Re-usar" button that calls `onReuse` with the record data
- Empty state when no history

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useGenerationHistory.ts src/components/publicidad/GenerationHistory.tsx
git commit -m "feat(publicidad): add generation history hook and component"
```

---

### Task 12: Final Wiring — PublicidadPage

**Files:**
- Modify: `src/pages/PublicidadPage.tsx`

- [ ] **Step 1: Wire all components into PublicidadPage**

Update `src/pages/PublicidadPage.tsx` to import and use all components:

```tsx
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wand2, History, Settings } from 'lucide-react';
import GenerateWorkspace from '@/components/publicidad/GenerateWorkspace';
import GenerationHistory from '@/components/publicidad/GenerationHistory';
import SettingsPanel from '@/components/publicidad/SettingsPanel';

const PublicidadPage = () => {
  const [activeTab, setActiveTab] = useState('generate');

  // State to hold reuse data from history
  const [reuseData, setReuseData] = useState<any>(null);

  const handleReuse = (record: any) => {
    setReuseData(record);
    setActiveTab('generate');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Publicidad</h1>
        <p className="text-muted-foreground">Genera imágenes con IA para productos y publicidad</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Generar
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Ajustes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <GenerateWorkspace reuseData={reuseData} onReuseConsumed={() => setReuseData(null)} />
        </TabsContent>

        <TabsContent value="history">
          <GenerationHistory onReuse={handleReuse} />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PublicidadPage;
```

- [ ] **Step 2: Update GenerateWorkspace to accept reuseData**

Add to `GenerateWorkspace.tsx` props:
```tsx
interface GenerateWorkspaceProps {
  reuseData?: any;
  onReuseConsumed?: () => void;
}
```

Add `useEffect` that watches `reuseData` — when it changes, populate mode, prompt, resolution, template_id, seed_image_ids from the record, then call `onReuseConsumed()`.

- [ ] **Step 3: Build and verify full build succeeds**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/PublicidadPage.tsx src/components/publicidad/GenerateWorkspace.tsx
git commit -m "feat(publicidad): wire all components and add history reuse flow"
```

- [ ] **Step 5: Push to deploy**

```bash
git push origin main
```

Expected: Push succeeds, Vercel deploys automatically

---

## Post-Implementation Notes

- **GEMINI_API_KEY**: Must be set as a Supabase Edge Function secret before the generate function works
- **Storage buckets**: Created via SQL migration — verify they exist in Supabase Dashboard > Storage
- **Permissions**: The "publicidad" module needs to be added to the permissions system (insert into `permissions` table) for the sidebar item to show for admin users. Alternatively, since `isAdmin()` returns true for admins and `canViewModule` returns true for admins regardless of permissions, admin users will see the sidebar item automatically.
- **Nano Banana 2 API model**: The edge function currently uses `gemini-2.0-flash-exp`. When Gemini 3.1 Flash Image becomes available, update the model name to `gemini-3.1-flash-image-preview`.
