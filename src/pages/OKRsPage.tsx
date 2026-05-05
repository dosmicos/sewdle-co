import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { OKRGuard } from '@/components/OKRGuard';
import { OKRNavigation } from '@/components/okr/OKRNavigation';
import { OKRProvider } from '@/contexts/OKRContext';
import { OKROverviewPage } from './okrs/OKROverviewPage';
import { OKRMyQuarterPage } from './okrs/OKRMyQuarterPage';
import { OKRAreaPage } from './okrs/OKRAreaPage';
import { OKRIncentivesPage } from './okrs/OKRIncentivesPage';
import { OKRHistoryPage } from './okrs/OKRHistoryPage';

const OKRsPage = () => {
  return (
    <OKRGuard>
      <OKRProvider>
        <div className="space-y-6">
          <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-6">
              <h1 className="text-lg font-semibold">OKRs - Objetivos y Resultados Clave</h1>
            </div>
            <OKRNavigation />
          </div>
          
          <div className="px-6">
            <Routes>
              <Route path="/" element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<OKROverviewPage />} />
              <Route path="mi-trimestre" element={<OKRMyQuarterPage />} />
              <Route path="area" element={<OKRAreaPage />} />
              <Route path="incentivos" element={<OKRIncentivesPage />} />
              <Route path="historico" element={<OKRHistoryPage />} />
            </Routes>
          </div>
        </div>
      </OKRProvider>
    </OKRGuard>
  );
};

export default OKRsPage;