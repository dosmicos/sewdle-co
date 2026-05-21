import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Pencil,
  Eye,
  EyeOff,
  ChevronDown,
  ExternalLink,
  Store,
  AlertCircle,
  Power,
  Link,
} from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useStores, StoreUpsert } from '@/hooks/useStores';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Store as StoreType } from '@/hooks/useStores';

/* ─── Constants ─────────────────────────────────────────────── */

const SUPABASE_OAUTH_URL = 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/shopify-oauth';

const COUNTRY_OPTIONS = [
  { code: 'CO', label: '🇨🇴 Colombia',       currency: 'COP' },
  { code: 'US', label: '🇺🇸 Estados Unidos', currency: 'USD' },
  { code: 'MX', label: '🇲🇽 México',         currency: 'MXN' },
  { code: 'AR', label: '🇦🇷 Argentina',      currency: 'ARS' },
  { code: 'BR', label: '🇧🇷 Brasil',         currency: 'BRL' },
  { code: 'PE', label: '🇵🇪 Perú',           currency: 'PEN' },
  { code: 'CL', label: '🇨🇱 Chile',          currency: 'CLP' },
  { code: 'EC', label: '🇪🇨 Ecuador',        currency: 'USD' },
  { code: 'PA', label: '🇵🇦 Panamá',         currency: 'USD' },
  { code: 'CR', label: '🇨🇷 Costa Rica',     currency: 'CRC' },
];

const COUNTRY_FLAGS: Record<string, string> = Object.fromEntries(
  COUNTRY_OPTIONS.map(c => [c.code, c.label.split(' ')[0]])
);

function getFlag(code: string | null) {
  return code ? (COUNTRY_FLAGS[code.toUpperCase()] ?? '🏪') : '🏪';
}

function normalizeStoreUrl(url: string): string {
  let clean = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!clean.includes('.myshopify.com')) {
    if (!clean.includes('.')) clean = `${clean}.myshopify.com`;
  }
  return `https://${clean}`;
}

/** Extract the bare hostname for OAuth (e.g. "store.myshopify.com") */
function extractShopDomain(storeUrl: string): string {
  return storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** Open OAuth popup for the given store */
function openShopifyOAuth(store: StoreType) {
  const domain = extractShopDomain(store.shopify_store_url ?? '');
  if (!domain) {
    toast.error('La tienda no tiene una URL de Shopify configurada.');
    return;
  }
  const oauthUrl = `${SUPABASE_OAUTH_URL}?shop=${encodeURIComponent(domain)}&state=${store.id}`;
  window.open(oauthUrl, 'shopify-oauth', 'width=640,height=720,left=200,top=100');
}

/* ─── Store Form Dialog ──────────────────────────────────────── */

interface StoreFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editStore?: StoreType | null;
  organizationId: string;
  onSaved: () => void;
  upsertStore: (data: StoreUpsert) => Promise<StoreType | null>;
}

