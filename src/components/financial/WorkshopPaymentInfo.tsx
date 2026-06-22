import { useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Landmark, KeyRound, Copy, Check, Pencil, Loader2, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WorkshopPaymentInfoProps {
  workshopId: string;
  workshopName?: string | null;
}

interface PaymentInfo {
  bre_b: string;
  bank_name: string;
  bank_account_type: string;
  bank_account_number: string;
  account_holder: string;
  account_holder_document: string;
}

const EMPTY: PaymentInfo = {
  bre_b: "",
  bank_name: "",
  bank_account_type: "",
  bank_account_number: "",
  account_holder: "",
  account_holder_document: "",
};

const CopyRow = ({
  icon,
  label,
  value,
  copied,
  onCopy,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) => (
  <div className="flex items-center justify-between gap-2 bg-white/70 rounded px-2 py-1.5">
    <div className="flex items-center gap-2 min-w-0">
      {icon}
      <div className="min-w-0">
        <p className="text-[11px] text-emerald-700 leading-none">{label}</p>
        <p className="text-sm font-semibold text-emerald-950 truncate">{value}</p>
      </div>
    </div>
    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 shrink-0 text-emerald-800" onClick={onCopy}>
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  </div>
);

/**
 * Muestra los datos de pago (Bre-B / cuenta) del taller al que se le va a transferir.
 * Si el taller no los tiene, permite registrarlos inline. Persiste en la tabla workshops.
 */
export const WorkshopPaymentInfo = ({ workshopId, workshopName }: WorkshopPaymentInfoProps) => {
  const { toast } = useToast();
  const [info, setInfo] = useState<PaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PaymentInfo>(EMPTY);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchInfo = useCallback(async () => {
    if (!workshopId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("workshops")
        .select("bre_b, bank_name, bank_account_type, bank_account_number, account_holder, account_holder_document")
        .eq("id", workshopId)
        .single();
      if (error) throw error;
      const next: PaymentInfo = {
        bre_b: (data?.bre_b as string) ?? "",
        bank_name: (data?.bank_name as string) ?? "",
        bank_account_type: (data?.bank_account_type as string) ?? "",
        bank_account_number: (data?.bank_account_number as string) ?? "",
        account_holder: (data?.account_holder as string) ?? "",
        account_holder_document: (data?.account_holder_document as string) ?? "",
      };
      setInfo(next);
      setForm(next);
      // Sin datos → abrir directo en modo registro
      setEditing(!(next.bre_b || next.bank_account_number));
    } catch (e) {
      console.error("Error fetching workshop payment info", e);
      setInfo(EMPTY);
      setForm(EMPTY);
      setEditing(true);
    } finally {
      setLoading(false);
    }
  }, [workshopId]);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        bre_b: form.bre_b.trim() || null,
        bank_name: form.bank_name.trim() || null,
        bank_account_type: form.bank_account_type || null,
        bank_account_number: form.bank_account_number.trim() || null,
        account_holder: form.account_holder.trim() || null,
        account_holder_document: form.account_holder_document.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("workshops").update(payload).eq("id", workshopId);
      if (error) throw error;
      toast({
        title: "Datos de pago guardados",
        description: workshopName ? `Actualizados para ${workshopName}` : undefined,
      });
      setInfo({ ...form });
      setEditing(false);
    } catch (e) {
      console.error("Error saving workshop payment info", e);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar los datos de pago" });
    } finally {
      setSaving(false);
    }
  };

  const copy = async (key: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard no disponible */
    }
  };

  const hasAny = !!(info && (info.bre_b || info.bank_account_number));
  const canSave = !!(form.bre_b.trim() || form.bank_account_number.trim());

  if (loading) {
    return (
      <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando datos de pago…
      </div>
    );
  }

  // Vista: el taller ya tiene datos y no estamos editando
  if (!editing && hasAny && info) {
    return (
      <div className="rounded-lg border bg-emerald-50/60 border-emerald-200 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-emerald-900 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4" /> Transferir a {workshopName || "este taller"}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-emerald-800"
            onClick={() => setEditing(true)}
          >
            <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
          </Button>
        </div>

        {info.bre_b && (
          <CopyRow
            icon={<KeyRound className="w-4 h-4 text-emerald-700 shrink-0" />}
            label="Llave Bre-B"
            value={info.bre_b}
            copied={copied === "bre_b"}
            onCopy={() => copy("bre_b", info.bre_b)}
          />
        )}

        {info.bank_account_number && (
          <div className="space-y-1">
            <CopyRow
              icon={<Landmark className="w-4 h-4 text-emerald-700 shrink-0" />}
              label={`Cuenta${info.bank_name ? ` · ${info.bank_name}` : ""}${info.bank_account_type ? ` (${info.bank_account_type})` : ""}`}
              value={info.bank_account_number}
              copied={copied === "acc"}
              onCopy={() => copy("acc", info.bank_account_number)}
            />
            {(info.account_holder || info.account_holder_document) && (
              <p className="text-xs text-emerald-800 pl-7">
                Titular: {info.account_holder || "—"}
                {info.account_holder_document ? ` · CC/NIT ${info.account_holder_document}` : ""}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Registro / edición
  return (
    <div className="rounded-lg border bg-amber-50/60 border-amber-200 p-3 space-y-3">
      <div>
        <p className="text-sm font-medium text-amber-900">
          {hasAny ? "Editar datos de pago" : `Registrar datos de pago${workshopName ? ` de ${workshopName}` : ""}`}
        </p>
        <p className="text-xs text-amber-800">Llave Bre-B o cuenta bancaria a la que se le transfiere a este taller.</p>
      </div>

      <div>
        <Label htmlFor="wp-breb" className="text-xs">Llave Bre-B</Label>
        <Input
          id="wp-breb"
          value={form.bre_b}
          onChange={(e) => setForm((p) => ({ ...p, bre_b: e.target.value }))}
          placeholder="Celular, cédula, correo o llave alfanumérica"
        />
      </div>

      <div className="border-t border-amber-200 pt-2 space-y-2">
        <p className="text-xs text-amber-800">— o cuenta bancaria —</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="wp-bank" className="text-xs">Banco</Label>
            <Input
              id="wp-bank"
              value={form.bank_name}
              onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))}
              placeholder="Bancolombia, Nequi…"
            />
          </div>
          <div>
            <Label className="text-xs">Tipo de cuenta</Label>
            <Select value={form.bank_account_type} onValueChange={(v) => setForm((p) => ({ ...p, bank_account_type: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ahorros">Ahorros</SelectItem>
                <SelectItem value="corriente">Corriente</SelectItem>
                <SelectItem value="nequi">Nequi</SelectItem>
                <SelectItem value="daviplata">Daviplata</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="wp-accnum" className="text-xs">Número de cuenta</Label>
          <Input
            id="wp-accnum"
            value={form.bank_account_number}
            onChange={(e) => setForm((p) => ({ ...p, bank_account_number: e.target.value }))}
            placeholder="Número de cuenta"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="wp-holder" className="text-xs">Titular</Label>
            <Input
              id="wp-holder"
              value={form.account_holder}
              onChange={(e) => setForm((p) => ({ ...p, account_holder: e.target.value }))}
              placeholder="Nombre del titular"
            />
          </div>
          <div>
            <Label htmlFor="wp-doc" className="text-xs">Cédula / NIT</Label>
            <Input
              id="wp-doc"
              value={form.account_holder_document}
              onChange={(e) => setForm((p) => ({ ...p, account_holder_document: e.target.value }))}
              placeholder="Documento"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {hasAny && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (info) setForm(info);
              setEditing(false);
            }}
          >
            Cancelar
          </Button>
        )}
        <Button type="button" size="sm" onClick={handleSave} disabled={saving || !canSave}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
          Guardar datos
        </Button>
      </div>
    </div>
  );
};
