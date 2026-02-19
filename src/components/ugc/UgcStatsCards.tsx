import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Package, Video, CheckCircle } from 'lucide-react';
import type { UgcCreator, UgcCampaign, UgcVideo } from '@/types/ugc';

interface UgcStatsCardsProps {
  creators: UgcCreator[];
  campaigns: UgcCampaign[];
  videos: UgcVideo[];
}

export const UgcStatsCards: React.FC<UgcStatsCardsProps> = ({ creators, campaigns, videos }) => {
  const activeCampaignStatuses = new Set([
    'contactado',
    'negociando',
    'aceptado',
    'producto_enviado',
    'producto_recibido',
    'video_en_revision',
    'video_aprobado',
    'publicado',
  ]);

  const activeCreatorsFromCampaigns = new Set(
    campaigns
      .filter((c) => activeCampaignStatuses.has(c.status))
      .map((c) => c.creator_id)
  ).size;
  const activeCreators =
    activeCreatorsFromCampaigns || creators.filter((c) => c.status === 'activo').length;
  const pendingShipment = campaigns.filter((c) => c.status === 'aceptado').length;
  const videosInReview = videos.filter((v) => v.status === 'en_revision').length;
  const completedThisMonth = campaigns.filter((c) => {
    if (c.status !== 'completado') return false;
    const updated = new Date(c.updated_at);
    const now = new Date();
    return updated.getMonth() === now.getMonth() && updated.getFullYear() === now.getFullYear();
  }).length;

  const stats = [
    { label: 'Creadores Activos', value: activeCreators, icon: Users, color: 'text-blue-600' },
    { label: 'Pendientes Envío', value: pendingShipment, icon: Package, color: 'text-yellow-600' },
    { label: 'Videos en Revisión', value: videosInReview, icon: Video, color: 'text-orange-600' },
    { label: 'Completadas (mes)', value: completedThisMonth, icon: CheckCircle, color: 'text-green-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
