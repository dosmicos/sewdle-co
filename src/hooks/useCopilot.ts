import { useState, useCallback, useRef } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const STORAGE_KEY = 'sewdle-copilot-history';
const SUPABASE_URL = "https://ysdcsqsfnckeuafjyrbc.supabase.co";

export function useCopilot() {
  const { currentOrganization } = useOrganization();
  const [messages, setMessages] = useState<CopilotMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
      }
    } catch (e) {
      console.error('Error loading copilot history:', e);
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const saveMessages = useCallback((msgs: CopilotMessage[]) => {
    try {
      // Keep only last 50 messages
      const toSave = msgs.slice(-50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error('Error saving copilot history:', e);
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !currentOrganization) return;
    
    const userMessage: CopilotMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    setMessages(prev => {
      const updated = [...prev, userMessage];
      saveMessages(updated);
      return updated;
    });

    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const conversationHistory = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch(`${SUPABASE_URL}/functions/v1/sewdle-copilot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content.trim(),
          conversationHistory,
          organizationId: currentOrganization.id
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          toast.error('Límite de solicitudes excedido. Intenta en unos segundos.');
          throw new Error('Rate limit exceeded');
        }
        if (response.status === 402) {
          toast.error('Créditos de IA agotados. Contacta al administrador.');
          throw new Error('Payment required');
        }
        throw new Error(errorData.error || `Error: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let assistantContent = '';
      let assistantMessageId = crypto.randomUUID();
      let textBuffer = '';

      // Add empty assistant message that we'll update
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        // Process line by line
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const deltaContent = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (deltaContent) {
              assistantContent += deltaContent;
              setMessages(prev => 
                prev.map(m => 
                  m.id === assistantMessageId 
                    ? { ...m, content: assistantContent }
                    : m
                )
              );
            }
          } catch {
            // Incomplete JSON, put it back
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Save final messages
      setMessages(prev => {
        saveMessages(prev);
        return prev;
      });

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      console.error('Copilot error:', error);
      
      // Add error message
      setMessages(prev => {
        const errorMessage: CopilotMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Lo siento, hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.',
          timestamp: new Date()
        };
        const updated = [...prev, errorMessage];
        saveMessages(updated);
        return updated;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [currentOrganization, messages, saveMessages]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearHistory,
    cancelRequest
  };
}
