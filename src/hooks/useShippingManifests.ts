import { useState, useCallback } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import type { Json, TablesUpdate } from '@/integrations/supabase/types';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ShippingManifest {
  id: string;
  organization_id: string;
  manifest_number: string;
  carrier: string;
  manifest_date: string;
  status: string;
  total_packages: number;
  total_verified: number;
  notes: string | null;
  created_by: string | null;
  closed_by: string | null;
  closed_at: string | null;
  pickup_confirmed_at: string | null;
  pickup_confirmed_by: string | null;
  // Reconciliación al entregar a la transportadora
  collector_reported_count: number | null;
  collector_name: string | null;
  pickup_link_url: string | null;
  reconciliation_status: string | null; // pending | matched | mismatch | overridden
  reconciliation_data: ReconciliationData | null;
  pickup_override_reason: string | null;
  created_at: string;
  updated_at: string;
}

// Guía escaneada (o reportada por la transportadora) que NO está en el manifiesto.
export interface ManifestExtraScan {
  id: string;
  manifest_id: string;
  tracking_number: string;
  source: string; // 'gun' | 'carrier_link'
  scanned_at: string | null;
  scanned_by: string | null;
  created_at: string;
}

// Resultado del cruce con la relación de recogida de la transportadora.
export interface ReconciliationData {
  carrier: string;
  link_url?: string | null;
  collector_name?: string | null;
  total_unidades?: number | null;
  fecha_recogida?: string | null;
  id_recogida?: string | null;
  // Guías en MI manifiesto que NO están en la relación de la transportadora (señal de pérdida).
  missing_in_carrier: string[];
  // Guías en la relación de la transportadora que NO están en mi manifiesto.
  extra_in_carrier: string[];
  matched: string[];
  reconciled_at: string;
}

export interface ReconciliationResult {
  success: boolean;
  status: 'matched' | 'mismatch';
  message: string;
  data: ReconciliationData;
}

export interface ManifestItem {
  id: string;
  manifest_id: string;
  shipping_label_id: string;
  shopify_order_id: number;
  order_number: string;
  tracking_number: string;
  recipient_name: string | null;
  destination_city: string | null;
  scanned_at: string | null;
  scanned_by: string | null;
  scan_status: string;
  notes: string | null;
  created_at: string;
}

export interface ManifestWithItems extends ShippingManifest {
  items: ManifestItem[];
}

export interface ShipmentInput {
  id: string;             // may be 'envia_xxx' or 'manual_xxx' for portal-only guides
  tracking_number: string;
  shopify_order_id: number | null;
  order_number: string | null;
  recipient_name: string | null;
  destination_city: string | null;
}

interface CreateManifestParams {
  carrier: string;
  shipments: ShipmentInput[];
  notes?: string;
}

interface ScanResult {
  success: boolean;
  status: 'verified' | 'already_scanned' | 'not_found' | 'wrong_manifest' | 'error';
  message: string;
  item?: ManifestItem;
}

interface ConfirmPickupResult {
  ok: boolean;
  blocked?: boolean;   // true = bloqueado por descuadre (requiere justificación)
  issues?: string[];   // descripción de cada descuadre detectado
  message?: string;
}

interface AddGuiaResult {
  success: boolean;
  item?: ManifestItem;
  /** Carrier del shipping_label encontrado (para advertir si no coincide con el manifiesto). */
  labelCarrier?: string | null;
  /** true si la guía no existe como shipping_label en la organización. */
  unknownLabel?: boolean;
  message?: string;
}

