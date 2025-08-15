import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Plus, Target, CheckCircle, AlertCircle } from 'lucide-react';

export const OKRMyQuarterPage = () => {
  return (
    <div className="space-y-6">
      {/* Personal Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mis Objetivos</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">Para este trimestre</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Promedio 65% completo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">¡Buen trabajo!</p>
          </CardContent>
        </Card>
      </div>

      {/* My Objectives */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Mis Objetivos Q1 2024</CardTitle>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Objetivo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sample Objective */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold">Mejorar eficiencia operacional del área de producción</h3>
                <p className="text-sm text-muted-foreground">Reducir tiempos y optimizar procesos</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">75%</div>
                <div className="text-xs text-muted-foreground">En progreso</div>
              </div>
            </div>
            
            <Progress value={75} className="h-2" />
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Key Results:</h4>
              <div className="space-y-2 pl-4">
                <div className="flex items-center justify-between text-sm">
                  <span>• Reducir tiempo de setup en 25%</span>
                  <span className="text-green-600 font-medium">100%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>• Implementar 3 nuevos procesos automatizados</span>
                  <span className="text-yellow-600 font-medium">67%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>• Aumentar productividad general en 15%</span>
                  <span className="text-yellow-600 font-medium">58%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Another Sample Objective */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold">Fortalecer cultura de innovación en el equipo</h3>
                <p className="text-sm text-muted-foreground">Fomentar creatividad y mejora continua</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">45%</div>
                <div className="text-xs text-muted-foreground">En progreso</div>
              </div>
            </div>
            
            <Progress value={45} className="h-2" />
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Key Results:</h4>
              <div className="space-y-2 pl-4">
                <div className="flex items-center justify-between text-sm">
                  <span>• Realizar 4 sesiones de brainstorming mensuales</span>
                  <span className="text-yellow-600 font-medium">50%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>• Implementar 2 ideas del equipo</span>
                  <span className="text-gray-600 font-medium">0%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>• Incrementar participación en sugerencias 30%</span>
                  <span className="text-yellow-600 font-medium">75%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};