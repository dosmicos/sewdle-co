
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, TrendingDown, TrendingUp, Building2 } from 'lucide-react';
import { useMaterials } from '@/hooks/useMaterials';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useOrders } from '@/hooks/useOrders';
import { useMaterialDeliveries } from '@/hooks/useMaterialDeliveries';

interface WorkshopStockSummary {
  workshopId: string;
  workshopName: string;
  totalDelivered: number;
  totalConsumed: number;
  totalRemaining: number;
  materialsCount: number;
}

interface MaterialStockByWorkshop {
  materialId: string;
  materialName: string;
  materialSku: string;
  materialUnit: string;
  materialColor?: string;
  stocks: {
    workshopId: string;
    workshopName: string;
    delivered: number;
    consumed: number;
    remaining: number;
  }[];
  totalStock: number;
}

const SuppliesDashboard = () => {
  const [filters, setFilters] = useState({
    workshop: 'all',
    material: 'all'
  });
  const [deliveries, setDeliveries] = useState([]);
  const [workshopSummaries, setWorkshopSummaries] = useState<WorkshopStockSummary[]>([]);
  const [materialsByWorkshop, setMaterialsByWorkshop] = useState<MaterialStockByWorkshop[]>([]);
  const [stats, setStats] = useState({
    totalWorkshops: 0,
    totalMaterials: 0,
    totalStockValue: 0,
    lowStockMaterials: 0
  });

  const { materials, loading: materialsLoading } = useMaterials();
  const { workshops, loading: workshopsLoading } = useWorkshops();
  const { fetchMaterialDeliveries, loading: deliveriesLoading } = useMaterialDeliveries();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (deliveries.length > 0 && materials.length > 0 && workshops.length > 0) {
      calculateWorkshopStats();
      calculateMaterialsByWorkshop();
      calculateGeneralStats();
    }
  }, [deliveries, materials, workshops]);

  const loadData = async () => {
    const deliveriesData = await fetchMaterialDeliveries();
    setDeliveries(deliveriesData || []);
  };

  const calculateWorkshopStats = () => {
    const summaries: WorkshopStockSummary[] = workshops.map(workshop => {
      const workshopDeliveries = deliveries.filter(d => d.workshop_id === workshop.id);
      
      const totalDelivered = workshopDeliveries.reduce((sum, d) => sum + (d.quantity_delivered || 0), 0);
      const totalConsumed = workshopDeliveries.reduce((sum, d) => sum + (d.quantity_consumed || 0), 0);
      const totalRemaining = totalDelivered - totalConsumed;
      
      const uniqueMaterials = new Set(workshopDeliveries.map(d => d.material_id));
      
      return {
        workshopId: workshop.id,
        workshopName: workshop.name,
        totalDelivered,
        totalConsumed,
        totalRemaining,
        materialsCount: uniqueMaterials.size
      };
    });

    setWorkshopSummaries(summaries);
  };

  const calculateMaterialsByWorkshop = () => {
    const materialStocks: MaterialStockByWorkshop[] = materials.map(material => {
      const materialDeliveries = deliveries.filter(d => d.material_id === material.id);
      
      const stocks = workshops.map(workshop => {
        const workshopMaterialDeliveries = materialDeliveries.filter(d => d.workshop_id === workshop.id);
        const delivered = workshopMaterialDeliveries.reduce((sum, d) => sum + (d.quantity_delivered || 0), 0);
        const consumed = workshopMaterialDeliveries.reduce((sum, d) => sum + (d.quantity_consumed || 0), 0);
        const remaining = delivered - consumed;

        return {
          workshopId: workshop.id,
          workshopName: workshop.name,
          delivered,
          consumed,
          remaining
        };
      }).filter(stock => stock.delivered > 0 || stock.remaining > 0);

      const totalStock = stocks.reduce((sum, stock) => sum + stock.remaining, 0);

      return {
        materialId: material.id,
        materialName: material.name,
        materialSku: material.sku,
        materialUnit: material.unit,
        materialColor: material.color,
        stocks,
        totalStock
      };
    }).filter(material => material.totalStock > 0 || material.stocks.length > 0);

    setMaterialsByWorkshop(materialStocks);
  };

  const calculateGeneralStats = () => {
    const totalWorkshops = workshops.length;
    const totalMaterials = materials.length;
    const totalStockValue = materialsByWorkshop.reduce((sum, material) => sum + material.totalStock, 0);
    const lowStockMaterials = materials.filter(material => 
      (material.current_stock || 0) <= (material.min_stock_alert || 0)
    ).length;

    setStats({
      totalWorkshops,
      totalMaterials,
      totalStockValue,
      lowStockMaterials
    });
  };

  const filteredWorkshops = filters.workshop === 'all' 
    ? workshopSummaries 
    : workshopSummaries.filter(w => w.workshopId === filters.workshop);

  const filteredMaterials = filters.material === 'all'
    ? materialsByWorkshop
    : materialsByWorkshop.filter(m => m.materialId === filters.material);

  const loading = materialsLoading || workshopsLoading || deliveriesLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4 animate-pulse" />
          <h3 className="text-lg font-semibold mb-2 text-black">Cargando dashboard...</h3>
          <p className="text-gray-600">Obteniendo datos de stock por taller</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="w-5 h-5" />
            <span>Filtros de Stock por Taller</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Taller</label>
              <Select value={filters.workshop} onValueChange={(value) => setFilters(prev => ({ ...prev, workshop: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los talleres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los talleres</SelectItem>
                  {workshops.map((workshop) => (
                    <SelectItem key={workshop.id} value={workshop.id}>
                      {workshop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Material</label>
              <Select value={filters.material} onValueChange={(value) => setFilters(prev => ({ ...prev, material: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los materiales" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los materiales</SelectItem>
                  {materials.map((material) => (
                    <SelectItem key={material.id} value={material.id}>
                      {material.name} ({material.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs Generales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Talleres Activos</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalWorkshops}</div>
            <p className="text-xs text-muted-foreground">con inventario asignado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Materiales en Stock</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMaterials}</div>
            <p className="text-xs text-muted-foreground">tipos diferentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStockValue}</div>
            <p className="text-xs text-muted-foreground">unidades disponibles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.lowStockMaterials}</div>
            <p className="text-xs text-muted-foreground">materiales críticos</p>
          </CardContent>
        </Card>
      </div>

      {/* Resumen por Taller */}
      <Card>
        <CardHeader>
          <CardTitle>Stock por Taller</CardTitle>
          <CardDescription>
            Resumen de inventario disponible en cada taller
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredWorkshops.map((workshop) => (
              <div key={workshop.workshopId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <Building2 className="w-5 h-5 text-blue-500" />
                    <div>
                      <div className="font-semibold">{workshop.workshopName}</div>
                      <div className="text-sm text-gray-600">
                        {workshop.materialsCount} materiales diferentes
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-blue-500 text-blue-700">
                    {workshop.totalRemaining} unidades disponibles
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center p-2 bg-green-50 rounded">
                    <div className="font-semibold text-green-700">{workshop.totalDelivered}</div>
                    <div className="text-green-600">Entregado</div>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded">
                    <div className="font-semibold text-red-700">{workshop.totalConsumed}</div>
                    <div className="text-red-600">Consumido</div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded">
                    <div className="font-semibold text-blue-700">{workshop.totalRemaining}</div>
                    <div className="text-blue-600">Disponible</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detalle de Materiales por Taller */}
      <Card>
        <CardHeader>
          <CardTitle>Distribución de Materiales</CardTitle>
          <CardDescription>
            Stock detallado de cada material por taller
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredMaterials.map((material) => (
              <div key={material.materialId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-semibold">{material.materialName}</div>
                    <div className="text-sm text-gray-600">
                      {material.materialSku}
                      {material.materialColor && ` • ${material.materialColor}`}
                    </div>
                  </div>
                  <Badge variant="outline" className="border-green-500 text-green-700">
                    Total: {material.totalStock} {material.materialUnit}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  {material.stocks.map((stock) => (
                    <div key={stock.workshopId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{stock.workshopName}</span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-green-600">
                          Entregado: {stock.delivered}
                        </span>
                        <span className="text-red-600">
                          Consumido: {stock.consumed}
                        </span>
                        <Badge variant="outline" className={
                          stock.remaining > 0 
                            ? "border-blue-500 text-blue-700" 
                            : "border-gray-400 text-gray-600"
                        }>
                          Disponible: {stock.remaining} {material.materialUnit}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuppliesDashboard;
