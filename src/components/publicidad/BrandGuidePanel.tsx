import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles, Wand2, Loader2, Palette, Type, Eye,
  RefreshCw, Save, Check, X, MessageSquare, Shield,
} from 'lucide-react';
import { useBrandGuide } from '@/hooks/useBrandGuide';

const BrandGuidePanel = () => {
  const { brandGuide, loading, extracting, extractBrand, updateBrandGuide } = useBrandGuide();

  const [siteUrl, setSiteUrl] = useState('https://dosmicos.com');
  const [brandName, setBrandName] = useState('');
  const [tagline, setTagline] = useState('');
  const [brandVoice, setBrandVoice] = useState('');
  const [tone, setTone] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [headingFont, setHeadingFont] = useState('');
  const [bodyFont, setBodyFont] = useState('');
  const [visualStyle, setVisualStyle] = useState('');
  const [promptPrefix, setPromptPrefix] = useState('');

  useEffect(() => {
    if (brandGuide) {
      setBrandName(brandGuide.brand_name || '');
      setTagline(brandGuide.tagline || '');
      setBrandVoice(brandGuide.brand_voice || '');
      setTone(brandGuide.tone || '');
      setTargetAudience(brandGuide.target_audience || '');
      setHeadingFont(brandGuide.typography?.heading_font || '');
      setBodyFont(brandGuide.typography?.body_font || '');
      setVisualStyle(brandGuide.visual_style || '');
      setPromptPrefix(brandGuide.prompt_prefix || '');
      if (brandGuide.source_url) setSiteUrl(brandGuide.source_url);
    }
  }, [brandGuide]);

  const handleSave = () => {
    updateBrandGuide({
      brand_name: brandName || null,
      tagline: tagline || null,
      brand_voice: brandVoice || null,
      tone: tone || null,
      target_audience: targetAudience || null,
      typography: { heading_font: headingFont || undefined, body_font: bodyFont || undefined },
      visual_style: visualStyle || null,
      prompt_prefix: promptPrefix || null,
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!brandGuide) {
    return (
      <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
            <Sparkles className="w-10 h-10 text-orange-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold text-gray-900">Extrae tu Identidad de Marca</h3>
            <p className="text-gray-600 max-w-lg mx-auto">
              Ingresa la URL de tu tienda y analizaremos automáticamente tus productos, colores,
              estilo visual, voz de marca y más.
            </p>
          </div>
          <div className="max-w-md mx-auto w-full space-y-3">
            <Input
              placeholder="https://tutienda.com"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className="text-center"
            />
            <Button
              size="lg"
              className="bg-[#ff5c02] hover:bg-[#e55502] text-white w-full"
              onClick={() => extractBrand(siteUrl)}
              disabled={!siteUrl || extracting}
            >
              <Wand2 className="w-5 h-5 mr-2" />
              Extraer Identidad de Marca
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const colors = brandGuide.colors;
  const guidelines = brandGuide.guidelines;
  const doList = guidelines?.do || [];
  const dontList = guidelines?.dont || [];

  return (
    <div className="space-y-4">
      {/* Brand Identity */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Identidad de Marca</CardTitle>
          <Badge variant="secondary">
            {brandGuide.source_url ? 'Extraído de ' + brandGuide.source_url : 'Manual'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Input value={brandName} onChange={(e) => setBrandName(e.target.value)}
              placeholder="Nombre de marca" className="text-2xl font-bold border-none px-0 focus-visible:ring-0 shadow-none" />
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)}
              placeholder="Tagline" className="text-gray-500 border-none px-0 focus-visible:ring-0 shadow-none" />
          </div>
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Voz de Marca</Label>
              <Input value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} placeholder="Ej: Profesional, cercana" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Tono</Label>
              <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Ej: Amigable, confiable" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Audiencia Objetivo</Label>
              <Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="Ej: Mujeres 25-45" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Color Palette */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="w-5 h-5 text-orange-500" /> Paleta de Colores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 flex-wrap">
              {colors?.primary && (
                <div className="flex flex-col items-center gap-1">
                  <div className="rounded-full w-10 h-10 border border-gray-200" style={{ backgroundColor: colors.primary }} />
                  <span className="text-xs text-gray-500">Primario</span>
                  <span className="text-xs font-mono">{colors.primary}</span>
                </div>
              )}
              {colors?.secondary && (
                <div className="flex flex-col items-center gap-1">
                  <div className="rounded-full w-10 h-10 border border-gray-200" style={{ backgroundColor: colors.secondary }} />
                  <span className="text-xs text-gray-500">Secundario</span>
                  <span className="text-xs font-mono">{colors.secondary}</span>
                </div>
              )}
              {colors?.accent && (
                <div className="flex flex-col items-center gap-1">
                  <div className="rounded-full w-10 h-10 border border-gray-200" style={{ backgroundColor: colors.accent }} />
                  <span className="text-xs text-gray-500">Acento</span>
                  <span className="text-xs font-mono">{colors.accent}</span>
                </div>
              )}
              {colors?.additional && colors.additional.map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="rounded-full w-8 h-8 border border-gray-200" style={{ backgroundColor: c }} />
                  <span className="text-xs font-mono">{c}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Typography */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Type className="w-5 h-5 text-orange-500" /> Tipografía
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Títulos</Label>
              <Input value={headingFont} onChange={(e) => setHeadingFont(e.target.value)} placeholder="Ej: Montserrat" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Cuerpo</Label>
              <Input value={bodyFont} onChange={(e) => setBodyFont(e.target.value)} placeholder="Ej: Open Sans" />
            </div>
          </CardContent>
        </Card>

        {/* Visual Style */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="w-5 h-5 text-orange-500" /> Estilo Visual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)}
              placeholder="Describe el estilo visual de tu marca..." rows={3} />
            {brandGuide.mood_keywords && brandGuide.mood_keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {brandGuide.mood_keywords.map((kw, i) => <Badge key={i} variant="secondary">{kw}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Guidelines */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-500" /> Lineamientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-green-700">Hacer</p>
                {doList.length > 0 ? (
                  <ul className="space-y-1">
                    {doList.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-gray-400">Sin lineamientos</p>}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-700">Evitar</p>
                {dontList.length > 0 ? (
                  <ul className="space-y-1">
                    {dontList.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                        <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" /> <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-gray-400">Sin lineamientos</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Prompt Prefix */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-500" /> Contexto de Marca para Generación
            </CardTitle>
            <Badge variant={brandGuide.extraction_status === 'complete' ? 'default' : 'secondary'}
              className={brandGuide.extraction_status === 'complete' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
              {brandGuide.extraction_status === 'complete' ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            Este texto se agrega automáticamente a todos tus prompts de generación de imágenes.
          </p>
        </CardHeader>
        <CardContent>
          <Textarea value={promptPrefix} onChange={(e) => setPromptPrefix(e.target.value)}
            placeholder="Contexto de marca para generación..." rows={4} />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between py-4">
        <p className="text-sm text-gray-500">
          Última extracción: {formatDate(brandGuide.extracted_at)}
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => extractBrand(siteUrl)} disabled={extracting}>
            <RefreshCw className="w-4 h-4 mr-2" /> Re-extraer Marca
          </Button>
          <Button className="bg-[#ff5c02] hover:bg-[#e55502] text-white" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" /> Guardar Cambios
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BrandGuidePanel;
