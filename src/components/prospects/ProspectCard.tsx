import { Building2, Phone, Mail, MapPin, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WorkshopProspect, STAGE_LABELS, ProspectStage } from '@/types/prospects';
import { cn } from '@/lib/utils';

interface ProspectCardProps {
  prospect: WorkshopProspect;
  onClick: () => void;
}

const STAGE_COLORS: Record<ProspectStage, string> = {
  lead: 'bg-slate-500',
  videocall_scheduled: 'bg-blue-500',
  videocall_completed: 'bg-blue-600',
  visit_scheduled: 'bg-purple-500',
  visit_completed: 'bg-purple-600',
  sample_in_progress: 'bg-amber-600',
  sample_approved: 'bg-green-500',
  sample_rejected: 'bg-red-500',
  trial_production: 'bg-indigo-500',
  trial_approved: 'bg-green-600',
  trial_rejected: 'bg-red-600',
  approved_workshop: 'bg-emerald-600',
  rejected: 'bg-gray-600',
};

export const ProspectCard = ({ prospect, onClick }: ProspectCardProps) => {
  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={onClick}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{prospect.name}</CardTitle>
          </div>
          <Badge className={cn('text-white', STAGE_COLORS[prospect.stage])}>
            {STAGE_LABELS[prospect.stage]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {prospect.contact_person && (
          <p className="text-sm text-muted-foreground">
            <strong>Contacto:</strong> {prospect.contact_person}
          </p>
        )}
        
        {prospect.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4" />
            <span>{prospect.phone}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                openWhatsApp(prospect.phone!);
              }}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        )}
        
        {prospect.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4" />
            <span className="text-muted-foreground">{prospect.email}</span>
          </div>
        )}
        
        {prospect.city && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4" />
            <span className="text-muted-foreground">{prospect.city}</span>
          </div>
        )}

        {prospect.source && (
          <div className="pt-2">
            <Badge variant="outline" className="text-xs">
              Origen: {prospect.source}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
