import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot } from 'lucide-react';
import { ConversationsList } from '@/components/whatsapp-ai/ConversationsList';
import { ConversationThread } from '@/components/whatsapp-ai/ConversationThread';
import { AIConfigPanel } from '@/components/whatsapp-ai/AIConfigPanel';
import { ProductCatalogConnection } from '@/components/whatsapp-ai/ProductCatalogConnection';
import { WhatsAppStats } from '@/components/whatsapp-ai/WhatsAppStats';
import { WhatsAppSidebar } from '@/components/whatsapp-ai/WhatsAppSidebar';

type FilterType = 'inbox' | 'needs-help' | 'ai-managed';
type ViewType = 'conversations' | 'config' | 'catalog' | 'train' | 'knowledge' | 'campaigns' | 'stats';

// Mock data for conversations with varied statuses
const mockConversations = [
  { 
    id: '1', 
    phone: '+57 300 123 4567', 
    name: 'María García', 
    lastMessage: '¿Tienen ruanas disponibles?', 
    unread: 2,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 5),
    status: 'active' as const
  },
  { 
    id: '2', 
    phone: '+57 311 456 7890', 
    name: 'Carlos López', 
    lastMessage: '¿Cuál es el precio de la ruana azul?', 
    unread: 0,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 30),
    status: 'resolved' as const
  },
  { 
    id: '3', 
    phone: '+57 320 789 0123', 
    name: 'Ana Martínez', 
    lastMessage: 'Gracias por la información', 
    unread: 0,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2),
    status: 'resolved' as const
  },
  { 
    id: '4', 
    phone: '+57 315 234 5678', 
    name: 'Pedro Sánchez', 
    lastMessage: '¿Hacen envíos a Bogotá?', 
    unread: 1,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 15),
    status: 'pending' as const
  },
  { 
    id: '5', 
    phone: '+57 318 111 2222', 
    name: 'Laura Gómez', 
    lastMessage: 'No entendí bien el proceso de pago', 
    unread: 3,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 8),
    status: 'pending' as const
  },
  { 
    id: '6', 
    phone: '+57 319 333 4444', 
    name: 'Diego Fernández', 
    lastMessage: 'Perfecto, gracias por todo', 
    unread: 0,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 4),
    status: 'resolved' as const
  },
  { 
    id: '7', 
    phone: '+57 320 555 6666', 
    name: 'Sofía Rodríguez', 
    lastMessage: '¿Tienen servicio de personalización?', 
    unread: 1,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 25),
    status: 'pending' as const
  },
];

const mockMessages: Record<string, Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>> = {
  '1': [
    { role: 'user', content: '¡Hola! ¿Tienen ruanas disponibles?', timestamp: new Date(Date.now() - 1000 * 60 * 10) },
    { role: 'assistant', content: '¡Hola María! 👋 Sí, tenemos varias ruanas disponibles. Contamos con ruanas en lana de oveja en colores azul, rojo, verde y beige. ¿Algún color en particular te interesa?', timestamp: new Date(Date.now() - 1000 * 60 * 9) },
    { role: 'user', content: '¿Tienen en talla M azul?', timestamp: new Date(Date.now() - 1000 * 60 * 5) },
  ],
  '2': [
    { role: 'user', content: 'Buenos días, ¿cuánto cuesta una ruana?', timestamp: new Date(Date.now() - 1000 * 60 * 60) },
    { role: 'assistant', content: '¡Buenos días Carlos! 🌞 Nuestras ruanas tienen diferentes precios según el material:\n\n• Ruana lana de oveja: $180.000\n• Ruana alpaca: $250.000\n• Ruana sintética: $95.000\n\n¿Cuál te interesa?', timestamp: new Date(Date.now() - 1000 * 60 * 55) },
    { role: 'user', content: '¿Cuál es el precio de la ruana azul?', timestamp: new Date(Date.now() - 1000 * 60 * 30) },
    { role: 'assistant', content: 'La ruana azul en lana de oveja está a $180.000 COP. Tenemos disponible en tallas S, M, L y XL. ¿Te gustaría que te reserve alguna?', timestamp: new Date(Date.now() - 1000 * 60 * 28) },
  ],
  '3': [
    { role: 'user', content: '¿Tienen catálogo de productos?', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3) },
    { role: 'assistant', content: '¡Claro que sí! 📚 Te comparto el enlace a nuestro catálogo: www.tienda.com/catalogo\n\nTambién puedes preguntarme directamente por cualquier producto y te doy información al instante.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2.5) },
    { role: 'user', content: 'Gracias por la información', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) },
    { role: 'assistant', content: '¡Con mucho gusto! Si tienes alguna otra pregunta, aquí estaré para ayudarte. 😊', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) },
  ],
  '4': [
    { role: 'user', content: '¿Hacen envíos a Bogotá?', timestamp: new Date(Date.now() - 1000 * 60 * 15) },
  ],
  '5': [
    { role: 'user', content: 'Hola, quiero comprar una ruana', timestamp: new Date(Date.now() - 1000 * 60 * 20) },
    { role: 'assistant', content: '¡Hola Laura! Con gusto te ayudo. ¿Qué tipo de ruana te interesa?', timestamp: new Date(Date.now() - 1000 * 60 * 18) },
    { role: 'user', content: 'Una de lana, pero no entendí bien el proceso de pago', timestamp: new Date(Date.now() - 1000 * 60 * 8) },
  ],
  '6': [
    { role: 'user', content: '¿Ya fue enviado mi pedido?', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5) },
    { role: 'assistant', content: '¡Hola Diego! Sí, tu pedido #2847 fue enviado ayer. El número de seguimiento es: CO789456123. Puedes rastrearlo en la página de Servientrega.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4.5) },
    { role: 'user', content: 'Perfecto, gracias por todo', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4) },
    { role: 'assistant', content: '¡Con gusto! Cualquier otra consulta, aquí estamos. 🙌', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4) },
  ],
  '7': [
    { role: 'user', content: '¿Tienen servicio de personalización?', timestamp: new Date(Date.now() - 1000 * 60 * 25) },
  ],
};

