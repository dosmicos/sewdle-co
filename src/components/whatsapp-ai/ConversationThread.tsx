import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, Phone, Sparkles, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  phone: string;
  name: string;
  status: 'active' | 'pending' | 'resolved';
}

interface ConversationThreadProps {
  conversation?: Conversation;
  messages: Message[];
}

export const ConversationThread = ({ conversation, messages }: ConversationThreadProps) => {
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerateResponse = () => {
    setIsGenerating(true);
    // Simular generación de respuesta IA
    setTimeout(() => {
      setIsGenerating(false);
      toast.success('Respuesta generada por IA');
    }, 1500);
  };

  const handleCopyMessage = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    toast.success('Mensaje copiado');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: '#9ca3af' }}>
        <div className="text-center">
          <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Selecciona una conversación para ver los mensajes</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <CardHeader className="border-b" style={{ borderColor: '#e5e7eb' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <User className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-base">{conversation.name}</CardTitle>
              <p className="text-sm" style={{ color: '#6b7280' }}>{conversation.phone}</p>
            </div>
          </div>
          <Badge 
            variant={conversation.status === 'active' ? 'default' : 'secondary'}
            className={conversation.status === 'active' ? 'bg-green-500' : ''}
          >
            {conversation.status === 'active' ? 'Activo' : conversation.status === 'pending' ? 'Pendiente' : 'Resuelto'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 flex flex-col">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 relative group ${
                    message.role === 'user'
                      ? 'bg-gray-100'
                      : 'bg-green-500 text-white'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.role === 'assistant' && (
                      <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p 
                        className={`text-xs mt-1 ${
                          message.role === 'user' ? 'text-gray-400' : 'text-green-100'
                        }`}
                      >
                        {format(message.timestamp, 'HH:mm', { locale: es })}
                      </p>
                    </div>
                  </div>
                  
                  {/* Copy button for assistant messages */}
                  {message.role === 'assistant' && (
                    <button
                      onClick={() => handleCopyMessage(message.content, index)}
                      className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100"
                    >
                      {copiedIndex === index ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex justify-end">
                <div className="bg-green-500 text-white rounded-lg p-3 max-w-[80%]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    <span className="text-sm">Generando respuesta...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="p-4 border-t" style={{ borderColor: '#e5e7eb' }}>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleGenerateResponse}
              disabled={isGenerating}
              className="flex items-center gap-1"
            >
              <Sparkles className="h-4 w-4" />
              Generar con IA
            </Button>
            <Input
              placeholder="Escribe un mensaje o genera con IA..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1"
            />
            <Button size="icon" className="bg-green-500 hover:bg-green-600">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>
            💡 La IA generará respuestas basadas en tu catálogo de productos y configuración
          </p>
        </div>
      </CardContent>
    </>
  );
};
