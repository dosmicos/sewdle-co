import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, Plus, X, Sparkles, AlertCircle, Loader2, MessageSquareText, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useQueryClient } from '@tanstack/react-query';

interface AIRule {
  id: string;
  condition: string;
  response: string;
}

interface QuickReply {
  id: string;
  title: string;
  content: string;
}

interface AIConfig {
  systemPrompt: string;
  tone: string;
  includeCatalog: boolean;
  autoReply: boolean;
  responseDelay: number;
  businessHours: boolean;
  greetingMessage: string;
  rules: AIRule[];
  quickReplies: QuickReply[];
}

export const AIConfigPanel = () => {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);
  
  const [config, setConfig] = useState<AIConfig>({
    systemPrompt: `Eres un asistente de ventas amigable para una tienda de artesanías colombianas. 

Tu rol es:
- Responder preguntas sobre productos disponibles
- Proporcionar información de precios y disponibilidad
- Ayudar a los clientes con sus pedidos
- Ser amable y usar emojis ocasionalmente

Reglas importantes:
- Siempre saluda al cliente
- Si no sabes algo, ofrece conectar con un humano
- Mantén respuestas concisas pero informativas`,
    tone: 'friendly',
    includeCatalog: true,
    autoReply: true,
    responseDelay: 3,
    businessHours: true,
    greetingMessage: '¡Hola! 👋 Soy el asistente virtual de la tienda. ¿En qué puedo ayudarte?',
    rules: [
      { id: '1', condition: 'precio', response: 'Consultar catálogo de productos' },
      { id: '2', condition: 'envío', response: 'Informar sobre políticas de envío' },
      { id: '3', condition: 'disponible', response: 'Verificar inventario en tiempo real' },
    ],
    quickReplies: [
      { id: '1', title: '👋 Saludo', content: '¡Hola! Gracias por comunicarte con nosotros. ¿En qué puedo ayudarte?' },
      { id: '2', title: '📦 Envíos', content: 'Hacemos envíos a todo el país. El tiempo de entrega es de 3-5 días hábiles.' },
      { id: '3', title: '💳 Pagos', content: 'Aceptamos transferencia, Nequi, Daviplata y pago contra entrega en algunas ciudades.' },
    ],
  });

  const [newRule, setNewRule] = useState({ condition: '', response: '' });
  const [newQuickReply, setNewQuickReply] = useState({ title: '', content: '' });
  const [editingQuickReply, setEditingQuickReply] = useState<QuickReply | null>(null);

  // Load config from database
  useEffect(() => {
    const loadConfig = async () => {
      if (!currentOrganization?.id) return;
      
      setIsLoading(true);
      try {
        const { data: channel, error } = await supabase
          .from('messaging_channels')
          .select('id, ai_config, ai_enabled, is_active, created_at')
          .eq('organization_id', currentOrganization.id)
          .eq('channel_type', 'whatsapp')
          .order('is_active', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error loading AI config:', error);
          return;
        }

        if (channel) {
          setChannelId(channel.id);
          const savedConfig = channel.ai_config as any;
          
          if (savedConfig) {
            setConfig(prev => ({
              systemPrompt: savedConfig.systemPrompt || prev.systemPrompt,
              tone: savedConfig.tone || prev.tone,
              includeCatalog: savedConfig.includeCatalog ?? prev.includeCatalog,
              autoReply: savedConfig.autoReply ?? channel.ai_enabled ?? prev.autoReply,
              responseDelay: savedConfig.responseDelay ?? prev.responseDelay,
              businessHours: savedConfig.businessHours ?? prev.businessHours,
              greetingMessage: savedConfig.greetingMessage || prev.greetingMessage,
              rules: savedConfig.rules || prev.rules,
              quickReplies: savedConfig.quickReplies || prev.quickReplies,
            }));
          }
        }
      } catch (err) {
        console.error('Error loading config:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [currentOrganization?.id]);

  const handleSave = async () => {
    if (!currentOrganization?.id) {
      toast.error('No hay una organización activa');
      return;
    }

    setIsSaving(true);
    try {
      let effectiveChannelId = channelId;

      // If there is no WhatsApp channel yet, create a placeholder so we can persist config.
      if (!effectiveChannelId) {
        const { data: created, error: createError } = await supabase
          .from('messaging_channels')
          .insert({
            organization_id: currentOrganization.id,
            channel_type: 'whatsapp',
            is_active: false,
            ai_enabled: config.autoReply,
          } as any)
          .select('id')
          .single();

        if (createError) throw createError;
        effectiveChannelId = created.id;
        setChannelId(created.id);
      }

      // Build the config object as a plain object for JSON compatibility
      const configToSave = {
        systemPrompt: config.systemPrompt,
        tone: config.tone,
        includeCatalog: config.includeCatalog,
        autoReply: config.autoReply,
        responseDelay: config.responseDelay,
        businessHours: config.businessHours,
        greetingMessage: config.greetingMessage,
        rules: config.rules.map(r => ({ id: r.id, condition: r.condition, response: r.response })),
        quickReplies: config.quickReplies.map(q => ({ id: q.id, title: q.title, content: q.content })),
      };

      // Merge with existing ai_config to avoid overwriting knowledgeBase or other keys.
      const { data: current, error: currentError } = await supabase
        .from('messaging_channels')
        .select('ai_config')
        .eq('id', effectiveChannelId)
        .maybeSingle();

      if (currentError) throw currentError;

      const currentConfig = (current?.ai_config as any) || {};

      const { error } = await supabase
        .from('messaging_channels')
        .update({
          ai_config: {
            ...currentConfig,
            ...configToSave,
          },
          ai_enabled: config.autoReply,
        } as any)
        .eq('id', effectiveChannelId);

      if (error) throw error;

      toast.success('Configuración guardada correctamente');
    } catch (err) {
      console.error('Error saving config:', err);
      toast.error('Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const addRule = () => {
    if (newRule.condition && newRule.response) {
      setConfig(prev => ({
        ...prev,
        rules: [...prev.rules, { id: Date.now().toString(), ...newRule }]
      }));
      setNewRule({ condition: '', response: '' });
      toast.success('Regla agregada');
    }
  };

  const removeRule = (id: string) => {
    setConfig(prev => ({
      ...prev,
      rules: prev.rules.filter(r => r.id !== id)
    }));
    toast.success('Regla eliminada');
  };

  // Auto-save quick replies to database
  const saveQuickRepliesToDB = async (quickReplies: QuickReply[]) => {
    if (!currentOrganization?.id) return;
    
    try {
      let effectiveChannelId = channelId;

      // Create channel if it doesn't exist
      if (!effectiveChannelId) {
        const { data: created, error: createError } = await supabase
          .from('messaging_channels')
          .insert({
            organization_id: currentOrganization.id,
            channel_type: 'whatsapp',
            is_active: false,
            ai_enabled: false,
          } as any)
          .select('id')
          .single();

        if (createError) throw createError;
        effectiveChannelId = created.id;
        setChannelId(created.id);
      }

      // Get current config to merge
      const { data: current } = await supabase
        .from('messaging_channels')
        .select('ai_config')
        .eq('id', effectiveChannelId)
        .maybeSingle();

      const currentConfig = (current?.ai_config as any) || {};

      // Update with new quick replies
      await supabase
        .from('messaging_channels')
        .update({
          ai_config: {
            ...currentConfig,
            quickReplies: quickReplies.map(q => ({
              id: q.id,
              title: q.title,
              content: q.content
            })),
          },
        } as any)
        .eq('id', effectiveChannelId);

      // Invalidate cache so ConversationThread gets updated data
      queryClient.invalidateQueries({ queryKey: ['quick-replies', currentOrganization.id] });
    } catch (err) {
      console.error('Error saving quick replies:', err);
    }
  };

  const addQuickReply = async () => {
    if (newQuickReply.title && newQuickReply.content) {
      const newReplies = [...config.quickReplies, { id: Date.now().toString(), ...newQuickReply }];
      setConfig(prev => ({
        ...prev,
        quickReplies: newReplies
      }));
      setNewQuickReply({ title: '', content: '' });
      await saveQuickRepliesToDB(newReplies);
      toast.success('Respuesta rápida agregada');
    }
  };

  const updateQuickReply = async () => {
    if (editingQuickReply) {
      const newReplies = config.quickReplies.map(q => 
        q.id === editingQuickReply.id ? editingQuickReply : q
      );
      setConfig(prev => ({
        ...prev,
        quickReplies: newReplies
      }));
      setEditingQuickReply(null);
      await saveQuickRepliesToDB(newReplies);
      toast.success('Respuesta rápida actualizada');
    }
  };

  const removeQuickReply = async (id: string) => {
    const newReplies = config.quickReplies.filter(q => q.id !== id);
    setConfig(prev => ({
      ...prev,
      quickReplies: newReplies
    }));
    await saveQuickRepliesToDB(newReplies);
    toast.success('Respuesta rápida eliminada');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* System Prompt */}
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <CardTitle>Prompt del Sistema</CardTitle>
          </div>
          <CardDescription>
            Instrucciones que la IA seguirá para generar respuestas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={config.systemPrompt}
            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
            className="min-h-[200px] font-mono text-sm"
            placeholder="Escribe las instrucciones para la IA..."
          />
          <p className="text-xs mt-2 text-muted-foreground">
            Tip: Sé específico sobre el tono, las reglas y la información que la IA debe proporcionar
          </p>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración General</CardTitle>
          <CardDescription>Ajustes básicos del asistente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Tono de respuesta</Label>
            <Select 
              value={config.tone} 
              onValueChange={(value) => setConfig({ ...config, tone: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">😊 Amigable</SelectItem>
                <SelectItem value="formal">👔 Formal</SelectItem>
                <SelectItem value="casual">🎉 Casual</SelectItem>
                <SelectItem value="professional">💼 Profesional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Incluir catálogo</Label>
              <p className="text-xs text-muted-foreground">
                Permitir consultas sobre productos
              </p>
            </div>
            <Switch 
              checked={config.includeCatalog}
              onCheckedChange={(checked) => setConfig({ ...config, includeCatalog: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                Respuestas automáticas
                <Badge variant={config.autoReply ? "default" : "secondary"} className="text-xs">
                  {config.autoReply ? 'Activo' : 'Inactivo'}
                </Badge>
              </Label>
              <p className="text-xs text-muted-foreground">
                La IA responde automáticamente a los mensajes
              </p>
            </div>
            <Switch 
              checked={config.autoReply}
              onCheckedChange={(checked) => setConfig({ ...config, autoReply: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Horario comercial</Label>
              <p className="text-xs text-muted-foreground">
                Solo responder en horario laboral
              </p>
            </div>
            <Switch 
              checked={config.businessHours}
              onCheckedChange={(checked) => setConfig({ ...config, businessHours: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label>Delay de respuesta (segundos)</Label>
            <Input
              type="number"
              min={0}
              max={30}
              value={config.responseDelay}
              onChange={(e) => setConfig({ ...config, responseDelay: parseInt(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground">
              Tiempo de espera antes de enviar respuesta automática
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Greeting Message */}
      <Card>
        <CardHeader>
          <CardTitle>Mensaje de Bienvenida</CardTitle>
          <CardDescription>Primer mensaje al iniciar conversación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={config.greetingMessage}
            onChange={(e) => setConfig({ ...config, greetingMessage: e.target.value })}
            className="min-h-[100px]"
            placeholder="Escribe el mensaje de bienvenida..."
          />
          
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">Vista previa</p>
                <p className="mt-1">{config.greetingMessage}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Response Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Reglas de Respuesta</CardTitle>
          <CardDescription>
            Define comportamientos específicos según palabras clave
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {config.rules.map((rule) => (
              <Badge 
                key={rule.id} 
                variant="secondary" 
                className="px-3 py-2 flex items-center gap-2"
              >
                <span className="font-medium">"{rule.condition}"</span>
                <span className="text-muted-foreground">→</span>
                <span>{rule.response}</span>
                <button 
                  onClick={() => removeRule(rule.id)}
                  className="ml-1 hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Palabra clave..."
              value={newRule.condition}
              onChange={(e) => setNewRule({ ...newRule, condition: e.target.value })}
              className="flex-1"
            />
            <Input
              placeholder="Acción a tomar..."
              value={newRule.response}
              onChange={(e) => setNewRule({ ...newRule, response: e.target.value })}
              className="flex-1"
            />
            <Button onClick={addRule} variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Replies */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-emerald-500" />
            <CardTitle>Respuestas Rápidas</CardTitle>
          </div>
          <CardDescription>
            Mensajes predefinidos para intervención humana
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* List of quick replies */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {config.quickReplies.map((reply) => (
              <div 
                key={reply.id} 
                className="p-3 border rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                {editingQuickReply?.id === reply.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editingQuickReply.title}
                      onChange={(e) => setEditingQuickReply({ ...editingQuickReply, title: e.target.value })}
                      placeholder="Título..."
                      className="text-sm"
                    />
                    <Textarea
                      value={editingQuickReply.content}
                      onChange={(e) => setEditingQuickReply({ ...editingQuickReply, content: e.target.value })}
                      placeholder="Contenido..."
                      className="text-sm min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={updateQuickReply}>
                        Guardar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingQuickReply(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{reply.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{reply.content}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7"
                        onClick={() => setEditingQuickReply(reply)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 hover:text-destructive"
                        onClick={() => removeQuickReply(reply.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add new quick reply */}
          <div className="pt-3 border-t space-y-2">
            <Input
              placeholder="Título (ej: 👋 Saludo)"
              value={newQuickReply.title}
              onChange={(e) => setNewQuickReply({ ...newQuickReply, title: e.target.value })}
            />
            <Textarea
              placeholder="Contenido del mensaje..."
              value={newQuickReply.content}
              onChange={(e) => setNewQuickReply({ ...newQuickReply, content: e.target.value })}
              className="min-h-[80px]"
            />
            <Button 
              onClick={addQuickReply} 
              variant="outline" 
              className="w-full"
              disabled={!newQuickReply.title || !newQuickReply.content}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar respuesta rápida
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="md:col-span-2 flex justify-end">
        <Button 
          onClick={handleSave} 
          className="flex items-center gap-2"
          disabled={isSaving || !currentOrganization?.id}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSaving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>
    </div>
  );
};
