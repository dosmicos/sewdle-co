import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExternalLink, MessageSquare, Edit, Plus, Video, Eye, Heart, MessageCircle, Package, CheckCircle, Trash2, Loader2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { UgcCreator, UgcCampaign, CampaignStatus } from '@/types/ugc';
import { CAMPAIGN_STATUS_CONFIG, CREATOR_STATUS_CONFIG } from '@/types/ugc';
import { useUgcVideos } from '@/hooks/useUgcVideos';
import { UgcChildrenManager } from './UgcChildrenManager';
import { UgcCreatorTagsManager } from './UgcCreatorTagsManager';
import { GenerateUploadLinkButton } from './GenerateUploadLinkButton';
import { PickingOrderDetailsModal } from '@/components/picking/PickingOrderDetailsModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UgcCreatorDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: UgcCreator | null;
  campaigns: UgcCampaign[];
  onEdit: () => void;
  onNewCampaign: () => void;
  onNewVideo: (campaignId: string) => void;
  onCampaignStatusChange: (campaignId: string, status: CampaignStatus, extra?: Record<string, any>) => void;
  onVideoStatusChange: (videoId: string, status: string, feedback?: string) => void;
  onVideoPublicationChange: (videoId: string, publishedOrganic?: boolean, publishedAds?: boolean, currentStatus?: string) => void;
  onDelete?: () => void;
}

