import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Send, Bot, User, Phone, Sparkles, Copy, Check, MessageCircle, Instagram, Facebook, Loader2, Paperclip, Image, Mic, X, FileText, UserCog, ArrowDown, ArrowLeft, Reply, MessageSquareText, Search, Play, Pause, AlertCircle, RefreshCw, Download, ImagePlus, Smile } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { format, isToday, isYesterday, isThisWeek, isThisYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  formatSuggestionConfidence,
  getPendingElsaSupervisedSuggestion,
  type ConversationMetadata,
} from '@/lib/elsaSupervisedSuggestion';
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

interface MessageMetadata {
  original_media_id?: string;
  media_download_error?: string;
  // Meta webhook may embed the original message here
  original_message?: Record<string, { id?: string } | undefined>;
  // Or individual media objects
  image?: { id?: string };
  audio?: { id?: string };
  video?: { id?: string };
  sticker?: { id?: string };
  document?: { id?: string };
  [key: string]: unknown;
}

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
  replyToMediaUrl?: string;
  replyToMediaType?: string;
  metadata?: MessageMetadata;
}

interface Conversation {
  id: string;
  phone: string;
  name: string;
  status: 'active' | 'pending' | 'resolved';
  channel: ChannelType;
  ai_managed?: boolean;
  metadata?: ConversationMetadata;
}

interface ConversationThreadProps {
  conversation?: Conversation;
  messages: Message[];
  onSendMessage?: (message: string, mediaFiles?: File[], mediaType?: string, replyToMessageId?: string) => void;
  isSending?: boolean;
  isLoading?: boolean;
  onToggleAiManaged?: (aiManaged: boolean) => void;
  isTogglingAiManaged?: boolean;
  onBack?: () => void;
}

// Format date separator label like Telegram: "Hoy", "Ayer", "lunes", or "25 de febrero de 2025"
function formatDateSeparator(date: Date): string {
  if (isToday(date)) return 'Hoy';
  if (isYesterday(date)) return 'Ayer';
  if (isThisWeek(date, { weekStartsOn: 1 })) {
    // Capitalize first letter: "lunes" -> "Lunes"
    const day = format(date, 'EEEE', { locale: es });
    return day.charAt(0).toUpperCase() + day.slice(1);
  }
  if (isThisYear(date)) {
    return format(date, "d 'de' MMMM", { locale: es });
  }
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
}

