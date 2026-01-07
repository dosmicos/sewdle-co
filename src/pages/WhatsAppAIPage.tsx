import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Settings, Package, Bot } from 'lucide-react';
import { ConversationsList } from '@/components/whatsapp-ai/ConversationsList';
import { ConversationThread } from '@/components/whatsapp-ai/ConversationThread';
import { AIConfigPanel } from '@/components/whatsapp-ai/AIConfigPanel';
import { ProductCatalogConnection } from '@/components/whatsapp-ai/ProductCatalogConnection';
import { WhatsAppStats } from '@/components/whatsapp-ai/WhatsAppStats';

// Mock data for conversations
const mockConversations = [
  { 
    id: '1', 
    phone: '+57 300 123 4567', 
    name: 'María García', 
    lastMessage: '¿Tienen ruanas disponibles?', 
    unread: 2,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 5), // 5 min ago
    status: 'active' as const
  },
  { 
    id: '2', 
    phone: '+57 311 456 7890', 
    name: 'Carlos López', 
    lastMessage: '¿Cuál es el precio de la ruana azul?', 
    unread: 0,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
    status: 'resolved' as const
  },
  { 
    id: '3', 
    phone: '+57 320 789 0123', 
    name: 'Ana Martínez', 
    lastMessage: 'Gracias por la información', 
    unread: 0,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    status: 'resolved' as const
  },
  { 
    id: '4', 
    phone: '+57 315 234 5678', 
    name: 'Pedro Sánchez', 
    lastMessage: '¿Hacen envíos a Bogotá?', 
    unread: 1,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 15), // 15 min ago
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
};

const WhatsAppAIPage = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>('1');
  const [activeTab, setActiveTab] = useState('conversations');

  const currentMessages = selectedConversation ? mockMessages[selectedConversation] || [] : [];
  const currentConversation = mockConversations.find(c => c.id === selectedConversation);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100">
            <Bot className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1f2937' }}>WhatsApp IA</h1>
            <p className="text-sm" style={{ color: '#6b7280' }}>
              Gestiona respuestas automáticas inteligentes para tus clientes
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <WhatsAppStats />

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="conversations" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversaciones
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuración
          </TabsTrigger>
          <TabsTrigger value="catalog" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Catálogo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
            {/* Conversations List */}
            <Card className="lg:col-span-1 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Chats</CardTitle>
                <CardDescription>
                  {mockConversations.filter(c => c.unread > 0).length} conversaciones sin leer
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ConversationsList 
                  conversations={mockConversations}
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
        </TabsContent>

        <TabsContent value="config">
          <AIConfigPanel />
        </TabsContent>

        <TabsContent value="catalog">
          <ProductCatalogConnection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WhatsAppAIPage;
