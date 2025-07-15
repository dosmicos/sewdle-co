import { useState } from 'react';
import { RefreshCw, Calculator, TrendingUp, Package, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useReplenishment, ReplenishmentSuggestion } from '@/hooks/useReplenishment';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const getUrgencyBadge = (urgency: string) => {
  switch (urgency) {
    case 'critical':
      return <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Crítico
      </Badge>;
    case 'high':
      return <Badge variant="secondary" className="flex items-center gap-1 bg-orange-100 text-orange-800">
        <TrendingUp className="w-3 h-3" />
        Alto
      </Badge>;
    case 'normal':
      return <Badge variant="outline" className="flex items-center gap-1">
        <Package className="w-3 h-3" />
        Normal
      </Badge>;
    case 'low':
      return <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3" />
        Bajo
      </Badge>;
    default:
      return <Badge variant="outline">{urgency}</Badge>;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary" className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Pendiente
      </Badge>;
    case 'approved':
      return <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3" />
        Aprobado
      </Badge>;
    case 'rejected':
      return <Badge variant="destructive" className="flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        Rechazado
      </Badge>;
    case 'executed':
      return <Badge variant="default" className="flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        Ejecutado
      </Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const SuggestionRow = ({ 
  suggestion, 
  onApprove, 
  onReject 
}: { 
  suggestion: ReplenishmentSuggestion;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) => {
  return (
    <TableRow key={suggestion.id}>
      <TableCell className="font-medium">
        <div>
          <div className="font-semibold">{suggestion.product_name}</div>
          <div className="text-sm text-muted-foreground">
            {suggestion.variant_size && `Talla: ${suggestion.variant_size}`}
            {suggestion.variant_size && suggestion.variant_color && ' • '}
            {suggestion.variant_color && `Color: ${suggestion.variant_color}`}
          </div>
          <div className="text-xs text-muted-foreground">{suggestion.sku_variant}</div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="font-bold text-lg">{suggestion.suggested_quantity}</div>
        <div className="text-xs text-muted-foreground">unidades</div>
      </TableCell>
      <TableCell className="text-center">
        <div>{suggestion.current_stock}</div>
        <div className="text-xs text-muted-foreground">actual</div>
      </TableCell>
      <TableCell className="text-center">
        <div>{suggestion.sales_velocity.toFixed(2)}</div>
        <div className="text-xs text-muted-foreground">unid/día</div>
      </TableCell>
      <TableCell className="text-center">
        <div className={suggestion.days_of_stock < 15 ? 'text-orange-600 font-semibold' : ''}>
          {suggestion.days_of_stock > 365 ? '365+' : Math.round(suggestion.days_of_stock)}
        </div>
        <div className="text-xs text-muted-foreground">días</div>
      </TableCell>
      <TableCell className="text-center">
        <div>{suggestion.open_orders_quantity}</div>
        <div className="text-xs text-muted-foreground">en proceso</div>
      </TableCell>
      <TableCell>
        {getUrgencyBadge(suggestion.urgency_level)}
      </TableCell>
      <TableCell>
        {getStatusBadge(suggestion.status)}
      </TableCell>
      <TableCell>
        <div className="text-sm">{suggestion.reason}</div>
      </TableCell>
      <TableCell>
        {suggestion.status === 'pending' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={() => onApprove(suggestion.id)}
              className="h-8 px-2"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Aprobar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReject(suggestion.id)}
              className="h-8 px-2"
            >
              <XCircle className="w-3 h-3 mr-1" />
              Rechazar
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
};

export default function ReplenishmentPage() {
  const {
    suggestions,
    loading,
    calculating,
    calculateSuggestions,
    triggerReplenishmentFunction,
    updateSuggestionStatus,
    fetchSuggestions
  } = useReplenishment();

  const [activeTab, setActiveTab] = useState('suggestions');

  // Calcular estadísticas
  const stats = {
    total: suggestions.length,
    critical: suggestions.filter(s => s.urgency_level === 'critical').length,
    high: suggestions.filter(s => s.urgency_level === 'high').length,
    normal: suggestions.filter(s => s.urgency_level === 'normal').length,
    pending: suggestions.filter(s => s.status === 'pending').length,
    totalQuantity: suggestions.reduce((sum, s) => sum + s.suggested_quantity, 0),
  };

  const handleApprove = async (suggestionId: string) => {
    await updateSuggestionStatus(suggestionId, 'approved');
  };

  const handleReject = async (suggestionId: string) => {
    await updateSuggestionStatus(suggestionId, 'rejected');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Reposición Inteligente</h1>
          <p className="text-muted-foreground">
            Sugerencias automáticas de producción basadas en IA
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={fetchSuggestions}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button 
            variant="secondary"
            onClick={calculateSuggestions}
            disabled={calculating}
          >
            <Calculator className={`w-4 h-4 mr-2 ${calculating ? 'animate-spin' : ''}`} />
            Calcular Ahora
          </Button>
          <Button 
            onClick={triggerReplenishmentFunction}
            disabled={calculating}
          >
            <TrendingUp className={`w-4 h-4 mr-2 ${calculating ? 'animate-spin' : ''}`} />
            Ejecutar Función
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sugerencias</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pending} pendientes de aprobación
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Casos Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            <p className="text-xs text-muted-foreground">
              Requieren atención inmediata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Casos Altos</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
            <p className="text-xs text-muted-foreground">
              Prioridad alta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cantidad Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalQuantity.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Unidades sugeridas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {stats.critical > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>¡Atención! Stock Crítico Detectado</AlertTitle>
          <AlertDescription>
            Hay {stats.critical} productos con stock crítico (menos de 7 días). 
            Considera aprobar estas sugerencias inmediatamente.
          </AlertDescription>
        </Alert>
      )}

      {/* Contenido principal */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="suggestions">Sugerencias</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
          <TabsTrigger value="analytics">Análisis</TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sugerencias de Reposición</CardTitle>
              <p className="text-sm text-muted-foreground">
                Basadas en velocidad de venta de los últimos 30 días, stock actual y órdenes abiertas
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                  Cargando sugerencias...
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No hay sugerencias</h3>
                  <p className="text-muted-foreground mb-4">
                    No se encontraron sugerencias de reposición. Ejecuta el cálculo para generar nuevas sugerencias.
                  </p>
                  <Button onClick={calculateSuggestions} disabled={calculating}>
                    <Calculator className="w-4 h-4 mr-2" />
                    Calcular Sugerencias
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-center">Sugerencia</TableHead>
                        <TableHead className="text-center">Stock Actual</TableHead>
                        <TableHead className="text-center">Velocidad</TableHead>
                        <TableHead className="text-center">Días Stock</TableHead>
                        <TableHead className="text-center">Órdenes</TableHead>
                        <TableHead>Urgencia</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Razón</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suggestions.map((suggestion) => (
                        <SuggestionRow
                          key={suggestion.id}
                          suggestion={suggestion}
                          onApprove={handleApprove}
                          onReject={handleReject}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Reposición</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configura parámetros por variante de producto
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Configuración</h3>
                <p className="text-muted-foreground">
                  Panel de configuración en desarrollo
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análisis y Métricas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Rendimiento del sistema de reposición inteligente
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Análisis</h3>
                <p className="text-muted-foreground">
                  Métricas y análisis en desarrollo
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}