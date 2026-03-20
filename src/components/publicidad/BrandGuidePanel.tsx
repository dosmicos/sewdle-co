import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles,
  Wand2,
  Loader2,
  Palette,
  Type,
  Eye,
  RefreshCw,
  Save,
  Check,
  X,
  MessageSquare,
  Copy,
  Shield,
} from 'lucide-react';
import { useBrandGuide } from '@/hooks/useBrandGuide';

const BrandGuidePanel = () => {
  const { brandGuide, loading, extracting, extractBrand, updateBrandGuide } = useBrandGuide();

  // Local editable state
  const [brandName, setBrandName] = useState('');
  const [tagline, setTagline] = useState('');
  const [brandVoice, setBrandVoice] = useState('');
  const [brandTone, setBrandTone] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [headingFont, setHeadingFont] = useState('');
  const [bodyFont, setBodyFont] = useState('');
  const [visualStyle, setVisualStyle] = useState('');
  const [promptPrefix, setPromptPrefix] = useState('');

  // Sync local state when brandGuide loads or changes
  useEffect(() => {
    if (brandGuide) {
      setBrandName(brandGuide.brand_name || '');
      setTagline(brandGuide.tagline || '');
      setBrandVoice(brandGuide.brand_voice || '');
      setBrandTone(brandGuide.brand_tone || '');
      setTargetAudience(brandGuide.target_audience || '');
      setHeadingFont(brandGuide.fonts?.heading || '');
      setBodyFont(brandGuide.fonts?.body || '');
      setVisualStyle(brandGuide.visual_style || '');
      setPromptPrefix(brandGuide.prompt_prefix || '');
    }
  }, [brandGuide]);

  const handleSave = () => {
    updateBrandGuide({
      brand_name: brandName || null,
      tagline: tagline || null,
      brand_voice: brandVoice || null,
      brand_tone: brandTone || null,
      target_audience: targetAudience || null,
      fonts: { heading: headingFont || undefined, body: bodyFont || undefined },
      visual_style: visualStyle || null,
      prompt_prefix: promptPrefix || null,
      source: 'manual' as const,
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // State 1: Loading
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // State 2: Extracting
  if (extracting) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Analizando tu marca...</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Estamos revisando tus productos, colores y estilo. Esto puede tomar hasta 30 segundos.
            </p>
          </CardContent>
        </Card>

        {/* Skeleton placeholders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // State 1: No brand guide
  if (!brandGuide) {
    return (
      <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
            <Sparkles className="w-10 h-10 text-orange-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold text-gray-900">
              Extrae tu Identidad de Marca
            </h3>
            <p className="text-gray-600 max-w-lg mx-auto">
              Analiza automáticamente tus productos y tienda para generar una guía de marca completa
              con colores, estilo visual, voz de marca y más.
            </p>
          </div>
          <Button
            size="lg"
            className="bg-[#ff5c02] hover:bg-[#e55502] text-white"
            onClick={extractBrand}
          >
            <Wand2 className="w-5 h-5 mr-2" />
            Extraer Identidad de Marca
          </Button>
        </CardContent>
      </Card>
    );
  }

  // State 3: Brand guide loaded
  return (
    <div className="space-y-4">
      {/* Card 1: Brand Identity (full width) */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Identidad de Marca</CardTitle>
          <Badge variant={brandGuide.source === 'auto' ? 'secondary' : 'outline'}>
            {brandGuide.source === 'auto' ? 'Generado por IA' : 'Manual'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Nombre de marca"
              className="text-2xl font-bold border-none px-0 focus-visible:ring-0 shadow-none"
            />
            <Input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Tagline"
              className="text-gray-500 border-none px-0 focus-visible:ring-0 shadow-none"
            />
          </div>
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Voz de Marca</Label>
              <Input
                value={brandVoice}
                onChange={(e) => setBrandVoice(e.target.value)}
                placeholder="Ej: Profesional, cercana"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Tono</Label>
              <Input
                value={brandTone}
                onChange={(e) => setBrandTone(e.target.value)}
                placeholder="Ej: Amigable, confiable"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Audiencia Objetivo</Label>
              <Input
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Ej: Mujeres 25-45"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 2: Color Palette */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="w-5 h-5 text-orange-500" />
              Paleta de Colores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {brandGuide.primary_color && (
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="rounded-full w-10 h-10 border border-gray-200"
                    style={{ backgroundColor: brandGuide.primary_color }}
                  />
                  <span className="text-xs text-gray-500">Primario</span>
                  <span className="text-xs font-mono">{brandGuide.primary_color}</span>
                </div>
              )}
              {brandGuide.secondary_color && (
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="rounded-full w-10 h-10 border border-gray-200"
                    style={{ backgroundColor: brandGuide.secondary_color }}
                  />
                  <span className="text-xs text-gray-500">Secundario</span>
                  <span className="text-xs font-mono">{brandGuide.secondary_color}</span>
                </div>
              )}
              {brandGuide.accent_color && (
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="rounded-full w-10 h-10 border border-gray-200"
                    style={{ backgroundColor: brandGuide.accent_color }}
                  />
                  <span className="text-xs text-gray-500">Acento</span>
                  <span className="text-xs font-mono">{brandGuide.accent_color}</span>
                </div>
              )}
            </div>
            {brandGuide.colors && brandGuide.colors.length > 0 && (
              <>
                <Separator />
                <div className="flex flex-wrap gap-3">
                  {brandGuide.colors.map((color, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <div
                        className="rounded-full w-8 h-8 border border-gray-200"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="text-xs text-gray-500">{color.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Typography */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Type className="w-5 h-5 text-orange-500" />
              Tipografía
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Títulos</Label>
              <Input
                value={headingFont}
                onChange={(e) => setHeadingFont(e.target.value)}
                placeholder="Ej: Montserrat"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Cuerpo</Label>
              <Input
                value={bodyFont}
                onChange={(e) => setBodyFont(e.target.value)}
                placeholder="Ej: Open Sans"
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Visual Style */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="w-5 h-5 text-orange-500" />
              Estilo Visual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={visualStyle}
              onChange={(e) => setVisualStyle(e.target.value)}
              placeholder="Describe el estilo visual de tu marca..."
              rows={3}
            />
            {brandGuide.mood_keywords && brandGuide.mood_keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {brandGuide.mood_keywords.map((keyword, idx) => (
                  <Badge key={idx} variant="secondary">
                    {keyword}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 5: Brand Guidelines */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-500" />
              Lineamientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-green-700">Hacer</p>
                {brandGuide.do_list && brandGuide.do_list.length > 0 ? (
                  <ul className="space-y-1">
                    {brandGuide.do_list.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400">Sin lineamientos</p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-700">Evitar</p>
                {brandGuide.dont_list && brandGuide.dont_list.length > 0 ? (
                  <ul className="space-y-1">
                    {brandGuide.dont_list.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-sm text-gray-700">
                        <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400">Sin lineamientos</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card 6: Prompt Prefix (full width) */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-500" />
              Contexto de Marca para Generación
            </CardTitle>
            <Badge
              variant={brandGuide.extraction_status === 'complete' ? 'default' : 'secondary'}
              className={
                brandGuide.extraction_status === 'complete'
                  ? 'bg-green-100 text-green-700 hover:bg-green-100'
                  : ''
              }
            >
              {brandGuide.extraction_status === 'complete' ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            Este texto se agrega automáticamente a todos tus prompts de generación de imágenes.
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            value={promptPrefix}
            onChange={(e) => setPromptPrefix(e.target.value)}
            placeholder="Contexto de marca para generación..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Actions bar */}
      <div className="flex items-center justify-between py-4">
        <p className="text-sm text-gray-500">
          Última extracción: {formatDate(brandGuide.last_extracted_at)}
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={extractBrand} disabled={extracting}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Re-extraer Marca
          </Button>
          <Button className="bg-[#ff5c02] hover:bg-[#e55502] text-white" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BrandGuidePanel;
