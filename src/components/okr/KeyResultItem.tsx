import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Edit3, MessageSquare } from 'lucide-react';

interface KeyResultItemProps {
  keyResult: {
    id: string;
    title: string;
    current_value: number;
    target_value: number;
    unit: '%' | '#' | '$' | 'rate' | 'binary';
    progress_pct: number;
    confidence: 'low' | 'med' | 'high';
    data_source: 'manual' | 'auto' | 'computed';
    private: boolean;
    guardrail: boolean;
  };
  showActions?: boolean;
  onEdit?: () => void;
  onCheckin?: () => void;
}

export const KeyResultItem: React.FC<KeyResultItemProps> = ({
  keyResult,
  showActions = false,
  onEdit,
  onCheckin
}) => {
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'med': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDataSourceIcon = (source: string) => {
    switch (source) {
      case 'auto': return <TrendingUp className="h-3 w-3" />;
      case 'computed': return <TrendingDown className="h-3 w-3" />;
      case 'manual': return <Edit3 className="h-3 w-3" />;
      default: return <Minus className="h-3 w-3" />;
    }
  };

  const formatValue = (value: number, unit: string) => {
    switch (unit) {
      case '%': return `${value}%`;
      case '$': return `$${value.toLocaleString()}`;
      case '#': return value.toString();
      case 'rate': return `${value}x`;
      case 'binary': return value > 0 ? 'Sí' : 'No';
      default: return value.toString();
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 70) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 hover:bg-accent/50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">{keyResult.title}</h4>
            {keyResult.private && (
              <Badge variant="outline" className="text-xs">
                Privado
              </Badge>
            )}
            {keyResult.guardrail && (
              <Badge variant="destructive" className="text-xs">
                Guardrail
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              {getDataSourceIcon(keyResult.data_source)}
              <span className="capitalize">{keyResult.data_source}</span>
            </div>
            <Badge className={getConfidenceColor(keyResult.confidence)}>
              {keyResult.confidence} confidence
            </Badge>
          </div>
        </div>

        {showActions && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit3 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onCheckin}>
              <MessageSquare className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>
            {formatValue(keyResult.current_value, keyResult.unit)} de {' '}
            {formatValue(keyResult.target_value, keyResult.unit)}
          </span>
          <span className="font-medium">
            {Math.round(keyResult.progress_pct)}%
          </span>
        </div>
        
        <div className="relative">
          <Progress 
            value={Math.min(keyResult.progress_pct, 100)} 
            className="h-2"
          />
          {keyResult.progress_pct > 100 && (
            <div 
              className="absolute top-0 left-0 h-2 bg-green-600 rounded-full opacity-75"
              style={{ width: `${Math.min((keyResult.progress_pct - 100) / 20 * 100, 100)}%` }}
            />
          )}
        </div>
      </div>

      {/* Status Indicator */}
      <div className="flex items-center justify-between text-xs">
        <span className={`px-2 py-1 rounded-full ${
          keyResult.progress_pct >= 100 ? 'bg-green-100 text-green-800' :
          keyResult.progress_pct >= 70 ? 'bg-yellow-100 text-yellow-800' :
          keyResult.progress_pct >= 30 ? 'bg-blue-100 text-blue-800' :
          'bg-red-100 text-red-800'
        }`}>
          {keyResult.progress_pct >= 100 ? 'Completado' :
           keyResult.progress_pct >= 70 ? 'En buen camino' :
           keyResult.progress_pct >= 30 ? 'En progreso' :
           'Necesita atención'}
        </span>
        
        <span className="text-muted-foreground">
          Última actualización: hace 2 días
        </span>
      </div>
    </div>
  );
};