export const UgcCreatorDetailModal: React.FC<UgcCreatorDetailModalProps> = ({
  open,
  onOpenChange,
  creator,
  campaigns,
  onEdit,
  onNewCampaign,
  onNewVideo,
  onCampaignStatusChange,
  onVideoStatusChange,
  onVideoPublicationChange,
  onDelete,
}) => {
  const { videos: allVideos } = useUgcVideos(creator?.id);
  const [pickingOrderId, setPickingOrderId] = useState<string | null>(null);
  const [pickingModalOpen, setPickingModalOpen] = useState(false);
  const [loadingPickingOrder, setLoadingPickingOrder] = useState(false);
  const [videoFilter, setVideoFilter] = useState<'all' | 'pending_organic' | 'pending_ads' | 'published_organic' | 'published_ads'>('all');
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const [videoPreviewSource, setVideoPreviewSource] = useState<string | null>(null);
  const [videoPreviewOriginalUrl, setVideoPreviewOriginalUrl] = useState<string | null>(null);
  const [videoPreviewLoading, setVideoPreviewLoading] = useState(false);
  const [videoPreviewError, setVideoPreviewError] = useState<string | null>(null);
  const previewBlobUrlRef = useRef<string | null>(null);

  const isDirectVideoAsset = (url: string) => {
    const normalized = url.toLowerCase().split('?')[0];
    return (
      normalized.endsWith('.mp4') ||
      normalized.endsWith('.mov') ||
      normalized.endsWith('.webm') ||
      normalized.endsWith('.m4v') ||
      normalized.endsWith('.ogg') ||
      normalized.includes('/storage/v1/object/')
    );
  };

  const clearPreviewBlob = () => {
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearPreviewBlob();
    };
  }, []);

  const openVideoPreview = async (url: string) => {
    clearPreviewBlob();
    setVideoPreviewOriginalUrl(url);
    setVideoPreviewSource(null);
    setVideoPreviewError(null);
    setVideoPreviewLoading(true);
    setVideoPreviewOpen(true);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      if (!blob.size) throw new Error('Archivo vacío');
      if (!blob.type.startsWith('video/') && !isDirectVideoAsset(url)) {
        throw new Error('El enlace no apunta a un archivo de video directo');
      }
      const objectUrl = URL.createObjectURL(blob);
      previewBlobUrlRef.current = objectUrl;
      setVideoPreviewSource(objectUrl);
    } catch (error) {
      console.error('Video preview load error:', error);
      // Fallback: use direct URL if blob fetch fails
      setVideoPreviewSource(url);
      setVideoPreviewError('No se pudo cargar por streaming; intentando vista directa.');
    } finally {
      setVideoPreviewLoading(false);
    }
  };

  const downloadVideo = () => {
    if (!videoPreviewOriginalUrl) return;

    const source = previewBlobUrlRef.current || videoPreviewOriginalUrl;
    const normalizedUrl = videoPreviewOriginalUrl.split('?')[0];
    const extensionMatch = normalizedUrl.match(/\.(mp4|mov|webm|m4v|ogg)$/i);
    const extension = extensionMatch?.[1]?.toLowerCase() || 'mp4';

    const link = document.createElement('a');
    link.href = source;
    link.download = `ugc-video-${Date.now()}.${extension}`;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenPickingOrder = async (orderNumber: string) => {
    const normalized = orderNumber.replace('#', '');
    setLoadingPickingOrder(true);
    try {
      // First find the shopify_order_id from shopify_orders
      const { data: shopifyOrder } = await supabase
        .from('shopify_orders')
        .select('shopify_order_id')
        .or(`order_number.eq.${normalized},order_number.eq.#${normalized}`)
        .maybeSingle();

      if (!shopifyOrder) {
        toast.error('No se encontró el pedido en Shopify');
        return;
      }

      // Then find the picking order by shopify_order_id
      const { data: pickingOrder } = await supabase
        .from('picking_packing_orders')
        .select('id')
        .eq('shopify_order_id', shopifyOrder.shopify_order_id)
        .maybeSingle();

      if (pickingOrder) {
        setPickingOrderId(pickingOrder.id);
        setPickingModalOpen(true);
      } else {
        toast.error('No se encontró el pedido en Picking & Packing');
      }
    } catch (err) {
      console.error('Error finding picking order:', err);
      toast.error('Error al buscar el pedido');
    } finally {
      setLoadingPickingOrder(false);
    }
  };

  if (!creator) return null;

  const avatarUrl = creator.instagram_handle
    ? `https://unavatar.io/instagram/${creator.instagram_handle}`
    : null;

  const creatorCampaigns = campaigns.filter((c) => c.creator_id === creator.id);
  const activeCampaigns = creatorCampaigns.filter((c) => !['completado', 'cancelado'].includes(c.status));
  const historicCampaigns = creatorCampaigns.filter((c) => ['completado', 'cancelado'].includes(c.status));
  const latestCampaign = creatorCampaigns[0];

  const getStatusActions = (campaign: UgcCampaign): { label: string; nextStatus: CampaignStatus; needsInput?: string }[] => {
    switch (campaign.status) {
      case 'contactado':
        return [
          { label: 'Marcar Negociando', nextStatus: 'negociando' },
          { label: 'Marcar Aceptado', nextStatus: 'aceptado' },
        ];
      case 'negociando':
        return [{ label: 'Marcar Aceptado', nextStatus: 'aceptado' }];
      case 'aceptado':
        return [{ label: 'Producto Enviado', nextStatus: 'producto_enviado', needsInput: 'tracking' }];
      case 'producto_enviado':
        return [{ label: 'Confirmar Recibido', nextStatus: 'producto_recibido' }];
      case 'producto_recibido':
        return [{ label: 'Video en Revisión', nextStatus: 'video_en_revision' }];
      case 'video_en_revision':
        return [
          { label: 'Aprobar Video', nextStatus: 'video_aprobado' },
          { label: 'Completar', nextStatus: 'completado' },
        ];
      case 'video_aprobado':
        return [{ label: 'Completar Campaña', nextStatus: 'completado' }];
      default:
        return [];
    }
  };

  const totalVideos = allVideos.length;
  const avgViews = totalVideos > 0 ? Math.round(allVideos.reduce((s, v) => s + v.views, 0) / totalVideos) : 0;
  const avgLikes = totalVideos > 0 ? Math.round(allVideos.reduce((s, v) => s + v.likes, 0) / totalVideos) : 0;
  const completedCampaigns = historicCampaigns.filter((c) => c.status === 'completado').length;
  const cancelledCampaigns = historicCampaigns.filter((c) => c.status === 'cancelado').length;
  const videosEligibleForPublication = allVideos.filter((video) => video.status === 'aprobado' || video.status === 'publicado');
  const pendingOrganicCount = videosEligibleForPublication.filter((video) => !video.published_organic).length;
  const pendingAdsCount = videosEligibleForPublication.filter((video) => !video.published_ads).length;
  const publishedOrganicCount = allVideos.filter((video) => video.published_organic).length;
  const publishedAdsCount = allVideos.filter((video) => video.published_ads).length;
  const filteredVideos = allVideos.filter((video) => {
    const isOrganicPublished = !!video.published_organic;
    const isAdsPublished = !!video.published_ads;

    switch (videoFilter) {
      case 'pending_organic':
        return (video.status === 'aprobado' || video.status === 'publicado') && !isOrganicPublished;
      case 'pending_ads':
        return (video.status === 'aprobado' || video.status === 'publicado') && !isAdsPublished;
      case 'published_organic':
        return isOrganicPublished;
      case 'published_ads':
        return isAdsPublished;
      default:
        return true;
    }
  });

  const getCreatorStatusFromCampaign = (campaignStatus?: CampaignStatus) => {
    if (!campaignStatus) return creator.status;
    if (campaignStatus === 'contactado') return 'contactado';
    if (campaignStatus === 'negociando') return 'negociando';
    if (['aceptado', 'producto_enviado', 'producto_recibido', 'video_en_revision', 'video_aprobado', 'publicado', 'completado'].includes(campaignStatus)) {
      return 'activo';
    }
    return creator.status;
  };

  const displayCreatorStatus = getCreatorStatusFromCampaign(latestCampaign?.status as CampaignStatus | undefined);
  const creatorStatusConfig = CREATOR_STATUS_CONFIG[displayCreatorStatus as keyof typeof CREATOR_STATUS_CONFIG];

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={creator.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground">
                  {creator.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">{creator.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                {creator.instagram_handle && creator.platform !== 'tiktok' && (
                  <a
                    href={`https://instagram.com/${creator.instagram_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    @{creator.instagram_handle} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {/* TikTok: use tiktok_handle, or fallback to instagram_handle for legacy data */}
                {(creator.tiktok_handle || (creator.platform === 'tiktok' && creator.instagram_handle)) && (
                  <a
                    href={`https://tiktok.com/@${creator.tiktok_handle || creator.instagram_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    TikTok @{creator.tiktok_handle || creator.instagram_handle} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span>{creator.instagram_followers?.toLocaleString() || 0} seguidores</span>
                {creator.engagement_rate && <span>{creator.engagement_rate}% engagement</span>}
                {creatorStatusConfig && (
                  <Badge className={`${creatorStatusConfig.bgClass} ${creatorStatusConfig.textClass} text-xs`}>
                    {creatorStatusConfig.label}
                  </Badge>
                )}
              </div>
              {/* Tags */}
              <div className="mt-2">
                <UgcCreatorTagsManager creatorId={creator.id} />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <GenerateUploadLinkButton creatorId={creator.id} creatorName={creator.name} />
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-1" /> Editar
              </Button>
              {creator.phone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`https://wa.me/${creator.phone?.replace(/\D/g, '')}`, '_blank')}
                >
                  <MessageSquare className="h-4 w-4 mr-1" /> WhatsApp
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (confirm(`¿Estás seguro de eliminar a "${creator.name}"? Se eliminarán también sus campañas y videos.`)) {
                      onDelete();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="info">Información</TabsTrigger>
            <TabsTrigger value="campaigns">Campañas</TabsTrigger>
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="metrics">Métricas</TabsTrigger>
          </TabsList>

          {/* Tab: Info */}
          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{creator.email || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Teléfono:</span>
                <p className="font-medium">{creator.phone || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Ciudad:</span>
                <p className="font-medium">{creator.city || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Plataforma:</span>
                <p className="font-medium capitalize">{creator.platform || 'Instagram'}</p>
              </div>
              {creator.content_types && creator.content_types.length > 0 && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Contenido:</span>
                  <div className="flex gap-1 mt-1">
                    {creator.content_types.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs capitalize">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {creator.last_contact_date && (
                <div>
                  <span className="text-muted-foreground">Último contacto:</span>
                  <p className="font-medium">{format(new Date(creator.last_contact_date), 'dd MMM yyyy', { locale: es })}</p>
                </div>
              )}
            </div>

            {creator.notes && (
              <div className="text-sm">
                <span className="text-muted-foreground">Notas:</span>
                <p className="mt-1">{creator.notes}</p>
              </div>
            )}

            {/* Children */}
            <UgcChildrenManager creatorId={creator.id} />
          </TabsContent>

          {/* Tab: Campaigns */}
          <TabsContent value="campaigns" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={onNewCampaign}>
                <Plus className="h-4 w-4 mr-1" /> Nueva Campaña
              </Button>
            </div>

            {creatorCampaigns.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Sin campañas registradas</p>
            ) : (
              <div className="space-y-3">
                {[...activeCampaigns, ...historicCampaigns].map((campaign) => {
                  const config = CAMPAIGN_STATUS_CONFIG[campaign.status as CampaignStatus];
                  const videosDelivered = campaign.videos?.filter((v) => v.status === 'aprobado' || v.status === 'publicado').length || 0;
                  const actions = getStatusActions(campaign);

                  return (
                    <Card key={campaign.id} className="border border-border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-sm">{campaign.name}</h4>
                            <Badge className={`${config?.bgClass} ${config?.textClass} text-xs mt-1`}>
                              {config?.label}
                            </Badge>
                          </div>
                          {!['completado', 'cancelado'].includes(campaign.status) && (
                            <Button size="sm" variant="outline" onClick={() => onNewVideo(campaign.id)}>
                              <Video className="h-3 w-3 mr-1" /> Subir Video
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-2">
                          {campaign.order_number && (
                            <div className="flex items-center gap-1">
                              <Package className="h-3 w-3" /> Pedido:{' '}
                              <span
                                className="text-primary hover:underline cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenPickingOrder(campaign.order_number!);
                                }}
                              >
                                {loadingPickingOrder ? <Loader2 className="h-3 w-3 animate-spin inline" /> : campaign.order_number}
                              </span>
                            </div>
                          )}
                          {campaign.tracking_number && (
                            <div>📦 Tracking: {campaign.tracking_number}</div>
                          )}
                          <div className="flex items-center gap-1">
                            <Video className="h-3 w-3" /> Videos: {videosDelivered}/{campaign.agreed_videos}
                          </div>
                          {campaign.agreed_payment > 0 && (
                            <div>💰 ${campaign.agreed_payment.toLocaleString()} ({campaign.payment_type})</div>
                          )}
                        </div>

                        {actions.length > 0 && (
                          <div className="flex gap-2 mt-3 pt-2 border-t border-border">
                            {actions.map((action) => (
                              <Button
                                key={action.nextStatus}
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                onClick={() => {
                                  if (action.needsInput === 'tracking') {
                                    const tracking = prompt('Número de tracking:');
                                    if (tracking) {
                                      onCampaignStatusChange(campaign.id, action.nextStatus, { tracking_number: tracking, shipping_date: new Date().toISOString().split('T')[0] });
                                    }
                                  } else {
                                    const extra: Record<string, any> = {};
                                    if (action.nextStatus === 'producto_recibido') {
                                      extra.received_date = new Date().toISOString().split('T')[0];
                                    }
                                    onCampaignStatusChange(campaign.id, action.nextStatus, extra);
                                  }
                                }}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Tab: Videos */}
          <TabsContent value="videos" className="mt-4">
            {allVideos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Sin videos registrados</p>
            ) : (
              <div className="space-y-3">
                <Card className="border border-border">
                  <CardContent className="p-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Orgánico publicados</p>
                        <p className="text-lg font-semibold text-foreground">{publishedOrganicCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Ads publicados</p>
                        <p className="text-lg font-semibold text-foreground">{publishedAdsCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Faltan orgánico</p>
                        <p className="text-lg font-semibold text-amber-700">{pendingOrganicCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Faltan ads</p>
                        <p className="text-lg font-semibold text-orange-700">{pendingAdsCount}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={videoFilter === 'all' ? 'default' : 'outline'} onClick={() => setVideoFilter('all')}>
                    Todos ({allVideos.length})
                  </Button>
                  <Button size="sm" variant={videoFilter === 'pending_organic' ? 'default' : 'outline'} onClick={() => setVideoFilter('pending_organic')}>
                    Faltan orgánico ({pendingOrganicCount})
                  </Button>
                  <Button size="sm" variant={videoFilter === 'pending_ads' ? 'default' : 'outline'} onClick={() => setVideoFilter('pending_ads')}>
                    Faltan ads ({pendingAdsCount})
                  </Button>
                  <Button size="sm" variant={videoFilter === 'published_organic' ? 'default' : 'outline'} onClick={() => setVideoFilter('published_organic')}>
                    Orgánico publicados ({publishedOrganicCount})
                  </Button>
                  <Button size="sm" variant={videoFilter === 'published_ads' ? 'default' : 'outline'} onClick={() => setVideoFilter('published_ads')}>
                    Ads publicados ({publishedAdsCount})
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Video</TableHead>
                        <TableHead>Revisión</TableHead>
                        <TableHead>Orgánico</TableHead>
                        <TableHead>Ads</TableHead>
                        <TableHead>Métricas</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVideos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No hay videos para este filtro.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredVideos.map((video) => {
                          const isOrganicPublished = !!video.published_organic;
                          const isAdsPublished = !!video.published_ads;
                          return (
                            <TableRow key={video.id}>
                              <TableCell className="align-top">
                                <div className="space-y-1">
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {video.platform?.replace('_', ' ') || 'N/A'}
                                  </Badge>
                                  {video.feedback && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">{video.feedback}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="align-top">
                                <Badge
                                  className={`text-xs ${
                                    video.status === 'aprobado' || video.status === 'publicado'
                                      ? 'bg-green-100 text-green-700'
                                      : video.status === 'rechazado'
                                      ? 'bg-red-100 text-red-700'
                                      : video.status === 'en_revision'
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {video.status.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={isOrganicPublished}
                                      onCheckedChange={(checked) => onVideoPublicationChange(video.id, checked, undefined, video.status)}
                                    />
                                    <span className={`text-xs font-medium ${isOrganicPublished ? 'text-green-700' : 'text-amber-700'}`}>
                                      {isOrganicPublished ? 'Publicado' : 'Pendiente'}
                                    </span>
                                  </div>
                                  {video.published_organic_at && (
                                    <p className="text-[11px] text-muted-foreground">
                                      {format(new Date(video.published_organic_at), 'dd MMM HH:mm', { locale: es })}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={isAdsPublished}
                                      onCheckedChange={(checked) => onVideoPublicationChange(video.id, undefined, checked, video.status)}
                                    />
                                    <span className={`text-xs font-medium ${isAdsPublished ? 'text-blue-700' : 'text-orange-700'}`}>
                                      {isAdsPublished ? 'Publicado' : 'Pendiente'}
                                    </span>
                                  </div>
                                  {video.published_ads_at && (
                                    <p className="text-[11px] text-muted-foreground">
                                      {format(new Date(video.published_ads_at), 'dd MMM HH:mm', { locale: es })}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="text-xs text-muted-foreground space-y-1">
                                  <p className="flex items-center gap-1"><Eye className="h-3 w-3" /> {video.views.toLocaleString()}</p>
                                  <p className="flex items-center gap-1"><Heart className="h-3 w-3" /> {video.likes.toLocaleString()}</p>
                                  <p className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {video.comments}</p>
                                </div>
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="flex flex-wrap gap-1">
                                  {video.video_url && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openVideoPreview(video.video_url!)}>
                                      <ExternalLink className="h-3 w-3 mr-1" /> Ver
                                    </Button>
                                  )}
                                  {video.status === 'en_revision' && (
                                    <>
                                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onVideoStatusChange(video.id, 'aprobado')}>
                                        Aprobar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() => {
                                          const fb = prompt('Feedback:');
                                          if (fb) onVideoStatusChange(video.id, 'rechazado', fb);
                                        }}
                                      >
                                        Rechazar
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab: Metrics */}
          <TabsContent value="metrics" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="border border-border">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-foreground">{totalVideos}</p>
                  <p className="text-xs text-muted-foreground">Videos Totales</p>
                </CardContent>
              </Card>
              <Card className="border border-border">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-foreground">{avgViews.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Promedio Views</p>
                </CardContent>
              </Card>
              <Card className="border border-border">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-foreground">{avgLikes.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Promedio Likes</p>
                </CardContent>
              </Card>
              <Card className="border border-border">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-foreground">
                    {completedCampaigns}
                    <span className="text-sm text-muted-foreground font-normal"> / {cancelledCampaigns} cancel.</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Campañas Completadas</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    {pickingOrderId && pickingModalOpen && (
      <PickingOrderDetailsModal
        orderId={pickingOrderId}
        allOrderIds={[pickingOrderId]}
        onNavigate={() => {}}
        onClose={() => {
          setPickingModalOpen(false);
          setPickingOrderId(null);
        }}
      />
    )}

    <Dialog
      open={videoPreviewOpen}
      onOpenChange={(open) => {
        setVideoPreviewOpen(open);
        if (!open) {
          clearPreviewBlob();
          setVideoPreviewSource(null);
          setVideoPreviewOriginalUrl(null);
          setVideoPreviewError(null);
          setVideoPreviewLoading(false);
        }
      }}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Vista previa de video</DialogTitle>
        </DialogHeader>
        <div className="min-h-[360px] bg-black rounded-md overflow-hidden flex items-center justify-center">
          {videoPreviewLoading ? (
            <Loader2 className="h-7 w-7 animate-spin text-white/70" />
          ) : videoPreviewSource ? (
            <video
              src={videoPreviewSource}
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="w-full max-h-[70vh] bg-black"
              onError={() => {
                setVideoPreviewError('No se pudo reproducir el video en vista previa. Puedes usar el enlace original o descargarlo.');
              }}
            />
          ) : (
            <p className="text-sm text-white/70">No se pudo cargar el video.</p>
          )}
        </div>
        {videoPreviewError && (
          <p className="text-xs text-amber-600">{videoPreviewError}</p>
        )}
        {videoPreviewOriginalUrl && (
          <div className="flex justify-end">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadVideo}>
                <Download className="h-4 w-4 mr-1" />
                Descargar video
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(videoPreviewOriginalUrl, '_blank', 'noopener,noreferrer')}
              >
                Abrir enlace original
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
};
