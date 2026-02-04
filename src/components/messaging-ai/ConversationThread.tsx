import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Send, Bot, User, Phone, Sparkles, Copy, Check, MessageCircle, Instagram, Facebook, Loader2, Paperclip, Image, Mic, X, FileText, UserCog, ArrowDown, Reply, MessageSquareText, Search, Play, Pause, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ChannelType } from './ConversationsList';
import { useQuickReplies } from '@/hooks/useQuickReplies';
import { ChatTagsManager } from './ChatTagsManager';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'document' | 'video' | 'sticker';
  mediaMimeType?: string;
  replyToMessageId?: string;
  replyToContent?: string;
  metadata?: {
    original_media_id?: string;
    media_download_error?: string;
  };
}

interface Conversation {
  id: string;
  phone: string;
  name: string;
  status: 'active' | 'pending' | 'resolved';
  channel: ChannelType;
  ai_managed?: boolean;
}

interface ConversationThreadProps {
  conversation?: Conversation;
  messages: Message[];
  onSendMessage?: (message: string, mediaFile?: File, mediaType?: string, replyToMessageId?: string) => void;
  isSending?: boolean;
  isLoading?: boolean;
  onToggleAiManaged?: (aiManaged: boolean) => void;
  isTogglingAiManaged?: boolean;
}

// Audio Player Component with WhatsApp-like styling
const AudioPlayer = ({ src, className }: { src: string; className?: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn("flex items-center gap-3 p-3 bg-background/20 rounded-lg min-w-[200px]", className)}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <button
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors flex-shrink-0"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 ml-0.5" />
        )}
      </button>
      
      <div className="flex-1 min-w-0">
        {/* Waveform placeholder */}
        <div className="h-8 flex items-center gap-0.5">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1 rounded-full transition-all",
                i < (progress / 100) * 30 ? "bg-white" : "bg-white/40"
              )}
              style={{ 
                height: `${Math.sin(i * 0.5) * 50 + 50}%`,
                minHeight: '4px'
              }}
            />
          ))}
        </div>
        
        <div className="flex justify-between text-xs opacity-70 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

