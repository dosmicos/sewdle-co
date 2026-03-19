import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAiGeneration } from '@/hooks/useAiGeneration';
import { useAiSkills } from '@/hooks/useAiSkills';
import TemplateSelector from './TemplateSelector';
import PromptEditor from './PromptEditor';
import ImageEditor from './ImageEditor';
import ImagePreview from './ImagePreview';

interface GenerateWorkspaceProps {
  reuseData?: any;
  onReuseConsumed?: () => void;
}

const GenerateWorkspace = ({ reuseData, onReuseConsumed }: GenerateWorkspaceProps) => {
  const { toast } = useToast();
  const { generate, generating, generatedImages, rateLimitUsed, rateLimitMax, clearImage, downloadImage } =
    useAiGeneration();
  const { skills } = useAiSkills();

  const [mode, setMode] = useState<'template' | 'free' | 'edit'>('template');
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState('1K');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedSeedIds, setSelectedSeedIds] = useState<string[]>([]);
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [editInstructions, setEditInstructions] = useState('');
  const [selectedAdSeedIds, setSelectedAdSeedIds] = useState<string[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');

  // Populate state from reuseData
  useEffect(() => {
    if (reuseData) {
      if (reuseData.mode) setMode(reuseData.mode);
      if (reuseData.prompt) setPrompt(reuseData.prompt);
      if (reuseData.resolution) setResolution(reuseData.resolution);
      if (reuseData.template_id) setSelectedTemplateId(reuseData.template_id);
      if (reuseData.seed_image_ids) setSelectedSeedIds(reuseData.seed_image_ids);
      if (reuseData.base_image) setBaseImage(reuseData.base_image);
      if (reuseData.edit_instructions) setEditInstructions(reuseData.edit_instructions);
      if (reuseData.ad_seed_ids) setSelectedAdSeedIds(reuseData.ad_seed_ids);
      onReuseConsumed?.();
    }
  }, [reuseData]);

  const handleSkillSelect = (skillId: string) => {
    setSelectedSkillId(skillId);
    const skill = skills.find((s) => s.id === skillId);
    if (skill) {
      setMode(skill.mode || 'template');
      setPrompt(skill.prompt || '');
      setResolution(skill.resolution || '1K');
      setSelectedTemplateId(skill.template_id || null);
      setSelectedSeedIds(skill.seed_image_ids || []);
    }
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplateId(template.id);
    if (template.resolution) setResolution(template.resolution);
  };

  const handleGenerate = async () => {
    const currentPrompt = mode === 'edit' ? editInstructions : prompt;
    if (!currentPrompt.trim() && mode !== 'template') {
      toast({
        title: 'Prompt requerido',
        description: 'Debes ingresar un prompt o instrucciones para generar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const request = {
        mode,
        prompt: mode === 'edit' ? editInstructions : prompt,
        resolution,
        seed_image_ids: mode === 'edit' ? selectedAdSeedIds : selectedSeedIds,
        base_image: mode === 'edit' ? baseImage || undefined : undefined,
        template_id: mode === 'template' ? selectedTemplateId || undefined : undefined,
      };
      await generate(request);
    } catch (error: any) {
      toast({
        title: 'Error al generar',
        description: error.message || 'Hubo un problema al generar la imagen.',
        variant: 'destructive',
      });
    }
  };

  const canGenerate = () => {
    if (generating) return false;
    if (mode === 'template') return !!selectedTemplateId;
    if (mode === 'free') return !!prompt.trim();
    if (mode === 'edit') return !!editInstructions.trim();
    return false;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column - Controls */}
      <div className="lg:col-span-2 space-y-6">
        {/* Skill selector */}
        {skills.length > 0 && (
          <div className="space-y-2">
            <Label>Skill</Label>
            <Select value={selectedSkillId} onValueChange={handleSkillSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar un skill..." />
              </SelectTrigger>
              <SelectContent>
                {skills.map((skill) => (
                  <SelectItem key={skill.id} value={skill.id}>
                    {skill.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={mode === 'template' ? 'default' : 'outline'}
            onClick={() => setMode('template')}
            size="sm"
          >
            Templates
          </Button>
          <Button
            variant={mode === 'free' ? 'default' : 'outline'}
            onClick={() => setMode('free')}
            size="sm"
          >
            Prompt Libre
          </Button>
          <Button
            variant={mode === 'edit' ? 'default' : 'outline'}
            onClick={() => setMode('edit')}
            size="sm"
          >
            Editar
          </Button>
        </div>

        {/* Mode-specific content */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          {mode === 'template' && (
            <div className="space-y-4">
              <TemplateSelector onSelect={handleTemplateSelect} selectedTemplateId={selectedTemplateId} />
              <div className="space-y-2">
                <Label>Personalizacion (opcional)</Label>
                <Input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ajustes al template seleccionado..."
                />
              </div>
            </div>
          )}

          {mode === 'free' && (
            <PromptEditor
              prompt={prompt}
              onPromptChange={setPrompt}
              resolution={resolution}
              onResolutionChange={setResolution}
              selectedSeedIds={selectedSeedIds}
              onSeedIdsChange={setSelectedSeedIds}
            />
          )}

          {mode === 'edit' && (
            <ImageEditor
              baseImage={baseImage}
              onBaseImageChange={setBaseImage}
              instructions={editInstructions}
              onInstructionsChange={setEditInstructions}
              selectedAdSeedIds={selectedAdSeedIds}
              onAdSeedIdsChange={setSelectedAdSeedIds}
            />
          )}
        </Card>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate()}
          className="w-full bg-[#ff5c02] text-white hover:bg-[#e55200]"
          size="lg"
        >
          <Wand2 className="w-5 h-5 mr-2" />
          {generating ? 'Generando...' : 'Generar Imagen'}
        </Button>
      </div>

      {/* Right column - Preview & Rate limit */}
      <div className="space-y-4">
        <div className="flex justify-end">
          <Badge variant="outline" className="text-xs">
            {rateLimitUsed ?? 0}/{rateLimitMax ?? 50} generaciones hoy
          </Badge>
        </div>

        <ImagePreview
          images={generatedImages}
          generating={generating}
          onDownload={(url) => downloadImage(url)}
          onClear={clearImage}
        />
      </div>
    </div>
  );
};

export default GenerateWorkspace;
