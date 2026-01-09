import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  BookOpen, 
  Search,
  Tag,
  HelpCircle,
  Package,
  Clock,
  MapPin,
  CreditCard,
  Truck
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface KnowledgeItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
}

const CATEGORIES = [
  { value: 'products', label: 'Productos', icon: Package },
  { value: 'pricing', label: 'Precios', icon: CreditCard },
  { value: 'shipping', label: 'Envíos', icon: Truck },
  { value: 'hours', label: 'Horarios', icon: Clock },
  { value: 'location', label: 'Ubicación', icon: MapPin },
  { value: 'faq', label: 'Preguntas frecuentes', icon: HelpCircle },
];

export const KnowledgeBaseEditor = () => {
  const { currentOrganization } = useOrganization();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [channelId, setChannelId] = useState<string | null>(null);
  
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [newItem, setNewItem] = useState<Partial<KnowledgeItem>>({
    category: 'faq',
    question: '',
    answer: '',
    keywords: [],
  });
  const [newKeyword, setNewKeyword] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Load knowledge base from channel ai_config
  useEffect(() => {
    const loadKnowledge = async () => {
      if (!currentOrganization?.id) return;
      
      setIsLoading(true);
      try {
        const { data: channel, error } = await supabase
          .from('messaging_channels')
          .select('id, ai_config')
          .eq('organization_id', currentOrganization.id)
          .eq('channel_type', 'whatsapp')
          .eq('is_active', true)
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading knowledge:', error);
          return;
        }

        if (channel) {
          setChannelId(channel.id);
          const config = channel.ai_config as any;
          
          if (config?.knowledgeBase && Array.isArray(config.knowledgeBase)) {
            setItems(config.knowledgeBase);
          }
        }
      } catch (err) {
        console.error('Error loading knowledge:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadKnowledge();
  }, [currentOrganization?.id]);

  const handleSave = async () => {
    if (!channelId) {
      toast.error('No hay un canal de WhatsApp configurado');
      return;
    }

    setIsSaving(true);
    try {
      // Get current config
      const { data: channel } = await supabase
        .from('messaging_channels')
        .select('ai_config')
        .eq('id', channelId)
        .single();

      const currentConfig = (channel?.ai_config as any) || {};

      // Update with new knowledge base
      const { error } = await supabase
        .from('messaging_channels')
        .update({
          ai_config: {
            ...currentConfig,
            knowledgeBase: items,
          },
        })
        .eq('id', channelId);

      if (error) throw error;

      toast.success('Base de conocimiento guardada');
    } catch (err) {
      console.error('Error saving knowledge:', err);
      toast.error('Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const addItem = () => {
    if (!newItem.question || !newItem.answer) {
      toast.error('Completa la pregunta y respuesta');
      return;
    }

    const item: KnowledgeItem = {
      id: Date.now().toString(),
      category: newItem.category || 'faq',
      question: newItem.question,
      answer: newItem.answer,
      keywords: newItem.keywords || [],
    };

    setItems(prev => [...prev, item]);
    setNewItem({ category: 'faq', question: '', answer: '', keywords: [] });
    setIsAdding(false);
    toast.success('Conocimiento agregado');
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    toast.success('Conocimiento eliminado');
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !newItem.keywords?.includes(newKeyword.trim())) {
      setNewItem(prev => ({
        ...prev,
        keywords: [...(prev.keywords || []), newKeyword.trim()],
      }));
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setNewItem(prev => ({
      ...prev,
      keywords: prev.keywords?.filter(k => k !== keyword) || [],
    }));
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Base de Conocimiento</h2>
            <p className="text-sm text-muted-foreground">
              Información que la IA usará para responder
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar conocimiento
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !channelId}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en la base de conocimiento..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Add New Item Form */}
      {isAdding && (
        <Card className="border-dashed border-2 border-primary/50">
          <CardHeader>
            <CardTitle className="text-lg">Nuevo conocimiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select 
                  value={newItem.category} 
                  onValueChange={(value) => setNewItem(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Palabras clave</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Agregar palabra clave..."
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                  />
                  <Button variant="outline" size="icon" onClick={addKeyword}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {newItem.keywords && newItem.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {newItem.keywords.map(keyword => (
                      <Badge key={keyword} variant="secondary" className="gap-1">
                        <Tag className="h-3 w-3" />
                        {keyword}
                        <button onClick={() => removeKeyword(keyword)} className="hover:text-destructive">
                          <span className="sr-only">Eliminar</span>
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pregunta / Tema</Label>
              <Input
                placeholder="¿Cuáles son los métodos de pago?"
                value={newItem.question}
                onChange={(e) => setNewItem(prev => ({ ...prev, question: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Respuesta</Label>
              <Textarea
                placeholder="Aceptamos pagos con tarjeta de crédito, débito, transferencia bancaria y pago contra entrega..."
                value={newItem.answer}
                onChange={(e) => setNewItem(prev => ({ ...prev, answer: e.target.value }))}
                className="min-h-[100px]"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsAdding(false)}>
                Cancelar
              </Button>
              <Button onClick={addItem}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Knowledge Items */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              {items.length === 0 
                ? 'Aún no hay conocimiento agregado'
                : 'No se encontraron resultados'}
            </p>
            {items.length === 0 && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setIsAdding(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar primer conocimiento
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredItems.map(item => {
            const categoryInfo = CATEGORIES.find(c => c.value === item.category);
            const Icon = categoryInfo?.icon || HelpCircle;
            
            return (
              <Card key={item.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                          <Icon className="h-3 w-3" />
                          {categoryInfo?.label || item.category}
                        </Badge>
                        {item.keywords.map(keyword => (
                          <Badge key={keyword} variant="secondary" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                      <p className="font-medium">{item.question}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {item.answer}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CATEGORIES.slice(0, 4).map(cat => {
          const count = items.filter(i => i.category === cat.value).length;
          const Icon = cat.icon;
          return (
            <Card key={cat.value}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{cat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