// Media Error Placeholder Component
const MediaErrorPlaceholder = ({ 
  type, 
  onRetry,
  isRetrying 
}: { 
  type: string; 
  onRetry?: () => void;
  isRetrying?: boolean;
}) => {
  const iconMap: Record<string, React.ReactNode> = {
    image: <Image className="h-6 w-6" />,
    audio: <Mic className="h-6 w-6" />,
    video: <Play className="h-6 w-6" />,
    sticker: <Image className="h-6 w-6" />,
    document: <FileText className="h-6 w-6" />,
  };

  const labelMap: Record<string, string> = {
    image: 'imagen',
    audio: 'audio',
    video: 'video',
    sticker: 'sticker',
    document: 'documento',
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/30 min-w-[150px]">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <AlertCircle className="h-5 w-5" />
        {iconMap[type] || <FileText className="h-6 w-6" />}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        No se pudo cargar {labelMap[type] || type}
      </p>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-xs h-7"
          onClick={onRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          Reintentar
        </Button>
      )}
    </div>
  );
};

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
  isLoading = false,
  onToggleAiManaged,
  isTogglingAiManaged = false,
}: ConversationThreadProps) => {
  const { currentOrganization } = useOrganization();
  const { quickReplies } = useQuickReplies(currentOrganization?.id);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showQuickRepliesPanel, setShowQuickRepliesPanel] = useState(false);
  const [quickReplySearch, setQuickReplySearch] = useState('');
  const [selectedQuickReplyIndex, setSelectedQuickReplyIndex] = useState(0);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [retryingMedia, setRetryingMedia] = useState<string | null>(null);
  const quickReplySearchInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter quick replies based on search
  const filteredQuickReplies = useMemo(() => {
    if (!quickReplySearch.trim()) return quickReplies;
    const search = quickReplySearch.toLowerCase().trim();
    return quickReplies.filter(reply => 
      reply.title.toLowerCase().includes(search) || 
      reply.content.toLowerCase().includes(search)
    );
  }, [quickReplies, quickReplySearch]);

  // Reset selection when filtered results change
  useEffect(() => {
    setSelectedQuickReplyIndex(0);
  }, [filteredQuickReplies.length]);

  // Function to scroll to bottom
  const scrollToBottom = (behavior: 'instant' | 'smooth' = 'smooth') => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior
      });
    }
  };

  // Instant scroll when conversation changes
  useEffect(() => {
    if (conversation?.id && messages.length > 0) {
      const timer = setTimeout(() => scrollToBottom('instant'), 50);
      return () => clearTimeout(timer);
    }
  }, [conversation?.id]);

  // Smooth scroll when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('smooth');
    }
  }, [messages.length]);

  // Detect scroll position to show/hide button
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    const handleScroll = () => {
      const isNearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    };

    viewport.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [conversation?.id, messages.length]);

  const handleSendMessage = () => {
    if ((!inputMessage.trim() && !selectedFile) || !onSendMessage) return;
    
    if (selectedFile) {
      const mediaType = selectedFile.type.startsWith('image/') 
        ? 'image' 
        : selectedFile.type.startsWith('audio/') 
          ? 'audio' 
          : 'document';
      onSendMessage(inputMessage.trim(), selectedFile, mediaType, replyingTo?.id);
      clearSelectedFile();
    } else {
      onSendMessage(inputMessage.trim(), undefined, undefined, replyingTo?.id);
    }
    setInputMessage('');
    setReplyingTo(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickReplyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredQuickReplies.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedQuickReplyIndex(prev => 
        prev < filteredQuickReplies.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedQuickReplyIndex(prev => 
        prev > 0 ? prev - 1 : filteredQuickReplies.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selectedReply = filteredQuickReplies[selectedQuickReplyIndex];
      if (selectedReply) {
        handleQuickReplySelect(selectedReply);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowQuickRepliesPanel(false);
      setQuickReplySearch('');
      inputRef.current?.focus();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
  };

  const handleQuickReplySelect = async (reply: { title: string; content: string; imageUrl?: string }) => {
    setShowQuickRepliesPanel(false);
    setQuickReplySearch('');
    setSelectedQuickReplyIndex(0);

    setInputMessage(reply.content);

    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';

    if (reply.imageUrl) {
      try {
        console.log('Fetching quick reply image:', reply.imageUrl);
        const response = await fetch(reply.imageUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        console.log('Blob received:', blob.size, blob.type);

        const inferredExt = blob.type?.split('/')?.[1] || 'jpg';
        const fileName = `quick-reply-${Date.now()}.${inferredExt}`;
        const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });

        const reader = new FileReader();
        reader.onload = (e) => {
          console.log('Image preview loaded');
          setFilePreview(e.target?.result as string);
          setSelectedFile(file);
        };
        reader.onerror = () => {
          console.error('FileReader error');
          toast.error('Error al cargar vista previa de imagen');
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('Error fetching quick reply image:', err);
        toast.error('No se pudo cargar la imagen de la respuesta rápida');
      }
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const openQuickRepliesPanel = () => {
    setShowQuickRepliesPanel(true);
    setQuickReplySearch('');
    setSelectedQuickReplyIndex(0);
    setTimeout(() => quickReplySearchInputRef.current?.focus(), 100);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 16 * 1024 * 1024) {
      toast.error('El archivo es muy grande. Máximo 16MB');
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
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      if (!lastUserMessage) {
        toast.error('No hay mensaje del usuario para responder');
        setIsGenerating(false);
        return;
      }

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

  const handleReply = (message: Message) => {
    setReplyingTo(message);
  };

  // Retry media download - would need backend support
  const handleRetryMedia = async (message: Message) => {
    if (!message.id) {
      toast.error('No se puede reintentar: falta ID del mensaje');
      return;
    }

    if (!message.metadata?.original_media_id) {
      toast.error('No se puede reintentar: falta ID de media');
      return;
    }
    
    setRetryingMedia(message.id || null);
    
    try {
      const { data, error } = await supabase.functions.invoke('retry-whatsapp-media', {
        body: {
          message_id: message.id,
        }
      });

      if (error) {
        const anyError: any = error;
        let messageText = error.message || 'Error reintentando descarga';
        const resp: Response | undefined = anyError?.context?.response;

        if (resp) {
          try {
            const body = await resp.clone().json();
            messageText = body?.details || body?.error || messageText;
          } catch {
            // ignore
          }
        }

        throw new Error(messageText);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'No se pudo recuperar el medio');
      }

      toast.success('Medio recuperado');
      // IMPORTANT: UI will update via Realtime UPDATE subscription in useMessagingMessages
    } catch (err: any) {
      console.error('Retry media failed:', err);
      toast.error(err?.message || 'No se pudo recuperar el medio');
    } finally {
      setRetryingMedia(null);
    }
  };

  // Render media content based on type
  const renderMediaContent = (message: Message) => {
    const { mediaUrl, mediaType, mediaMimeType, metadata } = message;
    const hasMediaError = !mediaUrl && metadata?.media_download_error;
    const canRetry = !!message.id && !!metadata?.original_media_id;

    // Handle image
    if (mediaType === 'image') {
      if (mediaUrl) {
        return (
          <div 
            className="cursor-pointer" 
            onClick={() => setLightboxImage(mediaUrl)}
          >
            <img 
              src={mediaUrl} 
              alt="Imagen" 
              className="max-w-full max-h-64 rounded-lg mb-2 hover:opacity-90 transition-opacity object-contain"
              loading="lazy"
            />
          </div>
        );
      } else if (hasMediaError) {
        return (
          <MediaErrorPlaceholder 
            type="image" 
            onRetry={canRetry ? () => handleRetryMedia(message) : undefined}
            isRetrying={retryingMedia === message.id}
          />
        );
      } else {
        // No URL and no error -> treat as missing media (older messages or pending download)
        return (
          <MediaErrorPlaceholder
            type="image"
            onRetry={canRetry ? () => handleRetryMedia(message) : undefined}
            isRetrying={retryingMedia === message.id}
          />
        );
      }
    }

    // Handle audio
    if (mediaType === 'audio') {
      if (mediaUrl) {
        return (
          <AudioPlayer src={mediaUrl} className="mb-2" />
        );
      } else if (hasMediaError) {
        return (
          <MediaErrorPlaceholder 
            type="audio" 
            onRetry={canRetry ? () => handleRetryMedia(message) : undefined}
            isRetrying={retryingMedia === message.id}
          />
        );
      } else {
        return (
          <MediaErrorPlaceholder
            type="audio"
            onRetry={canRetry ? () => handleRetryMedia(message) : undefined}
            isRetrying={retryingMedia === message.id}
          />
        );
      }
    }

    // Handle sticker
    if (mediaType === 'sticker') {
      if (mediaUrl) {
        return (
          <img 
            src={mediaUrl} 
            alt="Sticker" 
            className="max-w-[150px] max-h-[150px] mb-2 object-contain"
            loading="lazy"
          />
        );
      } else if (hasMediaError) {
        return (
          <MediaErrorPlaceholder 
            type="sticker" 
            onRetry={canRetry ? () => handleRetryMedia(message) : undefined}
            isRetrying={retryingMedia === message.id}
          />
        );
      } else {
        return (
          <MediaErrorPlaceholder
            type="sticker"
            onRetry={canRetry ? () => handleRetryMedia(message) : undefined}
            isRetrying={retryingMedia === message.id}
          />
        );
      }
    }

    // Handle video
    if (mediaType === 'video') {
      if (mediaUrl) {
        return (
          <video 
            controls 
            className="max-w-full max-h-64 rounded-lg mb-2"
            preload="metadata"
          >
            <source src={mediaUrl} type={mediaMimeType || 'video/mp4'} />
            Tu navegador no soporta video.
          </video>
        );
      } else if (hasMediaError) {
        return (
          <MediaErrorPlaceholder 
            type="video" 
            onRetry={canRetry ? () => handleRetryMedia(message) : undefined}
            isRetrying={retryingMedia === message.id}
          />
        );
      } else {
        return (
          <MediaErrorPlaceholder
            type="video"
            onRetry={canRetry ? () => handleRetryMedia(message) : undefined}
            isRetrying={retryingMedia === message.id}
          />
        );
      }
    }

    // Handle document
    if (mediaType === 'document') {
      if (mediaUrl) {
        return (
          <a 
            href={mediaUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-background/10 rounded-lg mb-2 hover:bg-background/20 transition-colors"
          >
            <FileText className="h-6 w-6 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium block truncate">
                {message.content || 'Documento adjunto'}
              </span>
              <span className="text-xs opacity-70">Clic para descargar</span>
            </div>
            <Download className="h-4 w-4 opacity-70" />
          </a>
        );
      } else if (hasMediaError) {
        return (
          <MediaErrorPlaceholder 
            type="document" 
            onRetry={canRetry ? () => handleRetryMedia(message) : undefined}
            isRetrying={retryingMedia === message.id}
          />
        );
      } else {
        return (
          <MediaErrorPlaceholder
            type="document"
            onRetry={canRetry ? () => handleRetryMedia(message) : undefined}
            isRetrying={retryingMedia === message.id}
          />
        );
      }
    }

    return null;
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
            <ChatTagsManager conversationId={conversation.id} />
          </div>
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <UserCog className={cn(
                      "h-4 w-4 transition-colors",
                      conversation.ai_managed === false ? "text-primary" : "text-muted-foreground"
                    )} />
                    <Switch
                      id="ai-managed-toggle"
                      checked={conversation.ai_managed !== false}
                      onCheckedChange={(checked) => {
                        console.log('Switch toggled, setting ai_managed to:', checked);
                        onToggleAiManaged?.(checked);
                      }}
                      disabled={isTogglingAiManaged}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                    <Bot className={cn(
                      "h-4 w-4 transition-colors",
                      conversation.ai_managed !== false ? "text-emerald-500" : "text-muted-foreground"
                    )} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">
                    {conversation.ai_managed !== false 
                      ? "IA activa: Responde automáticamente" 
                      : "Control manual: Solo tú respondes"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Badge 
              variant={conversation.status === 'active' ? 'default' : 'secondary'}
              className={conversation.status === 'active' ? 'bg-emerald-500' : ''}
            >
              {conversation.status === 'active' ? 'Activo' : conversation.status === 'pending' ? 'Pendiente' : 'Resuelto'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 relative min-h-0" ref={scrollAreaRef}>
          <ScrollArea className="h-full p-4">
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
                  className={cn(
                    "flex animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
                    message.role === 'user' ? 'justify-start' : 'justify-end'
                  )}
                  style={{ animationDelay: `${Math.min(index * 20, 100)}ms` }}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg p-3 relative group transition-all",
                      message.role === 'user'
                        ? 'bg-muted'
                        : channelInfo.bubbleColor,
                      // Special styling for stickers - no bubble background
                      message.mediaType === 'sticker' && message.mediaUrl && 'bg-transparent p-0'
                    )}
                  >
                    {/* Reply preview if this message is replying to another */}
                    {message.replyToContent && (
                      <div className={cn(
                        "text-xs mb-2 p-2 rounded border-l-2",
                        message.role === 'user' 
                          ? 'bg-background/50 border-muted-foreground/30' 
                          : 'bg-white/10 border-white/30'
                      )}>
                        <p className="opacity-70 line-clamp-2">{message.replyToContent}</p>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-2">
                      {message.role === 'assistant' && (
                        <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        {/* Render media content */}
                        {message.mediaType && renderMediaContent(message)}
                        
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
                    
                    {/* Action buttons on hover */}
                    <div className={cn(
                      "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1",
                      message.role === 'user' ? '-right-16' : '-left-16'
                    )}>
                      <button
                        onClick={() => handleReply(message)}
                        className="p-1 rounded hover:bg-muted transition-colors"
                        title="Responder"
                      >
                        <Reply className="h-4 w-4 text-muted-foreground" />
                      </button>
                      {message.role === 'assistant' && (
                        <button
                          onClick={() => handleCopyMessage(message.content, index)}
                          className="p-1 rounded hover:bg-muted transition-colors"
                          title="Copiar"
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

          {/* Scroll to bottom button */}
          {showScrollButton && (
            <button
              onClick={() => scrollToBottom('smooth')}
              className="absolute bottom-4 right-6 z-10 p-2 rounded-full bg-emerald-500 text-white shadow-lg hover:bg-emerald-600 transition-all animate-in fade-in slide-in-from-bottom-2"
            >
              <ArrowDown className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-border">
          {/* Reply preview */}
          {replyingTo && (
            <div className="mb-3 p-3 bg-muted/50 rounded-lg border-l-4 border-emerald-500 flex items-start gap-3">
              <Reply className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">
                  Respondiendo a {replyingTo.role === 'user' ? 'cliente' : 'ti'}
                </p>
                <p className="text-sm line-clamp-2">{replyingTo.content}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyingTo(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

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

            {/* Quick replies button with popover panel */}
            <Popover open={showQuickRepliesPanel} onOpenChange={setShowQuickRepliesPanel}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  disabled={isSending}
                  onClick={openQuickRepliesPanel}
                >
                  <MessageSquareText className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-80 p-0 bg-popover border border-border shadow-xl z-[60]" 
                align="start"
                side="top"
                sideOffset={8}
              >
                <div className="p-3 border-b border-border">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">Respuestas rápidas</h4>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => setShowQuickRepliesPanel(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    ref={quickReplySearchInputRef}
                    placeholder="Buscar por nombre..."
                    value={quickReplySearch}
                    onChange={(e) => setQuickReplySearch(e.target.value)}
                    onKeyDown={handleQuickReplyKeyDown}
                    className="h-8 text-sm"
                  />
                </div>
                <ScrollArea className="max-h-64">
                  {quickReplies.length === 0 ? (
                    <div className="p-4 text-center">
                      <MessageSquareText className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-sm text-muted-foreground">
                        No hay respuestas rápidas configuradas
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ve a Configuración para agregarlas
                      </p>
                    </div>
                  ) : filteredQuickReplies.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No se encontraron respuestas para "{quickReplySearch}"
                    </div>
                  ) : (
                    <div className="p-1">
                      {filteredQuickReplies.map((reply, index) => (
                        <button
                          key={reply.id}
                          onClick={() => handleQuickReplySelect(reply)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-start gap-2",
                            index === selectedQuickReplyIndex 
                              ? "bg-accent text-accent-foreground" 
                              : "hover:bg-muted"
                          )}
                        >
                          {reply.imageUrl && (
                            <img 
                              src={reply.imageUrl} 
                              alt="" 
                              className="h-8 w-8 object-cover rounded flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="font-medium block">{reply.title}</span>
                            <span className="text-xs text-muted-foreground line-clamp-2">{reply.content}</span>
                            {reply.imageUrl && (
                              <span className="text-xs text-emerald-600 mt-0.5 block">📷 Incluye imagen</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                {quickReplies.length > 0 && (
                  <div className="p-2 border-t border-border bg-muted/30">
                    <p className="text-xs text-muted-foreground text-center">
                      ↑↓ navegar • Enter seleccionar • Esc cerrar
                    </p>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Audio recording button */}
            <Button 
              variant={isRecording ? "destructive" : "outline"} 
              size="icon"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isSending}
            >
              <Mic className={cn("h-4 w-4", isRecording && "animate-pulse")} />
            </Button>

            {/* Input field */}
            <div className="flex-1">
              <Input
                ref={inputRef}
                placeholder="Escribe un mensaje..."
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                className="w-full"
                disabled={isSending}
              />
            </div>
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

      {/* Image Lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">Vista de imagen</DialogTitle>
          {lightboxImage && (
            <img 
              src={lightboxImage} 
              alt="Imagen ampliada" 
              className="w-full h-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
