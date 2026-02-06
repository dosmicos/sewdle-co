import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { UgcCreator, UgcCreatorFormData } from '@/types/ugc';

interface UgcCreatorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator?: UgcCreator | null;
  onSubmit: (data: UgcCreatorFormData) => void;
  isLoading?: boolean;
}

export const UgcCreatorForm: React.FC<UgcCreatorFormProps> = ({
  open,
  onOpenChange,
  creator,
  onSubmit,
  isLoading,
}) => {
  const [name, setName] = useState(creator?.name || '');
  const [instagram, setInstagram] = useState(creator?.instagram_handle || '');
  const [followers, setFollowers] = useState(creator?.instagram_followers?.toString() || '');
  const [email, setEmail] = useState(creator?.email || '');
  const [phone, setPhone] = useState(creator?.phone || '');
  const [city, setCity] = useState(creator?.city || '');
  const [engagement, setEngagement] = useState(creator?.engagement_rate?.toString() || '');
  const [notes, setNotes] = useState(creator?.notes || '');

  React.useEffect(() => {
    if (open) {
      setName(creator?.name || '');
      setInstagram(creator?.instagram_handle || '');
      setFollowers(creator?.instagram_followers?.toString() || '');
      setEmail(creator?.email || '');
      setPhone(creator?.phone || '');
      setCity(creator?.city || '');
      setEngagement(creator?.engagement_rate?.toString() || '');
      setNotes(creator?.notes || '');
    }
  }, [open, creator]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      instagram_handle: instagram.replace('@', '').trim() || undefined,
      instagram_followers: followers ? parseInt(followers) : undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      city: city.trim() || undefined,
      engagement_rate: engagement ? parseFloat(engagement) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{creator ? 'Editar Creador' : 'Nuevo Creador UGC'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instagram">Instagram handle (sin @)</Label>
            <Input id="instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="username" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="followers">Seguidores</Label>
              <Input id="followers" type="number" value={followers} onChange={(e) => setFollowers(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="engagement">Engagement (%)</Label>
              <Input id="engagement" type="number" step="0.01" value={engagement} onChange={(e) => setEngagement(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Guardando...' : creator ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
