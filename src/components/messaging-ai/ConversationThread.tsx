import React, { useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, Phone, Sparkles, Copy, Check, MessageCircle, Instagram, Facebook, Loader2, Paperclip, Image, Mic, X, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ChannelType } from './ConversationsList';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'document';
}

interface Conversation {
  id: string;
  phone: string;
  name: string;
  status: 'active' | 'pending' | 'resolved';
  channel: ChannelType;
}

interface ConversationThreadProps {
  conversation?: Conversation;
  messages: Message[];
  onSendMessage?: (message: string, mediaFile?: File, mediaType?: string) => void;
  isSending?: boolean;
  isLoading?: boolean;
}

const channelConfig: Record<ChannelType, { 
  icon: React.ElementType; 
  color: string; 
  bgColor: string;
  bubbleColor: string;
  buttonColor: string;
  avatarBg: string;
}> = {
  whatsapp: { 
    icon: MessageCircle, 
    color: 'text-emerald-500', 
    bgColor: 'bg-emerald-500',
    bubbleColor: 'bg-emerald-500 text-white',
    buttonColor: 'bg-emerald-500 hover:bg-emerald-600',
    avatarBg: 'bg-emerald-100',
  },
  instagram: { 
    icon: Instagram, 
    color: 'text-pink-500', 
    bgColor: 'bg-pink-500',
    bubbleColor: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white',
    buttonColor: 'bg-pink-500 hover:bg-pink-600',
    avatarBg: 'bg-pink-100',
  },
  messenger: { 
    icon: Facebook, 
    color: 'text-blue-500', 
    bgColor: 'bg-blue-500',
    bubbleColor: 'bg-blue-500 text-white',
    buttonColor: 'bg-blue-500 hover:bg-blue-600',
    avatarBg: 'bg-blue-100',
  },
};

