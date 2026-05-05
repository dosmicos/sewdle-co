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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, MessageCircle, FileText, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

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

// --- WhatsApp template definitions ---
export interface TemplateParam {
  key: string;
  label: string;
  placeholder: string;
}

export interface WhatsAppTemplate {
  name: string;
  displayName: string;
  language: string;
  description: string;
  previewText: string;
  params: TemplateParam[];
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    name: 'saludo_inicial',
    displayName: 'Saludo inicial',
    language: 'es_CO',
    description: 'Mensaje de saludo para iniciar conversación',
    previewText: 'Hola! Nos comunicamos de parte de Dosmicos.',
    params: [],
  },
  {
    name: 'confirmacion_pedido',
    displayName: 'Confirmación de pedido',
    language: 'es_CO',
    description: 'Confirmar pedido contra entrega con detalles de compra',
    previewText: 'Hola {{1}}!\n\nTe escribimos de Dosmicos.co para confirmar tu pedido contra entrega.\n\nPedido #{{2}}\n{{3}}\n\nTotal: {{4}}\nDireccion de envio: {{5}}\nCiudad: {{6}}\n\nPor favor confirma respondiendo SI para procesar tu pedido, o escribenos si necesitas hacer algun cambio.\n\nGracias por tu compra!',
    params: [
      { key: '1', label: 'Nombre del cliente', placeholder: 'Juan Pérez' },
      { key: '2', label: 'Número de pedido', placeholder: '1234' },
      { key: '3', label: 'Lista de productos', placeholder: '2x Camiseta, 1x Pantalón' },
      { key: '4', label: 'Total', placeholder: 'COP 150,000' },
      { key: '5', label: 'Dirección de envío', placeholder: 'Cra 45 #67-89' },
      { key: '6', label: 'Ciudad', placeholder: 'Medellín' },
    ],
  },
  {
    name: 'address_verification',
    displayName: 'Verificación de dirección',
    language: 'es',
    description: 'Verificar dirección de envío con el cliente',
    previewText: 'Hola {{1}}! 🛍️ Para tu pedido #{{2}} de Dosmicos.co, necesitamos verificar tu dirección.\n\n{{3}} pertenece a {{4}}, pero en tu pedido aparece {{5}}.\n\n¿Está correcta tu dirección?',
    params: [
      { key: '1', label: 'Nombre del cliente', placeholder: 'Juan Pérez' },
      { key: '2', label: 'Número de pedido', placeholder: '1234' },
      { key: '3', label: 'Ciudad', placeholder: 'Medellín' },
      { key: '4', label: 'Departamento esperado', placeholder: 'Antioquia' },
      { key: '5', label: 'Departamento actual', placeholder: 'Cundinamarca' },
    ],
  },
  {
    name: 'reclamar_interrapidisimo',
    displayName: 'Reclamar Interrapidísimo',
    language: 'es_CO',
    description: 'Informar al cliente que puede reclamar su pedido en oficina Interrapidísimo',
    previewText: 'Hola, nos estamos comunicando de dosmicos.co\n\nEs para informarte que ya puedes reclamar tu pedido en la oficina Interrapidísimo con el número de guía: {{1}}\n\nCualquier duda estoy para ayudarte\ud83d\ude0a',
    params: [
      { key: '1', label: 'Número de guía', placeholder: '240048962605' },
    ],
  },
  {
    name: 'notificacion_envio_express',
    displayName: 'Notificación envío express',
    language: 'en',
    description: 'Informar al cliente que su pedido va en camino con dato de entrega',
    previewText: 'Hola! Te escribimos desde Dosmicos para informarte que tu pedido ya se encuentra en camino 🚀\n\nAl momento de la entrega, por favor comparte este dato con el/la repartidor/a: {{1}}\n\nGracias por confiar en nosotros!',
    params: [
      { key: '1', label: 'Dato de entrega', placeholder: 'ABC-1234' },
    ],
  },
];

