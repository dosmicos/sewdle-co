import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useStores, StoreUpsert } from '@/hooks/useStores';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Store as StoreType } from '@/hooks/useStores';

/* ─── Constants ─────────────────────────────────────────────── */

const COUNTRY_OPTIONS = [
  { code: 'CO', label: '🇨🇴 Colombia', currency: 'COP' },
  { code: 'US', label: '🇺🇸 Estados Unidos', currency: 'USD' },
  { code: 'MX', label: '🇲🇽 México', currency: 'MXN' },
  { code: 'AR', label: '🇦🇷 Argentina', currency: 'ARS' },
  { code: 'BR', label: '🇧🇷 Brasil', currency: 'BRL' },
  { code: 'PE', label: '🇵🇪 Perú', currency: 'PEN' },
  { code: 'CL', label: '🇨🇱 Chile', currency: 'CLP' },
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

  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [currency, setCurrency] = useState('USD');
  const [storeUrl, setStoreUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [guideOpen, setGuideOpen] = useState(!isEdit);

  // Seed form when editing
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
        setGuideOpen(true);
      }
      setTestResult(null);
      setShowToken(false);
    }
  }, [open, editStore]);

  // Auto-set currency when country changes
  const handleCountryChange = (code: string) => {
    setCountryCode(code);
    const found = COUNTRY_OPTIONS.find(c => c.code === code);
    if (found) setCurrency(found.currency);
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'El nombre de la tienda es requerido';
    if (!storeUrl.trim()) return 'La URL de la tienda es requerida';
    if (!accessToken.trim()) return 'El token de acceso es requerido';
    const normalized = normalizeStoreUrl(storeUrl);
    if (!normalized.includes('.myshopify.com'))
      return 'La URL debe ser una tienda válida de Shopify (ej: tienda.myshopify.com)';
    return null;
  };

  const handleTestConnection = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }

    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-shopify-connection', {
        body: {
          storeUrl: normalizeStoreUrl(storeUrl),
          accessToken: accessToken.trim(),
        },
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
      name: name.trim(),
      country_code: countryCode,
      currency,
      shopify_store_url: normalizeStoreUrl(storeUrl),
      shopify_credentials: {
        access_token: accessToken.trim(),
        configured_at: new Date().toISOString(),
      },
      is_active: editStore?.is_active ?? true,
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
              ? 'Actualiza las credenciales y la configuración de esta tienda.'
              : 'Conecta una nueva tienda de Shopify a Sewdle.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* ── How to get Access Token guide ── */}
          <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <span className="text-xs font-medium">
                  ¿Cómo obtener el Access Token de Shopify?
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${guideOpen ? 'rotate-180' : ''}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="rounded-md border bg-muted/40 p-4 mt-2 space-y-3 text-sm">
                <p className="font-medium text-sm">Pasos para crear una Custom App en Shopify:</p>
                <ol className="space-y-2 list-none">
                  {[
                    <>Ve a tu Admin de Shopify → <strong>Settings → Apps and sales channels</strong></>,
                    <>Haz clic en <strong>"Develop apps"</strong> (arriba a la derecha)</>,
                    <>Clic en <strong>"Create an app"</strong> y dale un nombre (ej: "Sewdle")</>,
                    <>En la app, ve a <strong>"Configuration"</strong> → <strong>"Admin API integration"</strong></>,
                    <>Activa los permisos: <code className="bg-background rounded px-1">read_orders</code>, <code className="bg-background rounded px-1">read_products</code>, <code className="bg-background rounded px-1">read_inventory</code>, <code className="bg-background rounded px-1">write_inventory</code>, <code className="bg-background rounded px-1">read_customers</code></>,
                    <>Guarda y luego ve a <strong>"API credentials"</strong> → haz clic en <strong>"Install app"</strong></>,
                    <>Copia el <strong>"Admin API access token"</strong> — solo se muestra una vez</>,
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5 h-5 min-w-5 flex items-center justify-center text-xs shrink-0">
                        {i + 1}
                      </Badge>
                      <span className="text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
                <a
                  href="https://help.shopify.com/en/manual/apps/app-types/custom-apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Documentación oficial de Shopify
                </a>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Form fields ── */}
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="store-name">Nombre de la tienda</Label>
                <Input
                  id="store-name"
                  placeholder="Ej: Estados Unidos"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>País</Label>
                <Select value={countryCode} onValueChange={handleCountryChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS.map(c => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
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
                <p className="text-xs text-muted-foreground">Solo el dominio, sin https://</p>
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

            <div className="space-y-1.5">
              <Label htmlFor="access-token">Admin API Access Token</Label>
              <div className="relative">
                <Input
                  id="access-token"
                  type={showToken ? 'text' : 'password'}
                  placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
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
          </div>

          {/* ── Test result ── */}
          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'}>
              {testResult.success
                ? <CheckCircle className="h-4 w-4" />
                : <XCircle className="h-4 w-4" />}
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}

          {/* ── Actions ── */}
          <div className="flex items-center justify-between pt-1">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || saving}
            >
              {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {!testing && <CheckCircle className="h-4 w-4 mr-2" />}
              Probar conexión
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
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
  onEdit: (s: StoreType) => void;
  onToggle: (id: string, active: boolean) => void;
}

const StoreCard: React.FC<StoreCardProps> = ({ store, onEdit, onToggle }) => {
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    await onToggle(store.id, !store.is_active);
    setToggling(false);
  };

  return (
    <Card className={`transition-opacity ${store.is_active ? '' : 'opacity-60'}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <span className="text-xl leading-none">{getFlag(store.country_code)}</span>
            {store.name}
          </span>
          <div className="flex items-center gap-1.5">
            <Badge variant={store.is_active ? 'default' : 'secondary'} className="text-xs">
              {store.is_active ? 'Activa' : 'Inactiva'}
            </Badge>
          </div>
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
          {store.shopify_credentials?.access_token ? (
            <div className="flex items-center gap-1.5 text-xs">
              <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
              Token configurado
              {store.shopify_credentials.configured_at && (
                <span className="text-muted-foreground/70 ml-1">
                  · {new Date(store.shopify_credentials.configured_at).toLocaleDateString()}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-orange-500">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Token no configurado
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Moneda: <span className="font-medium">{store.currency}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
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
            {toggling ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Power className="h-3 w-3" />
            )}
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

  const handleEdit = (store: StoreType) => {
    setEditStore(store);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditStore(null);
    setShowForm(true);
  };

  const handleFormClose = (open: boolean) => {
    setShowForm(open);
    if (!open) setEditStore(null);
  };

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
            />
          ))}
        </div>
      )}

      <StoreFormDialog
        open={showForm}
        onOpenChange={handleFormClose}
        editStore={editStore}
        organizationId={orgId}
        onSaved={fetchStores}
        upsertStore={upsertStore}
      />
    </div>
  );
};
