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
import { DataQualityBadge } from './DataQualityBadge';
import { AlertTriangle, TrendingUp, Package, Search, RefreshCw, Factory, ChevronUp, ChevronDown, ChevronsUpDown, Download } from 'lucide-react';

export const ReplenishmentSuggestions: React.FC = () => {
  const { 
    suggestions: rawSuggestions, 
    loading, 
    calculating, 
    fetchSuggestions, 
    calculateSuggestions
  } = useReplenishment();

  // Data validation and deduplication
  const suggestions = React.useMemo(() => {
    if (!rawSuggestions || rawSuggestions.length === 0) return [];
    
    // Filter out invalid suggestions (without valid identifiers)
    const validSuggestions = rawSuggestions.filter(suggestion => 
      suggestion.sku_variant || suggestion.product_variant_id
    );
    
    // Remove duplicates based on sku_variant (primary) or product_variant_id (fallback)
    const uniqueSuggestions = validSuggestions.reduce((acc, current) => {
      const key = current.sku_variant || current.product_variant_id;
      const existing = acc.find(item => (item.sku_variant || item.product_variant_id) === key);
      
      if (!existing) {
        acc.push(current);
      } else {
        console.warn(`Duplicate replenishment suggestion found for key: ${key}`);
      }
      
      return acc;
    }, [] as ReplenishmentSuggestion[]);
    
    return uniqueSuggestions;
  }, [rawSuggestions]);

  const [searchTerm, setSearchTerm] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [showProductionModal, setShowProductionModal] = useState(false);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  // Sortable columns configuration
  const sortableColumns = [
    { key: 'current_stock', label: 'Stock Actual' },
    { key: 'sales_last_30_days', label: 'Ventas 30d' },
    { key: 'sales_velocity', label: 'Velocidad (diario)' },
    { key: 'stock_days_remaining', label: 'Días de Stock' },
    { key: 'open_orders_quantity', label: 'Pendiente Producción' },
    { key: 'suggested_quantity', label: 'Cantidad Sugerida' },
    { key: 'urgency_level', label: 'Urgencia' }
  ];

  // Handle column sorting
  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // Get sort icon for column header
  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ChevronsUpDown className="h-4 w-4 text-muted-foreground ml-1" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="h-4 w-4 text-primary ml-1" />;
    }
    if (sortDirection === 'desc') {
      return <ChevronDown className="h-4 w-4 text-primary ml-1" />;
    }
    return <ChevronsUpDown className="h-4 w-4 text-muted-foreground ml-1" />;
  };

  // Sorting function
  const sortSuggestions = (suggestions: ReplenishmentSuggestion[]) => {
    if (!sortColumn || !sortDirection) return suggestions;

    return [...suggestions].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Handle urgency specially (categorical sorting)
      if (sortColumn === 'urgency_level') {
        const urgencyOrder = { critical: 4, high: 3, normal: 2, low: 1 };
        aValue = urgencyOrder[a.urgency_level as keyof typeof urgencyOrder] || 0;
        bValue = urgencyOrder[b.urgency_level as keyof typeof urgencyOrder] || 0;
      } else {
        // Handle numeric columns
        aValue = Number(a[sortColumn as keyof ReplenishmentSuggestion]) || 0;
        bValue = Number(b[sortColumn as keyof ReplenishmentSuggestion]) || 0;
      }

      if (sortDirection === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  };

  // Create unique key for each suggestion - use sku_variant as primary unique identifier
  const getKey = (suggestion: ReplenishmentSuggestion): string => {
    return suggestion.sku_variant || suggestion.product_variant_id || `fallback-${suggestion.id}`;
  };

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

  // Apply filtering and then sorting
  const filteredAndSortedSuggestions = React.useMemo(() => {
    const filtered = suggestions.filter(suggestion => {
      const lowerSearch = searchTerm.toLowerCase();
      const nameText = (suggestion.product_name || '').toLowerCase();
      const skuText = (suggestion.sku || '').toLowerCase();
      const variantText = (suggestion.variant_name || '').toLowerCase();
      const matchesSearch = nameText.includes(lowerSearch) || skuText.includes(lowerSearch) || variantText.includes(lowerSearch);
      const matchesUrgency = urgencyFilter === 'all' || suggestion.urgency_level === urgencyFilter;
      
      return matchesSearch && matchesUrgency;
    });

    return sortSuggestions(filtered);
  }, [suggestions, searchTerm, urgencyFilter, sortColumn, sortDirection]);

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
    const key = getKey(suggestion);
    if (checked) {
      setSelectedSuggestions(prev => [...prev, key]);
    } else {
      setSelectedSuggestions(prev => prev.filter(k => k !== key));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSuggestions(filteredAndSortedSuggestions.map(s => getKey(s)));
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

  const allSuggestionsSelected = filteredAndSortedSuggestions.length > 0 && 
    filteredAndSortedSuggestions.every(s => selectedSuggestions.includes(getKey(s)));

  const getSelectedSuggestions = (): ReplenishmentSuggestion[] => {
    return suggestions.filter(s => selectedSuggestions.includes(getKey(s)));
  };

  // Matrix generation function
  const generateMatrixSection = (suggestions: ReplenishmentSuggestion[]): string[] => {
    // Group data by product and size, summing quantities for multiple colors
    const matrix: { [size: string]: { [product: string]: number } } = {};
    const products = new Set<string>();
    const sizes = new Set<string>();

    suggestions.forEach(suggestion => {
      const product = suggestion.product_name || 'Sin nombre';
      const size = suggestion.variant_size || 'Sin talla';
      const quantity = suggestion.suggested_quantity || 0;

      products.add(product);
      sizes.add(size);

      if (!matrix[size]) {
        matrix[size] = {};
      }
      if (!matrix[size][product]) {
        matrix[size][product] = 0;
      }
      matrix[size][product] += quantity;
    });

    // Sort sizes logically (numbers first, then alphabetical)
    const sortedSizes = Array.from(sizes).sort((a, b) => {
      const aIsNumber = !isNaN(Number(a));
      const bIsNumber = !isNaN(Number(b));
      
      if (aIsNumber && bIsNumber) {
        return Number(a) - Number(b);
      }
      if (aIsNumber && !bIsNumber) return -1;
      if (!aIsNumber && bIsNumber) return 1;
      return a.localeCompare(b);
    });

    const sortedProducts = Array.from(products).sort();

    // Generate matrix section
    const matrixRows: string[] = [];
    
    // Add section header
    matrixRows.push('');
    matrixRows.push('# MATRIZ DE CANTIDADES SUGERIDAS POR PRODUCTO');
    matrixRows.push('');

    // Create header row
    const headerRow = ['Talla', ...sortedProducts, 'Total'];
    matrixRows.push(headerRow.map(h => `"${h}"`).join(','));

    // Create data rows
    const columnTotals: { [product: string]: number } = {};
    sortedProducts.forEach(product => columnTotals[product] = 0);
    let grandTotal = 0;

    sortedSizes.forEach(size => {
      const row = [`"${size}"`];
      let rowTotal = 0;

      sortedProducts.forEach(product => {
        const quantity = matrix[size]?.[product] || 0;
        row.push(quantity.toString());
        columnTotals[product] += quantity;
        rowTotal += quantity;
        grandTotal += quantity;
      });

      row.push(rowTotal.toString());
      matrixRows.push(row.join(','));
    });

    // Add totals row
    const totalsRow = ['"Total"'];
    sortedProducts.forEach(product => {
      totalsRow.push(columnTotals[product].toString());
    });
    totalsRow.push(grandTotal.toString());
    matrixRows.push(totalsRow.join(','));

    return matrixRows;
  };

  // CSV generation function
  const generateCSVContent = (suggestions: ReplenishmentSuggestion[]): string => {
    // SECTION 1: Detailed data
    const headers = [
      'Producto',
      'Variante',
      'SKU',
      'Stock Actual',
      'Ventas 30 días',
      'Velocidad (diario)',
      'Días de Stock',
      'Pendiente Producción',
      'Cantidad Sugerida',
      'Nivel de Urgencia',
      'Motivo',
      'Calidad de Datos'
    ];

    const csvRows = [headers.join(',')];
    
    suggestions.forEach(suggestion => {
      const row = [
        `"${suggestion.product_name || ''}"`,
        `"${suggestion.variant_name || [suggestion.variant_size, suggestion.variant_color].filter(Boolean).join(' / ') || 'Sin variante'}"`,
        `"${suggestion.sku_variant || suggestion.sku || '-'}"`,
        suggestion.current_stock || 0,
        suggestion.sales_last_30_days || 0,
        Number(suggestion.sales_velocity || 0).toFixed(2),
        Math.round(suggestion.stock_days_remaining || 0),
        suggestion.open_orders_quantity || 0,
        suggestion.suggested_quantity || 0,
        `"${suggestion.urgency_level?.toUpperCase() || 'NORMAL'}"`,
        `"${suggestion.reason || 'Reposición automática basada en análisis de ventas'}"`,
        `"${suggestion.data_quality?.toUpperCase() || 'MEDIUM'}"`,
      ];
      csvRows.push(row.join(','));
    });

    // Add metadata
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-ES');
    const timeStr = now.toLocaleTimeString('es-ES');
    
    csvRows.unshift(`# DETALLE COMPLETO DE RECOMENDACIONES`);
    csvRows.unshift(`# Generado el ${dateStr} a las ${timeStr}`);
    csvRows.unshift(`# Total de sugerencias: ${suggestions.length}`);
    csvRows.unshift('');

    // SECTION 2: Matrix format
    const matrixSection = generateMatrixSection(suggestions);
    
    return [...csvRows, ...matrixSection].join('\n');
  };

  // CSV download function
  const handleDownloadCSV = () => {
    const selectedData = getSelectedSuggestions();
    if (selectedData.length === 0) return;

    const csvContent = generateCSVContent(selectedData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const now = new Date();
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
                <SelectItem value="critical">Crítica</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Baja</SelectItem>
              </SelectContent>
            </Select>
            
          </div>

          {filteredAndSortedSuggestions.length === 0 ? (
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
                        disabled={filteredAndSortedSuggestions.length === 0}
                      />
                    </TableHead>
                    <TableHead>Producto / Variante / SKU</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('current_stock')}
                    >
                      <div className="flex items-center">
                        Stock Actual
                        {getSortIcon('current_stock')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="bg-green-50 cursor-pointer hover:bg-green-100 select-none"
                      onClick={() => handleSort('sales_last_30_days')}
                    >
                      <div className="flex items-center">
                        Ventas 30d
                        {getSortIcon('sales_last_30_days')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('sales_velocity')}
                    >
                      <div className="flex items-center">
                        Velocidad (diario)
                        {getSortIcon('sales_velocity')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('stock_days_remaining')}
                    >
                      <div className="flex items-center">
                        Días de Stock
                        {getSortIcon('stock_days_remaining')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('open_orders_quantity')}
                    >
                      <div className="flex items-center">
                        Pendiente Producción
                        {getSortIcon('open_orders_quantity')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('suggested_quantity')}
                    >
                      <div className="flex items-center">
                        Cantidad Sugerida
                        {getSortIcon('suggested_quantity')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('urgency_level')}
                    >
                      <div className="flex items-center">
                        Urgencia
                        {getSortIcon('urgency_level')}
                      </div>
                    </TableHead>
                    <TableHead>Calidad de Datos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedSuggestions.map((suggestion) => (
                    <TableRow key={getKey(suggestion)}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSuggestions.includes(getKey(suggestion))}
                          onCheckedChange={(checked) => handleSuggestionSelect(suggestion, checked as boolean)}
                        />
                      </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{suggestion.product_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {(suggestion.variant_name && suggestion.variant_name.trim()) ||
                                ([suggestion.variant_size, suggestion.variant_color].filter(Boolean).join(' / ') || 'Sin variante')}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono mt-1">
                              SKU: {suggestion.sku_variant || suggestion.sku || '-'}
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
                      <TableCell>
                        <DataQualityBadge quality={suggestion.data_quality} />
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
        selectedSuggestions={getSelectedSuggestions()}
        onSuccess={handleProductionOrderSuccess}
      />
    </div>
  );
};
