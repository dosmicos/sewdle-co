import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Package, Building, BarChart3 } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useQuery } from '@tanstack/react-query';

export const OrganizationStats: React.FC = () => {
  const { currentOrganization, getUsageStats } = useOrganization();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['organization-stats', currentOrganization?.id],
    queryFn: getUsageStats,
    enabled: !!currentOrganization,
    refetchInterval: 5 * 60 * 1000, // Refrescar cada 5 minutos
  });

  if (!currentOrganization || isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-20 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-3 w-full bg-gray-200 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const getUsagePercentage = (current: number, max: number) => {
    if (max === -1) return 0; // Unlimited
    return Math.min((current / max) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'destructive';
    if (percentage >= 75) return 'warning';
    return 'default';
  };

  return (
    <div className="space-y-4">
      {/* Plan Info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{currentOrganization.name}</CardTitle>
              <CardDescription>
                Plan {currentOrganization.plan}
              </CardDescription>
            </div>
            <Badge 
              variant="secondary" 
              className={
                currentOrganization.plan === 'enterprise' 
                  ? 'bg-purple-100 text-purple-800' 
                  : currentOrganization.plan === 'professional'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }
            >
              {currentOrganization.plan.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Usage Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Orders this month */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes este mes</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.ordersThisMonth || 0}
              {stats?.maxOrdersPerMonth !== -1 && (
                <span className="text-sm text-muted-foreground font-normal">
                  /{stats?.maxOrdersPerMonth}
                </span>
              )}
            </div>
            {stats?.maxOrdersPerMonth !== -1 && (
              <Progress 
                value={getUsagePercentage(stats?.ordersThisMonth || 0, stats?.maxOrdersPerMonth || 0)} 
                className="mt-2"
              />
            )}
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.activeUsers || 0}
              {stats?.maxUsers !== -1 && (
                <span className="text-sm text-muted-foreground font-normal">
                  /{stats?.maxUsers}
                </span>
              )}
            </div>
            {stats?.maxUsers !== -1 && (
              <Progress 
                value={getUsagePercentage(stats?.activeUsers || 0, stats?.maxUsers || 0)} 
                className="mt-2"
              />
            )}
          </CardContent>
        </Card>

        {/* Workshops */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Talleres</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.workshopsCount || 0}
              {stats?.maxWorkshops !== -1 && (
                <span className="text-sm text-muted-foreground font-normal">
                  /{stats?.maxWorkshops}
                </span>
              )}
            </div>
            {stats?.maxWorkshops !== -1 && (
              <Progress 
                value={getUsagePercentage(stats?.workshopsCount || 0, stats?.maxWorkshops || 0)} 
                className="mt-2"
              />
            )}
          </CardContent>
        </Card>

        {/* Storage (placeholder) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Almacenamiento</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((stats?.storageUsed || 0) / 1024).toFixed(1)} GB
              {stats?.maxStorage !== -1 && (
                <span className="text-sm text-muted-foreground font-normal">
                  /{((stats?.maxStorage || 0) / 1024).toFixed(1)} GB
                </span>
              )}
            </div>
            {stats?.maxStorage !== -1 && (
              <Progress 
                value={getUsagePercentage(stats?.storageUsed || 0, stats?.maxStorage || 0)} 
                className="mt-2"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};