export interface CreateConversationData {
  phone: string;
  name: string;
  message: string;
  useTemplate?: boolean;
  templateName?: string;
  templateLanguage?: string;
  templateParams?: Array<{ type: 'text'; text: string }>;
}

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateConversation: (data: CreateConversationData) => Promise<void>;
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
  const [selectedTemplateName, setSelectedTemplateName] = useState('saludo_inicial');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  const selectedTemplate = useMemo(
    () => WHATSAPP_TEMPLATES.find(t => t.name === selectedTemplateName) || WHATSAPP_TEMPLATES[0],
    [selectedTemplateName]
  );

  const fullPhone = useMemo(() => {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (!cleaned) return '';
    const countryCode = selectedCountry.code.replace('-', '');
    return `${countryCode}${cleaned}`;
  }, [phone, selectedCountry]);

  // Build preview text with filled parameters
  const filledPreviewText = useMemo(() => {
    let text = selectedTemplate.previewText;
    selectedTemplate.params.forEach(param => {
      const value = paramValues[param.key] || `{{${param.key}}}`;
      text = text.replace(`{{${param.key}}}`, value);
    });
    return text;
  }, [selectedTemplate, paramValues]);

  // Check if all required parameters are filled
  const allParamsFilled = useMemo(() => {
    if (selectedTemplate.params.length === 0) return true;
    return selectedTemplate.params.every(p => (paramValues[p.key] || '').trim().length > 0);
  }, [selectedTemplate, paramValues]);

  const handleTemplateChange = (templateName: string) => {
    setSelectedTemplateName(templateName);
    setParamValues({}); // Reset params when template changes
  };

  const handleParamChange = (key: string, value: string) => {
    setParamValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    // Build template parameters array in order
    const templateParams = selectedTemplate.params.map(p => ({
      type: 'text' as const,
      text: (paramValues[p.key] || '').trim(),
    }));

    await onCreateConversation({
      phone: fullPhone,
      name: name.trim(),
      message: filledPreviewText,
      useTemplate: true,
      templateName: selectedTemplate.name,
      templateLanguage: selectedTemplate.language,
      templateParams: templateParams.length > 0 ? templateParams : undefined,
    });

    // Reset form
    setPhone('');
    setName('');
    setSelectedCountry(DEFAULT_COUNTRY);
    setSelectedTemplateName('saludo_inicial');
    setParamValues({});
  };

  const formatPhoneInput = (value: string) => {
    // Only allow digits
    return value.replace(/[^\d]/g, '');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Nueva conversación
          </DialogTitle>
          <DialogDescription>
            Selecciona una plantilla y completa los campos para iniciar la conversación.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto pr-2">
          <form onSubmit={handleSubmit} className="space-y-4" id="new-conversation-form">
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

            {/* Template selector */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Plantilla
              </Label>
              <Select
                value={selectedTemplateName}
                onValueChange={handleTemplateChange}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una plantilla" />
                </SelectTrigger>
                <SelectContent>
                  {WHATSAPP_TEMPLATES.map((template) => (
                    <SelectItem key={template.name} value={template.name}>
                      <div className="flex flex-col items-start">
                        <span>{template.displayName}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedTemplate.description}
              </p>
            </div>

            {/* Template parameters */}
            {selectedTemplate.params.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Campos de la plantilla</Label>
                {selectedTemplate.params.map((param) => (
                  <div key={param.key} className="space-y-1">
                    <Label htmlFor={`param-${param.key}`} className="text-xs text-muted-foreground">
                      {param.label}
                    </Label>
                    <Input
                      id={`param-${param.key}`}
                      placeholder={param.placeholder}
                      value={paramValues[param.key] || ''}
                      onChange={(e) => handleParamChange(param.key, e.target.value)}
                      disabled={isLoading}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Template preview */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Vista previa del mensaje</Label>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm text-emerald-900">
                <p className="whitespace-pre-wrap">{filledPreviewText}</p>
              </div>
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="pt-2">
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
            form="new-conversation-form"
            disabled={!phone.trim() || !allParamsFilled || isLoading}
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
      </DialogContent>
    </Dialog>
  );
};
