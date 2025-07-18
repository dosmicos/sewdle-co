
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useReplenishment } from '@/hooks/useReplenishment';
import { AlertTriangle, TrendingUp, Package, Search, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

export const ReplenishmentSuggestions: React.FC = () => {
  const { 
    suggestions, 
    loading, 
    calculating, 
    fetchSuggestions, 
    updateSuggestionStatus,
    triggerReplenishmentFunction
  } = useReplenishment();

  const [searchTerm, setSearchTerm] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const filteredSuggestions = suggestions.filter(suggestion => {
    const matchesSearch = suggestion.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         suggestion.sku_variant.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUrgency = urgencyFilter === 'all' || suggestion.urgency_level === urgencyFilter;
    const matchesStatus = statusFilter === 'all' || suggestion.status === statusFilter;
    
    return matchesSearch && matchesUrgency && matchesStatus;
  });

  const getUrgencyBadge = (urgency: string) => {
    const variants = {
      critical: 'destructive',
      high: 'secondary',
      normal: 'outline',
      low: 'default'
    } as const;
    
    const colors = {
      critical: '🔴',
      high: '🟡',
      normal: '🟢',
      low: '🔵'
    };
    
    return (
      <Badge variant={variants[urgency as keyof typeof variants] || 'outline'}>
        {colors[urgency as keyof typeof colors]} {urgency.toUpperCase()}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'outline',
      approved: 'default',
      rejected: 'destructive',
      executed: 'secondary'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const handleApprove = async (suggestionId: string) => {
    await updateSuggestionStatus(suggestionId, 'approved');
  };

  const handleReject = async (suggestionId: string) => {
    await updateSuggestionStatus(suggestionId, 'rejected');
  };

  const handleRecalculate = async () => {
    await triggerReplenishmentFunction();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Cargando sugerencias...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Críticas</p>
                <p className="text-2xl font-bold">
                  {suggestions.filter(s => s.urgency_level === 'critical').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Altas</p>
                <p className="text-2xl font-bold">
                  {suggestions.filter(s => s.urgency_level === 'high').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Sugerencias</p>
                <p className="text-2xl font-bold">{suggestions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Aprobadas</p>
                <p className="text-2xl font-bold">
                  {suggestions.filter(s => s.status === 'approved').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Sugerencias Inteligentes de Reposición</CardTitle>
              <CardDescription>
                Basado en análisis de ventas, stock actual y demanda proyectada
              </CardDescription>
            </div>
            <Button 
              onClick={handleRecalculate}
              disabled={calculating}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${calculating ? 'animate-spin' : ''}`} />
              Recalcular
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por producto o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por urgencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las urgencias</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Baja</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="approved">Aprobada</SelectItem>
                <SelectItem value="rejected">Rechazada</SelectItem>
                <SelectItem value="executed">Ejecutada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredSuggestions.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {suggestions.length === 0 
                  ? "No hay sugerencias de reposición disponibles. Ejecuta una sincronización de Shopify primero."
                  : "No se encontraron sugerencias que coincidan con los filtros aplicados."
                }
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Stock Actual</TableHead>
                    <TableHead>Ventas 30d</TableHead>
                    <TableHead>Días de Stock</TableHead>
                    <TableHead>Cantidad Sugerida</TableHead>
                    <TableHead>Urgencia</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuggestions.map((suggestion) => (
                    <TableRow key={suggestion.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{suggestion.product_name}</p>
                          {(suggestion.variant_size || suggestion.variant_color) && (
                            <p className="text-sm text-muted-foreground">
                              {[suggestion.variant_size, suggestion.variant_color].filter(Boolean).join(' - ')}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {suggestion.sku_variant}
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${
                          suggestion.current_stock <= 0 ? 'text-red-600' : 
                          suggestion.current_stock < 10 ? 'text-yellow-600' : 
                          'text-green-600'
                        }`}>
                          {suggestion.current_stock}
                        </span>
                      </TableCell>
                      <TableCell>{suggestion.sales_30_days}</TableCell>
                      <TableCell>
                        <span className={`font-medium ${
                          suggestion.days_of_stock <= 7 ? 'text-red-600' : 
                          suggestion.days_of_stock <= 15 ? 'text-yellow-600' : 
                          'text-green-600'
                        }`}>
                          {Math.round(suggestion.days_of_stock)}d
                        </span>
                      </TableCell>
                      <TableCell className="font-bold text-primary">
                        {suggestion.suggested_quantity}
                      </TableCell>
                      <TableCell>
                        {getUrgencyBadge(suggestion.urgency_level)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(suggestion.status)}
                      </TableCell>
                      <TableCell>
                        {suggestion.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApprove(suggestion.id)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReject(suggestion.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
