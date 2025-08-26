import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useReplenishment, ReplenishmentSuggestion } from '@/hooks/useReplenishment';
import { ProductionOrderModal } from './ProductionOrderModal';
import { AlertTriangle, TrendingUp, Package, Search, RefreshCw, Factory } from 'lucide-react';

export const ReplenishmentSuggestions: React.FC = () => {
  const { 
    suggestions, 
    loading, 
    calculating, 
    fetchSuggestions, 
    calculateSuggestions
  } = useReplenishment();

  const [searchTerm, setSearchTerm] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [selectedSuggestions, setSelectedSuggestions] = useState<ReplenishmentSuggestion[]>([]);
  const [showProductionModal, setShowProductionModal] = useState(false);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleRecalculate = async () => {
    await calculateSuggestions();
    // Add a small delay to ensure the calculation is complete before fetching
    setTimeout(() => {
      fetchSuggestions();
    }, 1000);
  };

const filteredSuggestions = suggestions.filter(suggestion => {
  const lowerSearch = searchTerm.toLowerCase();
  const nameText = (suggestion.product_name || '').toLowerCase();
  const skuText = (suggestion.sku || '').toLowerCase();
  const variantText = (suggestion.variant_name || '').toLowerCase();
  const matchesSearch = nameText.includes(lowerSearch) || skuText.includes(lowerSearch) || variantText.includes(lowerSearch);
  const matchesUrgency = urgencyFilter === 'all' || suggestion.urgency_level === urgencyFilter;
  
  return matchesSearch && matchesUrgency;
});

  const getUrgencyBadge = (urgency: string) => {
    const variants = {
      critical: 'destructive',
      high: 'secondary',
      normal: 'default',
      low: 'outline'
    } as const;
    
    const labels = {
      critical: 'CRÍTICA',
      high: 'ALTA',
      normal: 'NORMAL',
      low: 'BAJA'
    };
    
    const icons = {
      critical: '🔴',
      high: '🟠',
      normal: '🟢',
      low: '🔵'
    };
    
    return (
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${
          urgency === 'critical' ? 'bg-red-500 animate-pulse' : 
          urgency === 'high' ? 'bg-orange-500' : 
          urgency === 'normal' ? 'bg-green-500' : 
          'bg-blue-500'
        }`} />
        <Badge variant={variants[urgency as keyof typeof variants] || 'outline'} className="font-medium">
          {labels[urgency as keyof typeof labels] || urgency.toUpperCase()}
        </Badge>
      </div>
    );
  };


  const handleSuggestionSelect = (suggestion: ReplenishmentSuggestion, checked: boolean) => {
    if (checked) {
      setSelectedSuggestions(prev => [...prev, suggestion]);
    } else {
      setSelectedSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSuggestions(filteredSuggestions);
    } else {
      setSelectedSuggestions([]);
    }
  };

  const handleCreateProductionOrder = () => {
    setShowProductionModal(true);
  };

  const handleProductionOrderSuccess = () => {
    setSelectedSuggestions([]);
    fetchSuggestions(); // Refresh the data
  };

  const allSuggestionsSelected = filteredSuggestions.length > 0 && 
    filteredSuggestions.every(s => selectedSuggestions.some(sel => sel.id === s.id));

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
              <Factory className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Seleccionadas</p>
                <p className="text-2xl font-bold">
                  {selectedSuggestions.length}
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
              <CardTitle>Análisis con Datos Automáticos</CardTitle>
              <CardDescription>
                Usando datos en tiempo real de Shopify via webhook - stock actual, ventas y demanda proyectada
              </CardDescription>
            </div>
            <Button 
              onClick={handleRecalculate}
              disabled={calculating}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${calculating ? 'animate-spin' : ''}`} />
              {calculating ? 'Calculando...' : 'Calcular Sugerencias'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Production Order Controls */}
          {selectedSuggestions.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">
                      {selectedSuggestions.length} sugerencias seleccionadas
                    </p>
                    <p className="text-sm text-blue-700">
                      Total: {selectedSuggestions.reduce((sum, s) => sum + s.suggested_quantity, 0)} unidades
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSuggestions([])}
                  >
                    Limpiar Selección
                  </Button>
                  <Button
                    onClick={handleCreateProductionOrder}
                    className="flex items-center gap-2"
                  >
                    <Factory className="h-4 w-4" />
                    Crear Orden de Producción
                  </Button>
                </div>
              </div>
            </div>
          )}

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
            
          </div>

          {filteredSuggestions.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {suggestions.length === 0 
                  ? "No hay sugerencias disponibles. Los datos se actualizan automáticamente con las ventas de Shopify."
                  : "No se encontraron sugerencias que coincidan con los filtros aplicados."
                }
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSuggestionsSelected}
                        onCheckedChange={handleSelectAll}
                        disabled={filteredSuggestions.length === 0}
                      />
                    </TableHead>
                    <TableHead>Producto / Variante / SKU</TableHead>
                    <TableHead>Stock Actual</TableHead>
                    <TableHead className="bg-green-50">Ventas 30d</TableHead>
                    <TableHead>Velocidad (diario)</TableHead>
                    <TableHead>Días de Stock</TableHead>
                    <TableHead>Pendiente Producción</TableHead>
                    <TableHead>Cantidad Sugerida</TableHead>
                    <TableHead>Urgencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuggestions.map((suggestion) => (
                    <TableRow key={suggestion.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSuggestions.some(s => s.id === suggestion.id)}
                          onCheckedChange={(checked) => handleSuggestionSelect(suggestion, checked as boolean)}
                        />
                      </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{suggestion.product_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {suggestion.variant_name}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono mt-1">
                              SKU: {suggestion.sku}
                            </p>
                          </div>
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
                       <TableCell className="bg-green-50">
                         <span className="font-bold text-green-700 text-lg">
                           {suggestion.sales_last_30_days}
                         </span>
                       </TableCell>
                       <TableCell>
                         <span className="text-sm font-medium text-primary">
                           {Number(suggestion.sales_velocity || 0).toFixed(2)}
                         </span>
                       </TableCell>
                       <TableCell>
                         <span className={`font-medium ${
                           suggestion.stock_days_remaining <= 7 ? 'text-red-600' : 
                           suggestion.stock_days_remaining <= 15 ? 'text-yellow-600' : 
                           'text-green-600'
                         }`}>
                           {Math.round(suggestion.stock_days_remaining)}d
                         </span>
                       </TableCell>
                       <TableCell>
                         <span className="font-medium text-blue-600">
                           {suggestion.open_orders_quantity || 0}
                         </span>
                       </TableCell>
                      <TableCell className="font-bold text-primary">
                        {suggestion.suggested_quantity}
                      </TableCell>
                      <TableCell>
                        {getUrgencyBadge(suggestion.urgency_level)}
                      </TableCell>
                     </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductionOrderModal
        isOpen={showProductionModal}
        onClose={() => setShowProductionModal(false)}
        selectedSuggestions={selectedSuggestions}
        onSuccess={handleProductionOrderSuccess}
      />
    </div>
  );
};
