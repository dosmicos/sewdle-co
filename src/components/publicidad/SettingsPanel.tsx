import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Image as ImageIcon, FileText, Zap } from 'lucide-react';
import SeedImageManager from './SeedImageManager';
import SavedPromptsManager from './SavedPromptsManager';
import SkillsManager from './SkillsManager';

const SettingsPanel = () => {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="product-seeds" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="product-seeds" className="flex items-center space-x-2">
            <ImageIcon className="w-4 h-4" />
            <span>Semillas de Producto</span>
          </TabsTrigger>
          <TabsTrigger value="ad-seeds" className="flex items-center space-x-2">
            <ImageIcon className="w-4 h-4" />
            <span>Semillas de Publicidad</span>
          </TabsTrigger>
          <TabsTrigger value="prompts" className="flex items-center space-x-2">
            <FileText className="w-4 h-4" />
            <span>Prompts Guardados</span>
          </TabsTrigger>
          <TabsTrigger value="skills" className="flex items-center space-x-2">
            <Zap className="w-4 h-4" />
            <span>Skills</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="product-seeds" className="mt-6">
          <SeedImageManager type="product" />
        </TabsContent>

        <TabsContent value="ad-seeds" className="mt-6">
          <SeedImageManager type="advertising" />
        </TabsContent>

        <TabsContent value="prompts" className="mt-6">
          <SavedPromptsManager />
        </TabsContent>

        <TabsContent value="skills" className="mt-6">
          <SkillsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPanel;