// Check if two dates are on different calendar days
function isDifferentDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() !== d2.getFullYear() ||
    d1.getMonth() !== d2.getMonth() ||
    d1.getDate() !== d2.getDate();
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
  onBack,
}: ConversationThreadProps) => {
  const { currentOrganization } = useOrganization();
  const { quickReplies } = useQuickReplies(currentOrganization?.id);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedElsaSuggestion, setCopiedElsaSuggestion] = useState(false);
  const [showElsaCorrection, setShowElsaCorrection] = useState(false);
  const [elsaCorrectionText, setElsaCorrectionText] = useState('');
  const [elsaRejectReason, setElsaRejectReason] = useState('');
  const [isReviewingElsaSuggestion, setIsReviewingElsaSuggestion] = useState(false);
  const [dismissedElsaSuggestionKey, setDismissedElsaSuggestionKey] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showQuickRepliesPanel, setShowQuickRepliesPanel] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [quickReplySearch, setQuickReplySearch] = useState('');
  const [selectedQuickReplyIndex, setSelectedQuickReplyIndex] = useState(0);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [retryingMedia, setRetryingMedia] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const quickReplySearchInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const rawElsaSuggestion = useMemo(
    () => getPendingElsaSupervisedSuggestion(conversation?.metadata),
    [conversation?.metadata]
  );
  const elsaSuggestionKey = rawElsaSuggestion
    ? `${conversation?.id || ''}:${rawElsaSuggestion.generated_at || rawElsaSuggestion.text}`
    : null;
  const elsaSuggestion = elsaSuggestionKey && dismissedElsaSuggestionKey === elsaSuggestionKey
    ? null
    : rawElsaSuggestion;
  const elsaConfidence = formatSuggestionConfidence(elsaSuggestion?.confidence);

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
    setShowElsaCorrection(false);
    setElsaCorrectionText('');
    setElsaRejectReason('');
    setDismissedElsaSuggestionKey(null);
  }, [conversation?.id]);

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
    if ((!inputMessage.trim() && selectedFiles.length === 0) || !onSendMessage) return;

    if (selectedFiles.length > 0) {
      // Determine media type from first file (all should be same category via input)
      const firstFile = selectedFiles[0];
      const mediaType = firstFile.type.startsWith('image/')
        ? 'image'
        : firstFile.type.startsWith('audio/')
          ? 'audio'
          : 'document';
      // Pass all files to parent for sequential sending
      onSendMessage(inputMessage.trim(), selectedFiles, mediaType, replyingTo?.id);
      clearSelectedFiles();
    } else {
      onSendMessage(inputMessage.trim(), undefined, undefined, replyingTo?.id);
    }
    setInputMessage('');
    setReplyingTo(null);
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // When in slash mode, handle navigation and selection
    if (isSlashMode && slashFilteredReplies.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex(prev =>
          prev < slashFilteredReplies.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex(prev =>
          prev > 0 ? prev - 1 : slashFilteredReplies.length - 1
        );
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const selected = slashFilteredReplies[slashSelectedIndex];
        if (selected) {
          handleQuickReplySelect(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setInputMessage('');
        return;
      }
    }

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

  // Inline quick replies triggered by "/" prefix
  const isSlashMode = inputMessage.startsWith('/');
  const slashSearch = isSlashMode ? inputMessage.slice(1).toLowerCase().trim() : '';
  const slashFilteredReplies = useMemo(() => {
    if (!isSlashMode) return [];
    if (!slashSearch) return quickReplies;
    return quickReplies.filter(r =>
      r.title.toLowerCase().includes(slashSearch) ||
      r.content.toLowerCase().includes(slashSearch)
    );
  }, [isSlashMode, slashSearch, quickReplies]);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  // Reset selection when slash filtered results change
  useEffect(() => {
    setSlashSelectedIndex(0);
  }, [slashFilteredReplies.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const handleQuickReplySelect = async (reply: { title: string; content: string; imageUrl?: string }) => {
    setShowQuickRepliesPanel(false);
    setQuickReplySearch('');
    setSelectedQuickReplyIndex(0);

    setInputMessage(reply.content);

    setSelectedFiles([]);
    setFilePreviews([]);
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
          setFilePreviews([e.target?.result as string]);
          setSelectedFiles([file]);
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

  const handleEmojiSelect = (emojiData: { emoji: string }) => {
    setInputMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const openQuickRepliesPanel = () => {
    setShowQuickRepliesPanel(true);
    setQuickReplySearch('');
    setSelectedQuickReplyIndex(0);
    setTimeout(() => quickReplySearchInputRef.current?.focus(), 100);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: File[] = [];
    const tooLarge: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 16 * 1024 * 1024) {
        tooLarge.push(file.name);
      } else {
        newFiles.push(file);
      }
    }

    if (tooLarge.length > 0) {
      toast.error(`${tooLarge.length} archivo(s) superan el máximo de 16MB`);
    }

    if (newFiles.length === 0) return;

    // Append to existing selections
    setSelectedFiles(prev => [...prev, ...newFiles]);

    // Generate previews for images
    if (type === 'image') {
      newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setFilePreviews(prev => [...prev, ev.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
    } else {
      // For documents, add null placeholders to keep indexes aligned
      setFilePreviews(prev => [...prev, ...newFiles.map(() => '')]);
    }

    // Reset input so the same file(s) can be selected again
    e.target.value = '';
  };

  const clearSelectedFiles = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Process image files from drag/drop or paste (supports multiple)
  const processImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se pueden pegar/arrastrar imágenes');
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      toast.error('La imagen es muy grande. Máximo 16MB');
      return;
    }

    setSelectedFiles(prev => [...prev, file]);
    const reader = new FileReader();
    reader.onload = (e) => setFilePreviews(prev => [...prev, e.target?.result as string]);
    reader.readAsDataURL(file);
    toast.success('Imagen lista para enviar');
    // Focus the input so user can add a caption and press Enter
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ===== DRAG & DROP =====
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    const validFiles: File[] = [];
    let tooLargeCount = 0;

    for (const file of droppedFiles) {
      if (file.size > 16 * 1024 * 1024) {
        tooLargeCount++;
      } else {
        validFiles.push(file);
      }
    }

    if (tooLargeCount > 0) {
      toast.error(`${tooLargeCount} archivo(s) superan el máximo de 16MB`);
    }

    if (validFiles.length === 0) return;

    // Add all valid files
    setSelectedFiles(prev => [...prev, ...validFiles]);

    // Generate previews for images
    validFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => setFilePreviews(prev => [...prev, ev.target?.result as string]);
        reader.readAsDataURL(file);
      } else {
        setFilePreviews(prev => [...prev, '']);
      }
    });

    toast.success(`${validFiles.length} archivo${validFiles.length > 1 ? 's' : ''} listo${validFiles.length > 1 ? 's' : ''} para enviar`);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ===== PASTE IMAGE (Ctrl+V / Cmd+V) =====
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only handle paste if this conversation is active
      if (!conversation) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      let handled = false;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          if (!handled) {
            e.preventDefault();
            handled = true;
          }
          const file = item.getAsFile();
          if (file) {
            processImageFile(file);
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [conversation, processImageFile]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        // Audio replaces all selected files (you send audio alone)
        setSelectedFiles([file]);
        setFilePreviews(['']);
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

      // Always use OpenAI
      const functionName = 'messaging-ai-openai';
      console.log('Using AI function:', functionName);

      const { data, error } = await supabase.functions.invoke(functionName, {
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

  const handleUseElsaSuggestion = () => {
    if (!elsaSuggestion?.text) return;
    setInputMessage(elsaSuggestion.text);
    setSelectedFiles([]);
    setFilePreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
    setTimeout(() => {
      inputRef.current?.focus();
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
      }
    }, 50);
    toast.success('Sugerencia de Elsa lista para revisar');
  };

  const handleCopyElsaSuggestion = () => {
    if (!elsaSuggestion?.text) return;
    navigator.clipboard.writeText(elsaSuggestion.text);
    setCopiedElsaSuggestion(true);
    toast.success('Sugerencia de Elsa copiada');
    setTimeout(() => setCopiedElsaSuggestion(false), 2000);
  };

  const handleRejectElsaSuggestion = async () => {
    if (!conversation?.id || !currentOrganization?.id || !elsaSuggestion) return;

    setIsReviewingElsaSuggestion(true);
    try {
      const { data, error } = await supabase.functions.invoke('elsa-review-suggestion', {
        body: {
          conversationId: conversation.id,
          organizationId: currentOrganization.id,
          rejectionReason: elsaRejectReason,
          correctedResponse: elsaCorrectionText,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (elsaSuggestionKey) setDismissedElsaSuggestionKey(elsaSuggestionKey);
      setShowElsaCorrection(false);
      setElsaCorrectionText('');
      setElsaRejectReason('');
      toast.success(elsaCorrectionText.trim()
        ? 'Corrección guardada para revisión de Elsa'
        : 'Sugerencia rechazada y enviada a aprendizajes');
    } catch (err: any) {
      console.error('Error rejecting Elsa suggestion:', err);
      toast.error(err?.message || 'No se pudo rechazar la sugerencia de Elsa');
    } finally {
      setIsReviewingElsaSuggestion(false);
    }
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
    console.log(`🖼️ Renderizando mensaje tipo: ${mediaType}, media_url: ${mediaUrl || 'null'}`);
    const hasMediaError = !mediaUrl && metadata?.media_download_error;

    // Check multiple places for original_media_id (webhook may store in different locations)
    const originalMediaId = metadata?.original_media_id
      || metadata?.image?.id
      || metadata?.audio?.id
      || metadata?.video?.id
      || metadata?.sticker?.id
      || metadata?.document?.id
      || metadata?.original_message?.[mediaType || '']?.id
      || null;
    const canRetry = !!message.id && !!originalMediaId;

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
          {onBack && (
            <button onClick={onBack} className="mb-4 p-2 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
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
      <CardHeader className={cn(
        "border-b border-border",
        onBack ? "py-2 px-2 lg:py-4 lg:px-6 safe-area-top" : "py-2 px-3 lg:py-4 lg:px-6"
      )}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
            {/* Mobile back button */}
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-muted transition-colors flex-shrink-0 lg:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div className={cn("w-9 h-9 lg:w-10 lg:h-10 rounded-full flex items-center justify-center flex-shrink-0", channelInfo.avatarBg)}>
              <ChannelIcon className={cn("h-5 w-5 lg:h-5 lg:w-5", channelInfo.color)} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 lg:gap-2">
                <CardTitle className="text-[15px] lg:text-base truncate">{conversation.name}</CardTitle>
                <Badge variant="outline" className={cn("text-[10px] lg:text-xs px-1.5 flex-shrink-0", channelInfo.color)}>
                  {conversation.channel === 'whatsapp' ? 'WA' :
                   conversation.channel === 'instagram' ? 'IG' : 'MSG'}
                </Badge>
              </div>
              <p className="text-xs lg:text-sm text-muted-foreground truncate">{conversation.phone}</p>
            </div>
            <div className="hidden lg:block">
              <ChatTagsManager conversationId={conversation.id} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 lg:gap-3 flex-shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 lg:gap-2">
                    <UserCog className={cn(
                      "h-3.5 w-3.5 lg:h-4 lg:w-4 transition-colors hidden lg:block",
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
                      className="data-[state=checked]:bg-emerald-500 scale-90 lg:scale-100"
                    />
                    <Bot className={cn(
                      "h-3.5 w-3.5 lg:h-4 lg:w-4 transition-colors",
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
              className={cn(
                "text-[10px] lg:text-xs hidden sm:inline-flex",
                conversation.status === 'active' ? 'bg-emerald-500' : ''
              )}
            >
              {conversation.status === 'active' ? 'Activo' : conversation.status === 'pending' ? 'Pendiente' : 'Resuelto'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent
        className="flex-1 p-0 flex flex-col min-h-0 overflow-hidden relative"
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag & Drop overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-emerald-500 rounded-lg m-2 pointer-events-none animate-in fade-in duration-200">
            <div className="flex flex-col items-center gap-3 text-emerald-600">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <ImagePlus className="h-8 w-8" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">Suelta la imagen aquí</p>
                <p className="text-sm text-muted-foreground">Se adjuntará al mensaje</p>
              </div>
            </div>
          </div>
        )}

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
              {messages.map((message, index) => {
                // Show date separator if first message or different day from previous
                const showDateSeparator = index === 0 ||
                  isDifferentDay(message.timestamp, messages[index - 1].timestamp);

                return (
                <React.Fragment key={index}>
                  {showDateSeparator && (
                    <div className="flex items-center justify-center my-3">
                      <div className="bg-muted/80 backdrop-blur-sm text-muted-foreground text-xs font-medium px-3 py-1 rounded-full shadow-sm">
                        {formatDateSeparator(message.timestamp)}
                      </div>
                    </div>
                  )}
                  <div
                    id={message.id ? `msg-${message.id}` : undefined}
                    className={cn(
                      "flex animate-in fade-in-0 slide-in-from-bottom-2 duration-300 transition-all",
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
                    {(message.replyToContent || message.replyToMediaUrl) && (
                      <div
                        className={cn(
                          "text-xs mb-2 p-2 rounded border-l-2 cursor-pointer hover:opacity-80 transition-opacity",
                          message.role === 'user'
                            ? 'bg-background/50 border-muted-foreground/30'
                            : 'bg-white/10 border-white/30'
                        )}
                        onClick={() => {
                          if (message.replyToMessageId) {
                            const el = document.getElementById(`msg-${message.replyToMessageId}`);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              el.classList.add('ring-2', 'ring-emerald-400', 'ring-opacity-75');
                              setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-400', 'ring-opacity-75'), 2000);
                            }
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {message.replyToMediaUrl && message.replyToMediaType === 'image' && (
                            <img src={message.replyToMediaUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                          )}
                          <p className="opacity-70 line-clamp-2">
                            {message.replyToContent && !/^\[(imagen|image)\]$/i.test(message.replyToContent)
                              ? message.replyToContent
                              : message.replyToMediaUrl ? '📷 Imagen' : message.replyToContent}
                          </p>
                        </div>
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
                </React.Fragment>
                );
              })}

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
        <div className="p-2 lg:p-4 border-t border-border safe-area-bottom">
          {/* Elsa supervised suggestion */}
          {elsaSuggestion && (
            <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50/90 p-3 shadow-sm animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-amber-950">Sugerencia de Elsa</p>
                    <Badge variant="secondary" className="bg-white/80 text-amber-800 border-amber-200">
                      Supervisada · no enviada
                    </Badge>
                    {elsaConfidence && (
                      <Badge variant="outline" className="bg-white/70 text-amber-800 border-amber-200">
                        Confianza {elsaConfidence}
                      </Badge>
                    )}
                    {elsaSuggestion.handoff_required && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Revisar caso
                      </Badge>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap rounded-lg border border-amber-100 bg-white/80 p-3 text-sm leading-relaxed text-slate-900">
                    {elsaSuggestion.text}
                  </p>
                  {elsaSuggestion.handoff_reason && (
                    <p className="text-xs text-amber-800">
                      Motivo de revisión: {elsaSuggestion.handoff_reason}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                      onClick={handleUseElsaSuggestion}
                      disabled={isSending}
                    >
                      Usar respuesta
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleCopyElsaSuggestion}
                    >
                      {copiedElsaSuggestion ? (
                        <Check className="h-4 w-4 mr-1.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-1.5" />
                      )}
                      Copiar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => setShowElsaCorrection((current) => !current)}
                      disabled={isReviewingElsaSuggestion}
                    >
                      <X className="h-4 w-4 mr-1.5" />
                      Rechazar
                    </Button>
                    <span className="text-xs text-amber-800">
                      La asesora debe revisar y enviar manualmente.
                    </span>
                  </div>
                  {showElsaCorrection && (
                    <div className="space-y-2 rounded-lg border border-red-100 bg-white/80 p-3">
                      <p className="text-xs font-medium text-red-800">
                        Corrección para que Elsa aprenda
                      </p>
                      <Textarea
                        value={elsaCorrectionText}
                        onChange={(event) => setElsaCorrectionText(event.target.value)}
                        placeholder="Opcional: escribe cómo debió responder Elsa. Si ya lo vas a responder en el chat, igual puedes dejar aquí la corrección corta."
                        className="min-h-[76px] bg-white"
                      />
                      <Input
                        value={elsaRejectReason}
                        onChange={(event) => setElsaRejectReason(event.target.value)}
                        placeholder="Motivo opcional: producto equivocado, política incompleta, tono, precio, etc."
                        className="bg-white"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={handleRejectElsaSuggestion}
                          disabled={isReviewingElsaSuggestion}
                        >
                          {isReviewingElsaSuggestion && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                          Guardar rechazo
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setShowElsaCorrection(false);
                            setElsaCorrectionText('');
                            setElsaRejectReason('');
                          }}
                          disabled={isReviewingElsaSuggestion}
                        >
                          Cancelar
                        </Button>
                        <span className="text-xs text-slate-500">
                          Se crea un aprendizaje en revisión; Elsa no lo usa hasta aprobarlo.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Reply preview */}
          {replyingTo && (
            <div className="mb-2 p-2 lg:p-3 bg-muted/50 rounded-lg border-l-4 border-emerald-500 flex items-start gap-2">
              <Reply className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] lg:text-xs text-muted-foreground">
                  Respondiendo a {replyingTo.role === 'user' ? 'cliente' : 'ti'}
                </p>
                <p className="text-xs lg:text-sm line-clamp-1">{replyingTo.content}</p>
              </div>
              <button className="p-0.5 rounded hover:bg-muted" onClick={() => setReplyingTo(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* File previews (multiple) */}
          {selectedFiles.length > 0 && (
            <div className="mb-2 p-2 lg:p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] lg:text-xs text-muted-foreground font-medium">
                  {selectedFiles.length} archivo{selectedFiles.length > 1 ? 's' : ''} seleccionado{selectedFiles.length > 1 ? 's' : ''}
                </span>
                <button className="text-[10px] lg:text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={clearSelectedFiles}>
                  Quitar todos
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="relative group">
                    {filePreviews[index] && file.type.startsWith('image/') ? (
                      <img src={filePreviews[index]} alt={file.name} className="w-14 h-14 lg:w-16 lg:h-16 object-cover rounded border border-border" />
                    ) : file.type.startsWith('audio/') ? (
                      <div className="w-14 h-14 lg:w-16 lg:h-16 bg-primary/10 rounded border border-border flex flex-col items-center justify-center">
                        <Mic className="h-5 w-5 text-primary" />
                        <span className="text-[8px] text-muted-foreground mt-0.5 truncate max-w-[3rem]">{file.name.split('.').pop()}</span>
                      </div>
                    ) : (
                      <div className="w-14 h-14 lg:w-16 lg:h-16 bg-primary/10 rounded border border-border flex flex-col items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="text-[8px] text-muted-foreground mt-0.5 truncate max-w-[3rem]">{file.name.split('.').pop()}</span>
                      </div>
                    )}
                    <button
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      onClick={() => removeSelectedFile(index)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[7px] text-center py-0.5 rounded-b truncate px-0.5">
                      {file.size >= 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)}MB` : `${(file.size / 1024).toFixed(0)}KB`}
                    </div>
                  </div>
                ))}
                {/* Add more button */}
                <button
                  className="w-14 h-14 lg:w-16 lg:h-16 border-2 border-dashed border-border rounded flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}

          {/* Hidden file inputs (multiple) */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'image')}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'document')}
          />

          {/* Inline quick replies panel triggered by "/" */}
          {isSlashMode && slashFilteredReplies.length > 0 && (
            <div className="mb-2 bg-popover border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="px-3 py-2 border-b border-border bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground">
                  Respuestas rápidas · <span className="text-foreground">{slashFilteredReplies.length}</span>
                </p>
              </div>
              <ScrollArea className="max-h-48">
                <div className="p-1">
                  {slashFilteredReplies.map((reply, index) => (
                    <button
                      key={reply.id}
                      onClick={() => handleQuickReplySelect(reply)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors flex items-start gap-2.5",
                        index === slashSelectedIndex
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted active:bg-muted"
                      )}
                    >
                      {reply.imageUrl && (
                        <img
                          src={reply.imageUrl}
                          alt=""
                          className="h-9 w-9 object-cover rounded flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium block text-[13px]">/{reply.title}</span>
                        <span className="text-xs text-muted-foreground line-clamp-1">{reply.content}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
          {isSlashMode && slashFilteredReplies.length === 0 && slashSearch && (
            <div className="mb-2 bg-popover border border-border rounded-lg shadow-lg p-3 animate-in fade-in duration-150">
              <p className="text-xs text-muted-foreground text-center">
                No hay respuestas para "/{slashSearch}"
              </p>
            </div>
          )}

          {/* Mobile: compact input row like WhatsApp/Telegram */}
          <div className="flex items-end gap-1.5 lg:gap-2">
            {/* Attachment dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-2 rounded-full hover:bg-muted transition-colors flex-shrink-0 text-muted-foreground"
                  disabled={isSending}
                >
                  <Paperclip className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top">
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

            {/* Input field - grows to fill space */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                placeholder="Escribe un mensaje..."
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                className="w-full pr-10 rounded-full bg-muted/50 border-muted lg:rounded-md lg:bg-background flex items-center px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden"
                disabled={isSending}
                rows={1}
                style={{ minHeight: '40px', maxHeight: '120px' }}
              />
            </div>

            {/* Emoji picker button */}
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <button
                  className="p-2 rounded-full hover:bg-muted transition-colors flex-shrink-0 text-muted-foreground"
                  disabled={isSending}
                >
                  <Smile className="h-5 w-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-full p-0 border-none shadow-xl z-[60]"
                align="end"
                side="top"
                sideOffset={8}
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiSelect}
                  width="100%"
                  height={350}
                  searchPlaceholder="Buscar emoji..."
                  theme={Theme.AUTO}
                  lazyLoadEmojis
                />
              </PopoverContent>
            </Popover>

            {/* Quick replies button */}
            <Popover open={showQuickRepliesPanel} onOpenChange={setShowQuickRepliesPanel}>
              <PopoverTrigger asChild>
                <button
                  className="p-2 rounded-full hover:bg-muted transition-colors flex-shrink-0 text-muted-foreground hidden lg:flex"
                  disabled={isSending}
                  onClick={openQuickRepliesPanel}
                >
                  <MessageSquareText className="h-5 w-5" />
                </button>
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

            {/* Audio recording button - hidden on mobile when there's text */}
            <button
              className={cn(
                "p-2 rounded-full transition-colors flex-shrink-0",
                isRecording
                  ? "bg-red-500 text-white"
                  : "hover:bg-muted text-muted-foreground",
                inputMessage.trim() && "hidden lg:flex"
              )}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isSending}
            >
              <Mic className={cn("h-5 w-5", isRecording && "animate-pulse")} />
            </button>

            {/* AI Generate button - compact on mobile */}
            <button
              className="p-2 rounded-full hover:bg-muted transition-colors flex-shrink-0 text-muted-foreground"
              onClick={handleGenerateResponse}
              disabled={isGenerating || isSending}
              title="Generar con IA"
            >
              <Sparkles className={cn("h-5 w-5", isGenerating && "animate-pulse text-amber-500")} />
            </button>

            {/* Send button - WhatsApp style circular */}
            <button
              className={cn(
                "p-2.5 rounded-full flex-shrink-0 transition-all",
                (!inputMessage.trim() && selectedFiles.length === 0) || isSending
                  ? "bg-muted text-muted-foreground"
                  : cn(channelInfo.buttonColor, "text-white shadow-md")
              )}
              onClick={handleSendMessage}
              disabled={(!inputMessage.trim() && selectedFiles.length === 0) || isSending}
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
          <p className="text-xs mt-1.5 text-muted-foreground hidden lg:block">
            La IA genera respuestas basadas en tu catálogo y configuración
          </p>
        </div>
      </CardContent>

      {/* Image Lightbox - Full screen overlay */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxImage(null)}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white z-10"
            onClick={() => setLightboxImage(null)}
          >
            <X className="h-6 w-6" />
          </button>
          {/* Image */}
          <img
            src={lightboxImage}
            alt="Imagen ampliada"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {/* Download button */}
          <a
            href={lightboxImage}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm bg-white text-black rounded-md hover:bg-gray-200 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-4 w-4" />
            Descargar imagen
          </a>
        </div>
      )}
    </>
  );
};
