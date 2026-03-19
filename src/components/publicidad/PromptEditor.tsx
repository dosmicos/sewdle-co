import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSavedPrompts } from '@/hooks/useSavedPrompts';
import { useSeedImages } from '@/hooks/useSeedImages';

interface PromptEditorProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  resolution: string;
  onResolutionChange: (value: string) => void;
  selectedSeedIds: string[];
  onSeedIdsChange: (ids: string[]) => void;
}

const PromptEditor = ({
  prompt,
  onPromptChange,
  resolution,
  onResolutionChange,
  selectedSeedIds,
  onSeedIdsChange,
}: PromptEditorProps) => {
  const { prompts: savedPrompts } = useSavedPrompts();
  const { seedImages } = useSeedImages('product');

  const handleSavedPromptSelect = (promptId: string) => {
    const selected = savedPrompts.find((p) => p.id === promptId);
    if (selected) {
      onPromptChange(selected.prompt);
    }
  };

  const toggleSeedImage = (id: string) => {
    if (selectedSeedIds.includes(id)) {
      onSeedIdsChange(selectedSeedIds.filter((s) => s !== id));
    } else {
      onSeedIdsChange([...selectedSeedIds, id]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Prompt</Label>
        <Textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Describe la imagen que quieres generar..."
          rows={4}
        />
      </div>

      <div className="flex items-end gap-4">
        <div className="flex-1 space-y-2">
          <Label>Prompt guardado</Label>
          <Select onValueChange={handleSavedPromptSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Usar un prompt guardado..." />
            </SelectTrigger>
            <SelectContent>
              {savedPrompts.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-32 space-y-2">
          <Label>Resolucion</Label>
          <Select value={resolution} onValueChange={onResolutionChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1K">1K</SelectItem>
              <SelectItem value="2K">2K</SelectItem>
              <SelectItem value="4K">4K</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-gray-700">Imagenes de referencia (opcional)</Label>
        {seedImages.length === 0 ? (
          <p className="text-sm text-gray-500">No hay imagenes semilla disponibles.</p>
        ) : (
          <div className="grid grid-cols-5 md:grid-cols-8 gap-2">
            {seedImages.map((seed) => {
              const isSelected = selectedSeedIds.includes(seed.id);
              return (
                <div
                  key={seed.id}
                  className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleSeedImage(seed.id)}
                  title={seed.name}
                >
                  <img src={seed.image_url} alt={seed.name} className="w-full aspect-square object-cover" />
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptEditor;
