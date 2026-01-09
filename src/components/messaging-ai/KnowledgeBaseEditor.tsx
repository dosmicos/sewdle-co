import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  BookOpen, 
  Search,
  Info,
  Image,
  Package,
  Star,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface KnowledgeItem {
  id: string;
  category: string;
  title: string;
  content: string;
}

const CATEGORIES = [
  { value: 'general', label: 'Información general', icon: Info, description: 'Horarios, políticas, contacto, etc.' },
  { value: 'visual', label: 'Información visual', icon: Image, description: 'Imágenes, videos, guías visuales' },
  { value: 'product', label: 'Información del producto', icon: Package, description: 'Detalles, características, precios' },
  { value: 'recommendation', label: 'Recomendación del producto', icon: Star, description: 'Sugerencias, combos, ofertas' },
];

export const KnowledgeBaseEditor = () => {
  const { currentOrganization } = useOrganization();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelId, setChannelId] = useState<string | null>(null);
  
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<KnowledgeItem>>({
    title: '',
    content: '',
  });

  // Load knowledge base from channel ai_config
  useEffect(() => {
    const loadKnowledge = async () => {
      if (!currentOrganization?.id) return;
      
      setIsLoading(true);
      try {
        const { data: channel, error } = await supabase
          .from('messaging_channels')
          .select('id, ai_config, is_active, created_at')
          .eq('organization_id', currentOrganization.id)
          .eq('channel_type', 'whatsapp')
          .order('is_active', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) {
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
    if (!currentOrganization?.id) {
      toast.error('No hay una organización activa');
      return;
    }

    setIsSaving(true);
    try {
      let effectiveChannelId = channelId;

      if (!effectiveChannelId) {
        const { data: created, error: createError } = await supabase
          .from('messaging_channels')
          .insert({
            organization_id: currentOrganization.id,
            channel_type: 'whatsapp',
            is_active: false,
          } as any)
          .select('id')
          .single();

        if (createError) throw createError;
        effectiveChannelId = created.id;
        setChannelId(created.id);
      }

      const { data: channel, error: channelError } = await supabase
        .from('messaging_channels')
        .select('ai_config')
        .eq('id', effectiveChannelId)
        .maybeSingle();

      if (channelError) throw channelError;

      const currentConfig = (channel?.ai_config as any) || {};

      const { error } = await supabase
        .from('messaging_channels')
        .update({
          ai_config: {
            ...currentConfig,
            knowledgeBase: items,
          },
        })
        .eq('id', effectiveChannelId);

      if (error) throw error;

      toast.success('Base de conocimiento guardada');
    } catch (err) {
      console.error('Error saving knowledge:', err);
      toast.error('Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setNewItem({ title: '', content: '' });
    setShowCategoryModal(false);
  };

  const addItem = () => {
    if (!newItem.title || !newItem.content || !selectedCategory) {
      toast.error('Completa el título y contenido');
      return;
    }

    const item: KnowledgeItem = {
      id: Date.now().toString(),
      category: selectedCategory,
      title: newItem.title,
      content: newItem.content,
    };

    setItems(prev => [...prev, item]);
    setNewItem({ title: '', content: '' });
    setSelectedCategory(null);
    toast.success('Conocimiento agregado');
  };

  const cancelAdd = () => {
    setSelectedCategory(null);
    setNewItem({ title: '', content: '' });
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    toast.success('Conocimiento eliminado');
  };

  const filteredItems = items.filter(item => {
    if (!searchQuery) return true;
    return item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getCategoryInfo = (value: string) => {
    return CATEGORIES.find(c => c.value === value) || CATEGORIES[0];
  };

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
            onClick={() => setShowCategoryModal(true)}
            disabled={!!selectedCategory}
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar conocimiento
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !currentOrganization?.id}
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar en la base de conocimiento..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Add New Item Form */}
      {selectedCategory && (
        <Card className="border-dashed border-2 border-primary/50">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  {React.createElement(getCategoryInfo(selectedCategory).icon, { className: "h-3 w-3" })}
                  {getCategoryInfo(selectedCategory).label}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={cancelAdd}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Título / Tema</Label>
              <Input
                placeholder="Ej: Métodos de pago disponibles"
                value={newItem.title}
                onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Contenido</Label>
              <Textarea
                placeholder="Escribe la información que la IA debe conocer..."
                value={newItem.content}
                onChange={(e) => setNewItem(prev => ({ ...prev, content: e.target.value }))}
                className="min-h-[120px]"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={cancelAdd}>
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
      {filteredItems.length === 0 && !selectedCategory ? (
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
                onClick={() => setShowCategoryModal(true)}
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
            const categoryInfo = getCategoryInfo(item.category);
            const Icon = categoryInfo.icon;
            
            return (
              <Card key={item.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <Badge variant="outline" className="gap-1">
                        <Icon className="h-3 w-3" />
                        {categoryInfo.label}
                      </Badge>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {item.content}
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

      {/* Stats by Category */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CATEGORIES.map(cat => {
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

      {/* Category Selection Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Añadir conocimiento</DialogTitle>
            <p className="text-center text-sm text-muted-foreground">
              ¿Qué tipo de información quieres añadir?
            </p>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-4">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              return (
                <Button
                  key={cat.value}
                  variant="outline"
                  className="h-auto py-4 px-4 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5"
                  onClick={() => handleCategorySelect(cat.value)}
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium text-center">{cat.label}</span>
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
