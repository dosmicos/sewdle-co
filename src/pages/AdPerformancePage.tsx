import React, { useState, useMemo } from 'react';
import { Target, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import FinanceDashboardLayout from '@/components/finance-dashboard/FinanceDashboardLayout';
import FinanceDatePicker from '@/components/finance-dashboard/FinanceDatePicker';
import AdPerformanceDiagnostics from '@/components/finance-dashboard/AdPerformanceDiagnostics';
import AdPerformanceTable from '@/components/finance-dashboard/AdPerformanceTable';
import MetaAdsConnectionModal from '@/components/finance-dashboard/MetaAdsConnectionModal';
import { useFinanceDateRange } from '@/hooks/useFinanceDateRange';
import { useAdPerformance } from '@/hooks/useAdPerformance';
import { useMetaAdsConnection } from '@/hooks/useMetaAdsConnection';
import { useAdCreativeSync } from '@/hooks/useAdCreativeSync';
import { useAdTags } from '@/hooks/useAdTags';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const formatCOP = (amount: number) => {
  return `COP ${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
};

const formatNumber = (n: number) => new Intl.NumberFormat('es-CO').format(n);
const formatPercent = (n: number) => `${n.toFixed(2)}%`;

const MetaIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" fill="#1877F2"/>
  </svg>
);

const AdPerformancePage: React.FC = () => {
  const dateRange = useFinanceDateRange();
  const adPerformance = useAdPerformance(dateRange.current);
  const metaConnection = useMetaAdsConnection();
  const creativeSync = useAdCreativeSync();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Get ad IDs for fetching tags/creative/lifecycle
  const adIds = useMemo(
    () => adPerformance.ads.map((a) => a.ad_id),
    [adPerformance.ads]
  );

  const { tags: tagsMap, creatives: creativesMap, lifecycle: lifecycleMap } = useAdTags(adIds);

  const handleSync = async () => {
    const startStr = format(dateRange.current.start, 'yyyy-MM-dd');
    const endStr = format(dateRange.current.end, 'yyyy-MM-dd');
    await adPerformance.syncAdPerformance(startStr, endStr);
  };

  return (
    <FinanceDashboardLayout activeSection="ad-performance" onOpenSettings={() => setSettingsOpen(true)}>
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Target className="h-5 w-5 text-indigo-500" />
              Ad Performance
            </h1>
            <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 text-xs">
              {adPerformance.ads.length} ads
            </Badge>
            <FinanceDatePicker dateRange={dateRange} />
          </div>
          <div className="flex items-center gap-2">
            {metaConnection.isConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => creativeSync.syncCreativeAndTags()}
                disabled={creativeSync.syncing}
              >
                {creativeSync.syncing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                )}
                Sync Creative + Tags
              </Button>
            )}
            {metaConnection.isConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={adPerformance.syncing}
              >
                {adPerformance.syncing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Sync Ads
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-[#1877F2] hover:bg-[#166FE5] text-white"
                onClick={() => setSettingsOpen(true)}
              >
                <MetaIcon />
                <span className="ml-1.5">Conectar Meta Ads</span>
              </Button>
            )}
          </div>
        </div>

        {/* Diagnostics */}
        {metaConnection.isConnected && adPerformance.ads.length > 0 && (
          <AdPerformanceDiagnostics
            ads={adPerformance.ads}
            formatCurrency={formatCOP}
          />
        )}

        {/* Table */}
        {metaConnection.isConnected ? (
          <AdPerformanceTable
            ads={adPerformance.ads}
            formatCurrency={formatCOP}
            formatNumber={formatNumber}
            formatPercent={formatPercent}
            tagsMap={tagsMap.size > 0 ? tagsMap : undefined}
            creativesMap={creativesMap.size > 0 ? creativesMap : undefined}
            lifecycleMap={lifecycleMap.size > 0 ? lifecycleMap : undefined}
          />
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <MetaIcon />
            <p className="text-sm font-medium text-blue-900 mt-3">Meta Ads no conectado</p>
            <p className="text-xs text-blue-700 mt-1">Conecta tu cuenta para ver el rendimiento individual de cada ad</p>
            <Button
              size="sm"
              className="bg-[#1877F2] hover:bg-[#166FE5] text-white mt-4"
              onClick={() => setSettingsOpen(true)}
            >
              Conectar Meta Ads
            </Button>
          </div>
        )}
      </div>

      <MetaAdsConnectionModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSuccess={() => setSettingsOpen(false)}
      />
    </FinanceDashboardLayout>
  );
};

export default AdPerformancePage;
