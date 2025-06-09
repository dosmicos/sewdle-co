
import React from 'react';
import { Card } from '@/components/ui/card';
import { 
  FileText, 
  Building2, 
  Package, 
  Truck, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Dashboard = () => {
  // Mock data for charts
  const ordersData = [
    { name: 'Ene', orders: 12 },
    { name: 'Feb', orders: 19 },
    { name: 'Mar', orders: 15 },
    { name: 'Abr', orders: 22 },
    { name: 'May', orders: 18 },
    { name: 'Jun', orders: 25 },
  ];

  const statusData = [
    { name: 'Pendientes', value: 35, color: '#FF9500' },
    { name: 'En Producción', value: 45, color: '#007AFF' },
    { name: 'Completadas', value: 20, color: '#34C759' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumen general de tu operación textil
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="apple-card p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Órdenes Activas</p>
              <p className="text-2xl font-bold">24</p>
            </div>
          </div>
        </Card>

        <Card className="apple-card p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Building2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Talleres</p>
              <p className="text-2xl font-bold">8</p>
            </div>
          </div>
        </Card>

        <Card className="apple-card p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Productos</p>
              <p className="text-2xl font-bold">156</p>
            </div>
          </div>
        </Card>

        <Card className="apple-card p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-orange-100 rounded-xl">
              <Truck className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Entregas Pendientes</p>
              <p className="text-2xl font-bold">12</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="apple-card p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Órdenes por Mes</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ordersData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Bar dataKey="orders" fill="#007AFF" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card className="apple-card p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Estado de Órdenes</h3>
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
                  <span className="text-sm">{item.name}: {item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="apple-card p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Actividad Reciente</h3>
          <div className="space-y-4">
            {[
              {
                icon: CheckCircle,
                color: 'text-green-600',
                title: 'Orden #ORD-001 completada',
                description: 'Taller Principal - 50 camisetas',
                time: 'Hace 2 horas'
              },
              {
                icon: Clock,
                color: 'text-orange-600',
                title: 'Nueva orden asignada',
                description: 'Orden #ORD-025 asignada a Taller Norte',
                time: 'Hace 4 horas'
              },
              {
                icon: AlertCircle,
                color: 'text-red-600',
                title: 'Retraso en entrega',
                description: 'Orden #ORD-018 - Fecha límite próxima',
                time: 'Hace 6 horas'
              },
              {
                icon: TrendingUp,
                color: 'text-blue-600',
                title: 'Nuevo taller registrado',
                description: 'Taller Sur agregado al sistema',
                time: 'Ayer'
              }
            ].map((activity, index) => (
              <div key={index} className="flex items-start space-x-4 p-4 bg-muted/30 rounded-xl">
                <activity.icon className={`w-5 h-5 mt-0.5 ${activity.color}`} />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{activity.title}</p>
                  <p className="text-xs text-muted-foreground">{activity.description}</p>
                </div>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
