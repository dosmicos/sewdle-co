import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useOKR } from '@/contexts/OKRContext';
import { MessageCircle, UserCheck, AlertTriangle, Target, Send } from 'lucide-react';
import { useState } from 'react';

interface OKRCoachingPanelProps {
  selectedQuarter?: string;
}

export const OKRCoachingPanel: React.FC<OKRCoachingPanelProps> = ({
  selectedQuarter
}) => {
  const { objectives, keyResults, getKeyResultsByObjective } = useOKR();
  const [selectedObjective, setSelectedObjective] = useState<string | null>(null);
  const [coachingNote, setCoachingNote] = useState('');

  // Get objectives that need attention (low confidence or progress)
  const objectivesNeedingAttention = objectives.filter(obj => {
    const krs = getKeyResultsByObjective(obj.id);
    const avgProgress = krs.length > 0 ? krs.reduce((sum, kr) => sum + kr.progress_pct, 0) / krs.length : 0;
    const hasLowConfidence = krs.some(kr => kr.confidence === 'low');
    
    return avgProgress < 50 || hasLowConfidence;
  });

  const getRiskIndicator = (objective: unknown) => {
    const krs = getKeyResultsByObjective(objective.id);
    const avgProgress = krs.length > 0 ? krs.reduce((sum, kr) => sum + kr.progress_pct, 0) / krs.length : 0;
    const hasLowConfidence = krs.some(kr => kr.confidence === 'low');
    
    if (avgProgress < 30 || hasLowConfidence) return 'high';
    if (avgProgress < 60) return 'medium';
    return 'low';
  };

  const sendCoachingNote = () => {
    // Here you would implement the actual coaching note functionality
    console.log('Sending coaching note:', coachingNote);
    setCoachingNote('');
    setSelectedObjective(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Panel de Coaching
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {objectivesNeedingAttention.length > 0 ? (
          <>
            <div className="text-sm text-muted-foreground mb-4">
              {objectivesNeedingAttention.length} objetivo(s) requieren atención
            </div>
            
            <div className="space-y-3">
              {objectivesNeedingAttention.map((objective) => {
                const risk = getRiskIndicator(objective);
                const krs = getKeyResultsByObjective(objective.id);
                const avgProgress = krs.length > 0 ? krs.reduce((sum, kr) => sum + kr.progress_pct, 0) / krs.length : 0;
                
                return (
                  <div key={objective.id} className="border rounded-lg p-3 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm mb-1">{objective.title}</h4>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={risk === 'high' ? 'destructive' : risk === 'medium' ? 'secondary' : 'default'}
                            className="text-xs"
                          >
                            {risk === 'high' ? 'Alto Riesgo' : risk === 'medium' ? 'Atención' : 'Normal'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(avgProgress)}% progreso
                          </span>
                        </div>
                      </div>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedObjective(objective.id)}
                          >
                            <MessageCircle className="h-3 w-3 mr-1" />
                            Coach
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Coaching para Objetivo</DialogTitle>
                          </DialogHeader>
                          
                          <div className="space-y-4">
                            <div className="p-3 bg-muted rounded-lg">
                              <h4 className="font-medium text-sm mb-1">{objective.title}</h4>
                              <div className="text-xs text-muted-foreground">
                                Progreso actual: {Math.round(avgProgress)}%
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Mensaje de Coaching</label>
                              <Textarea
                                placeholder="Escribe un mensaje de apoyo, sugerencias o feedback para ayudar con este objetivo..."
                                value={coachingNote}
                                onChange={(e) => setCoachingNote(e.target.value)}
                                className="min-h-[100px]"
                              />
                            </div>
                            
                            <div className="flex gap-2">
                              <Button 
                                onClick={sendCoachingNote}
                                disabled={!coachingNote.trim()}
                                className="flex-1"
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Enviar
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    
                    {/* Key Results Summary */}
                    <div className="space-y-1">
                      {krs.slice(0, 2).map((kr) => (
                        <div key={kr.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground truncate flex-1">{kr.title}</span>
                          <div className="flex items-center gap-1 ml-2">
                            {kr.confidence === 'low' && (
                              <AlertTriangle className="h-3 w-3 text-red-500" />
                            )}
                            <span className={kr.confidence === 'low' ? 'text-red-600' : 'text-muted-foreground'}>
                              {Math.round(kr.progress_pct)}%
                            </span>
                          </div>
                        </div>
                      ))}
                      {krs.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{krs.length - 2} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="pt-3 border-t">
              <Button variant="outline" className="w-full">
                <Target className="h-3 w-3 mr-1" />
                Ver Todos los Objetivos
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <UserCheck className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Equipo en Buen Camino</h3>
            <p className="text-sm text-muted-foreground">
              Todos los objetivos están progresando según lo esperado.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};