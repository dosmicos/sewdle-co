import React, { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Trash2, X, Loader2, Sparkles } from 'lucide-react';
import { useCopilot } from '@/hooks/useCopilot';
import CopilotMessage from './CopilotMessage';
import CopilotQuickActions from './CopilotQuickActions';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function SewdleCopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, isLoading, sendMessage, clearHistory, cancelRequest } = useCopilot();
  const { currentOrganization } = useOrganization();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput('');
    }
  };

  const handleQuickAction = (query: string) => {
    if (!isLoading) {
      sendMessage(query);
    }
  };

  if (!currentOrganization) return null;

  return (
    <>
      {/* Floating Button */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            size="lg"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90"
          >
            <Bot className="h-6 w-6" />
          </Button>
        </SheetTrigger>

        <SheetContent 
          side="right" 
          className="w-full sm:w-[420px] p-0 flex flex-col"
        >
          {/* Header */}
          <SheetHeader className="px-4 py-3 border-b border-border bg-background">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
                <div>
                  <SheetTitle className="text-base">Sewdle Copilot</SheetTitle>
                  <p className="text-xs text-muted-foreground">Asistente inteligente</p>
                </div>
              </div>
              <div className="flex gap-1">
                {messages.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={clearHistory}
                    title="Limpiar historial"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Quick Actions */}
          <CopilotQuickActions onAction={handleQuickAction} disabled={isLoading} />

          {/* Messages */}
          <ScrollArea className="flex-1 px-4" ref={scrollRef}>
            <div className="py-4 space-y-2">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">¡Hola! Soy Sewdle Copilot</p>
                  <p className="text-xs mt-1">
                    Pregúntame sobre órdenes, talleres, entregas o inventario.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <CopilotMessage key={msg.id} message={msg} />
                ))
              )}
              
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-2 py-2">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Consultando...
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-border bg-background">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu pregunta..."
                disabled={isLoading}
                className="flex-1"
              />
              {isLoading ? (
                <Button 
                  type="button" 
                  size="icon" 
                  variant="outline"
                  onClick={cancelRequest}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" size="icon" disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
