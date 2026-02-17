import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X, CheckCircle, AlertCircle, Loader2, Plus, Film } from 'lucide-react';

type Platform = 'instagram_reel' | 'instagram_story' | 'tiktok';

interface VideoQueueItem {
  id: string;
  file: File;
  platform: Platform;
  notes: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  errorMessage?: string;
}

interface TokenData {
  valid: boolean;
  error?: string;
  token_id?: string;
  organization_id?: string;
  creator?: {
    id: string;
    name: string;
    instagram_handle: string | null;
    avatar_url: string | null;
  };
  campaigns?: { id: string; name: string; status: string }[];
  upload_count?: number;
  max_uploads?: number;
  expires_at?: string | null;
}

const VALID_EXTENSIONS = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v', '3gp'];

const isValidVideoFile = (file: File): boolean => {
  if (file.type && file.type.startsWith('video/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return !!ext && VALID_EXTENSIONS.includes(ext);
};

const getMimeType = (file: File): string => {
  if (file.type && file.type.startsWith('video/')) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    avi: 'video/x-msvideo', mkv: 'video/x-matroska', m4v: 'video/x-m4v', '3gp': 'video/3gpp',
  };
  return (ext && mimeMap[ext]) || 'application/octet-stream';
};

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const UgcUploadPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [queue, setQueue] = useState<VideoQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('validate_ugc_upload_token', { p_token: token });
        if (error) throw error;
        const parsed = data as unknown as TokenData;
        setTokenData(parsed);
        if (parsed.valid && parsed.campaigns && parsed.campaigns.length === 1) {
          setSelectedCampaign(parsed.campaigns[0].id);
        }
      } catch {
        setTokenData({ valid: false, error: 'Error al validar el enlace' });
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: VideoQueueItem[] = Array.from(files)
      .filter(f => {
        if (!isValidVideoFile(f)) { return false; }
        if (f.size > 1073741824) { return false; }
        return true;
      })
      .map(f => ({
        id: crypto.randomUUID(),
        file: f,
        platform: 'instagram_reel' as Platform,
        notes: '',
        status: 'pending' as const,
        progress: 0,
      }));
    setQueue(prev => [...prev, ...newItems]);
  }, []);

  const removeItem = (id: string) => setQueue(prev => prev.filter(v => v.id !== id));

  const updateItem = (id: string, updates: Partial<VideoQueueItem>) =>
    setQueue(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleUploadAll = async () => {
    if (!token || !selectedCampaign || !tokenData?.creator || !tokenData.organization_id) return;
    setIsUploading(true);

    const pendingItems = queue.filter(v => v.status === 'pending' || v.status === 'error');

    for (const item of pendingItems) {
      updateItem(item.id, { status: 'uploading', progress: 10 });

      try {
        const ext = item.file.name.split('.').pop()?.toLowerCase() || 'mp4';
        const filePath = `${tokenData.organization_id}/${tokenData.creator.id}/${selectedCampaign}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
        const contentType = getMimeType(item.file);

        updateItem(item.id, { progress: 30 });

        const { error: uploadError } = await supabase.storage
          .from('ugc-videos')
          .upload(filePath, item.file, { contentType, upsert: false });

        if (uploadError) throw uploadError;
        updateItem(item.id, { progress: 70 });

        const { data: urlData } = supabase.storage.from('ugc-videos').getPublicUrl(filePath);
        const videoUrl = urlData.publicUrl;

        const { data: submitResult, error: submitError } = await supabase.rpc('ugc_submit_video', {
          p_token: token,
          p_campaign_id: selectedCampaign,
          p_video_url: videoUrl,
          p_platform: item.platform,
          p_notes: item.notes || null,
        });

        if (submitError) throw submitError;
        const result = submitResult as unknown as { success: boolean; error?: string };
        if (!result.success) throw new Error(result.error || 'Error al registrar video');

        updateItem(item.id, { status: 'success', progress: 100 });
      } catch (err: unknown) {
        updateItem(item.id, { status: 'error', progress: 0, errorMessage: err.message || 'Error al subir' });
      }
    }

    setIsUploading(false);
    const finalQueue = queue.map(v => pendingItems.find(p => p.id === v.id) ? v : v);
    // Check if all done
    setQueue(prev => {
      const allSuccess = prev.every(v => v.status === 'success');
      if (allSuccess) setAllDone(true);
      return prev;
    });
  };

  // Check allDone after state update
  useEffect(() => {
    if (queue.length > 0 && queue.every(v => v.status === 'success') && !isUploading) {
      setAllDone(true);
    }
  }, [queue, isUploading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!tokenData?.valid) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <img src="/logo-dosmicos.png" alt="Dosmicos" className="h-10 mb-8" />
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Enlace no válido</h1>
        <p className="text-gray-500 text-center max-w-sm">{tokenData?.error || 'Este enlace ha expirado o no es válido.'}</p>
      </div>
    );
  }

  const creator = tokenData.creator!;
  const campaigns = tokenData.campaigns || [];
  const pendingCount = queue.filter(v => v.status === 'pending' || v.status === 'error').length;

  const avatarUrl = creator.instagram_handle
    ? `https://unavatar.io/instagram/${creator.instagram_handle}`
    : null;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex justify-center">
        <img src="/logo-dosmicos.png" alt="Dosmicos" className="h-8" />
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Creator info */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={creator.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-400">
                {creator.name.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Hola, {creator.name} 👋</h1>
            <p className="text-sm text-gray-500">Sube tus videos de contenido aquí</p>
          </div>
        </div>

        {allDone ? (
          <Card className="border border-green-200 bg-green-50">
            <CardContent className="p-6 text-center space-y-3">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-lg font-semibold text-gray-900">¡Videos subidos con éxito!</h2>
              <p className="text-sm text-gray-600">El equipo de Dosmicos revisará tu contenido pronto. 🎬</p>
              <Button
                variant="outline"
                onClick={() => { setQueue([]); setAllDone(false); }}
                className="mt-2"
              >
                Subir más videos
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Campaign selector */}
            {campaigns.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Campaña</label>
                <select
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
                >
                  <option value="">Selecciona una campaña</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {campaigns.length === 0 && (
              <Card className="border border-yellow-200 bg-yellow-50">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-yellow-700">No hay campañas activas para subir videos.</p>
                </CardContent>
              </Card>
            )}

            {selectedCampaign && (
              <>
                {/* Drop zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
                >
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700">Toca para seleccionar videos</p>
                  <p className="text-xs text-gray-400 mt-1">o arrastra y suelta aquí</p>
                  <p className="text-xs text-gray-400 mt-1">MP4, MOV, WebM, AVI, MKV • Máx 1GB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) addFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </div>

                {/* Queue */}
                {queue.length > 0 && (
                  <div className="space-y-3">
                    {queue.map((item) => (
                      <Card key={item.id} className="border border-gray-200">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <Film className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <span className="text-sm text-gray-700 truncate">{item.file.name}</span>
                              <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(item.file.size)}</span>
                            </div>
                            {item.status === 'pending' && (
                              <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-gray-600">
                                <X className="h-4 w-4" />
                              </button>
                            )}
                            {item.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />}
                            {item.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-gray-400 flex-shrink-0" />}
                            {item.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                          </div>

                          {/* Platform pills */}
                          {(item.status === 'pending' || item.status === 'error') && (
                            <div className="flex gap-1.5">
                              {([
                                { value: 'instagram_reel', label: 'Reel' },
                                { value: 'instagram_story', label: 'Story' },
                                { value: 'tiktok', label: 'TikTok' },
                              ] as { value: Platform; label: string }[]).map(p => (
                                <button
                                  key={p.value}
                                  onClick={() => updateItem(item.id, { platform: p.value })}
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                    item.platform === p.value
                                      ? 'bg-gray-900 text-white'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Notes */}
                          {(item.status === 'pending' || item.status === 'error') && (
                            <Textarea
                              placeholder="Notas (opcional)"
                              value={item.notes}
                              onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                              className="text-xs min-h-[36px] resize-none"
                              rows={1}
                            />
                          )}

                          {/* Progress bar */}
                          {item.status === 'uploading' && (
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className="bg-gray-900 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          )}

                          {item.status === 'error' && item.errorMessage && (
                            <p className="text-xs text-red-500">{item.errorMessage}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}

                    {/* Add more button */}
                    {!isUploading && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Agregar más videos
                      </Button>
                    )}

                    {/* Upload button */}
                    {pendingCount > 0 && (
                      <Button
                        className="w-full h-12 text-base"
                        style={{ backgroundColor: '#000', color: '#fff' }}
                        onClick={handleUploadAll}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Subiendo...</>
                        ) : (
                          <><Upload className="h-5 w-5 mr-2" /> Subir {pendingCount} video{pendingCount !== 1 ? 's' : ''}</>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-300 pt-4">Powered by Sewdle</p>
      </div>
    </div>
  );
};

export default UgcUploadPage;
