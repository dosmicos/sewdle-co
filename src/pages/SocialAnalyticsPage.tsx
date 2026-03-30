import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TikTokDashboard from '@/components/social-analytics/TikTokDashboard';
import FinanceSidebar from '@/components/finance-dashboard/FinanceSidebar';
import FinanceDatePicker from '@/components/finance-dashboard/FinanceDatePicker';
import { useFinanceDateRange } from '@/hooks/useFinanceDateRange';

const SocialAnalyticsPage: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { dateRange, setDateRange, preset, setPreset, comparisonRange } =
    useFinanceDateRange();

  return (
    <div className="flex h-dvh bg-gray-50">
      <FinanceSidebar
        activeSection="social-analytics"
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Social Analytics</h1>
              <p className="text-sm text-gray-500">
                Analiza el rendimiento de tu contenido en redes sociales
              </p>
            </div>
            <FinanceDatePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              preset={preset}
              onPresetChange={setPreset}
            />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="tiktok" className="space-y-6">
            <TabsList className="bg-white border">
              <TabsTrigger value="tiktok" className="data-[state=active]:bg-black data-[state=active]:text-white">
                TikTok
              </TabsTrigger>
              <TabsTrigger value="instagram" disabled className="opacity-50">
                Instagram (Próximamente)
              </TabsTrigger>
              <TabsTrigger value="facebook" disabled className="opacity-50">
                Facebook (Próximamente)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tiktok">
              <TikTokDashboard dateRange={dateRange} />
            </TabsContent>

            <TabsContent value="instagram">
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <p className="text-lg font-medium">Instagram Analytics</p>
                <p className="text-sm">Próximamente disponible</p>
              </div>
            </TabsContent>

            <TabsContent value="facebook">
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <p className="text-lg font-medium">Facebook Analytics</p>
                <p className="text-sm">Próximamente disponible</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default SocialAnalyticsPage;