const WhatsAppAIPage = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>('1');
  const [activeFilter, setActiveFilter] = useState<FilterType>('inbox');
  const [activeView, setActiveView] = useState<ViewType>('conversations');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Calculate counts for each filter
  const counts = useMemo(() => ({
    total: mockConversations.length,
    pending: mockConversations.filter(c => c.status === 'pending' || c.status === 'active').length,
    resolved: mockConversations.filter(c => c.status === 'resolved').length,
  }), []);

  // Filter conversations based on active filter
  const filteredConversations = useMemo(() => {
    switch (activeFilter) {
      case 'inbox':
        return mockConversations;
      case 'needs-help':
        return mockConversations.filter(c => c.status === 'pending' || c.status === 'active');
      case 'ai-managed':
        return mockConversations.filter(c => c.status === 'resolved');
      default:
        return mockConversations;
    }
  }, [activeFilter]);

  const currentMessages = selectedConversation ? mockMessages[selectedConversation] || [] : [];
  const currentConversation = mockConversations.find(c => c.id === selectedConversation);

  const handleNavigate = (section: 'config' | 'catalog' | 'train' | 'knowledge' | 'campaigns' | 'stats') => {
    setActiveView(section);
  };

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setActiveView('conversations');
    setSelectedConversation(null);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <WhatsAppSidebar
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        onNavigate={handleNavigate}
        counts={counts}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b bg-background">
          <div className="p-2 rounded-lg bg-green-100">
            <Bot className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">WhatsApp IA</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona respuestas automáticas inteligentes para tus clientes
            </p>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {activeView === 'conversations' && (
            <>
              {/* Conversations grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
                {/* Conversations List */}
                <Card className="lg:col-span-1 overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">
                      {activeFilter === 'inbox' && 'Todos los chats'}
                      {activeFilter === 'needs-help' && 'Necesita ayuda'}
                      {activeFilter === 'ai-managed' && 'IA gestionada'}
                    </CardTitle>
                    <CardDescription>
                      {filteredConversations.filter(c => c.unread > 0).length} conversaciones sin leer
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ConversationsList 
                      conversations={filteredConversations}
                      selectedId={selectedConversation}
                      onSelect={setSelectedConversation}
                    />
                  </CardContent>
                </Card>

                {/* Conversation Thread */}
                <Card className="lg:col-span-2 overflow-hidden flex flex-col">
                  <ConversationThread 
                    conversation={currentConversation}
                    messages={currentMessages}
                  />
                </Card>
              </div>
            </>
          )}

          {activeView === 'config' && <AIConfigPanel />}
          {activeView === 'catalog' && <ProductCatalogConnection />}
          
          {activeView === 'train' && (
            <Card>
              <CardHeader>
                <CardTitle>Entrenar IA</CardTitle>
                <CardDescription>Agrega conocimiento y prueba el funcionamiento de tu asistente</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Próximamente: Herramientas de entrenamiento y chat de prueba</p>
              </CardContent>
            </Card>
          )}
          
          {activeView === 'knowledge' && (
            <Card>
              <CardHeader>
                <CardTitle>Conocimiento</CardTitle>
                <CardDescription>Gestiona la información que conoce tu IA</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Próximamente: Editor de base de conocimiento</p>
              </CardContent>
            </Card>
          )}
          
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
          
          {activeView === 'stats' && <WhatsAppStats />}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppAIPage;
