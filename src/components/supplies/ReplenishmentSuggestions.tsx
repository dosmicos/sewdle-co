import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useReplenishment, ReplenishmentSuggestion } from '@/hooks/useReplenishment';
import { ProductionOrderModal } from './ProductionOrderModal';
import { DataQualityBadge } from './DataQualityBadge';
import { AlertTriangle, TrendingUp, Package, Search, RefreshCw, Factory, Download, ArrowUpDown, ArrowUp, ArrowDown, Clock, History } from 'lucide-react';

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
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>('desc'); // Default: mayor a menor

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleRecalculate = async () => {
    await calculateSuggestions();
    setTimeout(() => {
      fetchSuggestions();
    }, 1000);
  };

  const getVariantName = (suggestion: ReplenishmentSuggestion): string => {
    const parts = [suggestion.variant_size, suggestion.variant_color].filter(Boolean);
    return parts.join(' / ') || 'Sin variante';
  };

  const filteredSuggestions = useMemo(() => {
    let filtered = suggestions.filter(suggestion => {
      const lowerSearch = searchTerm.toLowerCase();
      const nameText = (suggestion.product_name || '').toLowerCase();
      const skuText = (suggestion.sku_variant || '').toLowerCase();
      const variantText = getVariantName(suggestion).toLowerCase();
      const matchesSearch = nameText.includes(lowerSearch) || skuText.includes(lowerSearch) || variantText.includes(lowerSearch);
      const matchesUrgency = urgencyFilter === 'all' || suggestion.urgency === urgencyFilter;
      
      return matchesSearch && matchesUrgency;
    });

    // Aplicar ordenamiento si está activo
    if (sortOrder) {
      filtered = [...filtered].sort((a, b) => {
        const diff = a.suggested_quantity - b.suggested_quantity;
        return sortOrder === 'asc' ? diff : -diff;
      });
    }

    return filtered;
  }, [suggestions, searchTerm, urgencyFilter, sortOrder]);

  const getUrgencyBadge = (urgency: string) => {
    const variants = {
      critical: 'bg-destructive text-destructive-foreground',
      high: 'bg-orange-500 text-white',
      medium: 'bg-amber-500 text-white',
      low: 'bg-muted text-muted-foreground',
    };
    
    return (
      <Badge className={variants[urgency as keyof typeof variants] || variants.low}>
        {urgency === 'critical' ? 'Crítico' : 
         urgency === 'high' ? 'Alto' : 
         urgency === 'medium' ? 'Medio' : 'Bajo'}
      </Badge>
    );
  };

  const handleSuggestionSelect = (variantId: string) => {
    setSelectedSuggestions(prev => {
      if (prev.includes(variantId)) {
        return prev.filter(id => id !== variantId);
      }
      return [...prev, variantId];
    });
  };

  const handleSelectAll = () => {
    if (selectedSuggestions.length === filteredSuggestions.length) {
      setSelectedSuggestions([]);
    } else {
      setSelectedSuggestions(filteredSuggestions.map(s => s.variant_id));
    }
  };

  const handleCreateProductionOrder = () => {
    setShowProductionModal(true);
  };

  const handleProductionOrderSuccess = () => {
    setSelectedSuggestions([]);
    fetchSuggestions();
  };

  const getSelectedSuggestions = (): ReplenishmentSuggestion[] => {
    return suggestions.filter(s => selectedSuggestions.includes(s.variant_id));
  };

  const toggleSortOrder = () => {
    if (sortOrder === null) {
      setSortOrder('desc'); // Mayor a menor
    } else if (sortOrder === 'desc') {
      setSortOrder('asc'); // Menor a mayor
    } else {
      setSortOrder('desc'); // Volver a mayor a menor
    }
  };

  const getSortIcon = () => {
    if (sortOrder === null) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    if (sortOrder === 'desc') return <ArrowDown className="h-4 w-4 ml-1" />;
    return <ArrowUp className="h-4 w-4 ml-1" />;
  };

  const handleDownloadCSV = () => {
    const selectedData = getSelectedSuggestions();
    if (selectedData.length === 0) return;

    const headers = [
      'Producto',
      'Variante',
      'SKU',
      'Stock Actual',
      'Ventas 30d',
      'Velocidad (diario)',
      'Días de Stock',
      'Pendiente Producción',
      'Cantidad Sugerida',
      'Nivel de Urgencia',
      'Calidad de Datos'
    ];

    const csvRows = [headers.join(',')];
    
    selectedData.forEach(suggestion => {
      const row = [
        `"${suggestion.product_name || ''}"`,
        `"${getVariantName(suggestion)}"`,
        `"${suggestion.sku_variant || suggestion.sku || '-'}"`,
        suggestion.current_stock || 0,
        suggestion.sales_30d || 0,
        Number(suggestion.avg_daily_sales || 0).toFixed(2),
        Math.round(suggestion.days_of_supply || 0),
        suggestion.pending_production || 0,
        suggestion.suggested_quantity || 0,
        `"${suggestion.urgency?.toUpperCase() || 'MEDIUM'}"`,
        `"${suggestion.data_confidence?.toUpperCase() || 'MEDIUM'}"`,
      ];
      csvRows.push(row.join(','));
    });

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-ES');
    const timeStr = now.toLocaleTimeString('es-ES');
    
    csvRows.unshift(`# Generado el ${dateStr} a las ${timeStr}`);
    csvRows.unshift(`# Total de sugerencias: ${selectedData.length}`);
    csvRows.unshift('');

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const timestamp = now.toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
      const filename = `recomendaciones_reposicion_${timestamp}.csv`;
      
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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
                  {suggestions.filter(s => s.urgency === 'critical').length}
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
                  {suggestions.filter(s => s.urgency === 'high').length}
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
              <CardTitle>Análisis con Datos en Tiempo Real de Shopify</CardTitle>
              <CardDescription>
                Stock actual, ventas últimos 30 días y demanda proyectada
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
                      Total: {getSelectedSuggestions().reduce((sum, s) => sum + s.suggested_quantity, 0)} unidades
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
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-2"
                    disabled={selectedSuggestions.length === 0}
                  >
                    <Download className="h-4 w-4" />
                    Descargar CSV
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
                <SelectItem value="critical">🔴 Crítica</SelectItem>
                <SelectItem value="high">🟠 Alta</SelectItem>
                <SelectItem value="medium">🟡 Media</SelectItem>
                <SelectItem value="low">🟢 Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Suggestions Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedSuggestions.length === filteredSuggestions.length && filteredSuggestions.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Calidad Datos</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Ventas 30d</TableHead>
                  <TableHead className="text-right">Vel. diaria</TableHead>
                  <TableHead className="text-right">Días Stock</TableHead>
                  <TableHead className="text-right">En Producción</TableHead>
                  <TableHead className="text-right">En Calidad</TableHead>
                  <TableHead className="text-right">Cobertura</TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={toggleSortOrder}
                  >
                    <div className="flex items-center justify-end">
                      Sugerida
                      {getSortIcon()}
                    </div>
                  </TableHead>
                  <TableHead>Urgencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuggestions.map((suggestion) => (
                  <TableRow key={suggestion.variant_id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedSuggestions.includes(suggestion.variant_id)}
                        onCheckedChange={() => handleSuggestionSelect(suggestion.variant_id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{suggestion.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {getVariantName(suggestion)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{suggestion.sku_variant}</TableCell>
                    <TableCell>
                      <DataQualityBadge quality={suggestion.data_confidence} />
                    </TableCell>
                    <TableCell className="text-right">{suggestion.current_stock}</TableCell>
                    <TableCell className="text-right">{suggestion.sales_30d}</TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <div className="flex items-center justify-end gap-1">
                          <span>{suggestion.avg_daily_sales.toFixed(2)}</span>
                          {suggestion.reason?.includes('historica') && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-[10px] px-1 py-0">
                                  <History className="h-3 w-3 mr-0.5" />
                                  Hist.
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Velocidad histórica guardada: sin ventas recientes en 30d ni 90d</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {suggestion.reason?.includes('90d') && !suggestion.reason?.includes('historica') && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-[10px] px-1 py-0">
                                  <Clock className="h-3 w-3 mr-0.5" />
                                  90d
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{suggestion.reason}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {suggestion.reason && !suggestion.reason.includes('historica') && !suggestion.reason.includes('90d') && suggestion.reason.includes('ajustada') && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-[10px] px-1 py-0">
                                  30d
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{suggestion.reason}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-right">
                      {suggestion.days_of_supply?.toFixed(1) || 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">{suggestion.pending_production}</TableCell>
                    <TableCell className="text-right">
                      {suggestion.in_transit > 0 ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          {suggestion.in_transit}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {suggestion.pipeline_coverage_days != null ? (
                        <Badge variant="outline" className={
                          suggestion.pipeline_coverage_days < 7 
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : suggestion.pipeline_coverage_days < 14 
                              ? 'bg-amber-50 text-amber-700 border-amber-200' 
                              : 'bg-green-50 text-green-700 border-green-200'
                        }>
                          {suggestion.pipeline_coverage_days}d
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{suggestion.suggested_quantity}</TableCell>
                    <TableCell>{getUrgencyBadge(suggestion.urgency)}</TableCell>
                  </TableRow>
                ))}
                {filteredSuggestions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                      No se encontraron sugerencias de reposición
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Production Order Modal */}
      {showProductionModal && (
        <ProductionOrderModal
          isOpen={showProductionModal}
          onClose={() => setShowProductionModal(false)}
          onSuccess={handleProductionOrderSuccess}
          selectedSuggestions={getSelectedSuggestions()}
        />
      )}
    </div>
  );
};
