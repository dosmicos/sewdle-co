import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Award, Gift, Star, Target, TrendingUp } from 'lucide-react';

export const OKRIncentivesPage = () => {
  return (
    <div className="space-y-6">
      {/* Incentives Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Puntos Acumulados</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,250</div>
            <p className="text-xs text-muted-foreground">+180 esta semana</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Logros Desbloqueados</CardTitle>
            <Award className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">De 20 disponibles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ranking del Área</CardTitle>
            <Trophy className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">#2</div>
            <p className="text-xs text-muted-foreground">De 8 participantes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recompensas Canjeadas</CardTitle>
            <Gift className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">Este trimestre</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Incentives */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Incentivos Activos</CardTitle>
            <Button variant="outline" size="sm">Ver Historial</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <Target className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Objetivo Completado - Q1</h3>
                  <p className="text-sm text-muted-foreground">Bonus por completar objetivo antes del plazo</p>
                </div>
              </div>
              <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                +500 puntos
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Completado el 15 de Marzo • Resultado: Mejorar eficiencia operacional 75% → 100%
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Progreso Consistente</h3>
                  <p className="text-sm text-muted-foreground">7 días consecutivos de actualización de progreso</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                +150 puntos
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Racha activa • Último check-in: Hoy 14:30
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3 opacity-50">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                  <Award className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Mentor del Trimestre</h3>
                  <p className="text-sm text-muted-foreground">Ayudar a 3 compañeros a completar sus objetivos</p>
                </div>
              </div>
              <Badge variant="outline">
                1/3 completo
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Progreso: Juan Pérez (completado) • María González (en progreso)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Rewards */}
      <Card>
        <CardHeader>
          <CardTitle>Recompensas Disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Gift className="h-8 w-8 text-blue-500" />
                <Badge variant="secondary">500 pts</Badge>
              </div>
              <div>
                <h3 className="font-semibold">Día Libre Adicional</h3>
                <p className="text-sm text-muted-foreground">Un día de descanso extra</p>
              </div>
              <Button size="sm" className="w-full">Canjear</Button>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Gift className="h-8 w-8 text-green-500" />
                <Badge variant="secondary">750 pts</Badge>
              </div>
              <div>
                <h3 className="font-semibold">Voucher de Almuerzo</h3>
                <p className="text-sm text-muted-foreground">$25 para restaurante local</p>
              </div>
              <Button size="sm" className="w-full">Canjear</Button>
            </div>

            <div className="border rounded-lg p-4 space-y-3 opacity-50">
              <div className="flex items-center justify-between">
                <Gift className="h-8 w-8 text-purple-500" />
                <Badge variant="outline">1000 pts</Badge>
              </div>
              <div>
                <h3 className="font-semibold">Curso de Capacitación</h3>
                <p className="text-sm text-muted-foreground">Certificación profesional</p>
              </div>
              <Button size="sm" variant="outline" className="w-full" disabled>
                250 pts restantes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};