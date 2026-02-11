import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Link2, Copy, Check, Loader2, XCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useUgcUploadTokens } from '@/hooks/useUgcUploadTokens';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface GenerateUploadLinkButtonProps {
  creatorId: string;
  creatorName: string;
}

export const GenerateUploadLinkButton: React.FC<GenerateUploadLinkButtonProps> = ({
  creatorId,
  creatorName,
}) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [hasExpiration, setHasExpiration] = useState(true);
  const [hasMaxUploads, setHasMaxUploads] = useState(false);
  const [maxUploads, setMaxUploads] = useState(10);

  const { activeToken, isLoading, generateToken, deactivateToken, getUploadUrl } = useUgcUploadTokens(creatorId);

  const handleGenerate = () => {
    generateToken.mutate(
      {
        expiresInDays: hasExpiration ? expiresInDays : undefined,
        maxUploads: hasMaxUploads ? maxUploads : undefined,
      },
      {
        onSuccess: () => toast.success('Link de upload generado'),
        onError: () => toast.error('Error al generar el link'),
      }
    );
  };

  const handleCopy = () => {
    if (!activeToken) return;
    navigator.clipboard.writeText(getUploadUrl(activeToken.token));
    setCopied(true);
    toast.success('Link copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeactivate = () => {
    deactivateToken.mutate(undefined, {
      onSuccess: () => toast.success('Link desactivado'),
      onError: () => toast.error('Error al desactivar'),
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-1" /> Link de Upload
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link de Upload para {creatorName}</DialogTitle>
            <DialogDescription>
              Genera un link personalizado para que la creadora suba sus videos directamente.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : activeToken ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Activo
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {activeToken.upload_count} videos subidos
                  {activeToken.max_uploads && ` / ${activeToken.max_uploads} máx`}
                </span>
              </div>

              {activeToken.expires_at && (
                <p className="text-xs text-muted-foreground">
                  Expira: {format(new Date(activeToken.expires_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                </p>
              )}

              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={getUploadUrl(activeToken.token)}
                  className="text-xs"
                />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-destructive" onClick={handleDeactivate} disabled={deactivateToken.isPending}>
                  <XCircle className="h-4 w-4 mr-1" /> Desactivar Link
                </Button>
                <Button size="sm" onClick={handleGenerate} disabled={generateToken.isPending}>
                  {generateToken.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
                  Regenerar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Expiración</Label>
                <Switch checked={hasExpiration} onCheckedChange={setHasExpiration} />
              </div>
              {hasExpiration && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(Number(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">días</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label>Límite de videos</Label>
                <Switch checked={hasMaxUploads} onCheckedChange={setHasMaxUploads} />
              </div>
              {hasMaxUploads && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={maxUploads}
                    onChange={(e) => setMaxUploads(Number(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">videos máximo</span>
                </div>
              )}

              <DialogFooter>
                <Button onClick={handleGenerate} disabled={generateToken.isPending}>
                  {generateToken.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
                  Generar Link
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