export const ConversationThread = ({ 
  conversation, 
  messages, 
  onSendMessage,
  isSending = false,
  isLoading = false
}: ConversationThreadProps) => {
  const { currentOrganization } = useOrganization();
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if ((!inputMessage.trim() && !selectedFile) || !onSendMessage) return;
    
    if (selectedFile) {
      const mediaType = selectedFile.type.startsWith('image/') 
        ? 'image' 
        : selectedFile.type.startsWith('audio/') 
          ? 'audio' 
          : 'document';
      onSendMessage(inputMessage.trim(), selectedFile, mediaType);
      clearSelectedFile();
    } else {
      onSendMessage(inputMessage.trim());
    }
    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 16MB for WhatsApp)
    if (file.size > 16 * 1024 * 1024) {
      toast.error('El archivo es muy grande. Máximo 16MB');
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (type === 'image') {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        setSelectedFile(file);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      toast.info('Grabando audio...');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('No se pudo acceder al micrófono');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      toast.success('Audio grabado');
    }
  };

  const handleGenerateResponse = async () => {
    if (!conversation || messages.length === 0) {
      toast.error('No hay mensajes para generar respuesta');
      return;
    }

    setIsGenerating(true);
    
    try {
      // Get the last user message to respond to
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      if (!lastUserMessage) {
        toast.error('No hay mensaje del usuario para responder');
        setIsGenerating(false);
        return;
      }

      // Call OpenAI GPT-4o-mini via edge function
      const { data, error } = await supabase.functions.invoke('messaging-ai-openai', {
        body: {
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          systemPrompt: 'Eres un asistente virtual amigable de Dosmicos. Responde en español.',
          organizationId: currentOrganization?.id,
        }
      });

      if (error) {
        console.error('AI generation error:', error);
        toast.error('Error al generar respuesta con IA');
        return;
      }

      if (data?.response && onSendMessage) {
        onSendMessage(data.response);
        toast.success('Respuesta generada por IA');
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (err) {
      console.error('Error generating AI response:', err);
      toast.error('Error al conectar con la IA');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyMessage = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    toast.success('Mensaje copiado');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Selecciona una conversación para ver los mensajes</p>
        </div>
      </div>
    );
  }

  const channelInfo = channelConfig[conversation.channel];
  const ChannelIcon = channelInfo.icon;

  return (
    <>
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", channelInfo.avatarBg)}>
              <ChannelIcon className={cn("h-5 w-5", channelInfo.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{conversation.name}</CardTitle>
                <Badge variant="outline" className={cn("text-xs", channelInfo.color)}>
                  {conversation.channel === 'whatsapp' ? 'WhatsApp' : 
                   conversation.channel === 'instagram' ? 'Instagram' : 'Messenger'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{conversation.phone}</p>
            </div>
          </div>
          <Badge 
            variant={conversation.status === 'active' ? 'default' : 'secondary'}
            className={conversation.status === 'active' ? 'bg-emerald-500' : ''}
          >
            {conversation.status === 'active' ? 'Activo' : conversation.status === 'pending' ? 'Pendiente' : 'Resuelto'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 flex flex-col min-h-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
              <p>No hay mensajes en esta conversación</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg p-3 relative group",
                      message.role === 'user'
                        ? 'bg-muted'
                        : channelInfo.bubbleColor
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {message.role === 'assistant' && (
                        <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        {/* Media content */}
                        {message.mediaUrl && message.mediaType === 'image' && (
                          <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={message.mediaUrl} 
                              alt="Imagen" 
                              className="max-w-full max-h-64 rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                            />
                          </a>
                        )}
                        {message.mediaUrl && message.mediaType === 'audio' && (
                          <audio 
                            controls 
                            src={message.mediaUrl} 
                            className="max-w-full mb-2"
                          />
                        )}
                        {message.mediaUrl && message.mediaType === 'document' && (
                          <a 
                            href={message.mediaUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 bg-background/10 rounded mb-2 hover:bg-background/20 transition-colors"
                          >
                            <FileText className="h-5 w-5" />
                            <span className="text-sm underline">Documento adjunto</span>
                          </a>
                        )}
                        
                        {/* Text content */}
                        {message.content && (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        )}
                        <p 
                          className={cn(
                            "text-xs mt-1",
                            message.role === 'user' ? 'text-muted-foreground' : 'opacity-70'
                          )}
                        >
                          {format(message.timestamp, 'HH:mm', { locale: es })}
                        </p>
                      </div>
                    </div>
                    
                    {message.role === 'assistant' && (
                      <button
                        onClick={() => handleCopyMessage(message.content, index)}
                        className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                      >
                        {copiedIndex === index ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {(isGenerating || isSending) && (
                <div className="flex justify-end">
                  <div className={cn("rounded-lg p-3 max-w-[80%]", channelInfo.bubbleColor)}>
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">
                        {isSending ? 'Enviando...' : 'Generando respuesta...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        <div className="p-4 border-t border-border">
          {/* File preview */}
          {selectedFile && (
            <div className="mb-3 p-3 bg-muted rounded-lg flex items-center gap-3">
              {filePreview ? (
                <img src={filePreview} alt="Preview" className="w-16 h-16 object-cover rounded" />
              ) : selectedFile.type.startsWith('audio/') ? (
                <div className="w-16 h-16 bg-primary/10 rounded flex items-center justify-center">
                  <Mic className="h-8 w-8 text-primary" />
                </div>
              ) : (
                <div className="w-16 h-16 bg-primary/10 rounded flex items-center justify-center">
                  <FileText className="h-8 w-8 text-primary" />
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
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'image')}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'document')}
          />

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleGenerateResponse}
              disabled={isGenerating || isSending}
              className="flex items-center gap-1"
            >
              <Sparkles className="h-4 w-4" />
              Generar con IA
            </Button>

            {/* Attachment dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" disabled={isSending}>
                  <Paperclip className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                  <Image className="h-4 w-4 mr-2" />
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
              variant={isRecording ? "destructive" : "outline"} 
              size="icon"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isSending}
            >
              <Mic className={cn("h-4 w-4", isRecording && "animate-pulse")} />
            </Button>

            <Input
              placeholder="Escribe un mensaje o genera con IA..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
              disabled={isSending}
            />
            <Button 
              size="icon" 
              className={channelInfo.buttonColor}
              onClick={handleSendMessage}
              disabled={(!inputMessage.trim() && !selectedFile) || isSending}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs mt-2 text-muted-foreground">
            💡 La IA generará respuestas basadas en tu catálogo de productos y configuración
          </p>
        </div>
      </CardContent>
    </>
  );
};
