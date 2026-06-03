import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, ChevronLeft, ChevronRight, Play, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { UgcVideo, UgcCreator } from '@/types/ugc';

interface UgcContentCatalogProps {
  videos: UgcVideo[];
  creators: UgcCreator[];
}

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv', '.3gp', '.mpeg', '.mpg', '.ogv'];

function stripQuery(url: string): string {
  const q = url.indexOf('?');
  return (q === -1 ? url : url.slice(0, q)).toLowerCase();
}

function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const path = stripQuery(url);
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext));
}

interface CatalogItem {
  video: UgcVideo;
  creator: UgcCreator | undefined;
  isVideo: boolean;
}

const UgcContentCatalog: React.FC<UgcContentCatalogProps> = ({ videos, creators }) => {
  const creatorById = useMemo(() => {
    const map = new Map<string, UgcCreator>();
    for (const c of creators) map.set(c.id, c);
    return map;
  }, [creators]);

  // Only assets with a real uploaded file, newest first by upload (created_at) date.
  const items = useMemo<CatalogItem[]>(() => {
    return videos
      .filter((v) => !!v.video_url && v.video_url.trim().length > 0)
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((v) => ({
        video: v,
        creator: creatorById.get(v.creator_id),
        isVideo: isVideoUrl(v.video_url),
      }));
  }, [videos, creatorById]);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const close = useCallback(() => setLightboxIndex(null), []);
  const next = useCallback(() => {
    setLightboxIndex((i) => (i === null ? i : Math.min(i + 1, items.length - 1)));
  }, [items.length]);
  const prev = useCallback(() => {
    setLightboxIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, close, next, prev]);

  const handleDownload = useCallback((item: CatalogItem) => {
    const url = item.video.video_url;
    if (!url) return;
    const path = stripQuery(url);
    const extMatch = path.match(/\.(mp4|mov|webm|m4v|ogg|jpg|jpeg|png|gif|webp|heic|avif)$/i);
    const ext = extMatch?.[1]?.toLowerCase() || (item.isVideo ? 'mp4' : 'jpg');
    const handle =
      item.creator?.instagram_handle || item.creator?.tiktok_handle || 'sin-handle';
    const dateStr = format(new Date(item.video.created_at), 'yyyy-MM-dd');
    const filename = `UGC-@${handle}-${dateStr}.${ext}`;
    const proxyUrl = `${SUPABASE_URL}/functions/v1/proxy-ugc-download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    try {
      const link = document.createElement('a');
      link.href = proxyUrl;
      link.download = filename;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Descargando ${filename}`);
    } catch (err) {
      console.error('Download error:', err);
      window.open(proxyUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const creatorLabel = (c: UgcCreator | undefined) =>
    c?.name || (c?.instagram_handle ? `@${c.instagram_handle}` : c?.tiktok_handle ? `@${c.tiktok_handle}` : 'Creador desconocido');

  const creatorAvatar = (c: UgcCreator | undefined) =>
    c?.avatar_url ||
    (c?.instagram_handle ? `https://unavatar.io/instagram/${c.instagram_handle}` :
     c?.tiktok_handle ? `https://unavatar.io/tiktok/${c.tiktok_handle}` : undefined);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Play className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Aún no hay contenido subido por los creadores.</p>
      </div>
    );
  }

  const active = lightboxIndex !== null ? items[lightboxIndex] : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? 'pieza' : 'piezas'} de contenido · más reciente primero
        </p>
      </div>

      {/* Uniform grid — true rows, newest first, reads left → right then down.
          Tiles share a fixed aspect ratio (object-cover) so every row aligns;
          the full uncropped media opens in the lightbox on click. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {items.map((item, index) => (
          <button
            key={item.video.id}
            onClick={() => setLightboxIndex(index)}
            className="relative block w-full aspect-[4/5] overflow-hidden rounded-xl border border-border bg-muted/30 group focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {item.isVideo ? (
              <>
                <video
                  src={item.video.video_url || undefined}
                  preload="metadata"
                  muted
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full bg-black/45 p-3 backdrop-blur-sm transition group-hover:bg-black/60">
                    <Play className="h-5 w-5 text-white fill-white" />
                  </span>
                </span>
              </>
            ) : (
              <img
                src={item.video.video_url || undefined}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
                alt={`Contenido de ${creatorLabel(item.creator)}`}
              />
            )}
            {/* Hover overlay: creator + date */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
              <p className="text-[11px] font-medium text-white truncate">{creatorLabel(item.creator)}</p>
              <p className="text-[10px] text-white/70">
                {format(new Date(item.video.created_at), "d MMM yyyy", { locale: es })}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {active && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={close}
        >
          {/* Close */}
          <button
            onClick={(e) => { e.stopPropagation(); close(); }}
            className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Prev */}
          {lightboxIndex! > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-3 md:left-6 z-10 rounded-full bg-white/10 p-2 md:p-3 text-white hover:bg-white/20"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {/* Next */}
          {lightboxIndex! < items.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-3 md:right-6 z-10 rounded-full bg-white/10 p-2 md:p-3 text-white hover:bg-white/20"
              aria-label="Siguiente"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Content */}
          <div
            className="flex flex-col md:flex-row items-stretch gap-0 max-h-[90vh] max-w-[92vw] overflow-hidden rounded-2xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Media */}
            <div className="flex items-center justify-center bg-black md:max-w-[65vw]">
              {active.isVideo ? (
                <video
                  key={active.video.id}
                  src={active.video.video_url || undefined}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[90vh] max-w-full object-contain"
                />
              ) : (
                <img
                  key={active.video.id}
                  src={active.video.video_url || undefined}
                  className="max-h-[90vh] max-w-full object-contain"
                  alt={`Contenido de ${creatorLabel(active.creator)}`}
                />
              )}
            </div>

            {/* Info panel */}
            <div className="flex w-full md:w-72 flex-col justify-between p-5 shrink-0">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {creatorAvatar(active.creator) ? (
                    <img
                      src={creatorAvatar(active.creator)}
                      className="h-10 w-10 rounded-full object-cover bg-muted"
                      alt=""
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Creador</p>
                    <p className="font-semibold text-foreground truncate">{creatorLabel(active.creator)}</p>
                    {(active.creator?.instagram_handle || active.creator?.tiktok_handle) && (
                      <p className="text-xs text-muted-foreground truncate">
                        @{active.creator?.instagram_handle || active.creator?.tiktok_handle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    Subido el {format(new Date(active.video.created_at), "d 'de' MMMM yyyy", { locale: es })}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground">
                  {lightboxIndex! + 1} de {items.length}
                </div>
              </div>

              <Button className="w-full mt-6" onClick={() => handleDownload(active)}>
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default UgcContentCatalog;
