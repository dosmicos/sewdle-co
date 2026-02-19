import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { UgcCreator, UgcCampaign, CampaignStatus, UgcVideo } from '@/types/ugc';
import { CAMPAIGN_STATUS_CONFIG } from '@/types/ugc';
import type { UgcCreatorTag } from '@/hooks/useUgcCreatorTags';

interface UgcTableViewProps {
  creators: UgcCreator[];
  campaigns: UgcCampaign[];
  videos: UgcVideo[];
  onCreatorClick: (creator: UgcCreator) => void;
  getTagsForCreator?: (creatorId: string) => UgcCreatorTag[];
}

export const UgcTableView: React.FC<UgcTableViewProps> = ({
  creators,
  campaigns,
  videos,
  onCreatorClick,
  getTagsForCreator,
}) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [publicationFilter, setPublicationFilter] = useState<string>('all');

  const getCreatorCampaigns = (creatorId: string) =>
    campaigns
      .filter((c) => c.creator_id === creatorId)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  const getPrimaryCampaign = (creatorId: string) => {
    const creatorCampaigns = getCreatorCampaigns(creatorId);
    const activeCampaign = creatorCampaigns.find(
      (c) => !['completado', 'cancelado'].includes(c.status)
    );
    return activeCampaign || creatorCampaigns[0];
  };

  const getCampaignVideos = (creatorId: string, campaignId?: string) => {
    if (campaignId) {
      return videos.filter((v) => v.campaign_id === campaignId);
    }
    return videos.filter((v) => v.creator_id === creatorId);
  };

  const cities = [...new Set(creators.map((c) => c.city).filter(Boolean))] as string[];

  const filtered = creators.filter((creator) => {
    const matchesSearch =
      !search ||
      creator.name.toLowerCase().includes(search.toLowerCase()) ||
      creator.instagram_handle?.toLowerCase().includes(search.toLowerCase());

    const activeCampaign = getPrimaryCampaign(creator.id);
    const matchesStatus =
      statusFilter === 'all' || activeCampaign?.status === statusFilter;

    const matchesCity = cityFilter === 'all' || creator.city === cityFilter;

    const campaignVideos = getCampaignVideos(creator.id, activeCampaign?.id);
    const usableVideos = campaignVideos.filter(
      (v) => v.status !== 'rechazado' && (v.status !== 'pendiente' || !!v.video_url)
    );
    const publicationGoal = activeCampaign?.agreed_videos || usableVideos.length || 0;
    const organicPublished = usableVideos.filter(
      (v) => v.published_organic || v.status === 'publicado'
    ).length;
    const adsPublished = usableVideos.filter((v) => v.published_ads).length;

    const missingOrganic = publicationGoal > 0 && organicPublished < publicationGoal;
    const missingAds = publicationGoal > 0 && adsPublished < publicationGoal;
    const hasOrganicPublished = organicPublished > 0;
    const hasAdsPublished = adsPublished > 0;

    const matchesPublication =
      publicationFilter === 'all' ||
      (publicationFilter === 'missing_organic' && missingOrganic) ||
      (publicationFilter === 'missing_ads' && missingAds) ||
      (publicationFilter === 'published_organic' && hasOrganicPublished) ||
      (publicationFilter === 'published_ads' && hasAdsPublished);

    return matchesSearch && matchesStatus && matchesCity && matchesPublication;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o @instagram..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status campaña" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(CAMPAIGN_STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Ciudad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las ciudades</SelectItem>
            {cities.map((city) => (
              <SelectItem key={city} value={city}>{city}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={publicationFilter} onValueChange={setPublicationFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Publicación video" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos (publicación)</SelectItem>
            <SelectItem value="missing_organic">Faltan publicar orgánico</SelectItem>
            <SelectItem value="missing_ads">Faltan publicar en ads</SelectItem>
            <SelectItem value="published_organic">Con orgánico publicado</SelectItem>
            <SelectItem value="published_ads">Con ads publicado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Creador</TableHead>
              <TableHead>Instagram</TableHead>
              <TableHead className="text-right">Seguidores</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Etiquetas</TableHead>
              <TableHead>Campaña Activa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Videos</TableHead>
              <TableHead>Orgánico</TableHead>
              <TableHead>Ads</TableHead>
              <TableHead>Actualización</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                  No se encontraron creadores
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((creator) => {
                const activeCampaign = getPrimaryCampaign(creator.id);
                const avatarUrl = creator.instagram_handle
                  ? `https://unavatar.io/instagram/${creator.instagram_handle}`
                  : null;
                const campaignVideos = getCampaignVideos(creator.id, activeCampaign?.id);
                const usableVideos = campaignVideos.filter(
                  (v) => v.status !== 'rechazado' && (v.status !== 'pendiente' || !!v.video_url)
                );
                const videosDelivered = usableVideos.length;
                const organicPublished = usableVideos.filter(
                  (v) => v.published_organic || v.status === 'publicado'
                ).length;
                const adsPublished = usableVideos.filter((v) => v.published_ads).length;
                const publicationGoal = activeCampaign?.agreed_videos || usableVideos.length;
                const creatorTags = getTagsForCreator?.(creator.id) || [];

                return (
                  <TableRow
                    key={creator.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onCreatorClick(creator)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={creator.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                              {creator.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-sm">{creator.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {creator.instagram_handle ? `@${creator.instagram_handle}` : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {creator.instagram_followers?.toLocaleString() || '0'}
                    </TableCell>
                    <TableCell className="text-sm">{creator.city || '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {creatorTags.length > 0 ? creatorTags.map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                            style={{ borderColor: tag.color, color: tag.color }}
                          >
                            {tag.name}
                          </Badge>
                        )) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{activeCampaign?.name || '—'}</TableCell>
                    <TableCell>
                      {activeCampaign ? (
                        <Badge className={`${CAMPAIGN_STATUS_CONFIG[activeCampaign.status as CampaignStatus]?.bgClass} ${CAMPAIGN_STATUS_CONFIG[activeCampaign.status as CampaignStatus]?.textClass} text-xs`}>
                          {CAMPAIGN_STATUS_CONFIG[activeCampaign.status as CampaignStatus]?.label}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sin campaña</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {activeCampaign?.order_number ? (
                        <span
                          className="text-primary hover:underline cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/picking-packing?search=${activeCampaign.order_number!.replace('#', '')}`);
                          }}
                        >
                          {activeCampaign.order_number}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {activeCampaign ? `${videosDelivered}/${activeCampaign.agreed_videos}` : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {activeCampaign ? (
                        <Badge className={`${organicPublished >= publicationGoal ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'} text-xs`}>
                          {organicPublished}/{publicationGoal}
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {activeCampaign ? (
                        <Badge className={`${adsPublished >= publicationGoal ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'} text-xs`}>
                          {adsPublished}/{publicationGoal}
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(creator.updated_at), 'dd MMM', { locale: es })}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
