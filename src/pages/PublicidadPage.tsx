import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wand2, History, Settings, Palette } from 'lucide-react';
import GenerateWorkspace from '@/components/publicidad/GenerateWorkspace';
import GenerationHistory from '@/components/publicidad/GenerationHistory';
import SettingsPanel from '@/components/publicidad/SettingsPanel';
import BrandGuidePanel from '@/components/publicidad/BrandGuidePanel';

const PublicidadPage = () => {
  const [activeTab, setActiveTab] = useState('generate');
  const [reuseData, setReuseData] = useState<any>(null);

  const handleReuse = (record: any) => {
    setReuseData(record);
    setActiveTab('generate');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Publicidad</h1>
        <p className="text-muted-foreground">Genera imágenes con IA para productos y publicidad</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Generar
          </TabsTrigger>
          <TabsTrigger value="brand" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Marca
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Ajustes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <GenerateWorkspace reuseData={reuseData} onReuseConsumed={() => setReuseData(null)} />
        </TabsContent>

        <TabsContent value="brand">
          <BrandGuidePanel />
        </TabsContent>

        <TabsContent value="history">
          <GenerationHistory onReuse={handleReuse} />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PublicidadPage;
