import { ProspectActivity, ACTIVITY_TYPE_LABELS } from '@/types/prospects';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';

interface ActivityTimelineProps {
  activities: ProspectActivity[];
}

export const ActivityTimeline = ({ activities }: ActivityTimelineProps) => {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay actividades registradas
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <Card key={activity.id}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {activity.status === 'completed' && (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
                {activity.status === 'pending' && (
                  <Clock className="h-5 w-5 text-amber-600" />
                )}
                {activity.status === 'cancelled' && (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{activity.title}</h4>
                  <Badge variant="outline" className="text-xs">
                    {ACTIVITY_TYPE_LABELS[activity.activity_type]}
                  </Badge>
                </div>

                {activity.description && (
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {activity.scheduled_date && (
                    <span>
                      Programado: {format(new Date(activity.scheduled_date), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                    </span>
                  )}
                  {activity.completed_date && (
                    <span>
                      Completado: {format(new Date(activity.completed_date), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                    </span>
                  )}
                  {!activity.scheduled_date && !activity.completed_date && (
                    <span>
                      {format(new Date(activity.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
