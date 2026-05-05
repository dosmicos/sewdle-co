import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Bot, Clock, TrendingUp, Users, CheckCircle, Instagram, Facebook } from 'lucide-react';
import { cn } from '@/lib/utils';

export const MessagingStats = () => {
  const stats = [
    {
      label: 'Conversaciones hoy',
      value: '47',
      change: '+18%',
      positive: true,
      icon: MessageSquare,
      color: 'bg-indigo-100 text-indigo-600'
    },
    {
      label: 'Respuestas IA',
      value: '234',
      change: '+32%',
      positive: true,
      icon: Bot,
      color: 'bg-purple-100 text-purple-600'
    },
    {
      label: 'Tiempo promedio',
      value: '< 2s',
      change: '-20%',
      positive: true,
      icon: Clock,
      color: 'bg-emerald-100 text-emerald-600'
    },
    {
      label: 'Tasa de resolución',
      value: '92%',
      change: '+7%',
      positive: true,
      icon: CheckCircle,
      color: 'bg-amber-100 text-amber-600'
    },
    {
      label: 'Clientes atendidos',
      value: '38',
      change: '+15%',
      positive: true,
      icon: Users,
      color: 'bg-pink-100 text-pink-600'
    },
    {
      label: 'Satisfacción',
      value: '4.9',
      change: '⭐',
      positive: true,
      icon: TrendingUp,
      color: 'bg-yellow-100 text-yellow-600'
    }
  ];

  const channelStats = [
    {
      channel: 'WhatsApp',
      icon: MessageSquare,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-100',
      conversations: 28,
      resolved: 25,
      pending: 3
    },
    {
      channel: 'Instagram',
      icon: Instagram,
      color: 'text-pink-500',
      bgColor: 'bg-pink-100',
      conversations: 12,
      resolved: 10,
      pending: 2
    },
    {
      channel: 'Messenger',
      icon: Facebook,
      color: 'text-blue-500',
      bgColor: 'bg-blue-100',
      conversations: 7,
      resolved: 6,
      pending: 1
    }
  ];

  return (
    <div className="space-y-6">
      {/* General Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={cn("p-2 rounded-lg", stat.color)}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <span 
                  className={cn(
                    "text-xs font-medium",
                    stat.positive ? 'text-emerald-600' : 'text-red-600'
                  )}
                >
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground">
                {stat.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Channel Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estadísticas por Canal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {channelStats.map((channel, index) => (
              <div key={index} className="p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("p-2 rounded-lg", channel.bgColor)}>
                    <channel.icon className={cn("h-5 w-5", channel.color)} />
                  </div>
                  <span className="font-semibold text-foreground">{channel.channel}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Conversaciones</span>
                    <span className="font-medium text-foreground">{channel.conversations}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Resueltas</span>
                    <span className="font-medium text-emerald-600">{channel.resolved}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pendientes</span>
                    <span className="font-medium text-amber-600">{channel.pending}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
