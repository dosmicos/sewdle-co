
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Factory, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  RefreshCw,
  Award,
  Target,
  Package
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Cell, Tooltip } from 'recharts';
import { useAdminDashboardData } from '@/hooks/useAdminDashboardData';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { 
    stats, 
    productionData, 
    workshopRanking, 
    recentActivity, 
    viewMode, 
    setViewMode,
    loading, 
    refreshData 
  } = useAdminDashboardData();

  const getActivityIcon = (iconName: string) => {
    switch (iconName) {
      case 'CheckCircle':
        return CheckCircle2;
      case 'Clock':
        return Clock;
      case 'TrendingUp':
        return TrendingUp;
      default:
        return CheckCircle2;
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
        <div className="flex gap-2">
          <Button
            onClick={() => navigate('/picking-packing?tags=confirmado&exclude_tags=empacado&financial_status=paid,pending,partially_paid')}
            variant="default"
            size="sm"
            className="flex items-center gap-2"
          >
            <Package className="w-4 h-4" />
            Para Preparar
          </Button>
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
            <div className="p-3 bg-red-50 rounded-xl">
              <Factory className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgb(99 99 102)' }}>
                Unidades en Producción
              </p>
              <p className="text-2xl font-bold" style={{ color: 'rgb(29 29 31)' }}>
                {stats.unitsInProduction.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-orange-50 rounded-xl">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgb(99 99 102)' }}>
                Entregadas Esta Semana
              </p>
              <p className="text-2xl font-bold" style={{ color: 'rgb(29 29 31)' }}>
                {stats.unitsDeliveredWeek.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-50 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgb(99 99 102)' }}>
                Aprobadas Esta Semana
              </p>
              <p className="text-2xl font-bold" style={{ color: 'rgb(29 29 31)' }}>
                {stats.unitsApprovedWeek.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold" style={{ color: 'rgb(29 29 31)' }}>
                Progreso de la Producción
              </h3>
              <Tabs value={viewMode} onValueChange={(value: 'weekly' | 'monthly') => setViewMode(value)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="weekly">Semanal</TabsTrigger>
                  <TabsTrigger value="monthly">Mensual</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="period" 
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
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      color: 'rgb(29 29 31)'
                    }}
                    formatter={(value, name) => [`${value} unidades`, name]}
                    labelStyle={{ color: 'rgb(99 99 102)' }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="delivered" 
                    name="Entregadas"
                    fill="#FF9500" 
                    radius={[4, 4, 0, 0]} 
                  />
                  <Bar 
                    dataKey="approved" 
                    name="Aprobadas"
                    fill="#34C759" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-gold-600" />
              <h3 className="text-lg font-semibold" style={{ color: 'rgb(29 29 31)' }}>
                Ranking de Talleres
              </h3>
            </div>
            <p className="text-sm text-gray-600">Última semana - Producción y Calidad</p>
            <div className="space-y-3">
              {workshopRanking.length > 0 ? workshopRanking.map((workshop, index) => (
                <div key={workshop.workshopName} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-white rounded-full border-2 border-gray-200">
                      <span className="text-sm font-bold text-gray-600">#{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{workshop.workshopName}</p>
                      <p className="text-xs text-gray-600">
                        {workshop.approvedUnits} aprobadas / {workshop.deliveredUnits} entregadas
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="text-xs">
                      Calidad: {workshop.qualityScore}%
                    </Badge>
                    <div className="flex items-center space-x-1">
                      <Target className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-bold text-blue-600">{workshop.compositeScore}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8">
                  <Award className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No hay datos de talleres esta semana</p>
                </div>
              )}
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
