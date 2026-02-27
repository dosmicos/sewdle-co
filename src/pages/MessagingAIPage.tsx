import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquareMore, Loader2, Plus, Mail, Users, Menu, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationsList, Conversation, ChannelType } from '@/components/messaging-ai/ConversationsList';
import { ConversationThread } from '@/components/messaging-ai/ConversationThread';
import { NewConversationModal } from '@/components/messaging-ai/NewConversationModal';
import { AIConfigPanel } from '@/components/messaging-ai/AIConfigPanel';
import { ProductCatalogConnection } from '@/components/whatsapp-ai/ProductCatalogConnection';
import { MessagingStats } from '@/components/messaging-ai/MessagingStats';
import { MessagingSidebar } from '@/components/messaging-ai/MessagingSidebar';
import { KnowledgeBaseEditor } from '@/components/messaging-ai/KnowledgeBaseEditor';
import { AITrainingPanel } from '@/components/messaging-ai/AITrainingPanel';
import { TagsSettingsPanel } from '@/components/messaging-ai/TagsSettingsPanel';
import { RealtimeConnectionBanner } from '@/components/messaging-ai/RealtimeConnectionBanner';
import { MessagingSearchBar } from '@/components/messaging-ai/MessagingSearchBar';
import { SearchResultsList } from '@/components/messaging-ai/SearchResultsList';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useQueryClient } from '@tanstack/react-query';
import { useMessagingConversations } from '@/hooks/useMessagingConversations';
import { useMessagingMessages } from '@/hooks/useMessagingMessages';
import { useMessagingTags } from '@/hooks/useMessagingTags';
import { useMessagingRealtime } from '@/hooks/useMessagingRealtime';
import { useMessagingSearch } from '@/hooks/useMessagingSearch';
import { useMessagingFolders } from '@/hooks/useMessagingFolders';
import { FolderCreateDialog } from '@/components/messaging-ai/FolderCreateDialog';
import { OrderConfirmationPanel } from '@/components/messaging-ai/OrderConfirmationPanel';
import { ExpressNotificationPanel } from '@/components/messaging-ai/ExpressNotificationPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrganization } from '@/contexts/OrganizationContext';

type FilterType = 'inbox' | 'needs-help' | 'ai-managed';
type ViewType = 'conversations' | 'config' | 'catalog' | 'train' | 'knowledge' | 'campaigns' | 'stats' | 'tags';

