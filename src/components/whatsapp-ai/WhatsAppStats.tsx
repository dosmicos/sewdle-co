import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Bot, Clock, TrendingUp, Users, CheckCircle } from 'lucide-react';

export const WhatsAppStats = () => {
  const stats = [
    {
      label: 'Conversaciones hoy',
      value: '24',
      change: '+12%',
      positive: true,
      icon: MessageSquare,
      color: 'bg-blue-100 text-blue-600'
    },
    {
      label: 'Respuestas IA',
      value: '156',
      change: '+28%',
      positive: true,
      icon: Bot,
      color: 'bg-purple-100 text-purple-600'
    },
    {
      label: 'Tiempo promedio',
      value: '< 3s',
      change: '-15%',
      positive: true,
      icon: Clock,
      color: 'bg-green-100 text-green-600'
    },
    {
      label: 'Tasa de resolución',
      value: '89%',
      change: '+5%',
      positive: true,
      icon: CheckCircle,
      color: 'bg-orange-100 text-orange-600'
    },
    {
      label: 'Clientes atendidos',
      value: '18',
      change: '+8%',
      positive: true,
      icon: Users,
      color: 'bg-pink-100 text-pink-600'
    },
    {
      label: 'Satisfacción',
      value: '4.8',
      change: '⭐',
      positive: true,
      icon: TrendingUp,
      color: 'bg-yellow-100 text-yellow-600'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <span 
                className={`text-xs font-medium ${
                  stat.positive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#1f2937' }}>
              {stat.value}
            </p>
            <p className="text-xs" style={{ color: '#6b7280' }}>
              {stat.label}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
