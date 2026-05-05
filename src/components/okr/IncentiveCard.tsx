import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trophy, 
  Award, 
  Target, 
  TrendingUp, 
  Users, 
  Star,
  CheckCircle,
  Clock,
  Gift
} from 'lucide-react';

interface IncentiveData {
  id: string;
  title: string;
  description: string;
  type: 'objective_completion' | 'streak' | 'collaboration' | 'performance' | 'milestone';
  status: 'earned' | 'progress' | 'available';
  points: number;
  progress?: number;
  maxProgress?: number;
  earnedDate?: string;
  deadline?: string;
  requirements?: string[];
}

interface IncentiveCardProps {
  incentive: IncentiveData;
  onClaim?: (incentiveId: string) => void;
  onViewDetails?: (incentiveId: string) => void;
}

export const IncentiveCard: React.FC<IncentiveCardProps> = ({
  incentive,
  onClaim,
  onViewDetails
}) => {
  const getIncentiveIcon = (type: string) => {
    switch (type) {
      case 'objective_completion': return Target;
      case 'streak': return TrendingUp;
      case 'collaboration': return Users;
      case 'performance': return Trophy;
      case 'milestone': return Award;
      default: return Star;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'earned': return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800';
      case 'progress': return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'available': return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-800';
      default: return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'earned': return 'Ganado';
      case 'progress': return 'En Progreso';
      case 'available': return 'Disponible';
      default: return 'Disponible';
    }
  };

  const IconComponent = getIncentiveIcon(incentive.type);
  const isEarned = incentive.status === 'earned';
  const inProgress = incentive.status === 'progress';
  const progressPercentage = incentive.progress && incentive.maxProgress 
    ? (incentive.progress / incentive.maxProgress) * 100 
    : 0;

  return (
    <Card className={`transition-all hover:shadow-md ${getStatusColor(incentive.status)} ${isEarned ? 'ring-2 ring-green-200 dark:ring-green-800' : ''}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isEarned ? 'bg-green-500 text-white' : 'bg-background/50'}`}>
                <IconComponent className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{incentive.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {incentive.description}
                </p>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="text-xs">
                +{incentive.points} pts
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {getStatusLabel(incentive.status)}
              </Badge>
            </div>
          </div>

          {/* Progress for in-progress incentives */}
          {inProgress && incentive.progress !== undefined && incentive.maxProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Progreso: {incentive.progress}/{incentive.maxProgress}</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <div className="w-full bg-background/50 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Requirements */}
          {incentive.requirements && incentive.requirements.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium">Requisitos:</h4>
              <ul className="space-y-1">
                {incentive.requirements.map((req, index) => (
                  <li key={index} className="text-xs text-muted-foreground flex items-start gap-1">
                    <span className="text-primary">•</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Dates */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {incentive.earnedDate && (
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>Ganado: {new Date(incentive.earnedDate).toLocaleDateString()}</span>
              </div>
            )}
            
            {incentive.deadline && !isEarned && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-yellow-500" />
                <span>Vence: {new Date(incentive.deadline).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {isEarned && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => onClaim?.(incentive.id)}
              >
                <Gift className="h-3 w-3 mr-1" />
                Reclamar
              </Button>
            )}
            
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 text-xs"
              onClick={() => onViewDetails?.(incentive.id)}
            >
              Ver Detalles
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};