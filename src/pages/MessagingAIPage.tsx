import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquareMore, Loader2, Plus } from 'lucide-react';
import { ConversationsList, Conversation, ChannelType } from '@/components/messaging-ai/ConversationsList';
import { ConversationThread } from '@/components/messaging-ai/ConversationThread';
import { NewConversationModal } from '@/components/messaging-ai/NewConversationModal';
import { AIConfigPanel } from '@/components/messaging-ai/AIConfigPanel';
import { ProductCatalogConnection } from '@/components/whatsapp-ai/ProductCatalogConnection';
import { MessagingStats } from '@/components/messaging-ai/MessagingStats';
import { MessagingSidebar } from '@/components/messaging-ai/MessagingSidebar';
import { KnowledgeBaseEditor } from '@/components/messaging-ai/KnowledgeBaseEditor';
import { AITrainingPanel } from '@/components/messaging-ai/AITrainingPanel';
import { useMessagingConversations } from '@/hooks/useMessagingConversations';
import { useMessagingMessages } from '@/hooks/useMessagingMessages';

type FilterType = 'inbox' | 'needs-help' | 'ai-managed';
type ViewType = 'conversations' | 'config' | 'catalog' | 'train' | 'knowledge' | 'campaigns' | 'stats';

const MessagingAIPage = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('inbox');
  const [activeChannel, setActiveChannel] = useState<ChannelType | 'all'>('all');
  const [activeView, setActiveView] = useState<ViewType>('conversations');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);

  const { 
    conversations, 
    isLoading: isLoadingConversations, 
    markAsRead,
    createConversation,
    isCreatingConversation,
    deleteConversation,
    isDeletingConversation
  } = useMessagingConversations(activeChannel);
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

  // Filter conversations based on active filter
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
    
    return result;
  }, [activeFilter, transformedConversations]);

  // Transform messages to UI format
  const transformedMessages = useMemo(() => {
    return messages.map(msg => ({
      role: (msg.sender_type === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.content || '',
      timestamp: msg.sent_at ? new Date(msg.sent_at) : new Date(),
    }));
  }, [messages]);

  const currentConversation = transformedConversations.find(c => c.id === selectedConversation);

  // Mark as read when selecting a conversation
  useEffect(() => {
    if (selectedConversation) {
      markAsRead(selectedConversation);
    }
  }, [selectedConversation, markAsRead]);

  const handleNavigate = (section: 'config' | 'catalog' | 'train' | 'knowledge' | 'campaigns' | 'stats') => {
    setActiveView(section);
  };

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setActiveView('conversations');
    setSelectedConversation(null);
  };

  const handleChannelChange = (channel: ChannelType | 'all') => {
    setActiveChannel(channel === activeChannel ? 'all' : channel);
    setActiveView('conversations');
    setSelectedConversation(null);
  };

  const handleSendMessage = (message: string) => {
    sendMessage({ message });
  };

  const handleCreateConversation = async (phone: string, name: string, message: string) => {
    try {
      const result = await createConversation({ phone, name, message });
      setShowNewConversation(false);
      if (result?.conversationId) {
        setSelectedConversation(result.conversationId);
      }
    } catch (error) {
      // Error is handled in the hook
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <MessagingSidebar
        activeFilter={activeFilter}
        activeChannel={activeChannel}
        onFilterChange={handleFilterChange}
        onChannelChange={handleChannelChange}
        onNavigate={handleNavigate}
        counts={counts}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-background">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100">
              <MessageSquareMore className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Mensajería IA</h1>
              <p className="text-sm text-muted-foreground">
                Gestiona conversaciones de WhatsApp, Instagram y Messenger con IA
              </p>
            </div>
          </div>
          
          {activeView === 'conversations' && (
            <Button 
              onClick={() => setShowNewConversation(true)}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo chat
            </Button>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {activeView === 'conversations' && (
            <>
              {/* Conversations grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[500px] h-[calc(100vh-220px)]">
                {/* Conversations List */}
                <Card className="lg:col-span-1 overflow-hidden">
                  <CardHeader className="pb-2">
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
                      ) : (
                        `${filteredConversations.filter(c => c.unread > 0).length} conversaciones sin leer`
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoadingConversations ? (
                      <div className="flex items-center justify-center h-[400px]">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
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
                        onSelect={setSelectedConversation}
                        onDelete={(id) => {
                          deleteConversation(id);
                          if (selectedConversation === id) {
                            setSelectedConversation(null);
                          }
                        }}
                        isDeleting={isDeletingConversation}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Conversation Thread */}
                <Card className="lg:col-span-2 overflow-hidden flex flex-col">
                  <ConversationThread 
                    conversation={currentConversation}
                    messages={transformedMessages}
                    onSendMessage={handleSendMessage}
                    isSending={isSending}
                    isLoading={isLoadingMessages}
                  />
                </Card>
              </div>
            </>
          )}

          {activeView === 'config' && <AIConfigPanel />}
          {activeView === 'catalog' && <ProductCatalogConnection />}
          
          {activeView === 'train' && <AITrainingPanel />}
          
          {activeView === 'knowledge' && <KnowledgeBaseEditor />}
          
          {activeView === 'campaigns' && (
            <Card>
              <CardHeader>
                <CardTitle>Campañas</CardTitle>
                <CardDescription>Gestiona tus campañas de mensajes</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Próximamente: Herramientas de campañas</p>
              </CardContent>
            </Card>
          )}
          
          {activeView === 'stats' && <MessagingStats />}
        </div>
      </div>

      {/* New Conversation Modal */}
      <NewConversationModal
        open={showNewConversation}
        onOpenChange={setShowNewConversation}
        onCreateConversation={handleCreateConversation}
        isLoading={isCreatingConversation}
      />
    </div>
  );
};

export default MessagingAIPage;