const StoreFormDialog: React.FC<StoreFormDialogProps> = ({
  open,
  onOpenChange,
  editStore,
  organizationId,
  onSaved,
  upsertStore,
}) => {
  const isEdit = !!editStore;

  const [name,        setName]        = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [currency,    setCurrency]    = useState('USD');
  const [storeUrl,    setStoreUrl]    = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken,   setShowToken]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [testing,     setTesting]     = useState(false);
  const [testResult,  setTestResult]  = useState<{ success: boolean; message: string } | null>(null);
  const [guideOpen,   setGuideOpen]   = useState(false);

  // Seed form when opening
  useEffect(() => {
    if (open) {
      if (editStore) {
        setName(editStore.name);
        setCountryCode(editStore.country_code || 'CO');
        setCurrency(editStore.currency || 'COP');
        setStoreUrl(editStore.shopify_store_url || '');
        setAccessToken(editStore.shopify_credentials?.access_token || '');
        setGuideOpen(false);
      } else {
        setName('');
        setCountryCode('US');
        setCurrency('USD');
        setStoreUrl('');
        setAccessToken('');
        setGuideOpen(false);
      }
      setTestResult(null);
      setShowToken(false);
    }
  }, [open, editStore]);

  const handleCountryChange = (code: string) => {
    setCountryCode(code);
    const found = COUNTRY_OPTIONS.find(c => c.code === code);
    if (found) setCurrency(found.currency);
  };

  const validate = (): string | null => {
    if (!name.trim())    return 'El nombre de la tienda es requerido';
    if (!storeUrl.trim()) return 'La URL de la tienda es requerida';
    const normalized = normalizeStoreUrl(storeUrl);
    if (!normalized.includes('.myshopify.com'))
      return 'La URL debe ser un dominio válido de Shopify (ej: tienda.myshopify.com)';
    return null; // token is optional — can be connected via OAuth after saving
  };

  const handleTestConnection = async () => {
    if (!accessToken.trim()) { toast.error('Ingresa un token para probar la conexión'); return; }
    const err = validate();
    if (err) { toast.error(err); return; }

    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-shopify-connection', {
        body: { storeUrl: normalizeStoreUrl(storeUrl), accessToken: accessToken.trim() },
      });
      if (error) throw error;
      setTestResult({ success: data.success, message: data.message });
      if (data.success) toast.success('Conexión exitosa');
      else toast.error(data.message || 'Error al conectar');
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Error al probar la conexión' });
      toast.error('Error al probar la conexión');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }

    setSaving(true);
    const payload: StoreUpsert = {
      ...(isEdit ? { id: editStore!.id } : {}),
      organization_id: organizationId,
      name:             name.trim(),
      country_code:     countryCode,
      currency,
      shopify_store_url: normalizeStoreUrl(storeUrl),
      is_active: editStore?.is_active ?? true,
      ...(accessToken.trim()
        ? { shopify_credentials: { access_token: accessToken.trim(), configured_at: new Date().toISOString() } }
        : (isEdit ? {} : { shopify_credentials: {} })
      ),
    };

    const result = await upsertStore(payload);
    setSaving(false);
    if (result) {
      onSaved();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            {isEdit ? `Editar tienda: ${editStore?.name}` : 'Agregar nueva tienda'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Actualiza la configuración de esta tienda.'
              : 'Conecta una nueva tienda de Shopify a Sewdle.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">

          {/* ── Pasos rápidos ── */}
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-blue-700 text-sm">
              <strong>Flujo recomendado:</strong> Llena los campos de abajo → guarda la tienda →
              haz clic en <strong>"Conectar con Shopify"</strong> en la tarjeta para obtener el token automáticamente.
            </AlertDescription>
          </Alert>

          {/* ── Form fields ── */}
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="store-name">Nombre de la tienda</Label>
                <Input
                  id="store-name"
                  placeholder="Ej: México"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>País</Label>
                <Select value={countryCode} onValueChange={handleCountryChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="store-url">URL de Shopify</Label>
                <Input
                  id="store-url"
                  placeholder="tienda.myshopify.com"
                  value={storeUrl}
                  onChange={e => setStoreUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Solo el dominio .myshopify.com</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store-currency">Moneda</Label>
                <Input
                  id="store-currency"
                  placeholder="USD"
                  value={currency}
                  onChange={e => setCurrency(e.target.value.toUpperCase())}
                  maxLength={3}
                />
              </div>
            </div>

            {/* ── Token (optional) ── */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="access-token">
                  Admin API Access Token
                  <span className="ml-1.5 text-xs text-muted-foreground font-normal">(opcional — puedes conectar después)</span>
                </Label>
              </div>
              <div className="relative">
                <Input
                  id="access-token"
                  type={showToken ? 'text' : 'password'}
                  placeholder="shpat_xxxxxxxxxxxx  (dejar vacío para conectar vía OAuth)"
                  value={accessToken}
                  onChange={e => setAccessToken(e.target.value)}
                  className="pr-10 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowToken(v => !v)}
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* ── Cómo obtener el token (collapsible guide) ── */}
            <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                  <span className="text-xs">¿Cómo obtener el token manualmente?</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${guideOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="rounded-md border bg-muted/40 p-4 mt-1 space-y-2 text-sm">
                  <ol className="space-y-1.5 list-none">
                    {[
                      <>Shopify Admin → <strong>Settings → Apps → Develop apps</strong></>,
                      <>Clic en <strong>"Create an app"</strong> → dale un nombre</>,
                      <>En la app: <strong>Configuration → Admin API integration</strong> → activa permisos</>,
                      <>Guarda → <strong>API credentials → Install app</strong></>,
                      <>Copia el token <code className="bg-background rounded px-1">shpat_...</code> (solo se muestra una vez)</>,
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Badge variant="outline" className="mt-0.5 h-5 min-w-5 flex items-center justify-center text-xs shrink-0">{i + 1}</Badge>
                        <span className="text-muted-foreground">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* ── Test result ── */}
          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'}>
              {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}

          {/* ── Actions ── */}
          <div className="flex items-center justify-between pt-1">
            <Button variant="outline" onClick={handleTestConnection} disabled={testing || saving || !accessToken.trim()}>
              {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {!testing && <CheckCircle className="h-4 w-4 mr-2" />}
              Probar conexión
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || testing}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEdit ? 'Guardar cambios' : 'Agregar tienda'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Store Card ─────────────────────────────────────────────── */

interface StoreCardProps {
  store: StoreType;
  onEdit:     (s: StoreType) => void;
  onToggle:   (id: string, active: boolean) => void;
  onConnected: () => void;
}

const StoreCard: React.FC<StoreCardProps> = ({ store, onEdit, onToggle, onConnected }) => {
  const [toggling, setToggling] = useState(false);
  const hasToken = !!store.shopify_credentials?.access_token;

  const handleToggle = async () => {
    setToggling(true);
    await onToggle(store.id, !store.is_active);
    setToggling(false);
  };

  const handleConnect = () => {
    openShopifyOAuth(store);
    // Listen for OAuth success message from popup
    const handler = (e: MessageEvent) => {
      if (e.data === 'shopify-oauth-success') {
        window.removeEventListener('message', handler);
        onConnected();
        toast.success(`✅ Shopify conectado — ${store.name}`);
      }
    };
    window.addEventListener('message', handler);
    // Cleanup listener after 5 minutes (in case user closes popup without completing)
    setTimeout(() => window.removeEventListener('message', handler), 5 * 60 * 1000);
  };

  return (
    <Card className={`transition-opacity ${store.is_active ? '' : 'opacity-60'}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <span className="text-xl leading-none">{getFlag(store.country_code)}</span>
            {store.name}
          </span>
          <Badge variant={store.is_active ? 'default' : 'secondary'} className="text-xs">
            {store.is_active ? 'Activa' : 'Inactiva'}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground space-y-1">
          {store.shopify_store_url ? (
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
              <a
                href={store.shopify_store_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs hover:underline truncate text-foreground"
              >
                {store.shopify_store_url.replace('https://', '')}
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-orange-500">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Sin URL de Shopify configurada
            </div>
          )}

          {hasToken ? (
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle className="h-3.5 w-3.5 shrink-0" />
              Token configurado
              {store.shopify_credentials?.configured_at && (
                <span className="text-muted-foreground/70 ml-1">
                  · {new Date(store.shopify_credentials.configured_at).toLocaleDateString()}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-orange-500">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Sin token — conecta con Shopify
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Moneda: <span className="font-medium">{store.currency}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Connect via OAuth — shown when no token or to re-connect */}
          {store.shopify_store_url && (
            <Button
              variant={hasToken ? 'ghost' : 'default'}
              size="sm"
              className={`gap-1.5 text-xs h-8 ${hasToken ? 'text-muted-foreground' : ''}`}
              onClick={handleConnect}
            >
              <Link className="h-3 w-3" />
              {hasToken ? 'Reconectar' : 'Conectar con Shopify'}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8"
            onClick={() => onEdit(store)}
          >
            <Pencil className="h-3 w-3" />
            Editar
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={`gap-1.5 text-xs h-8 ${store.is_active ? 'text-muted-foreground' : 'text-green-600'}`}
            onClick={handleToggle}
            disabled={toggling}
          >
            {toggling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Power className="h-3 w-3" />}
            {store.is_active ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

/* ─── Main Panel ─────────────────────────────────────────────── */

export const StoresSettingsPanel: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id ?? null;
  const { stores, loading, fetchStores, upsertStore, toggleStoreActive } = useStores(orgId);

  const [showForm, setShowForm] = useState(false);
  const [editStore, setEditStore] = useState<StoreType | null>(null);

  // Listen for OAuth success from popup window
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data === 'shopify-oauth-success') fetchStores();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [fetchStores]);

  const handleEdit  = (store: StoreType) => { setEditStore(store); setShowForm(true); };
  const handleAdd   = () => { setEditStore(null); setShowForm(true); };
  const handleClose = (open: boolean) => { setShowForm(open); if (!open) setEditStore(null); };

  if (!orgId) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gestión de Tiendas</h2>
          <p className="text-sm text-muted-foreground">
            Conecta y administra tus tiendas de Shopify. Puedes tener una tienda por país.
          </p>
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Agregar tienda
        </Button>
      </div>

      {/* ── How to add a store ── */}
      <Card className="border-dashed bg-muted/20">
        <CardContent className="pt-4 pb-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">¿Cómo agregar una nueva tienda?</p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {[
              '1. Clic en "Agregar tienda"',
              '2. Llena nombre, país y URL (.myshopify.com)',
              '3. Guarda la tienda',
              '4. Clic en "Conectar con Shopify" → autoriza en 1 clic',
            ].map((step, i) => (
              <span key={i} className="bg-background border rounded px-2 py-1">{step}</span>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : stores.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <Store className="h-10 w-10 text-muted-foreground/50" />
            <div>
              <p className="font-medium">No hay tiendas configuradas</p>
              <p className="text-sm text-muted-foreground">
                Agrega tu primera tienda de Shopify para comenzar a sincronizar órdenes.
              </p>
            </div>
            <Button onClick={handleAdd} className="gap-2 mt-2">
              <Plus className="h-4 w-4" />
              Agregar tienda
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map(store => (
            <StoreCard
              key={store.id}
              store={store}
              onEdit={handleEdit}
              onToggle={toggleStoreActive}
              onConnected={fetchStores}
            />
          ))}
        </div>
      )}

      <StoreFormDialog
        open={showForm}
        onOpenChange={handleClose}
        editStore={editStore}
        organizationId={orgId}
        onSaved={fetchStores}
        upsertStore={upsertStore}
      />
    </div>
  );
};
