import React, { useState, useMemo } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Loader2, MessageCircle, FileText, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Country codes list (Latin America first, then common ones) ---
const COUNTRIES = [
  // Latin America (prioritized)
  { code: '+57', name: 'Colombia', flag: '🇨🇴' },
  { code: '+52', name: 'México', flag: '🇲🇽' },
  { code: '+54', name: 'Argentina', flag: '🇦🇷' },
  { code: '+56', name: 'Chile', flag: '🇨🇱' },
  { code: '+51', name: 'Perú', flag: '🇵🇪' },
  { code: '+593', name: 'Ecuador', flag: '🇪🇨' },
  { code: '+58', name: 'Venezuela', flag: '🇻🇪' },
  { code: '+507', name: 'Panamá', flag: '🇵🇦' },
  { code: '+506', name: 'Costa Rica', flag: '🇨🇷' },
  { code: '+502', name: 'Guatemala', flag: '🇬🇹' },
  { code: '+503', name: 'El Salvador', flag: '🇸🇻' },
  { code: '+504', name: 'Honduras', flag: '🇭🇳' },
  { code: '+505', name: 'Nicaragua', flag: '🇳🇮' },
  { code: '+591', name: 'Bolivia', flag: '🇧🇴' },
  { code: '+595', name: 'Paraguay', flag: '🇵🇾' },
  { code: '+598', name: 'Uruguay', flag: '🇺🇾' },
  { code: '+1-809', name: 'Rep. Dominicana', flag: '🇩🇴' },
  { code: '+53', name: 'Cuba', flag: '🇨🇺' },
  { code: '+55', name: 'Brasil', flag: '🇧🇷' },
  // North America & Europe
  { code: '+1', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: '+34', name: 'España', flag: '🇪🇸' },
  { code: '+44', name: 'Reino Unido', flag: '🇬🇧' },
  { code: '+33', name: 'Francia', flag: '🇫🇷' },
  { code: '+49', name: 'Alemania', flag: '🇩🇪' },
  { code: '+39', name: 'Italia', flag: '🇮🇹' },
  { code: '+351', name: 'Portugal', flag: '🇵🇹' },
];

const DEFAULT_COUNTRY = COUNTRIES[0]; // Colombia

const TEMPLATE_TEXT = 'Hola! Nos comunicamos de parte de Dosmicos. ¿En qué te podemos ayudar?';

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateConversation: (phone: string, name: string, message: string, useTemplate?: boolean) => Promise<void>;
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
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [countryOpen, setCountryOpen] = useState(false);

  const fullPhone = useMemo(() => {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (!cleaned) return '';
    const countryCode = selectedCountry.code.replace('-', '');
    return `${countryCode}${cleaned}`;
  }, [phone, selectedCountry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    await onCreateConversation(fullPhone, name.trim(), TEMPLATE_TEXT, true);

    // Reset form
    setPhone('');
    setName('');
    setSelectedCountry(DEFAULT_COUNTRY);
  };

  const formatPhoneInput = (value: string) => {
    // Only allow digits
    return value.replace(/[^\d]/g, '');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Nueva conversación
          </DialogTitle>
          <DialogDescription>
            Ingresa el número de WhatsApp para enviar la plantilla de saludo e iniciar la conversación.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Phone with country code selector */}
          <div className="space-y-2">
            <Label>Número de WhatsApp *</Label>
            <div className="flex gap-2">
              {/* Country code selector */}
              <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={countryOpen}
                    className="w-[130px] justify-between px-2 font-normal flex-shrink-0"
                    disabled={isLoading}
                    type="button"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span>{selectedCountry.flag}</span>
                      <span className="text-sm">{selectedCountry.code}</span>
                    </span>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar país..." />
                    <CommandList>
                      <CommandEmpty>No se encontró el país.</CommandEmpty>
                      <CommandGroup>
                        {COUNTRIES.map((country) => (
                          <CommandItem
                            key={country.code + country.name}
                            value={`${country.name} ${country.code}`}
                            onSelect={() => {
                              setSelectedCountry(country);
                              setCountryOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedCountry.code === country.code
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
                            />
                            <span className="mr-2">{country.flag}</span>
                            <span className="flex-1 truncate">{country.name}</span>
                            <span className="text-muted-foreground text-xs ml-1">{country.code}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Phone number input */}
              <Input
                id="phone"
                placeholder="300 123 4567"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                disabled={isLoading}
                className="flex-1"
              />
            </div>
            {fullPhone && (
              <p className="text-xs text-muted-foreground">
                Se enviará al: <span className="font-medium">{fullPhone}</span>
              </p>
            )}
          </div>

          {/* Contact name */}
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

          {/* Template preview */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Plantilla de saludo
            </Label>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm text-emerald-900">
              <p>{TEMPLATE_TEXT}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Se enviará esta plantilla aprobada por WhatsApp para iniciar la conversación.
            </p>
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
              disabled={!phone.trim() || isLoading}
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
