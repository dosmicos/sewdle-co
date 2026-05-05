import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, Plus, X, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export const AIConfigPanel = () => {
  const [config, setConfig] = useState({
    systemPrompt: `Eres un asistente de ventas amigable para una tienda de artesanías colombianas. 

Tu rol es:
- Responder preguntas sobre productos disponibles
- Proporcionar información de precios y disponibilidad
- Ayudar a los clientes con sus pedidos
- Ser amable y usar emojis ocasionalmente

Reglas importantes:
- Siempre saluda al cliente
- Si no sabes algo, ofrece conectar con un humano
- Mantén respuestas concisas pero informativas`,
    tone: 'friendly',
    includeCatalog: true,
    autoReply: false,
    responseDelay: 3,
    businessHours: false,
    greetingMessage: '¡Hola! 👋 Soy el asistente virtual de la tienda. ¿En qué puedo ayudarte?',
  });

  const [rules, setRules] = useState([
    { id: '1', condition: 'precio', response: 'Consultar catálogo de productos' },
    { id: '2', condition: 'envío', response: 'Informar sobre políticas de envío' },
    { id: '3', condition: 'disponible', response: 'Verificar inventario en tiempo real' },
  ]);

  const [newRule, setNewRule] = useState({ condition: '', response: '' });

  const handleSave = () => {
    toast.success('Configuración guardada correctamente');
  };

  const addRule = () => {
    if (newRule.condition && newRule.response) {
      setRules([...rules, { id: Date.now().toString(), ...newRule }]);
      setNewRule({ condition: '', response: '' });
      toast.success('Regla agregada');
    }
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
    toast.success('Regla eliminada');
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* System Prompt */}
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <CardTitle>Prompt del Sistema</CardTitle>
          </div>
          <CardDescription>
            Instrucciones que la IA seguirá para generar respuestas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={config.systemPrompt}
            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
            className="min-h-[200px] font-mono text-sm"
            placeholder="Escribe las instrucciones para la IA..."
          />
          <p className="text-xs mt-2" style={{ color: '#6b7280' }}>
            Tip: Sé específico sobre el tono, las reglas y la información que la IA debe proporcionar
          </p>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración General</CardTitle>
          <CardDescription>Ajustes básicos del asistente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Tono de respuesta</Label>
            <Select 
              value={config.tone} 
              onValueChange={(value) => setConfig({ ...config, tone: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">😊 Amigable</SelectItem>
                <SelectItem value="formal">👔 Formal</SelectItem>
                <SelectItem value="casual">🎉 Casual</SelectItem>
                <SelectItem value="professional">💼 Profesional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Incluir catálogo</Label>
              <p className="text-xs" style={{ color: '#6b7280' }}>
                Permitir consultas sobre productos
              </p>
            </div>
            <Switch 
              checked={config.includeCatalog}
              onCheckedChange={(checked) => setConfig({ ...config, includeCatalog: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Respuestas automáticas</Label>
              <p className="text-xs" style={{ color: '#6b7280' }}>
                Enviar respuestas sin revisión manual
              </p>
            </div>
            <Switch 
              checked={config.autoReply}
              onCheckedChange={(checked) => setConfig({ ...config, autoReply: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Horario comercial</Label>
              <p className="text-xs" style={{ color: '#6b7280' }}>
                Solo responder en horario laboral
              </p>
            </div>
            <Switch 
              checked={config.businessHours}
              onCheckedChange={(checked) => setConfig({ ...config, businessHours: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label>Delay de respuesta (segundos)</Label>
            <Input
              type="number"
              min={0}
              max={30}
              value={config.responseDelay}
              onChange={(e) => setConfig({ ...config, responseDelay: parseInt(e.target.value) || 0 })}
            />
            <p className="text-xs" style={{ color: '#6b7280' }}>
              Tiempo de espera antes de enviar respuesta automática
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Greeting Message */}
      <Card>
        <CardHeader>
          <CardTitle>Mensaje de Bienvenida</CardTitle>
          <CardDescription>Primer mensaje al iniciar conversación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={config.greetingMessage}
            onChange={(e) => setConfig({ ...config, greetingMessage: e.target.value })}
            className="min-h-[100px]"
            placeholder="Escribe el mensaje de bienvenida..."
          />
          
          <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Vista previa</p>
                <p className="mt-1">{config.greetingMessage}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Response Rules */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Reglas de Respuesta</CardTitle>
          <CardDescription>
            Define comportamientos específicos según palabras clave
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {rules.map((rule) => (
              <Badge 
                key={rule.id} 
                variant="secondary" 
                className="px-3 py-2 flex items-center gap-2"
              >
                <span className="font-medium">"{rule.condition}"</span>
                <span style={{ color: '#6b7280' }}>→</span>
                <span>{rule.response}</span>
                <button 
                  onClick={() => removeRule(rule.id)}
                  className="ml-1 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Palabra clave..."
              value={newRule.condition}
              onChange={(e) => setNewRule({ ...newRule, condition: e.target.value })}
              className="flex-1"
            />
            <Input
              placeholder="Acción a tomar..."
              value={newRule.response}
              onChange={(e) => setNewRule({ ...newRule, response: e.target.value })}
              className="flex-1"
            />
            <Button onClick={addRule} variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="md:col-span-2 flex justify-end">
        <Button onClick={handleSave} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          Guardar Configuración
        </Button>
      </div>
    </div>
  );
};
