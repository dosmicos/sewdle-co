import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAiTemplates } from '@/hooks/useAiTemplates';

interface TemplateSelectorProps {
  onSelect: (template: any) => void;
  selectedTemplateId: string | null;
}

const TemplateSelector = ({ onSelect, selectedTemplateId }: TemplateSelectorProps) => {
  const { templates, loading } = useAiTemplates();

  const productTemplates = templates.filter((t) => t.category === 'producto');
  const adTemplates = templates.filter((t) => t.category === 'publicidad');

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-3 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const renderTemplateGrid = (templateList: any[]) => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {templateList.map((template) => {
        const isSelected = selectedTemplateId === template.id;
        return (
          <Card
            key={template.id}
            className={`p-3 cursor-pointer transition-all hover:shadow-md ${
              isSelected
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => onSelect(template)}
          >
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900">{template.name}</h4>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {template.resolution || '1K'}
                </Badge>
                {template.width && template.height && (
                  <Badge variant="secondary" className="text-xs">
                    {template.width}x{template.height}
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      {productTemplates.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-gray-700">Producto</Label>
          {renderTemplateGrid(productTemplates)}
        </div>
      )}

      {adTemplates.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-gray-700">Publicidad</Label>
          {renderTemplateGrid(adTemplates)}
        </div>
      )}

      {productTemplates.length === 0 && adTemplates.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">No hay templates disponibles.</p>
      )}
    </div>
  );
};

export default TemplateSelector;