const MessagingAIPage = () => {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('inbox');
  const [activeChannel, setActiveChannel] = useState<ChannelType | 'all'>('all');
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewType>('conversations');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showCreateFolderFromChat, setShowCreateFolderFromChat] = useState(false);
  const [quickFilter, setQuickFilter] = useState<'all' | 'unread' | 'groups'>('all');
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Centralized realtime subscription for all messaging
  const { connectionStatus, manualRefresh } = useMessagingRealtime({
    organizationId: currentOrganization?.id,
    // Avoid subscribing before OrganizationContext resolves; early subscriptions can appear as TIMED_OUT
    // and leave the UI in a misleading "Conexión perdida" state.
    enabled: activeView === 'conversations' && !!currentOrganization?.id,
    activeConversationId: selectedConversation,
  });

  const { tags, tagCounts, useConversationTags } = useMessagingTags();

  // Search functionality
  const { 
    searchTerm, 
    setSearchTerm, 
    searchResults, 
    isSearching, 
    hasSearchTerm, 
    clearSearch 
  } = useMessagingSearch({
    channelFilter: activeChannel,
    statusFilter: activeFilter,
    tagFilter: activeTagId,
  });

  const { 
    conversations, 
    isLoading: isLoadingConversations, 
    markAsRead,
    markAsUnread,
    createConversation,
    isCreatingConversation,
    deleteConversation,
    isDeletingConversation,
    toggleAiManaged,
    isTogglingAiManaged,
    togglePin,
  } = useMessagingConversations(activeChannel);

  const {
    folders,
    folderCounts,
    createFolder,
    isCreatingFolder,
    deleteFolder,
    moveToFolder,
  } = useMessagingFolders();

  const { messages, isLoading: isLoadingMessages, sendMessage, isSending } = useMessagingMessages(selectedConversation);

  // Transform DB conversations to UI format
  const transformedConversations: Conversation[] = useMemo(() => {
    return conversations.map(conv => ({
      id: conv.id,
      phone: conv.user_identifier || conv.external_user_id || '',
      name: conv.user_name || conv.user_identifier || 'Sin nombre',
      lastMessage: conv.last_message_preview || '',
      unread: conv.unread_count || 0,
      lastMessageTime: conv.last_message_at ? new Date(conv.last_message_at) : new Date(conv.created_at || new Date()),
      status: conv.status === 'open' ? 'active' : conv.ai_managed ? 'resolved' : 'pending',
      channel: (conv.channel_type || 'whatsapp') as ChannelType,
      ai_managed: conv.ai_managed ?? true,
      tags: conv.tags || [],
      is_pinned: (conv as any).is_pinned ?? false,
      folder_id: (conv as any).folder_id ?? null,
      is_group: (conv as any).is_group ?? false,
    }));
  }, [conversations]);

  // Calculate counts for each filter and channel
  const counts = useMemo(() => ({
    total: transformedConversations.length,
    pending: transformedConversations.filter(c => c.status === 'pending' || c.status === 'active').length,
    resolved: transformedConversations.filter(c => c.status === 'resolved').length,
    whatsapp: transformedConversations.filter(c => c.channel === 'whatsapp').length,
    instagram: transformedConversations.filter(c => c.channel === 'instagram').length,
    messenger: transformedConversations.filter(c => c.channel === 'messenger').length,
  }), [transformedConversations]);

  // Filter conversations based on active filter, tag, and quick filter
  const filteredConversations = useMemo(() => {
    let result = transformedConversations;

    switch (activeFilter) {
      case 'needs-help':
        result = result.filter(c => c.status === 'pending' || c.status === 'active');
        break;
      case 'ai-managed':
        result = result.filter(c => c.status === 'resolved');
        break;
    }

    // Filter by tag if selected
    if (activeTagId) {
      result = result.filter(c => c.tags?.some(t => t.id === activeTagId));
    }

    // Filter by folder: if a folder is selected show only its chats,
    // otherwise hide chats that have been moved to any folder
    if (activeFolderId) {
      result = result.filter(c => c.folder_id === activeFolderId);
    } else {
      result = result.filter(c => !c.folder_id);
    }

    // Quick filters: unread / groups
    if (quickFilter === 'unread') {
      result = result.filter(c => c.unread > 0);
    } else if (quickFilter === 'groups') {
      result = result.filter(c => c.is_group === true);
    }

    return result;
  }, [activeFilter, activeTagId, activeFolderId, quickFilter, transformedConversations]);

  // Transform messages to UI format with reply info
  const transformedMessages = useMemo(() => {
    type MediaType = 'image' | 'audio' | 'document' | 'video' | 'sticker' | undefined;

    return messages.map(msg => {
      // Find replied message content if exists
      let replyToContent: string | undefined;
      let replyToMediaUrl: string | undefined;
      let replyToMediaType: string | undefined;
      if (msg.reply_to_message_id) {
        const repliedMsg = messages.find(m => m.id === msg.reply_to_message_id);
        replyToContent = repliedMsg?.content || undefined;
        replyToMediaUrl = repliedMsg?.media_url || undefined;
        replyToMediaType = repliedMsg?.message_type || undefined;
      }
      
      // Map message_type to mediaType
      const mediaTypeMap: Record<string, 'image' | 'audio' | 'document' | 'video' | 'sticker' | undefined> = {
        'image': 'image',
        'audio': 'audio',
        'document': 'document',
        'video': 'video',
        'sticker': 'sticker',
      };
      
      // Parse metadata safely - keep all fields for media retry logic
      const metadata = (typeof msg.metadata === 'object' && msg.metadata !== null)
        ? (msg.metadata as Record<string, unknown>)
        : undefined;

      const inferMediaTypeFromMime = (mime?: string | null): MediaType => {
        if (!mime) return undefined;
        if (mime.startsWith('image/')) return 'image';
        if (mime.startsWith('audio/')) return 'audio';
        if (mime.startsWith('video/')) return 'video';
        return 'document';
      };

      const inferMediaTypeFromMetadata = (m?: Record<string, unknown>): MediaType => {
        if (!m) return undefined;
        if (m.image || (m.original_message as any)?.image) return 'image';
        if (m.audio || (m.original_message as any)?.audio) return 'audio';
        if (m.video || (m.original_message as any)?.video) return 'video';
        if (m.sticker || (m.original_message as any)?.sticker) return 'sticker';
        if (m.document || (m.original_message as any)?.document) return 'document';
        return undefined;
      };

      const inferredMediaType = mediaTypeMap[msg.message_type || '']
        || inferMediaTypeFromMime(msg.media_mime_type)
        || inferMediaTypeFromMetadata(metadata);

      const normalizedContent = (() => {
        const c = (msg.content || '').trim();
        // If the DB stored placeholders like "[Imagen]" for media-only messages, don't render them as text.
        if (!inferredMediaType) return c;
        if (/^\[(imagen|image|audio|video|sticker|documento|document)\]$/i.test(c)) return '';
        return c;
      })();
      
      return {
        id: msg.id,
        role: (msg.sender_type === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: normalizedContent,
        timestamp: msg.sent_at ? new Date(msg.sent_at) : new Date(),
        mediaUrl: msg.media_url || undefined,
        mediaType: inferredMediaType,
        mediaMimeType: msg.media_mime_type || undefined,
        replyToMessageId: msg.reply_to_message_id || undefined,
        replyToContent,
        replyToMediaUrl,
        replyToMediaType,
        metadata,
      };
    });
  }, [messages]);

  const currentConversation = transformedConversations.find(c => c.id === selectedConversation);

  // Mark as read when selecting a conversation
  useEffect(() => {
    if (selectedConversation) {
      markAsRead(selectedConversation);
    }
  }, [selectedConversation, markAsRead]);

  // Handle selecting a conversation (show thread on mobile)
  const handleSelectConversation = (id: string) => {
    setSelectedConversation(id);
    setMobileShowThread(true);
  };

  // Handle going back to list on mobile
  const handleMobileBack = () => {
    setMobileShowThread(false);
  };

  const handleNavigate = (section: 'config' | 'catalog' | 'train' | 'knowledge' | 'campaigns' | 'stats' | 'tags') => {
    setActiveView(section);
  };

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setActiveTagId(null); // Clear tag filter when changing main filter
    setActiveView('conversations');
    setSelectedConversation(null);
  };

  const handleChannelChange = (channel: ChannelType | 'all') => {
    setActiveChannel(channel === activeChannel ? 'all' : channel);
    setActiveView('conversations');
    setSelectedConversation(null);
  };

  const handleTagChange = (tagId: string | null) => {
    setActiveTagId(tagId);
    setActiveView('conversations');
    setSelectedConversation(null);
  };

  const handleFolderChange = (folderId: string | null) => {
    setActiveFolderId(folderId);
    setActiveView('conversations');
    setSelectedConversation(null);
  };

  const handleSendMessage = (message: string, mediaFile?: File, mediaType?: string, replyToMessageId?: string) => {
    sendMessage({ message, mediaFile, mediaType, replyToMessageId });
  };

  const handleCreateConversation = async (phone: string, name: string, message: string, useTemplate?: boolean) => {
    try {
      const result = await createConversation({ phone, name, message, useTemplate });
      setShowNewConversation(false);
      if (result?.conversationId) {
        // Pre-poblar el cache de mensajes con el mensaje enviado
        // ANTES de seleccionar la conversación, para que useQuery lo use como initialData
        const optimisticMessage = {
          id: `temp-${Date.now()}`,
          conversation_id: result.conversationId,
          external_message_id: result.message_id || null,
          channel_type: 'whatsapp',
          direction: 'outbound',
          sender_type: 'agent',
          content: message,
          message_type: useTemplate ? 'template' : 'text',
          media_url: null,
          media_mime_type: null,
          reply_to_message_id: null,
          metadata: useTemplate ? { template_name: 'saludo_inicial', template_language: 'es_CO' } : null,
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };

        // Insertar en cache Y configurar como no-stale para que useQuery no lo sobreescriba inmediatamente
        queryClient.setQueryData(
          ['messaging-messages', result.conversationId],
          [optimisticMessage]
        );

        // Seleccionar la conversación (esto activa useQuery, pero el cache ya tiene datos)
        setSelectedConversation(result.conversationId);

        // Refetch real después de 2s para obtener el registro real de la DB
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: ['messaging-messages', result.conversationId],
            refetchType: 'all'
          });
        }, 2000);
      }
    } catch (error) {
      // Error is handled in the hook
    }
  };

  // Shared sidebar props
  const sidebarProps = {
    activeFilter,
    activeChannel,
    activeTagId,
    activeFolderId,
    onFilterChange: handleFilterChange,
    onChannelChange: handleChannelChange,
    onTagChange: handleTagChange,
    onFolderChange: handleFolderChange,
    onNavigate: handleNavigate,
    counts,
    tags,
    tagCounts,
    folders,
    folderCounts,
    onCreateFolder: createFolder,
    isCreatingFolder,
    onDeleteFolder: deleteFolder,
    collapsed: sidebarCollapsed,
    onToggleCollapse: () => setSidebarCollapsed(!sidebarCollapsed),
  };

  // Conversations list content (shared between mobile & desktop)
  const renderConversationsList = () => (
    <>
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-lg">
          {activeFilter === 'inbox' && 'Todos los chats'}
          {activeFilter === 'needs-help' && 'Necesita ayuda'}
          {activeFilter === 'ai-managed' && 'IA gestionada'}
          {activeChannel !== 'all' && ` - ${activeChannel === 'whatsapp' ? 'WhatsApp' : activeChannel === 'instagram' ? 'Instagram' : 'Messenger'}`}
        </CardTitle>
        <CardDescription>
          {isLoadingConversations ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando...
            </span>
          ) : hasSearchTerm ? (
            `${searchResults.length} resultado${searchResults.length !== 1 ? 's' : ''} encontrado${searchResults.length !== 1 ? 's' : ''}`
          ) : (
            `${filteredConversations.filter(c => c.unread > 0).length} conversaciones sin leer`
          )}
        </CardDescription>

        {/* Search bar */}
        <MessagingSearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          onClear={clearSearch}
          isSearching={isSearching}
          className="mt-2"
        />

        {/* Quick filter chips */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setQuickFilter('all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              quickFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setQuickFilter(quickFilter === 'unread' ? 'all' : 'unread')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              quickFilter === 'unread'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Mail className="h-3 w-3" />
            No leídos
            {transformedConversations.filter(c => c.unread > 0).length > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                quickFilter === 'unread'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-primary/10 text-primary'
              }`}>
                {transformedConversations.filter(c => c.unread > 0).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setQuickFilter(quickFilter === 'groups' ? 'all' : 'groups')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              quickFilter === 'groups'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Users className="h-3 w-3" />
            Grupos
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-hidden">
        {isLoadingConversations && !hasSearchTerm ? (
          <div className="flex items-center justify-center h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : hasSearchTerm ? (
          <SearchResultsList
            results={searchResults}
            selectedId={selectedConversation}
            onSelect={handleSelectConversation}
            searchTerm={searchTerm}
          />
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
            <MessageSquareMore className="h-12 w-12 mb-4 opacity-50" />
            <p>No hay conversaciones</p>
            <p className="text-sm text-center px-4">Los mensajes entrantes aparecerán aquí</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowNewConversation(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Iniciar nuevo chat
            </Button>
          </div>
        ) : (
          <ConversationsList
            conversations={filteredConversations}
            selectedId={selectedConversation}
            onSelect={handleSelectConversation}
            onDelete={(id) => {
              deleteConversation(id);
              if (selectedConversation === id) {
                setSelectedConversation(null);
                setMobileShowThread(false);
              }
            }}
            isDeleting={isDeletingConversation}
            onMarkAsUnread={markAsUnread}
            onMarkAsRead={markAsRead}
            onTogglePin={(id, isPinned) => togglePin({ conversationId: id, isPinned })}
            onMoveToFolder={(id, folderId) => moveToFolder({ conversationId: id, folderId })}
            folders={folders}
            onCreateFolder={() => setShowCreateFolderFromChat(true)}
          />
        )}
      </CardContent>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden lg:flex">
        <MessagingSidebar {...sidebarProps} />
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 w-[280px] bg-slate-900 border-slate-700">
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <MessagingSidebar
            {...sidebarProps}
            collapsed={false}
            onToggleCollapse={() => setMobileSidebarOpen(false)}
            onFilterChange={(filter) => {
              handleFilterChange(filter);
              setMobileSidebarOpen(false);
            }}
            onChannelChange={(channel) => {
              handleChannelChange(channel);
              setMobileSidebarOpen(false);
            }}
            onNavigate={(section) => {
              handleNavigate(section);
              setMobileSidebarOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - hidden on mobile for conversations view (Telegram-style) */}
        <div className={cn(
          "flex items-center justify-between p-3 lg:p-6 border-b bg-background",
          activeView === 'conversations' && "hidden lg:flex"
        )}>
          <div className="flex items-center gap-2 lg:gap-3">
            {/* Mobile hamburger menu */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden lg:block p-2 rounded-lg bg-indigo-100">
              <MessageSquareMore className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg lg:text-2xl font-bold text-foreground">Mensajería IA</h1>
              <p className="text-xs lg:text-sm text-muted-foreground hidden sm:block">
                Gestiona conversaciones de WhatsApp, Instagram y Messenger con IA
              </p>
            </div>
          </div>

          {activeView === 'conversations' && (
            <Button
              onClick={() => setShowNewConversation(true)}
              className="bg-emerald-500 hover:bg-emerald-600"
              size="sm"
            >
              <Plus className="h-4 w-4 lg:mr-2" />
              <span className="hidden lg:inline">Nuevo chat</span>
            </Button>
          )}
        </div>

        {/* Non-conversations views: show mobile header */}
        {activeView !== 'conversations' && (
          <div className="flex items-center justify-between p-3 border-b bg-background lg:hidden">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-bold text-foreground">Mensajería IA</h1>
            </div>
          </div>
        )}

        {/* Connection status banner */}
        {activeView === 'conversations' && currentOrganization?.id && (
          <RealtimeConnectionBanner status={connectionStatus} onReconnect={manualRefresh} />
        )}

        {/* Content area */}
        <div className="flex-1 overflow-hidden lg:overflow-auto lg:p-6 lg:space-y-6">
          {activeView === 'conversations' && (
            <>
              {/* === MOBILE LAYOUT === */}
              <div className="lg:hidden flex flex-col h-full">
                {/* Mobile: Show list OR thread - full screen like Telegram */}
                {!mobileShowThread ? (
                  /* Mobile Conversation List - full screen, no card wrapper */
                  <div className="flex flex-col h-full overflow-hidden">
                    {/* Mobile-specific header bar */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-1 bg-background safe-area-top">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setMobileSidebarOpen(true)}
                          className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted transition-colors"
                        >
                          <Menu className="h-5 w-5" />
                        </button>
                        <h1 className="text-xl font-bold text-foreground">
                          {activeFilter === 'inbox' && 'Chats'}
                          {activeFilter === 'needs-help' && 'Necesita ayuda'}
                          {activeFilter === 'ai-managed' && 'IA gestionada'}
                          {activeChannel !== 'all' && ` · ${activeChannel === 'whatsapp' ? 'WhatsApp' : activeChannel === 'instagram' ? 'Instagram' : 'Messenger'}`}
                        </h1>
                      </div>
                      <button
                        onClick={() => setShowNewConversation(true)}
                        className="p-2 rounded-full bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 transition-colors"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Search bar */}
                    <div className="px-4 pt-2 pb-1">
                      <MessagingSearchBar
                        value={searchTerm}
                        onChange={setSearchTerm}
                        onClear={clearSearch}
                        isSearching={isSearching}
                      />
                    </div>

                    {/* Quick filter chips */}
                    <div className="flex gap-2 px-4 py-2">
                      <button
                        onClick={() => setQuickFilter('all')}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                          quickFilter === 'all'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                      >
                        Todos
                      </button>
                      <button
                        onClick={() => setQuickFilter(quickFilter === 'unread' ? 'all' : 'unread')}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                          quickFilter === 'unread'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                      >
                        <Mail className="h-3 w-3" />
                        No leídos
                        {transformedConversations.filter(c => c.unread > 0).length > 0 && (
                          <span className={cn("ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                            quickFilter === 'unread'
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-primary/10 text-primary'
                          )}>
                            {transformedConversations.filter(c => c.unread > 0).length}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setQuickFilter(quickFilter === 'groups' ? 'all' : 'groups')}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                          quickFilter === 'groups'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                      >
                        <Users className="h-3 w-3" />
                        Grupos
                      </button>
                    </div>

                    {/* Conversation list - fills remaining space */}
                    <div className="flex-1 overflow-hidden">
                      {isLoadingConversations && !hasSearchTerm ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : hasSearchTerm ? (
                        <SearchResultsList
                          results={searchResults}
                          selectedId={selectedConversation}
                          onSelect={handleSelectConversation}
                          searchTerm={searchTerm}
                        />
                      ) : filteredConversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                          <MessageSquareMore className="h-12 w-12 mb-4 opacity-50" />
                          <p>No hay conversaciones</p>
                          <p className="text-sm text-center px-4">Los mensajes entrantes aparecerán aquí</p>
                          <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => setShowNewConversation(true)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Iniciar nuevo chat
                          </Button>
                        </div>
                      ) : (
                        <ConversationsList
                          conversations={filteredConversations}
                          selectedId={selectedConversation}
                          onSelect={handleSelectConversation}
                          onDelete={(id) => {
                            deleteConversation(id);
                            if (selectedConversation === id) {
                              setSelectedConversation(null);
                              setMobileShowThread(false);
                            }
                          }}
                          isDeleting={isDeletingConversation}
                          onMarkAsUnread={markAsUnread}
                          onMarkAsRead={markAsRead}
                          onTogglePin={(id, isPinned) => togglePin({ conversationId: id, isPinned })}
                          onMoveToFolder={(id, folderId) => moveToFolder({ conversationId: id, folderId })}
                          folders={folders}
                          onCreateFolder={() => setShowCreateFolderFromChat(true)}
                          isMobile
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  /* Mobile Conversation Thread - full screen */
                  <div className="flex flex-col h-full overflow-hidden">
                    <ConversationThread
                      conversation={currentConversation}
                      messages={transformedMessages}
                      onSendMessage={handleSendMessage}
                      isSending={isSending}
                      isLoading={isLoadingMessages}
                      onToggleAiManaged={(aiManaged) => {
                        if (selectedConversation) {
                          toggleAiManaged({ conversationId: selectedConversation, aiManaged });
                        }
                      }}
                      isTogglingAiManaged={isTogglingAiManaged}
                      onBack={handleMobileBack}
                    />
                  </div>
                )}
              </div>

              {/* === DESKTOP LAYOUT === */}
              <div className="hidden lg:grid grid-cols-3 gap-4 min-h-[500px] h-[calc(100vh-220px)]">
                {/* Conversations List */}
                <Card className="col-span-1 overflow-hidden flex flex-col">
                  {renderConversationsList()}
                </Card>

                {/* Conversation Thread */}
                <Card className="col-span-2 overflow-hidden flex flex-col">
                  <ConversationThread
                    conversation={currentConversation}
                    messages={transformedMessages}
                    onSendMessage={handleSendMessage}
                    isSending={isSending}
                    isLoading={isLoadingMessages}
                    onToggleAiManaged={(aiManaged) => {
                      if (selectedConversation) {
                        toggleAiManaged({ conversationId: selectedConversation, aiManaged });
                      }
                    }}
                    isTogglingAiManaged={isTogglingAiManaged}
                  />
                </Card>
              </div>
            </>
          )}

          {activeView === 'config' && <div className="p-4 lg:p-0"><AIConfigPanel /></div>}
          {activeView === 'catalog' && <div className="p-4 lg:p-0"><ProductCatalogConnection /></div>}

          {activeView === 'train' && <div className="p-4 lg:p-0"><AITrainingPanel /></div>}

          {activeView === 'knowledge' && <div className="p-4 lg:p-0"><KnowledgeBaseEditor /></div>}

          {activeView === 'campaigns' && (
            <div className="p-4 lg:p-0">
              <Tabs defaultValue="cod" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="cod">Confirmaciones COD</TabsTrigger>
                  <TabsTrigger value="express">Express</TabsTrigger>
                </TabsList>
                <TabsContent value="cod"><OrderConfirmationPanel /></TabsContent>
                <TabsContent value="express"><ExpressNotificationPanel /></TabsContent>
              </Tabs>
            </div>
          )}

          {activeView === 'stats' && <div className="p-4 lg:p-0"><MessagingStats /></div>}

          {activeView === 'tags' && <div className="p-4 lg:p-0"><TagsSettingsPanel /></div>}
        </div>
      </div>

      {/* New Conversation Modal */}
      <NewConversationModal
        open={showNewConversation}
        onOpenChange={setShowNewConversation}
        onCreateConversation={handleCreateConversation}
        isLoading={isCreatingConversation}
      />

      {/* Folder Create Dialog (from chat context menu) */}
      <FolderCreateDialog
        open={showCreateFolderFromChat}
        onOpenChange={setShowCreateFolderFromChat}
        onCreate={createFolder}
        isLoading={isCreatingFolder}
      />
    </div>
  );
};

export default MessagingAIPage;
