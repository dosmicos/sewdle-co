
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  TruckIcon, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  BarChart3,
  Loader2
} from 'lucide-react';
import { useMaterials } from '@/hooks/useMaterials';
import { useMaterialDeliveries } from '@/hooks/useMaterialDeliveries';
import { useUserContext } from '@/hooks/useUserContext';
import WorkshopInventoryTable from './WorkshopInventoryTable';

const SuppliesDashboard = () => {
  const { isAdmin, isDesigner, currentUser } = useUserContext();
  const isMountedRef = useRef(true);
  
  const [deliveryStats, setDeliveryStats] = useState({
    totalDeliveries: 0,
    recentDeliveries: 0,
    totalMaterialsDelivered: 0
  });
  const [consumptionStats, setConsumptionStats] = useState({
    totalConsumed: 0,
    remainingStock: 0,
    utilizationRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deliveriesData, setDeliveriesData] = useState<any[]>([]);

  const { materials, loading: materialsLoading } = useMaterials();
  const { fetchMaterialDeliveries, loading: deliveriesLoading } = useMaterialDeliveries();

  // Determinar si es usuario de taller
  const isWorkshopUser = !isAdmin && !isDesigner;

  useEffect(() => {
    // Cleanup function para marcar el componente como desmontado
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    
    const loadDashboardData = async () => {
      try {
        if (!isMountedRef.current) return;
        
        console.log('=== DASHBOARD DATA LOADING START ===');
        console.log('Loading dashboard data for user role:', { isAdmin, isDesigner, isWorkshopUser });
        setLoading(true);
        setError(null);

        // Cargar entregas de materiales con timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout loading deliveries')), 30000);
        });

        const deliveriesPromise = fetchMaterialDeliveries();
        
        console.log('Fetching deliveries with timeout protection...');
        const deliveries = await Promise.race([deliveriesPromise, timeoutPromise]) as any[];
        
        if (!isMountedRef.current || controller.signal.aborted) return;

        console.log('=== DELIVERIES FETCH RESULT ===');
        console.log('Loaded deliveries count:', deliveries?.length || 0);
        console.log('Deliveries data structure check:', {
          isArray: Array.isArray(deliveries),
          firstItem: deliveries?.[0],
          hasRealBalance: deliveries?.[0]?.real_balance !== undefined
        });
        
        // Actualizar estado de deliveries para WorkshopInventoryTable
        setDeliveriesData(deliveries || []);
        
        if (deliveries && Array.isArray(deliveries) && deliveries.length > 0) {
          console.log('=== CALCULATING STATISTICS ===');
          
          // Calcular estadísticas de entregas
          const totalDeliveries = deliveries.length;
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const recentDeliveries = deliveries.filter(delivery => {
            try {
              return new Date(delivery.created_at) >= thirtyDaysAgo;
            } catch (e) {
              console.warn('Invalid date in delivery:', delivery.created_at);
              return false;
            }
          }).length;

          const totalMaterialsDelivered = deliveries.reduce((sum, delivery) => {
            const delivered = Number(delivery.total_delivered) || 0;
            return sum + delivered;
          }, 0);

          console.log('Delivery stats calculated:', {
            totalDeliveries,
            recentDeliveries,
            totalMaterialsDelivered
          });

          if (isMountedRef.current) {
            setDeliveryStats({
              totalDeliveries,
              recentDeliveries,
              totalMaterialsDelivered
            });
          }

          // Calcular estadísticas de consumo
          const totalConsumed = deliveries.reduce((sum, delivery) => {
            const consumed = Number(delivery.total_consumed) || 0;
            return sum + consumed;
          }, 0);

          const remainingStock = deliveries.reduce((sum, delivery) => {
            const balance = Number(delivery.real_balance) || 0;
            return sum + balance;
          }, 0);

          const utilizationRate = totalMaterialsDelivered > 0 
            ? Math.round((totalConsumed / totalMaterialsDelivered) * 100)
            : 0;

          console.log('Consumption stats calculated:', {
            totalConsumed,
            remainingStock,
            utilizationRate
          });

          if (isMountedRef.current) {
            setConsumptionStats({
              totalConsumed,
              remainingStock,
              utilizationRate
            });
          }
        } else {
          console.log('=== NO DELIVERIES DATA ===');
          console.log('No deliveries data found or empty array. Setting default values.');
          // Establecer valores por defecto
          if (isMountedRef.current) {
            setDeliveryStats({ totalDeliveries: 0, recentDeliveries: 0, totalMaterialsDelivered: 0 });
            setConsumptionStats({ totalConsumed: 0, remainingStock: 0, utilizationRate: 0 });
          }
        }
        
        console.log('=== DASHBOARD DATA LOADING SUCCESS ===');
      } catch (err: any) {
        console.error('=== DASHBOARD DATA LOADING ERROR ===');
        console.error('Error loading dashboard data:', err);
        if (isMountedRef.current && !controller.signal.aborted) {
          setError(`Error al cargar los datos del dashboard: ${err.message || 'Error desconocido'}`);
          // Establecer valores por defecto en caso de error
          setDeliveryStats({ totalDeliveries: 0, recentDeliveries: 0, totalMaterialsDelivered: 0 });
          setConsumptionStats({ totalConsumed: 0, remainingStock: 0, utilizationRate: 0 });
        }
      } finally {
        if (isMountedRef.current && !controller.signal.aborted) {
          setLoading(false);
          console.log('=== DASHBOARD DATA LOADING COMPLETE ===');
        }
      }
    };

    loadDashboardData();

    return () => {
      controller.abort();
    };
  }, [fetchMaterialDeliveries, isAdmin, isDesigner, isWorkshopUser]);

  // Calcular estadísticas de materiales de forma segura
  const materialStats = React.useMemo(() => {
    try {
      if (!materials || !Array.isArray(materials) || materials.length === 0) {
        return {
          totalMaterials: 0,
          lowStockMaterials: 0,
          outOfStockMaterials: 0,
          totalStockValue: 0
        };
      }

      const totalMaterials = materials.length;
      const lowStockMaterials = materials.filter(m => {
        const currentStock = Number(m.current_stock) || 0;
        const minStock = Number(m.min_stock_alert) || 0;
        return currentStock <= minStock && currentStock > 0;
      }).length;
      
      const outOfStockMaterials = materials.filter(m => {
        const currentStock = Number(m.current_stock) || 0;
        return currentStock === 0;
      }).length;
      
      const totalStockValue = materials.reduce((sum, m) => {
        const stock = Number(m.current_stock) || 0;
        const cost = Number(m.unit_cost) || 0;
        return sum + (stock * cost);
      }, 0);

      return {
        totalMaterials,
        lowStockMaterials,
        outOfStockMaterials,
        totalStockValue
      };
    } catch (error) {
      console.error('Error calculating material stats:', error);
      return {
        totalMaterials: 0,
        lowStockMaterials: 0,
        outOfStockMaterials: 0,
        totalStockValue: 0
      };
    }
  }, [materials]);

  // Mostrar loading state
  if (loading || materialsLoading || deliveriesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-black">Cargando dashboard...</h3>
            <p className="text-gray-600">
              {isWorkshopUser ? 'Obteniendo estadísticas de tu taller' : 'Obteniendo estadísticas generales de insumos'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar error state
  if (error) {
    return (
      <div className="space-y-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
            <button 
              onClick={() => window.location.reload()} 
              className="ml-2 underline font-medium hover:no-underline"
            >
              Recargar página
            </button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header contextual */}
      {isWorkshopUser && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-blue-900 mb-1">
            Dashboard de Insumos - Tu Taller
          </h2>
          <p className="text-sm text-blue-700">
            Vista de los materiales y entregas específicos de tu taller
          </p>
        </div>
      )}

      {/* Estadísticas Generales */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isWorkshopUser ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-6`}>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">
              {isWorkshopUser ? 'Materiales en Catálogo' : 'Total Materiales'}
            </CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{materialStats.totalMaterials}</div>
            <p className="text-xs text-blue-700">Materiales disponibles</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">
              {isWorkshopUser ? 'Mis Entregas' : 'Total Entregas'}
            </CardTitle>
            <TruckIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">{deliveryStats.totalDeliveries}</div>
            <p className="text-xs text-green-700">
              <Badge variant="outline" className="text-green-700 border-green-300">
                {deliveryStats.recentDeliveries} últimos 30 días
              </Badge>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Stock Bajo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">{materialStats.lowStockMaterials}</div>
            <p className="text-xs text-orange-700">Materiales con stock crítico</p>
          </CardContent>
        </Card>

        {/* Mostrar valor del stock para admins y diseñadores */}
        {!isWorkshopUser && (
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-800">Valor del Stock</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">
                ${materialStats.totalStockValue.toLocaleString()}
              </div>
              <p className="text-xs text-purple-700">Valor total del inventario</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Estadísticas de Consumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-black">
              {isWorkshopUser ? 'Mi Consumo' : 'Total Consumido'}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-black">{consumptionStats.totalConsumed}</div>
            <p className="text-xs text-gray-600">Unidades consumidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-black">
              {isWorkshopUser ? 'Mi Stock Disponible' : 'Stock Restante'}
            </CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-black">{consumptionStats.remainingStock}</div>
            <p className="text-xs text-gray-600">Unidades disponibles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-black">Tasa de Utilización</CardTitle>
            <BarChart3 className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-black">{consumptionStats.utilizationRate}%</div>
            <p className="text-xs text-gray-600">Eficiencia de consumo</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventario por Taller (con datos filtrados) */}
      <WorkshopInventoryTable deliveries={deliveriesData} />

      {/* Alertas de Stock (solo para admin y diseñadores) */}
      {!isWorkshopUser && materialStats.outOfStockMaterials > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>¡Atención!</strong> Tienes {materialStats.outOfStockMaterials} materiales sin stock. 
            Es necesario realizar entregas para mantener la producción.
          </AlertDescription>
        </Alert>
      )}

      {!isWorkshopUser && materialStats.lowStockMaterials > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Stock bajo:</strong> {materialStats.lowStockMaterials} materiales tienen stock crítico.
            Considera realizar pedidos pronto.
          </AlertDescription>
        </Alert>
      )}

      {/* Mensaje informativo si no hay datos */}
      {deliveryStats.totalDeliveries === 0 && (
        <Card className="p-8">
          <div className="text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-black">
              {isWorkshopUser ? '¡Bienvenido a tus insumos!' : '¡Bienvenido al módulo de Insumos!'}
            </h3>
            <p className="text-gray-600 mb-4">
              {isWorkshopUser 
                ? 'Aún no tienes entregas de materiales registradas para tu taller.'
                : 'Aún no tienes materiales o entregas registradas. Comienza agregando materiales al catálogo.'
              }
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default SuppliesDashboard;
