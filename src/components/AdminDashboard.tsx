
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Building2, 
  Package, 
  Truck, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useDashboardData } from '@/hooks/useDashboardData';

const AdminDashboard = () => {
  const { stats, monthlyData, statusData, recentActivity, loading, refreshData } = useDashboardData();

  const getActivityIcon = (iconName: string) => {
    switch (iconName) {
      case 'CheckCircle':
        return CheckCircle;
      case 'Clock':
        return Clock;
      case 'AlertCircle':
        return AlertCircle;
      case 'TrendingUp':
        return TrendingUp;
      default:
        return CheckCircle;
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'rgb(29 29 31)' }}>
            Dashboard General
          </h1>
          <p style={{ color: 'rgb(99 99 102)' }}>
            Cargando datos del sistema TextilFlow...
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
            Dashboard General
          </h1>
          <p style={{ color: 'rgb(99 99 102)' }}>
            Vista general del sistema TextilFlow
          </p>
        </div>
        <Button
          onClick={refreshData}
          variant="outline"
          size="sm"
          className="flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Actualizar</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgb(99 99 102)' }}>
                Órdenes Activas
              </p>
              <p className="text-2xl font-bold" style={{ color: 'rgb(29 29 31)' }}>
                {stats.activeOrders}
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
                Talleres
              </p>
              <p className="text-2xl font-bold" style={{ color: 'rgb(29 29 31)' }}>
                {stats.workshops}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-50 rounded-xl">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgb(99 99 102)' }}>
                Productos
              </p>
              <p className="text-2xl font-bold" style={{ color: 'rgb(29 29 31)' }}>
                {stats.products}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-orange-50 rounded-xl">
              <Truck className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgb(99 99 102)' }}>
                Entregas Pendientes
              </p>
              <p className="text-2xl font-bold" style={{ color: 'rgb(29 29 31)' }}>
                {stats.pendingDeliveries}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: 'rgb(29 29 31)' }}>
              Órdenes por Mes
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
                    fill="#007AFF" 
                    radius={[8, 8, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: 'rgb(29 29 31)' }}>
              Estado de Órdenes
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {statusData.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm" style={{ color: 'rgb(29 29 31)' }}>
                    {item.name}: {item.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold" style={{ color: 'rgb(29 29 31)' }}>
            Actividad Reciente
          </h3>
          <div className="space-y-4">
            {recentActivity.length > 0 ? recentActivity.map((activity) => {
              const IconComponent = getActivityIcon(activity.icon);
              return (
                <div key={activity.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-xl">
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
                <p className="text-gray-500">No hay actividad reciente</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminDashboard;
