import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, KeyRound, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUgcCreatorPortalLink } from '@/hooks/useUgcCreatorPortalLink';

interface CreatorPortalLinkButtonProps {
  creatorId: string;
  creatorName: string;
}

export const CreatorPortalLinkButton: React.FC<CreatorPortalLinkButtonProps> = ({ creatorId, creatorName }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { activeLinkMeta, isLoading, generateLink, revokeLink, lastGeneratedUrl } = useUgcCreatorPortalLink(creatorId);

  const handleCopy = async () => {
    if (!lastGeneratedUrl) return;
    await navigator.clipboard.writeText(lastGeneratedUrl);
    setCopied(true);
    toast.success('Link Club copiado');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = () => {
    generateLink.mutate(undefined, {
      onSuccess: (generated) => {
        navigator.clipboard.writeText(generated.portal_url).catch(() => undefined);
        toast.success('Link Club generado y copiado');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al generar link'),
    });
  };

  const handleRevoke = () => {
    if (!window.confirm(`¿Revocar el link Club de ${creatorName}? El link anterior dejará de funcionar.`)) return;
    revokeLink.mutate(undefined, {
      onSuccess: () => toast.success('Link Club revocado'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al revocar link'),
    });
  };

  const hasActiveLink = !!activeLinkMeta;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={hasActiveLink ? 'border-blue-200 text-blue-700 hover:bg-blue-50' : ''}
      >
        <KeyRound className="h-4 w-4 mr-1" /> Link Club
        {hasActiveLink && (
          <Badge variant="outline" className="ml-1 h-4 text-[10px] bg-blue-100 text-blue-700 border-blue-200 px-1">
            Activo
          </Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link Club — {creatorName}</DialogTitle>
            <DialogDescription>
              Link privado para entrar a club.dosmicos.com sin contraseña. Por seguridad, el link completo solo se muestra al generarlo.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {activeLinkMeta ? (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200" variant="outline">Activo</Badge>
                    <span className="text-xs text-blue-700 font-mono">termina en {activeLinkMeta.token_last4}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Creado: {format(new Date(activeLinkMeta.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                  </p>
                  {activeLinkMeta.last_accessed_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Último ingreso: {format(new Date(activeLinkMeta.last_accessed_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center text-sm text-muted-foreground">
                  Esta creadora todavía no tiene link Club activo.
                </div>
              )}

              {lastGeneratedUrl && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Último link generado en esta sesión:</p>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={lastGeneratedUrl} className="text-xs font-mono" />
                    <Button size="icon" variant="outline" onClick={handleCopy}>
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {!lastGeneratedUrl && activeLinkMeta && (
                <p className="text-xs text-muted-foreground">
                  Si perdiste el link completo, genera uno nuevo. El link anterior quedará invalidado.
                </p>
              )}

              <DialogFooter className="gap-2 sm:gap-2">
                {activeLinkMeta && (
                  <Button variant="outline" className="text-destructive" onClick={handleRevoke} disabled={revokeLink.isPending}>
                    {revokeLink.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                    Revocar
                  </Button>
                )}
                <Button onClick={handleGenerate} disabled={generateLink.isPending}>
                  {generateLink.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                  {activeLinkMeta ? 'Regenerar' : 'Generar link'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
