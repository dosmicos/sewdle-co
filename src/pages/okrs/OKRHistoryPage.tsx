import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, TrendingUp, Target, Award, Download, Filter } from 'lucide-react';

export const OKRHistoryPage = () => {
  return (
    <div className="space-y-6">
      {/* Historical Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Histórico de OKRs</CardTitle>
              <p className="text-sm text-muted-foreground">Análisis de rendimiento y evolución trimestral</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quarter Tabs */}
      <Tabs defaultValue="q4-2023" className="space-y-4">
        <TabsList>
          <TabsTrigger value="q4-2023">Q4 2023</TabsTrigger>
          <TabsTrigger value="q3-2023">Q3 2023</TabsTrigger>
          <TabsTrigger value="q2-2023">Q2 2023</TabsTrigger>
          <TabsTrigger value="q1-2023">Q1 2023</TabsTrigger>
        </TabsList>

        <TabsContent value="q4-2023" className="space-y-6">
          {/* Q4 2023 Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Objetivos Totales</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">4</div>
                <p className="text-xs text-muted-foreground">Oct - Dic 2023</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Promedio de Logro</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">82%</div>
                <p className="text-xs text-green-600">+15% vs Q3</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completados</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <p className="text-xs text-muted-foreground">75% éxito</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Puntos Ganados</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2,150</div>
                <p className="text-xs text-muted-foreground">Récord trimestral</p>
              </CardContent>
            </Card>
          </div>

          {/* Q4 2023 Objectives */}
          <Card>
            <CardHeader>
              <CardTitle>Objetivos Q4 2023</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold flex items-center gap-2">
                      Optimizar procesos de manufactura
                      <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        Completado
                      </Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground">Oct 1 - Dic 31, 2023</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">95%</div>
                    <div className="text-xs text-muted-foreground">Final Score</div>
                  </div>
                </div>
                <Progress value={95} className="h-2" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  <div>• Reducir desperdicios 20% ✓ <span className="text-green-600 font-medium">100%</span></div>
                  <div>• Implementar Lean Manufacturing ✓ <span className="text-green-600 font-medium">100%</span></div>
                  <div>• Capacitar 15 operarios ✓ <span className="text-yellow-600 font-medium">85%</span></div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold flex items-center gap-2">
                      Mejorar satisfacción del cliente
                      <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        Completado
                      </Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground">Oct 1 - Dic 31, 2023</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">88%</div>
                    <div className="text-xs text-muted-foreground">Final Score</div>
                  </div>
                </div>
                <Progress value={88} className="h-2" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  <div>• NPS score &gt; 8.5 ✓ <span className="text-green-600 font-medium">100%</span></div>
                  <div>• Tiempo respuesta &lt; 24h ✓ <span className="text-green-600 font-medium">95%</span></div>
                  <div>• Resolución primer contacto 80% <span className="text-yellow-600 font-medium">70%</span></div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold flex items-center gap-2">
                      Fortalecer equipo de trabajo
                      <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        Completado
                      </Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground">Oct 1 - Dic 31, 2023</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">92%</div>
                    <div className="text-xs text-muted-foreground">Final Score</div>
                  </div>
                </div>
                <Progress value={92} className="h-2" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  <div>• Retención talento &gt; 95% ✓ <span className="text-green-600 font-medium">100%</span></div>
                  <div>• Clima laboral &gt; 4.5/5 ✓ <span className="text-green-600 font-medium">100%</span></div>
                  <div>• Certificaciones técnicas 12 <span className="text-yellow-600 font-medium">75%</span></div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold flex items-center gap-2">
                      Innovación en productos
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        Parcial
                      </Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground">Oct 1 - Dic 31, 2023</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-yellow-600">45%</div>
                    <div className="text-xs text-muted-foreground">Final Score</div>
                  </div>
                </div>
                <Progress value={45} className="h-2" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  <div>• Lanzar 2 productos nuevos <span className="text-red-600 font-medium">0%</span></div>
                  <div>• I+D inversión 5% revenue ✓ <span className="text-green-600 font-medium">100%</span></div>
                  <div>• Patentes solicitadas: 3 <span className="text-yellow-600 font-medium">33%</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="q3-2023" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center space-y-2">
                  <Calendar className="h-8 w-8 mx-auto opacity-50" />
                  <p>Datos de Q3 2023 disponibles próximamente</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="q2-2023" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center space-y-2">
                  <Calendar className="h-8 w-8 mx-auto opacity-50" />
                  <p>Datos de Q2 2023 disponibles próximamente</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="q1-2023" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center space-y-2">
                  <Calendar className="h-8 w-8 mx-auto opacity-50" />
                  <p>Datos de Q1 2023 disponibles próximamente</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};