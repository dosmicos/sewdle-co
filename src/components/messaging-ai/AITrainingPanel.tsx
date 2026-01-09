import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  RefreshCw, 
  Sparkles,
  MessageSquare,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface TestMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const AITrainingPanel = () => {
  const { currentOrganization } = useOrganization();
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load AI config
  useEffect(() => {
    const loadConfig = async () => {
      if (!currentOrganization?.id) return;
      
      setIsLoadingConfig(true);
      try {
        const { data: channel } = await supabase
          .from('messaging_channels')
          .select('ai_config, ai_enabled')
          .eq('organization_id', currentOrganization.id)
          .eq('channel_type', 'whatsapp')
          .eq('is_active', true)
          .limit(1)
          .single();

        if (channel) {
          setAiConfig(channel.ai_config);
        }
      } catch (err) {
        console.error('Error loading config:', err);
      } finally {
        setIsLoadingConfig(false);
      }
    };

    loadConfig();
  }, [currentOrganization?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const generateTestResponse = async (userMessage: string) => {
    setIsGenerating(true);
    
    try {
      // Build system prompt from config
      let systemPrompt = aiConfig?.systemPrompt || 'Eres un asistente virtual amigable.';
      
      const toneMap: Record<string, string> = {
        'friendly': 'Usa un tono amigable y cercano. Puedes usar emojis ocasionalmente.',
        'formal': 'Usa un tono formal y respetuoso.',
        'casual': 'Usa un tono casual y relajado. Usa emojis libremente.',
        'professional': 'Usa un tono profesional y directo.'
      };
      
      if (aiConfig?.tone && toneMap[aiConfig.tone]) {
        systemPrompt += `\n\nTono: ${toneMap[aiConfig.tone]}`;
      }

      if (aiConfig?.rules?.length > 0) {
        systemPrompt += '\n\nReglas especiales:';
        aiConfig.rules.forEach((rule: any) => {
          if (rule.condition && rule.response) {
            systemPrompt += `\n- Cuando el usuario mencione "${rule.condition}": ${rule.response}`;
          }
        });
      }

      if (aiConfig?.knowledgeBase?.length > 0) {
        systemPrompt += '\n\nConocimiento de la empresa:';
        aiConfig.knowledgeBase.forEach((item: any) => {
          if (item.question && item.answer) {
            systemPrompt += `\n- P: ${item.question}\n  R: ${item.answer}`;
          }
        });
      }

      // Call OpenAI GPT-4o-mini via edge function
      const { data, error } = await supabase.functions.invoke('messaging-ai-openai', {
        body: {
          messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: userMessage }],
          systemPrompt: systemPrompt,
          organizationId: currentOrganization?.id,
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Error en la función');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const aiResponse = data?.response || 'Lo siento, no pude generar una respuesta.';
      
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString() + '-ai',
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date(),
        }
      ]);
    } catch (err: any) {
      console.error('Error generating response:', err);
      
      let errorMessage = 'Error: No se pudo conectar con la IA.';
      if (err.message?.includes('429') || err.message?.includes('Límite')) {
        errorMessage = 'Demasiadas solicitudes. Espera unos segundos e intenta de nuevo.';
      } else if (err.message?.includes('402') || err.message?.includes('créditos')) {
        errorMessage = 'Se requieren créditos adicionales para usar la IA.';
      }
      
      toast.error(errorMessage);
      
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString() + '-error',
          role: 'assistant',
          content: errorMessage,
          timestamp: new Date(),
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isGenerating) return;

    const userMessage: TestMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    await generateTestResponse(userMessage.content);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast.success('Chat limpiado');
  };

  const suggestedMessages = [
    '¿Qué productos tienen disponibles?',
    '¿Cuánto cuesta el envío?',
    '¿Tienen descuentos?',
    '¿Cuál es el horario de atención?',
    '¿Aceptan pagos con tarjeta?',
  ];

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Chat Test Area */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <CardTitle>Probar IA</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={clearChat}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          </div>
          <CardDescription>
            Prueba cómo responderá la IA a los mensajes de tus clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Messages */}
          <ScrollArea className="h-[400px] p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                <p>Envía un mensaje para probar la IA</p>
                <div className="flex flex-wrap gap-2 mt-4 max-w-md justify-center">
                  {suggestedMessages.slice(0, 3).map((msg, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setInputMessage(msg);
                      }}
                    >
                      {msg}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString('es-CO', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                    {message.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                
                {isGenerating && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Escribiendo...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Escribe un mensaje de prueba..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isGenerating}
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!inputMessage.trim() || isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Config Summary & Tips */}
      <div className="space-y-4">
        {/* Current Config Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estado de configuración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Prompt del sistema</span>
              {aiConfig?.systemPrompt ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Configurado
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Pendiente
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tono</span>
              <Badge variant="outline">{aiConfig?.tone || 'friendly'}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Reglas</span>
              <Badge variant="secondary">{aiConfig?.rules?.length || 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Conocimiento</span>
              <Badge variant="secondary">{aiConfig?.knowledgeBase?.length || 0}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Suggested Test Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mensajes sugeridos</CardTitle>
            <CardDescription>Prueba estos escenarios comunes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {suggestedMessages.map((msg, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  className="w-full justify-start text-left h-auto py-2 text-sm"
                  onClick={() => setInputMessage(msg)}
                >
                  <MessageSquare className="h-4 w-4 mr-2 shrink-0" />
                  <span className="truncate">{msg}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">Tip de entrenamiento</p>
                <p>
                  Prueba diferentes escenarios: preguntas sobre precios, disponibilidad, 
                  quejas y saludos. Ajusta el prompt según las respuestas que observes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
