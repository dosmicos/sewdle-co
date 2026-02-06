import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UgcCampaignFormData } from '@/types/ugc';

interface UgcCampaignFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorName: string;
  onSubmit: (data: UgcCampaignFormData) => void;
  isLoading?: boolean;
}

export const UgcCampaignForm: React.FC<UgcCampaignFormProps> = ({
  open,
  onOpenChange,
  creatorName,
  onSubmit,
  isLoading,
}) => {
  const [name, setName] = useState('');
  const [product, setProduct] = useState('');
  const [videos, setVideos] = useState('1');
  const [paymentType, setPaymentType] = useState<'producto' | 'efectivo' | 'mixto'>('producto');
  const [payment, setPayment] = useState('');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (open) {
      setName('');
      setProduct('');
      setVideos('1');
      setPaymentType('producto');
      setPayment('');
      setDeadline('');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      product_sent: product.trim() || undefined,
      agreed_videos: parseInt(videos) || 1,
      payment_type: paymentType,
      agreed_payment: payment ? parseFloat(payment) : undefined,
      deadline: deadline || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Campaña — {creatorName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Nombre de campaña *</Label>
            <Input id="campaign-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej: Campaña Ruana Invierno 2026" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product">Producto a enviar</Label>
            <Input id="product" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Ej: Sleeping Bag Dinosaurio T4" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="videos-count">Videos acordados</Label>
              <Input id="videos-count" type="number" min="1" value={videos} onChange={(e) => setVideos(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de pago</Label>
              <Select value={paymentType} onValueChange={(v: 'producto' | 'efectivo' | 'mixto') => setPaymentType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="producto">Solo producto</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="mixto">Mixto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(paymentType === 'efectivo' || paymentType === 'mixto') && (
            <div className="space-y-2">
              <Label htmlFor="payment">Monto ($)</Label>
              <Input id="payment" type="number" step="0.01" value={payment} onChange={(e) => setPayment(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline</Label>
            <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-notes">Notas</Label>
            <Textarea id="campaign-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Creando...' : 'Crear Campaña'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
