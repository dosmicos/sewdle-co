import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import type { UgcCreator, UgcCreatorFormData } from '@/types/ugc';
import { useUgcCreatorTags } from '@/hooks/useUgcCreatorTags';

interface UgcCreatorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator?: UgcCreator | null;
  onSubmit: (data: UgcCreatorFormData) => void;
  isLoading?: boolean;
}

const CONTENT_TYPE_OPTIONS = [
  { value: 'reels', label: 'Reels' },
  { value: 'stories', label: 'Stories' },
  { value: 'posts', label: 'Posts' },
  { value: 'tiktoks', label: 'TikToks' },
];

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
  const [platform, setPlatform] = useState(creator?.platform || 'instagram');
  const [contentTypes, setContentTypes] = useState<string[]>(creator?.content_types || []);
  const [tiktokHandle, setTiktokHandle] = useState(creator?.tiktok_handle || '');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const { tags: allTags } = useUgcCreatorTags();

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
      setPlatform(creator?.platform || 'instagram');
      setContentTypes(creator?.content_types || []);
      setTiktokHandle(creator?.tiktok_handle || '');
      setSelectedTagIds([]); // reset tags on open
    }
  }, [open, creator]);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const toggleContentType = (type: string) => {
    setContentTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

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
      platform: platform || 'instagram',
      content_types: contentTypes.length > 0 ? contentTypes : undefined,
      tiktok_handle: tiktokHandle.replace('@', '').trim() || undefined,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{creator ? 'Editar Creador' : 'Nuevo Creador UGC'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          {/* Platform */}
          <div className="space-y-2">
            <Label>Plataforma principal</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="ambas">Ambas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(platform === 'instagram' || platform === 'ambas') && (
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram handle (sin @)</Label>
              <Input id="instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="username" />
            </div>
          )}

          {(platform === 'tiktok' || platform === 'ambas') && (
            <div className="space-y-2">
              <Label htmlFor="tiktok">TikTok handle (sin @)</Label>
              <Input id="tiktok" value={tiktokHandle} onChange={(e) => setTiktokHandle(e.target.value)} placeholder="username" />
            </div>
          )}

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

          {/* Content types multi-select */}
          <div className="space-y-2">
            <Label>Tipo de contenido</Label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPE_OPTIONS.map((opt) => {
                const isSelected = contentTypes.includes(opt.value);
                return (
                  <Badge
                    key={opt.value}
                    variant={isSelected ? 'default' : 'outline'}
                    className="cursor-pointer select-none"
                    onClick={() => toggleContentType(opt.value)}
                  >
                    {opt.label}
                    {isSelected && <X className="h-3 w-3 ml-1" />}
                  </Badge>
                );
              })}
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

          {/* Tag picker — only shown when creating (not editing), and only if there are tags */}
          {!creator && allTags.length > 0 && (
            <div className="space-y-2">
              <Label>Etiquetas</Label>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        isSelected
                          ? 'text-white border-transparent'
                          : 'bg-background text-muted-foreground border-border hover:border-foreground/40'
                      }`}
                      style={isSelected ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                      {isSelected && <X className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
              {selectedTagIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedTagIds.length} etiqueta{selectedTagIds.length > 1 ? 's' : ''} seleccionada{selectedTagIds.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

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
