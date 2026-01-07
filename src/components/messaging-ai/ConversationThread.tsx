import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, Phone, Sparkles, Copy, Check, MessageCircle, Instagram, Facebook } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ChannelType } from './ConversationsList';

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
  channel: ChannelType;
}

interface ConversationThreadProps {
  conversation?: Conversation;
  messages: Message[];
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

export const ConversationThread = ({ conversation, messages }: ConversationThreadProps) => {
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerateResponse = () => {
    setIsGenerating(true);
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

      <CardContent className="flex-1 p-0 flex flex-col">
        <ScrollArea className="flex-1 p-4">
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
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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

            {isGenerating && (
              <div className="flex justify-end">
                <div className={cn("rounded-lg p-3 max-w-[80%]", channelInfo.bubbleColor)}>
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
        <div className="p-4 border-t border-border">
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
            <Button size="icon" className={channelInfo.buttonColor}>
              <Send className="h-4 w-4" />
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
