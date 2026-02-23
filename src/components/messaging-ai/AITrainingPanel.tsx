import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  RefreshCw, 
  Sparkles,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Save,
  ChevronDown,
  ChevronUp,
  FileText,
  Paperclip,
  Image as ImageIcon,
  Mic,
  X,
  FileIcon,
  ExternalLink,
  ImageOff
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface ProductImage {
  product_id: number;
  image_url: string;
  product_name: string;
}

interface TestMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'document';
  productName?: string;
  imageError?: boolean;
}

export const AITrainingPanel = () => {
  const { currentOrganization } = useOrganization();
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Media state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Load AI config
  useEffect(() => {
    const loadConfig = async () => {
      if (!currentOrganization?.id) return;
      
      setIsLoadingConfig(true);
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

        if (error) throw error;

        if (channel) {
          setChannelId(channel.id);
          setAiConfig(channel.ai_config);
          setSystemPrompt((channel.ai_config as any)?.systemPrompt || '');
        }
      } catch (err) {
        console.error('Error loading config:', err);
      } finally {
        setIsLoadingConfig(false);
      }
    };

    loadConfig();
  }, [currentOrganization?.id]);

  // Save system prompt
  const handleSavePrompt = async () => {
    if (!currentOrganization?.id) {
      toast.error('No hay una organización activa');
      return;
    }

    setIsSavingPrompt(true);
    try {
      let effectiveChannelId = channelId;

      // If no channel exists, create one
      if (!effectiveChannelId) {
        const { data: created, error: createError } = await supabase
          .from('messaging_channels')
          .insert({
            organization_id: currentOrganization.id,
            channel_type: 'whatsapp',
            is_active: false,
            ai_enabled: true,
          } as any)
          .select('id')
          .single();

        if (createError) throw createError;
        effectiveChannelId = created.id;
        setChannelId(created.id);
      }

      // Merge with existing config
      const { data: current } = await supabase
        .from('messaging_channels')
        .select('ai_config')
        .eq('id', effectiveChannelId)
        .maybeSingle();

      const currentConfig = (current?.ai_config as any) || {};

      const { error } = await supabase
        .from('messaging_channels')
        .update({
          ai_config: {
            ...currentConfig,
            systemPrompt: systemPrompt,
          },
        })
        .eq('id', effectiveChannelId);

      if (error) throw error;

      // Update local state
      setAiConfig((prev: any) => ({ ...prev, systemPrompt }));
      toast.success('Prompt guardado correctamente');
    } catch (err) {
      console.error('Error saving prompt:', err);
      toast.error('Error al guardar el prompt');
    } finally {
      setIsSavingPrompt(false);
    }
  };

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

      // Get the AI provider from config (default to minimax)
      const aiProvider = aiConfig?.aiProvider || 'minimax';
      const functionName = aiProvider === 'minimax' ? 'messaging-ai-minimax' : 'messaging-ai-openai';
      console.log('Testing AI function:', functionName);

      // Call AI via edge function
      const { data, error } = await supabase.functions.invoke(functionName, {
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
      const productImages: ProductImage[] = data?.product_images || [];
      
      // Add text response
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString() + '-ai',
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date(),
        }
      ]);

      // Add each product image as a separate message
      if (productImages.length > 0) {
        console.log(`Received ${productImages.length} product images`);
        
        productImages.forEach((img, index) => {
          setMessages(prev => [
            ...prev,
            {
              id: Date.now().toString() + `-img-${index}`,
              role: 'assistant',
              content: `📸 ${img.product_name}`,
              timestamp: new Date(),
              mediaUrl: img.image_url,
              mediaType: 'image',
              productName: img.product_name,
            }
          ]);
        });
      }
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
    if ((!inputMessage.trim() && !selectedFile) || isGenerating) return;

    let mediaUrl: string | undefined;
    let mediaType: 'image' | 'audio' | 'document' | undefined;

    // Handle file upload for preview
    if (selectedFile) {
      mediaType = getMediaType(selectedFile);
      if (filePreview) {
        mediaUrl = filePreview;
      } else {
        // Create object URL for document
        mediaUrl = URL.createObjectURL(selectedFile);
      }
    }

    const messageContent = inputMessage.trim() || (mediaType === 'image' ? '📷 Imagen enviada' : mediaType === 'audio' ? '🎵 Audio enviado' : '📎 Archivo enviado');

    const userMessage: TestMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      mediaUrl,
      mediaType,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    clearSelectedFile();

    // Generate AI response for all messages (text and media)
    // For media-only, provide context about what was sent
    let aiPrompt = inputMessage.trim();
    if (!aiPrompt && selectedFile) {
      // Build context for media-only messages
      if (mediaType === 'image') {
        aiPrompt = 'El cliente envió una imagen. Responde de manera amigable, agradece y pregunta cómo puedes ayudarle.';
      } else if (mediaType === 'audio') {
        aiPrompt = 'El cliente envió un audio. Responde de manera amigable indicando que recibiste el audio y pregunta cómo puedes ayudarle.';
      } else {
        aiPrompt = 'El cliente envió un archivo. Responde de manera amigable indicando que recibiste el archivo y pregunta cómo puedes ayudarle.';
      }
    }
    
    await generateTestResponse(aiPrompt);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSelectedFile(null);
    setFilePreview(null);
    toast.success('Chat limpiado');
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 16MB)
    if (file.size > 16 * 1024 * 1024) {
      toast.error('El archivo es muy grande (máx. 16MB)');
      return;
    }

    setSelectedFile(file);

    if (type === 'image') {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  // Audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], 'audio.webm', { type: 'audio/webm' });
        setSelectedFile(file);
        const url = URL.createObjectURL(blob);
        setFilePreview(url);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      toast.info('Grabando audio...');
    } catch (err) {
      console.error('Error accessing microphone:', err);
      toast.error('No se pudo acceder al micrófono');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const getMediaType = (file: File): 'image' | 'audio' | 'document' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  // Handle image load error
  const handleImageError = (messageId: string, imageUrl: string) => {
    console.error('Image failed to load:', imageUrl);
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, imageError: true } : msg
    ));
  };

  const suggestedMessages = [
    '¿Qué productos tienen disponibles?',
    '¿Cuánto cuesta el envío?',
    '¿Tienen descuentos?',
    '¿Cuál es el horario de atención?',
    '¿Aceptan pagos con tarjeta?',
    'Muéstrame los sleeping bags que tienen',
    '¿Qué productos tienen para bebé de 6 meses?',
  ];

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Prompt Section */}
      <Card>
        <Collapsible open={isPromptOpen} onOpenChange={setIsPromptOpen}>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-500" />
                  <CardTitle className="text-lg">Prompt del Sistema</CardTitle>
                  {systemPrompt ? (
                    <Badge variant="default" className="gap-1 ml-2">
                      <CheckCircle2 className="h-3 w-3" />
                      Configurado
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 ml-2">
                      <AlertCircle className="h-3 w-3" />
                      Pendiente
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm">
                  {isPromptOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CollapsibleTrigger>
            <CardDescription>
              Define las instrucciones base que la IA usará para todas las respuestas
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder={`Ejemplo: Eres el asistente virtual de [Tu Tienda]. Tu rol es:
- Ayudar a los clientes con información de productos
- Proporcionar precios y disponibilidad
- Responder siempre en español
- Usar un tono amigable con emojis ocasionales`}
                className="min-h-[200px] font-mono text-sm"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Este prompt se usará como base para todas las respuestas de la IA
                </p>
                <Button 
                  onClick={handleSavePrompt} 
                  disabled={isSavingPrompt}
                  className="gap-2"
                >
                  {isSavingPrompt ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Guardar Prompt
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

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
              Prueba cómo responderá la IA a los mensajes de tus clientes (incluye fotos de productos)
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
                      {/* Media preview */}
                      {message.mediaUrl && message.mediaType === 'image' && !message.imageError && (
                        <div className="relative group">
                          <img 
                            src={message.mediaUrl} 
                            alt={message.productName || "Imagen enviada"}
                            className="max-w-[200px] rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(message.mediaUrl, '_blank')}
                            onError={() => handleImageError(message.id, message.mediaUrl!)}
                          />
                          <Button
                            variant="secondary"
                            size="icon"
                            className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => window.open(message.mediaUrl, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {message.mediaUrl && message.mediaType === 'image' && message.imageError && (
                        <div className="flex flex-col items-center gap-2 p-4 bg-background/50 rounded-lg mb-2">
                          <ImageOff className="h-8 w-8 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground text-center">No se pudo cargar la imagen</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs gap-1"
                            onClick={() => window.open(message.mediaUrl, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Abrir enlace
                          </Button>
                        </div>
                      )}
                      {message.mediaUrl && message.mediaType === 'audio' && (
                        <audio 
                          src={message.mediaUrl} 
                          controls 
                          className="max-w-[200px] mb-2"
                        />
                      )}
                      {message.mediaUrl && message.mediaType === 'document' && (
                        <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg mb-2">
                          <FileIcon className="h-5 w-5" />
                          <span className="text-sm">Documento</span>
                        </div>
                      )}
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
          <div className="p-4 border-t space-y-3">
            {/* File preview */}
            {selectedFile && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                {filePreview && selectedFile.type.startsWith('image/') ? (
                  <img src={filePreview} alt="Preview" className="h-12 w-12 object-cover rounded" />
                ) : filePreview && selectedFile.type.startsWith('audio/') ? (
                  <audio src={filePreview} controls className="h-10 max-w-[200px]" />
                ) : (
                  <div className="h-12 w-12 bg-background rounded flex items-center justify-center">
                    <FileIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={clearSelectedFile}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Hidden file inputs */}
            <input
              type="file"
              ref={imageInputRef}
              className="hidden"
              accept="image/*"
              onChange={(e) => handleFileSelect(e, 'image')}
            />
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={(e) => handleFileSelect(e, 'document')}
            />

            <div className="flex gap-2">
              {/* Attachment dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" disabled={isGenerating}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Imagen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <FileText className="h-4 w-4 mr-2" />
                    Documento
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Audio recording button */}
              <Button 
                variant={isRecording ? 'destructive' : 'outline'} 
                size="icon"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isGenerating}
              >
                <Mic className={`h-4 w-4 ${isRecording ? 'animate-pulse' : ''}`} />
              </Button>

              <Input
                placeholder="Escribe un mensaje de prueba..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isGenerating}
                className="flex-1"
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={(!inputMessage.trim() && !selectedFile) || isGenerating}
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
              <span className="text-sm text-muted-foreground">Proveedor IA</span>
              <Badge variant="outline">{aiConfig?.aiProvider === 'minimax' ? '⚡ Minimax' : '🤖 OpenAI'}</Badge>
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
            <CardDescription>Prueba estos escenarios (incluye productos)</CardDescription>
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
                  Prueba preguntas como "¿Qué productos tienen para bebé?" o "Muéstrame los sleeping bags". 
                  La IA ahora puede mostrar fotos de todos los productos que mencione (hasta 10).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
};
