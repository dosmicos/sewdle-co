import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useSalesVelocityRanking, SalesVelocityItem } from '@/hooks/useSalesVelocityRanking';
import { 
  TrendingDown, 
  TrendingUp, 
  RefreshCw, 
  Search, 
  Download, 
  AlertTriangle,
  BarChart3,
  DollarSign,
  Package,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown
} from 'lucide-react';

export const SalesVelocityRanking: React.FC = () => {
  const {
    ranking,
    summary,
    loading,
    calculating,
    fetchRanking,
    refreshRanking,
    markForDiscontinuation,
    exportRankingCSV
  } = useSalesVelocityRanking();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<string>('sales_60_days');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  // Sorting configuration
  const sortableColumns = [
    { key: 'sales_60_days', label: 'Ventas 60d' },
    { key: 'sales_velocity', label: 'Velocidad Diaria' },
    { key: 'current_stock', label: 'Stock Actual' },
    { key: 'stock_days_remaining', label: 'Días de Stock' },
    { key: 'velocity_stock_ratio', label: 'Ratio V/S' },
    { key: 'revenue_60_days', label: 'Ingresos 60d' },
    { key: 'orders_count', label: 'Órdenes' }
  ];

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ChevronsUpDown className="h-4 w-4 text-muted-foreground ml-1" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-4 w-4 text-primary ml-1" />
      : <ChevronDown className="h-4 w-4 text-primary ml-1" />;
  };

  // Filter and sort data
  const filteredAndSortedRanking = React.useMemo(() => {
    let filtered = ranking.filter(item => {
      const searchText = searchTerm.toLowerCase();
      const matchesSearch = 
        item.product_name.toLowerCase().includes(searchText) ||
        item.main_sku.toLowerCase().includes(searchText);
      
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    // Sort data
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortColumn === 'status') {
        const statusOrder = { critical: 4, low: 3, warning: 2, good: 1 };
        aValue = statusOrder[a.status as keyof typeof statusOrder] || 0;
        bValue = statusOrder[b.status as keyof typeof statusOrder] || 0;
      } else {
        aValue = Number(a[sortColumn as keyof SalesVelocityItem]) || 0;
        bValue = Number(b[sortColumn as keyof SalesVelocityItem]) || 0;
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return filtered;
  }, [ranking, searchTerm, statusFilter, sortColumn, sortDirection]);

  const getStatusBadge = (status: string) => {
    const config = {
      critical: { variant: 'destructive' as const, label: 'CRÍTICO', icon: '🔴' },
      low: { variant: 'secondary' as const, label: 'BAJO', icon: '🟠' },
      warning: { variant: 'outline' as const, label: 'ADVERTENCIA', icon: '🟡' },
      good: { variant: 'default' as const, label: 'BUENO', icon: '🟢' }
    };

    const { variant, label, icon } = config[status as keyof typeof config] || config.good;

    return (
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <Badge variant={variant} className="font-medium">
          {label}
        </Badge>
      </div>
    );
  };

  const handleItemSelect = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, itemId]);
    } else {
      setSelectedItems(prev => prev.filter(id => id !== itemId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(filteredAndSortedRanking.map(item => item.product_id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleMarkForDiscontinuation = async () => {
    if (selectedItems.length === 0) return;
    await markForDiscontinuation(selectedItems);
    setSelectedItems([]);
  };

  const allSelected = filteredAndSortedRanking.length > 0 && 
    filteredAndSortedRanking.every(item => selectedItems.includes(item.product_id));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Cargando ranking...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Sin Ventas</p>
                  <p className="text-2xl font-bold">{summary.zero_sales}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingDown className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Bajas Ventas</p>
                  <p className="text-2xl font-bold">{summary.low_sales}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Package className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Productos</p>
                  <p className="text-2xl font-bold">{summary.total_products}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Ingresos 60d</p>
                  <p className="text-2xl font-bold">${summary.total_revenue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Ranking de Velocidad de Ventas
              </CardTitle>
              <CardDescription>
                Análisis de rendimiento de productos en los últimos 60 días
              </CardDescription>
            </div>
            <Button 
              onClick={refreshRanking}
              disabled={calculating}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${calculating ? 'animate-spin' : ''}`} />
              {calculating ? 'Calculando...' : 'Actualizar Ranking'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Action buttons for selected items */}
          {selectedItems.length > 0 && (
            <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium text-orange-900">
                      {selectedItems.length} productos seleccionados
                    </p>
                    <p className="text-sm text-orange-700">
                      Candidatos para revisión de descontinuación
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => exportRankingCSV(ranking.filter(item => selectedItems.includes(item.product_id)))}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Selección
                  </Button>
                  <Button
                    onClick={handleMarkForDiscontinuation}
                    variant="destructive"
                    size="sm"
                  >
                    Marcar para Descontinuar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar por producto o SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="critical">Sin ventas</SelectItem>
                  <SelectItem value="low">Ventas bajas</SelectItem>
                  <SelectItem value="warning">Ventas moderadas</SelectItem>
                  <SelectItem value="good">Buenas ventas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => exportRankingCSV()}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>

          {/* Rankings Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU Principal</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('sales_60_days')}
                  >
                    <div className="flex items-center">
                      Ventas 60d
                      {getSortIcon('sales_60_days')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('sales_velocity')}
                  >
                    <div className="flex items-center">
                      Velocidad/día
                      {getSortIcon('sales_velocity')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('stock_days_remaining')}
                  >
                    <div className="flex items-center">
                      Días Stock
                      {getSortIcon('stock_days_remaining')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('velocity_stock_ratio')}
                  >
                    <div className="flex items-center">
                      Ratio V/S
                      {getSortIcon('velocity_stock_ratio')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('revenue_60_days')}
                  >
                    <div className="flex items-center">
                      Ingresos 60d
                      {getSortIcon('revenue_60_days')}
                    </div>
                  </TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedRanking.map((item, index) => {
                  const isSelected = selectedItems.includes(item.product_id);
                  
                  return (
                    <TableRow 
                      key={item.product_id}
                      className={`${isSelected ? 'bg-muted/50' : ''} ${item.status === 'critical' ? 'border-l-4 border-l-red-500' : ''}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleItemSelect(item.product_id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.variant_count} {item.variant_count === 1 ? 'variante' : 'variantes'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.main_sku}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.current_stock}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {item.sales_60_days === 0 ? (
                            <span className="text-red-600 font-bold">0</span>
                          ) : (
                            <span className={`font-medium ${
                              item.sales_60_days <= 5 ? 'text-orange-600' : 
                              item.sales_60_days <= 20 ? 'text-yellow-600' : 
                              'text-green-600'
                            }`}>
                              {item.sales_60_days}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {item.sales_velocity.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${
                          item.stock_days_remaining < 30 ? 'text-red-600' :
                          item.stock_days_remaining < 60 ? 'text-orange-600' :
                          'text-green-600'
                        }`}>
                          {item.stock_days_remaining === 9999 ? '∞' : item.stock_days_remaining}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-mono text-sm font-medium ${
                          (item.velocity_stock_ratio || 0) > 0.1 ? 'text-red-600' :
                          (item.velocity_stock_ratio || 0) > 0.05 ? 'text-orange-600' :
                          'text-green-600'
                        }`}>
                          {(item.velocity_stock_ratio || 0).toFixed(3)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          ${item.revenue_60_days.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(item.status)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {filteredAndSortedRanking.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {ranking.length === 0 ? 'No hay datos de ranking disponibles' : 'No se encontraron productos con los filtros aplicados'}
              </div>
            )}
          </div>

          {/* Summary information */}
          <div className="mt-4 text-sm text-muted-foreground">
            Mostrando {filteredAndSortedRanking.length} de {ranking.length} productos
            {summary && (
              <span className="ml-4">
                • Período: {summary.period_days} días • Actualizado: {summary.calculation_date}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};