export const useShippingManifests = () => {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [manifests, setManifests] = useState<ShippingManifest[]>([]);
  const [currentManifest, setCurrentManifest] = useState<ManifestWithItems | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all manifests with optional filters
  const fetchManifests = useCallback(async (filters?: {
    status?: string;
    carrier?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    if (!currentOrganization?.id) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('shipping_manifests')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.carrier) {
        query = query.eq('carrier', filters.carrier);
      }
      if (filters?.dateFrom) {
        query = query.gte('manifest_date', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('manifest_date', filters.dateTo);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      // reconciliation_data llega como Json desde la DB; lo exponemos tipado.
      setManifests((data || []) as unknown as ShippingManifest[]);
    } catch (err: any) {
      console.error('Error fetching manifests:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  // Fetch a single manifest with its items
  const fetchManifestWithItems = useCallback(async (manifestId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: manifest, error: manifestError } = await supabase
        .from('shipping_manifests')
        .select('*')
        .eq('id', manifestId)
        .single();

      if (manifestError) throw manifestError;

      const { data: items, error: itemsError } = await supabase
        .from('manifest_items')
        .select('*')
        .eq('manifest_id', manifestId)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      const manifestWithItems = {
        ...manifest,
        items: items || []
      } as unknown as ManifestWithItems;

      setCurrentManifest(manifestWithItems);
      return manifestWithItems;
    } catch (err: any) {
      console.error('Error fetching manifest:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new manifest
  // Accepts full shipment objects (including portal-only guides with synthetic IDs).
  // For guides not in shipping_labels (envia_xxx / manual_xxx IDs), stub records are
  // inserted first so that the manifest_items FK constraint can be satisfied.
  const createManifest = useCallback(async ({ carrier, shipments, notes }: CreateManifestParams) => {
    if (!currentOrganization?.id || !user?.id) {
      toast.error('Sesión no válida');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // ── Step 1: Resolve real shipping_labels UUIDs for every shipment ────────
      const isSynthetic = (id: string) =>
        id.startsWith('envia_') || id.startsWith('manual_');

      const externalShipments = shipments.filter(s => isSynthetic(s.id));
      const dbShipments       = shipments.filter(s => !isSynthetic(s.id));

      // Mapping tracking_number → real UUID (populated below)
      const trackingToUUID = new Map<string, string>();

      // DB shipments already carry real UUIDs
      dbShipments.forEach(s => trackingToUUID.set(s.tracking_number, s.id));

      if (externalShipments.length > 0) {
        const trackingNumbers = externalShipments.map(s => s.tracking_number);

        // Look up any existing labels by tracking number (may have been created earlier)
        const { data: existingLabels } = await supabase
          .from('shipping_labels')
          .select('id, tracking_number')
          .eq('organization_id', currentOrganization.id)
          .in('tracking_number', trackingNumbers);

        const foundByTracking = new Map<string, string>(
          (existingLabels || []).map(l => [l.tracking_number, l.id])
        );

        // For shipments with no existing label, create lightweight stub records
        const toCreate = externalShipments.filter(s => !foundByTracking.has(s.tracking_number));

        if (toCreate.length > 0) {
          const stubs = toCreate.map(s => {
            // shopify_order_id is NOT NULL and has a unique constraint per (org, order_id).
            // For portal-only guides (no real Shopify order) we derive a safe unique value
            // from the tracking number:
            //   • Numeric tracking (e.g. Coordinadora 57214551667) → parse as int.
            //     These are in the 10-billion range, far from Shopify IDs (~75000).
            //   • Non-numeric → use real shopify_order_id if available, else 0.
            //     (Multiple non-numeric guides from same org with shopify_order_id=0
            //      would still conflict; if that ever occurs, a migration to allow NULL
            //      is the correct long-term fix.)
            const numericTracking = /^\d+$/.test(s.tracking_number)
              ? parseInt(s.tracking_number, 10)
              : null;
            const shopifyOrderId = s.shopify_order_id ?? numericTracking ?? 0;

            return {
              organization_id: currentOrganization.id,
              shopify_order_id: shopifyOrderId,
              order_number: s.order_number || s.tracking_number,
              carrier,
              tracking_number: s.tracking_number,
              status: 'created',
            };
          });

          const { data: createdStubs, error: stubError } = await supabase
            .from('shipping_labels')
            .insert(stubs)
            .select('id, tracking_number');

          if (stubError) throw stubError;

          (createdStubs || []).forEach(l => foundByTracking.set(l.tracking_number, l.id));
        }

        // Register all external shipments in the main map
        externalShipments.forEach(s => {
          const uuid = foundByTracking.get(s.tracking_number);
          if (uuid) trackingToUUID.set(s.tracking_number, uuid);
        });
      }

      // ── Step 2: Generate manifest number ─────────────────────────────────────
      const { data: manifestNumber, error: numError } = await supabase
        .rpc('generate_manifest_number', {
          org_id: currentOrganization.id,
          carrier_code: carrier
        });

      if (numError) throw numError;

      // ── Step 3: Create the manifest record ───────────────────────────────────
      const { data: manifest, error: createError } = await supabase
        .from('shipping_manifests')
        .insert({
          organization_id: currentOrganization.id,
          manifest_number: manifestNumber,
          carrier,
          notes,
          created_by: user.id,
          total_packages: shipments.length
        })
        .select()
        .single();

      if (createError) throw createError;

      // ── Step 4: Create manifest items ─────────────────────────────────────────
      const itemsToInsert = shipments
        .map(s => {
          const labelId = trackingToUUID.get(s.tracking_number);
          if (!labelId) {
            console.warn(`⚠️ No UUID resolved for tracking ${s.tracking_number} — skipping`);
            return null;
          }
          return {
            manifest_id: manifest.id,
            shipping_label_id: labelId,
            shopify_order_id: s.shopify_order_id ?? 0,
            order_number: s.order_number || s.tracking_number,
            tracking_number: s.tracking_number,
            recipient_name: s.recipient_name,
            destination_city: s.destination_city,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('manifest_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      toast.success(`Manifiesto ${manifestNumber} creado con ${itemsToInsert.length} guías`);
      await fetchManifests();
      return manifest;
    } catch (err: any) {
      console.error('Error creating manifest:', err);
      setError(err.message);
      toast.error('Error al crear manifiesto: ' + err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, user?.id, fetchManifests]);

  // Scan a tracking number
  const scanTrackingNumber = useCallback(async (
    manifestId: string,
    trackingNumber: string
  ): Promise<ScanResult> => {
    if (!user?.id) {
      return { success: false, status: 'error', message: 'Sesión no válida' };
    }

    try {
      // ── Fast path: check current manifest directly ────────────────────────
      // Querying by (manifest_id, tracking_number) is indexed and avoids the
      // cross-manifest JOIN that could fail with maybeSingle() when the same
      // tracking number appears in multiple manifests.
      const { data: currentItem, error: currentError } = await supabase
        .from('manifest_items')
        .select('*')
        .eq('manifest_id', manifestId)
        .eq('tracking_number', trackingNumber)
        .maybeSingle();

      if (currentError) throw currentError;

      if (currentItem) {
        // Found in current manifest
        if (currentItem.scanned_at) {
          return {
            success: false,
            status: 'already_scanned',
            message: `Guía ya escaneada el ${new Date(currentItem.scanned_at).toLocaleString()}`,
            item: currentItem
          };
        }

        // Mark as scanned
        const { data: updatedItem, error: updateError } = await supabase
          .from('manifest_items')
          .update({
            scanned_at: new Date().toISOString(),
            scanned_by: user.id,
            scan_status: 'verified'
          })
          .eq('id', currentItem.id)
          .select()
          .single();

        if (updateError) throw updateError;

        // Recalcular total_verified desde el conteo real de items verificados.
        // Es autoritativo (no read-modify-write), así evita la carrera del
        // contador anterior sin acoplar el despliegue a un trigger de DB.
        const { count: verifiedCount } = await supabase
          .from('manifest_items')
          .select('*', { count: 'exact', head: true })
          .eq('manifest_id', manifestId)
          .eq('scan_status', 'verified');

        await supabase
          .from('shipping_manifests')
          .update({ total_verified: verifiedCount ?? 0 })
          .eq('id', manifestId);

        return {
          success: true,
          status: 'verified',
          message: `✓ Guía ${trackingNumber} verificada - Pedido ${currentItem.order_number}`,
          item: updatedItem
        };
      }

      // ── Slow path: not in current manifest — check others ─────────────────
      const { data: otherItem } = await supabase
        .from('manifest_items')
        .select('manifest_id, shipping_manifests!inner(manifest_number)')
        .eq('tracking_number', trackingNumber)
        .limit(1)
        .maybeSingle();

      if (otherItem) {
        return {
          success: false,
          status: 'wrong_manifest',
          message: `Guía pertenece al manifiesto ${(otherItem as any).shipping_manifests.manifest_number}`
        };
      }

      return {
        success: false,
        status: 'not_found',
        message: `Guía ${trackingNumber} no encontrada en ningún manifiesto`
      };
    } catch (err: any) {
      console.error('Error scanning:', err);
      return {
        success: false,
        status: 'error',
        message: 'Error al escanear: ' + err.message
      };
    }
  }, [user?.id]);

  // Close a manifest
  const closeManifest = useCallback(async (manifestId: string) => {
    if (!user?.id) {
      toast.error('Sesión no válida');
      return false;
    }

    try {
      const { error } = await supabase
        .from('shipping_manifests')
        .update({
          status: 'closed',
          closed_by: user.id,
          closed_at: new Date().toISOString()
        })
        .eq('id', manifestId);

      if (error) throw error;

      toast.success('Manifiesto cerrado');
      await fetchManifests();
      return true;
    } catch (err: any) {
      console.error('Error closing manifest:', err);
      toast.error('Error al cerrar manifiesto: ' + err.message);
      return false;
    }
  }, [user?.id, fetchManifests]);

  // Confirm pickup — GATE: bloquea ante descuadre salvo justificación registrada.
  // Re-lee la verdad desde la DB (no confía en el estado de la UI) y, si hay
  // guías pendientes, descuadre con el conteo del recolector, o mismatch del
  // cruce con la transportadora, rechaza el retiro a menos que venga overrideReason.
  const confirmPickup = useCallback(async (
    manifestId: string,
    opts: { overrideReason?: string } = {}
  ): Promise<ConfirmPickupResult> => {
    if (!user?.id) {
      toast.error('Sesión no válida');
      return { ok: false, message: 'Sesión no válida' };
    }

    try {
      const { data: manifest, error: mErr } = await supabase
        .from('shipping_manifests')
        .select('total_verified, collector_reported_count, reconciliation_status')
        .eq('id', manifestId)
        .single();
      if (mErr) throw mErr;

      const { data: itemRows, error: iErr } = await supabase
        .from('manifest_items')
        .select('scan_status')
        .eq('manifest_id', manifestId);
      if (iErr) throw iErr;

      const verified = (itemRows || []).filter(i => i.scan_status === 'verified').length;
      // Las canceladas no son paquetes efectivos: no cuentan como pendientes.
      const canceled = (itemRows || []).filter(i => i.scan_status === 'canceled').length;
      const pending = (itemRows || []).length - verified - canceled;
      const collectorCount = manifest?.collector_reported_count ?? null;

      const issues: string[] = [];
      if (pending > 0) {
        issues.push(`Faltan ${pending} guía${pending !== 1 ? 's' : ''} por escanear`);
      }
      if (collectorCount != null && collectorCount !== verified) {
        issues.push(`El recolector reporta ${collectorCount} y verificaste ${verified}`);
      }
      if (manifest?.reconciliation_status === 'mismatch') {
        issues.push('El cruce con la relación de la transportadora no cuadra');
      }

      const overrideReason = opts.overrideReason?.trim();
      if (issues.length > 0 && !overrideReason) {
        // No persistimos nada: el retiro queda bloqueado hasta resolver o justificar.
        return {
          ok: false,
          blocked: true,
          issues,
          message: 'Hay un descuadre. Resuelve o justifica antes de confirmar el retiro.',
        };
      }

      const update: TablesUpdate<'shipping_manifests'> = {
        status: 'picked_up',
        pickup_confirmed_at: new Date().toISOString(),
        pickup_confirmed_by: user.id,
      };
      if (overrideReason) {
        update.pickup_override_reason = overrideReason;
        if (issues.length > 0) update.reconciliation_status = 'overridden';
      }

      const { error } = await supabase
        .from('shipping_manifests')
        .update(update)
        .eq('id', manifestId);
      if (error) throw error;

      toast.success(overrideReason && issues.length > 0
        ? 'Retiro confirmado con justificación'
        : 'Retiro confirmado');
      await fetchManifests();
      return { ok: true };
    } catch (err: any) {
      console.error('Error confirming pickup:', err);
      toast.error('Error al confirmar retiro: ' + err.message);
      return { ok: false, message: err.message };
    }
  }, [user?.id, fetchManifests]);

  // Delete a manifest (any status)
  // Uses an edge function with service_role to bypass RLS restrictions
  // (RLS only allowed deleting 'open' manifests, but users can delete any status)
  const deleteManifest = useCallback(async (manifestId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/delete-manifest`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ manifest_id: manifestId }),
        }
      );

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Error al eliminar manifiesto');
      }

      // Update local state immediately
      setManifests(prev => prev.filter(m => m.id !== manifestId));
      toast.success('Manifiesto eliminado');
      return true;
    } catch (err: any) {
      console.error('Error deleting manifest:', err);
      toast.error('Error al eliminar: ' + err.message);
      return false;
    }
  }, []);

  // Get available labels for manifest creation
  const getAvailableLabels = useCallback(async (carrier?: string, dateFrom?: string, dateTo?: string) => {
    if (!currentOrganization?.id) return [];

    try {
      let query = supabase
        .from('shipping_labels')
        .select('id, shopify_order_id, order_number, tracking_number, carrier, recipient_name, destination_city, created_at')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'created')
        .not('tracking_number', 'is', null);

      if (carrier) {
        query = query.eq('carrier', carrier);
      }
      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo + 'T23:59:59');
      }

      const { data: labels, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out labels already in a manifest
      const { data: usedLabels } = await supabase
        .from('manifest_items')
        .select('shipping_label_id');

      const usedIds = new Set((usedLabels || []).map(l => l.shipping_label_id));
      
      return (labels || []).filter(l => !usedIds.has(l.id));
    } catch (err: any) {
      console.error('Error fetching available labels:', err);
      return [];
    }
  }, [currentOrganization?.id]);

  // Mark item as missing
  const markItemMissing = useCallback(async (itemId: string, notes?: string) => {
    try {
      const { error } = await supabase
        .from('manifest_items')
        .update({
          scan_status: 'missing',
          notes
        })
        .eq('id', itemId);

      if (error) throw error;
      return true;
    } catch (err: any) {
      console.error('Error marking item missing:', err);
      return false;
    }
  }, []);

  // Registrar el conteo que reporta el recolector (todas las transportadoras).
  const recordCollectorCount = useCallback(async (
    manifestId: string,
    count: number | null,
    name?: string | null
  ) => {
    try {
      const update: TablesUpdate<'shipping_manifests'> = { collector_reported_count: count };
      if (name !== undefined) update.collector_name = name;
      const { error } = await supabase
        .from('shipping_manifests')
        .update(update)
        .eq('id', manifestId);
      if (error) throw error;
      return true;
    } catch (err: any) {
      console.error('Error recording collector count:', err);
      toast.error('Error al guardar el conteo del recolector: ' + err.message);
      return false;
    }
  }, []);

  // Persistir una guía escaneada que NO está en el manifiesto (antes solo en estado de React).
  const persistExtraScan = useCallback(async (
    manifestId: string,
    trackingNumber: string,
    source: 'gun' | 'carrier_link' = 'gun'
  ) => {
    try {
      const { error } = await supabase
        .from('manifest_extra_scans')
        .upsert(
          {
            manifest_id: manifestId,
            tracking_number: trackingNumber,
            source,
            scanned_at: new Date().toISOString(),
            scanned_by: user?.id ?? null,
          },
          { onConflict: 'manifest_id,tracking_number', ignoreDuplicates: true }
        );
      if (error) throw error;
      return true;
    } catch (err: any) {
      console.error('Error persisting extra scan:', err);
      return false;
    }
  }, [user?.id]);

  // Cargar las guías extra persistidas de un manifiesto.
  const fetchExtraScans = useCallback(async (manifestId: string): Promise<ManifestExtraScan[]> => {
    try {
      const { data, error } = await supabase
        .from('manifest_extra_scans')
        .select('*')
        .eq('manifest_id', manifestId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ManifestExtraScan[];
    } catch (err: any) {
      console.error('Error fetching extra scans:', err);
      return [];
    }
  }, []);

  // Agregar al vuelo una guía escaneada que no estaba en el manifiesto pero sí
  // existe como shipping_label en la organización (objetivo: que nada entregado
  // quede sin rastrear). Se inserta ya como 'verified' porque se acaba de escanear.
  const addScannedGuiaToManifest = useCallback(async (
    manifestId: string,
    trackingNumber: string
  ): Promise<AddGuiaResult> => {
    if (!currentOrganization?.id || !user?.id) {
      return { success: false, message: 'Sesión no válida' };
    }
    try {
      const { data: label } = await supabase
        .from('shipping_labels')
        .select('id, carrier, order_number, recipient_name, destination_city, shopify_order_id')
        .eq('organization_id', currentOrganization.id)
        .eq('tracking_number', trackingNumber)
        .maybeSingle();

      const { data: inserted, error } = await supabase
        .from('manifest_items')
        .insert({
          manifest_id: manifestId,
          shipping_label_id: label?.id ?? null,
          shopify_order_id: label?.shopify_order_id ?? null,
          order_number: label?.order_number ?? trackingNumber,
          tracking_number: trackingNumber,
          recipient_name: label?.recipient_name ?? null,
          destination_city: label?.destination_city ?? null,
          scanned_at: new Date().toISOString(),
          scanned_by: user.id,
          scan_status: 'verified',
        })
        .select()
        .single();

      if (error) {
        // 23505 = la guía ya está en el manifiesto: lo tratamos como éxito.
        if ((error as any).code === '23505') {
          return { success: true, labelCarrier: label?.carrier ?? null };
        }
        throw error;
      }

      // Si estaba registrada como "extra", ya no lo es.
      await supabase
        .from('manifest_extra_scans')
        .delete()
        .eq('manifest_id', manifestId)
        .eq('tracking_number', trackingNumber);

      // Recalcular contadores: agregar al vuelo cambia tanto el total como lo verificado.
      // total_packages = guías efectivas (excluye canceladas: no son paquetes reales).
      const [{ count: totalCount }, { count: verifiedCount }] = await Promise.all([
        supabase.from('manifest_items').select('*', { count: 'exact', head: true })
          .eq('manifest_id', manifestId).neq('scan_status', 'canceled'),
        supabase.from('manifest_items').select('*', { count: 'exact', head: true })
          .eq('manifest_id', manifestId).eq('scan_status', 'verified'),
      ]);
      await supabase
        .from('shipping_manifests')
        .update({ total_packages: totalCount ?? 0, total_verified: verifiedCount ?? 0 })
        .eq('id', manifestId);

      return {
        success: true,
        item: inserted as ManifestItem,
        labelCarrier: label?.carrier ?? null,
        unknownLabel: !label,
      };
    } catch (err: any) {
      console.error('Error adding guia to manifest:', err);
      return { success: false, message: err.message };
    }
  }, [currentOrganization?.id, user?.id]);

  // Cruzar el manifiesto contra la "relación de recogida" de Coordinadora (link/tirilla).
  // Calcula los descuadres bidireccionales, persiste el resultado y auto-rellena el
  // conteo del recolector (= total_unidades de la relación).
  const reconcileWithCoordinadora = useCallback(async (
    manifestId: string,
    urlOrToken: string
  ): Promise<ReconciliationResult | null> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/coordinadora-pickup-relacion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ url: urlOrToken }),
        }
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        toast.error(payload.error || 'No se pudo leer la relación de Coordinadora');
        return null;
      }

      // Guías del manifiesto (lado nuestro). Excluimos las canceladas: no son
      // paquetes efectivos, así que no deben salir como 🔴 "falta en la relación".
      const { data: items, error: itemsErr } = await supabase
        .from('manifest_items')
        .select('tracking_number')
        .eq('manifest_id', manifestId)
        .neq('scan_status', 'canceled');
      if (itemsErr) throw itemsErr;

      const mineList = (items || []).map(i => String(i.tracking_number).trim());
      const mineSet = new Set(mineList);
      const carrierList: string[] = (payload.guias || []).map((g: string) => String(g).trim());
      const carrierSet = new Set(carrierList);

      const matched = mineList.filter(t => carrierSet.has(t));
      const missing_in_carrier = mineList.filter(t => !carrierSet.has(t)); // entregué pero no la registraron
      const extra_in_carrier = carrierList.filter(g => !mineSet.has(g));    // la registraron pero no está en mi manifiesto

      const status: 'matched' | 'mismatch' =
        missing_in_carrier.length === 0 && extra_in_carrier.length === 0 ? 'matched' : 'mismatch';

      const reconciliation_data: ReconciliationData = {
        carrier: 'coordinadora',
        link_url: urlOrToken,
        collector_name: payload.collector_name ?? null,
        total_unidades: payload.total_unidades ?? carrierList.length,
        fecha_recogida: payload.fecha_recogida ?? null,
        id_recogida: payload.id_recogida ?? null,
        missing_in_carrier,
        extra_in_carrier,
        matched,
        reconciled_at: new Date().toISOString(),
      };

      const { error: updErr } = await supabase
        .from('shipping_manifests')
        .update({
          pickup_link_url: urlOrToken,
          collector_reported_count: payload.total_unidades ?? carrierList.length,
          collector_name: payload.collector_name ?? null,
          reconciliation_status: status,
          reconciliation_data: reconciliation_data as unknown as Json,
        })
        .eq('id', manifestId);
      if (updErr) throw updErr;

      // Las guías que la transportadora registró pero no están en el manifiesto
      // quedan auditadas como extras de origen 'carrier_link'.
      if (extra_in_carrier.length > 0) {
        await supabase
          .from('manifest_extra_scans')
          .upsert(
            extra_in_carrier.map(t => ({
              manifest_id: manifestId,
              tracking_number: t,
              source: 'carrier_link',
              scanned_by: user?.id ?? null,
            })),
            { onConflict: 'manifest_id,tracking_number', ignoreDuplicates: true }
          );
      }

      await fetchManifests();

      return {
        success: true,
        status,
        message: status === 'matched'
          ? `Todo cuadra: ${matched.length} guías coinciden con Coordinadora`
          : `Descuadre: ${missing_in_carrier.length} no están en la relación · ${extra_in_carrier.length} sin escanear`,
        data: reconciliation_data,
      };
    } catch (err: any) {
      console.error('Error reconciling with Coordinadora:', err);
      toast.error('Error al cruzar con Coordinadora: ' + err.message);
      return null;
    }
  }, [user?.id, fetchManifests]);

  return {
    manifests,
    currentManifest,
    loading,
    error,
    fetchManifests,
    fetchManifestWithItems,
    createManifest,
    scanTrackingNumber,
    closeManifest,
    confirmPickup,
    deleteManifest,
    getAvailableLabels,
    markItemMissing,
    recordCollectorCount,
    persistExtraScan,
    fetchExtraScans,
    addScannedGuiaToManifest,
    reconcileWithCoordinadora,
  };
};
