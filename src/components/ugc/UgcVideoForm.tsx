import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UgcVideoFormData } from '@/types/ugc';

interface UgcVideoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignName: string;
  onSubmit: (data: UgcVideoFormData) => void;
  isLoading?: boolean;
}

export const UgcVideoForm: React.FC<UgcVideoFormProps> = ({
  open,
  onOpenChange,
  campaignName,
  onSubmit,
  isLoading,
}) => {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<'instagram_reel' | 'instagram_story' | 'tiktok'>('instagram_reel');
  const [views, setViews] = useState('');
  const [likes, setLikes] = useState('');
  const [comments, setComments] = useState('');

  React.useEffect(() => {
    if (open) {
      setUrl('');
      setPlatform('instagram_reel');
      setViews('');
      setLikes('');
      setComments('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit({
      video_url: url.trim(),
      platform,
      views: views ? parseInt(views) : undefined,
      likes: likes ? parseInt(likes) : undefined,
      comments: comments ? parseInt(comments) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Video — {campaignName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="video-url">URL del video *</Label>
            <Input id="video-url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://instagram.com/reel/..." />
          </div>
          <div className="space-y-2">
            <Label>Plataforma</Label>
            <Select value={platform} onValueChange={(v: unknown) => setPlatform(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram_reel">Instagram Reel</SelectItem>
                <SelectItem value="instagram_story">Instagram Story</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="v-views">Views</Label>
              <Input id="v-views" type="number" value={views} onChange={(e) => setViews(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-likes">Likes</Label>
              <Input id="v-likes" type="number" value={likes} onChange={(e) => setLikes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-comments">Comments</Label>
              <Input id="v-comments" type="number" value={comments} onChange={(e) => setComments(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading || !url.trim()}>
              {isLoading ? 'Guardando...' : 'Registrar Video'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
