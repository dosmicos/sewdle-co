import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageCircle } from 'lucide-react';

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateConversation: (phone: string, name: string, message: string) => Promise<void>;
  isLoading?: boolean;
}

export const NewConversationModal = ({
  open,
  onOpenChange,
  onCreateConversation,
  isLoading = false
}: NewConversationModalProps) => {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !message.trim()) return;
    
    await onCreateConversation(phone.trim(), name.trim(), message.trim());
    
    // Reset form
    setPhone('');
    setName('');
    setMessage('');
  };

  const formatPhoneNumber = (value: string) => {
    // Remove non-numeric characters except +
    const cleaned = value.replace(/[^\d+]/g, '');
    return cleaned;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-500" />
            Nueva conversación
          </DialogTitle>
          <DialogDescription>
            Ingresa el número de WhatsApp y un mensaje inicial para comenzar una conversación.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Número de WhatsApp *</Label>
            <Input
              id="phone"
              placeholder="+57 300 123 4567"
              value={phone}
              onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Incluye el código de país (ej: +57 para Colombia)
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del contacto (opcional)</Label>
            <Input
              id="name"
              placeholder="Juan Pérez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="message">Mensaje inicial *</Label>
            <Textarea
              id="message"
              placeholder="¡Hola! Te escribo desde Dosmicos..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!phone.trim() || !message.trim() || isLoading}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Iniciar chat
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
