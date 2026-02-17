
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, TrendingUp, Clock } from 'lucide-react';
import { useWorkshopAssignments } from '@/hooks/useWorkshopAssignments';

interface WorkshopCapacityStats {
  workshop_id: string;
  workshop_name: string;
  total_capacity: number;
  current_assignments: number;
  available_capacity: number;
  completion_rate: number;
}

const WorkshopCapacityDashboard: React.FC = () => {
  const [capacityStats, setCapacityStats] = useState<WorkshopCapacityStats[]>([]);
  const [loading, setLoading] = useState(true);
  const { getWorkshopCapacityStats } = useWorkshopAssignments();

  useEffect(() => {
    loadCapacityStats();
  }, []);

  const loadCapacityStats = async () => {
    setLoading(true);
    const stats = await getWorkshopCapacityStats();
    setCapacityStats(stats);
    setLoading(false);
  };

  const getCapacityColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getCapacityBadge = (percentage: number) => {
    if (percentage >= 90) return <Badge variant="destructive">Sobrecargado</Badge>;
    if (percentage >= 70) return <Badge variant="secondary">Alto</Badge>;
    return <Badge variant="default">Disponible</Badge>;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-4"></div>
            <div className="h-2 bg-gray-200 rounded mb-2"></div>
            <div className="h-2 bg-gray-200 rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-black">Capacidad de Talleres</h2>
        <Button onClick={loadCapacityStats} variant="outline" size="sm">
          <Clock className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {capacityStats.map((workshop) => {
          const capacityPercentage = workshop.total_capacity > 0 
            ? (workshop.current_assignments / workshop.total_capacity) * 100 
            : 0;

          return (
            <Card key={workshop.workshop_id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-black">{workshop.workshop_name}</h3>
                      <p className="text-sm text-gray-600">Capacidad: {workshop.total_capacity}</p>
                    </div>
                  </div>
                  {getCapacityBadge(capacityPercentage)}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Asignaciones actuales</span>
                    <span className={`font-semibold ${getCapacityColor(capacityPercentage)}`}>
                      {workshop.current_assignments}/{workshop.total_capacity}
                    </span>
                  </div>
                  
                  <Progress 
                    value={capacityPercentage} 
                    className="h-2"
                  />

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1 text-green-600">
                        <Users className="w-4 h-4" />
                        <span className="text-lg font-semibold">{workshop.available_capacity}</span>
                      </div>
                      <p className="text-xs text-gray-600">Disponible</p>
                    </div>
                    
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1 text-blue-600">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-lg font-semibold">{workshop.completion_rate}%</span>
                      </div>
                      <p className="text-xs text-gray-600">Completados</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {capacityStats.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay talleres registrados</h3>
          <p className="text-gray-600">Primero agrega algunos talleres para ver sus estadísticas de capacidad</p>
        </div>
      )}
    </div>
  );
};

export default WorkshopCapacityDashboard;
