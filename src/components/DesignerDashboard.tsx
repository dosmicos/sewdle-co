
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Package, 
  Building2, 
  TrendingUp, 
  Clock,
  CheckCircle,
  RefreshCw,
  Plus,
  Eye
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useAuth } from '@/contexts/AuthContext';

const DesignerDashboard = () => {
  const { stats, monthlyData, recentActivity, loading, refreshData } = useDashboardData();
  const { user } = useAuth();

  // Datos específicos para diseñadores
  const designerStats = {
    pendingDesigns: stats.activeOrders || 0,
    productsDesigned: stats.products || 0,
    activeWorkshops: stats.workshops || 0,
    completedThisMonth: 12 // Esto sería calculado desde la base de datos
  };

  const designerRecentActivity = recentActivity.slice(0, 3); // Limitar a 3 elementos

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'rgb(29 29 31)' }}>
            Dashboard de Diseño
          </h1>
          <p style={{ color: 'rgb(99 99 102)' }}>
            Cargando datos de diseño...
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 animate-pulse">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'rgb(29 29 31)' }}>
            Dashboard de Diseño
          </h1>
          <p style={{ color: 'rgb(99 99 102)' }}>
            Bienvenido {user?.name}, gestiona tus proyectos de diseño
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            onClick={refreshData}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Actualizar</span>
          </Button>
          <Button size="sm" className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4" />
            <span>Nueva Orden</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards específicas para diseñador */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-50 rounded-xl">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgb(99 99 102)' }}>
                Diseños Pendientes
              </p>
              <p className="text-2xl font-bold" style={{ color: 'rgb(29 29 31)' }}>
                {designerStats.pendingDesigns}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgb(99 99 102)' }}>
                Productos Diseñados
              </p>
              <p className="text-2xl font-bold" style={{ color: 'rgb(29 29 31)' }}>
                {designerStats.productsDesigned}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-50 rounded-xl">
              <Building2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgb(99 99 102)' }}>
                Talleres Activos
              </p>
              <p className="text-2xl font-bold" style={{ color: 'rgb(29 29 31)' }}>
                {designerStats.activeWorkshops}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-orange-50 rounded-xl">
              <CheckCircle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgb(99 99 102)' }}>
                Completados Este Mes
              </p>
              <p className="text-2xl font-bold" style={{ color: 'rgb(29 29 31)' }}>
                {designerStats.completedThisMonth}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts y contenido específico para diseñador */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: 'rgb(29 29 31)' }}>
              Productividad de Diseño
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#6b7280' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#6b7280' }}
                  />
                  <Bar 
                    dataKey="orders" 
                    fill="#8B5CF6" 
                    radius={[8, 8, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold" style={{ color: 'rgb(29 29 31)' }}>
                Accesos Rápidos
              </h3>
            </div>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start" size="lg">
                <FileText className="w-5 h-5 mr-3" />
                Ver Mis Órdenes
              </Button>
              <Button variant="outline" className="w-full justify-start" size="lg">
                <Package className="w-5 h-5 mr-3" />
                Gestionar Productos
              </Button>
              <Button variant="outline" className="w-full justify-start" size="lg">
                <Building2 className="w-5 h-5 mr-3" />
                Coordinar con Talleres
              </Button>
              <Button variant="outline" className="w-full justify-start" size="lg">
                <Eye className="w-5 h-5 mr-3" />
                Ver Entregas
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Actividad Reciente específica para diseñador */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold" style={{ color: 'rgb(29 29 31)' }}>
            Actividad Reciente de Diseño
          </h3>
          <div className="space-y-4">
            {designerRecentActivity.length > 0 ? designerRecentActivity.map((activity) => {
              const getActivityIcon = (iconName: string) => {
                switch (iconName) {
                  case 'CheckCircle': return CheckCircle;
                  case 'Clock': return Clock;
                  case 'AlertCircle': return FileText;
                  case 'TrendingUp': return TrendingUp;
                  default: return CheckCircle;
                }
              };
              
              const IconComponent = getActivityIcon(activity.icon);
              return (
                <div key={activity.id} className="flex items-start space-x-4 p-4 bg-purple-50 rounded-xl">
                  <IconComponent className={`w-5 h-5 mt-0.5 ${activity.color}`} />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium" style={{ color: 'rgb(29 29 31)' }}>
                      {activity.title}
                    </p>
                    <p className="text-xs" style={{ color: 'rgb(99 99 102)' }}>
                      {activity.description}
                    </p>
                  </div>
                  <p className="text-xs" style={{ color: 'rgb(142 142 147)' }}>
                    {activity.time}
                  </p>
                </div>
              );
            }) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No hay actividad reciente de diseño</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DesignerDashboard;
