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
  Package,
  X,
  Pencil,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { cn } from '@/lib/utils';
import { KnowledgeImageUpload } from './KnowledgeImageUpload';

interface KnowledgeItem {
  id: string;
  category: 'general' | 'product';
  title: string;
  content: string;
  images?: string[];
  // Product-specific fields
  productName?: string;
  recommendWhen?: string;
}

const CATEGORIES = [
  { value: 'general', label: 'Información general', icon: Info, description: 'Horarios, políticas, envíos, pagos, contacto, etc.' },
  { value: 'product', label: 'Información del producto', icon: Package, description: 'Detalles de un producto y cuándo recomendarlo' },
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
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [newItem, setNewItem] = useState<Partial<KnowledgeItem>>({
    title: '',
    content: '',
    images: [],
    productName: '',
    recommendWhen: '',
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<KnowledgeItem>>({
    title: '',
    content: '',
    images: [],
    productName: '',
    recommendWhen: '',
  });

  // Load knowledge base from channel ai_config.
  // Strategy: prefer the active channel with a meta_phone_number_id (the one
  // the webhook actually uses).  If that channel has no knowledgeBase, look
  // through all other WhatsApp channels for one that does.
  useEffect(() => {
    const loadKnowledge = async () => {
      if (!currentOrganization?.id) return;

      setIsLoading(true);
      try {
        // Fetch ALL WhatsApp channels for this org so we can pick the right one
        const { data: channels, error } = await supabase
          .from('messaging_channels')
          .select('id, ai_config, is_active, meta_phone_number_id, created_at')
          .eq('organization_id', currentOrganization.id)
          .eq('channel_type', 'whatsapp')
          .order('is_active', { ascending: false })
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error loading knowledge:', error);
          return;
        }

        if (!channels || channels.length === 0) return;

        // Pick the primary channel: active + has phone_number_id (webhook target)
        const primaryChannel = channels.find(
          (ch: any) => ch.is_active && ch.meta_phone_number_id
        ) || channels[0];

        setChannelId(primaryChannel.id);
        const primaryConfig = primaryChannel.ai_config as any;

        // Helper: ensure every item has a unique `id` so edit/delete work correctly.
        // Items saved before the `id` field existed will be missing it.
        const ensureIds = (arr: any[]): KnowledgeItem[] =>
          arr.map((item, index) => ({
            ...item,
            id: item.id || `${Date.now()}-${index}`,
          }));

        if (primaryConfig?.knowledgeBase && Array.isArray(primaryConfig.knowledgeBase) && primaryConfig.knowledgeBase.length > 0) {
          setItems(ensureIds(primaryConfig.knowledgeBase));
        } else {
          // The primary channel has no knowledgeBase – look in other channels
          const donor = channels.find((ch: any) => {
            if (ch.id === primaryChannel.id) return false;
            const cfg = ch.ai_config as any;
            return cfg?.knowledgeBase && Array.isArray(cfg.knowledgeBase) && cfg.knowledgeBase.length > 0;
          });

          if (donor) {
            const donorConfig = donor.ai_config as any;
            console.log(`📚 Found knowledgeBase in channel ${donor.id}, loading ${donorConfig.knowledgeBase.length} items`);
            setItems(ensureIds(donorConfig.knowledgeBase));
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

      // Also sync knowledgeBase to ALL other active WhatsApp channels in this
      // org so the webhook always picks it up regardless of which channel row
      // it resolves to.
      try {
        const { data: otherChannels } = await supabase
          .from('messaging_channels')
          .select('id, ai_config')
          .eq('organization_id', currentOrganization.id)
          .eq('channel_type', 'whatsapp')
          .neq('id', effectiveChannelId);

        if (otherChannels && otherChannels.length > 0) {
          for (const other of otherChannels) {
            const otherConfig = (other.ai_config as any) || {};
            await supabase
              .from('messaging_channels')
              .update({
                ai_config: { ...otherConfig, knowledgeBase: items },
              })
              .eq('id', other.id);
          }
          console.log(`📚 Synced knowledgeBase to ${otherChannels.length} other channel(s)`);
        }
      } catch (syncErr) {
        console.warn('Could not sync knowledgeBase to other channels:', syncErr);
      }

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
    setNewItem({ title: '', content: '', images: [], productName: '', recommendWhen: '' });
    setShowCategoryModal(false);
  };

  const addItem = () => {
    const isProduct = selectedCategory === 'product';
    
    if (isProduct) {
      if (!newItem.productName || !newItem.content) {
        toast.error('Completa el nombre del producto y los detalles');
        return;
      }
    } else {
      if (!newItem.title || !newItem.content) {
        toast.error('Completa el título y contenido');
        return;
      }
    }

    if (!selectedCategory) return;

    const item: KnowledgeItem = {
      id: Date.now().toString(),
      category: selectedCategory as 'general' | 'product',
      title: isProduct ? newItem.productName! : newItem.title!,
      content: newItem.content!,
      images: newItem.images || [],
      ...(isProduct && {
        productName: newItem.productName,
        recommendWhen: newItem.recommendWhen,
      }),
    };

    setItems(prev => [...prev, item]);
    setNewItem({ title: '', content: '', images: [], productName: '', recommendWhen: '' });
    setSelectedCategory(null);
    toast.success('Conocimiento agregado');
  };

  const cancelAdd = () => {
    setSelectedCategory(null);
    setNewItem({ title: '', content: '', images: [], productName: '', recommendWhen: '' });
  };

  const removeItem = (id: string) => {
    if (!id) {
      console.warn('removeItem called with falsy id – ignoring to prevent deleting all items');
      return;
    }
    setItems(prev => prev.filter(item => item.id !== id));
    toast.success('Conocimiento eliminado');
  };

  const startEditing = (item: KnowledgeItem) => {
    setEditingItemId(item.id);
    setEditingItem({
      title: item.title,
      content: item.content,
      images: item.images || [],
      productName: item.productName || '',
      recommendWhen: item.recommendWhen || '',
    });
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditingItem({ title: '', content: '', images: [], productName: '', recommendWhen: '' });
  };

  const saveEditing = (id: string) => {
    const item = items.find(i => i.id === id);
    const isProduct = item?.category === 'product';
    
    if (isProduct) {
      if (!editingItem.productName || !editingItem.content) {
        toast.error('Completa el nombre del producto y los detalles');
        return;
      }
    } else {
      if (!editingItem.title || !editingItem.content) {
        toast.error('Completa el título y contenido');
        return;
      }
    }

    setItems(prev => prev.map(i => 
      i.id === id 
        ? { 
            ...i, 
            title: isProduct ? editingItem.productName! : editingItem.title!,
            content: editingItem.content!,
            images: editingItem.images || [],
            ...(isProduct && {
              productName: editingItem.productName,
              recommendWhen: editingItem.recommendWhen,
            }),
          }
        : i
    ));
    setEditingItemId(null);
    setEditingItem({ title: '', content: '', images: [], productName: '', recommendWhen: '' });
    toast.success('Conocimiento actualizado');
  };

  const filteredItems = items.filter(item => {
    if (!searchQuery) return true;
    return item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getCategoryInfo = (value: string) => {
    return CATEGORIES.find(c => c.value === value) || CATEGORIES[0];
  };

  const toggleExpanded = (id: string) => {
    setExpandedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden shrink-0 rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30 sm:block">
            <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold leading-tight sm:text-xl">Base de Conocimiento</h2>
            <p className="max-w-[18rem] text-sm leading-snug text-muted-foreground sm:max-w-none">
              Información que la IA usará para responder
            </p>
          </div>
        </div>
        
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 lg:flex lg:w-auto">
          <Button 
            variant="outline" 
            onClick={() => setShowCategoryModal(true)}
            disabled={!!selectedCategory}
            className="h-10 w-full whitespace-normal px-3 lg:w-auto"
          >
            <Plus className="mr-2 h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate lg:hidden">Agregar</span>
            <span className="hidden min-w-0 truncate lg:inline">Agregar conocimiento</span>
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !currentOrganization?.id}
            className="h-10 w-full px-3 lg:w-auto"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4 shrink-0" />
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
        <Card className="max-w-full overflow-hidden border-dashed border-2 border-primary/50">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="outline" className="max-w-full gap-1">
                  {React.createElement(getCategoryInfo(selectedCategory).icon, { className: "h-3 w-3" })}
                  <span className="truncate">{getCategoryInfo(selectedCategory).label}</span>
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={cancelAdd}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {selectedCategory === 'general' ? (
              <>
                <div className="min-w-0 space-y-2">
                  <Label>Título / Tema</Label>
                  <Input
                    placeholder="Ej: Métodos de pago disponibles"
                    value={newItem.title}
                    onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="min-w-0 space-y-2">
                  <Label>Contenido</Label>
                  <Textarea
                    placeholder="Escribe la información que la IA debe conocer..."
                    value={newItem.content}
                    onChange={(e) => setNewItem(prev => ({ ...prev, content: e.target.value }))}
                    className="min-h-[120px]"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="min-w-0 space-y-2">
                  <Label>Nombre del producto</Label>
                  <Input
                    placeholder="Ej: Camiseta básica blanca"
                    value={newItem.productName}
                    onChange={(e) => setNewItem(prev => ({ ...prev, productName: e.target.value }))}
                  />
                </div>

                <div className="min-w-0 space-y-2">
                  <Label>¿Cuándo recomendar este producto?</Label>
                  <Input
                    placeholder="Ej: Cuando pregunte por ropa casual, básicos, outfit diario"
                    value={newItem.recommendWhen}
                    onChange={(e) => setNewItem(prev => ({ ...prev, recommendWhen: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Palabras clave o situaciones en las que la IA debería sugerir este producto
                  </p>
                </div>

                <div className="min-w-0 space-y-2">
                  <Label>Detalles del producto</Label>
                  <Textarea
                    placeholder="Características, tallas disponibles, precio, materiales, cuidados, etc."
                    value={newItem.content}
                    onChange={(e) => setNewItem(prev => ({ ...prev, content: e.target.value }))}
                    className="min-h-[120px]"
                  />
                </div>
              </>
            )}

            {currentOrganization?.id && (
              <KnowledgeImageUpload
                images={newItem.images || []}
                onImagesChange={(images) => setNewItem(prev => ({ ...prev, images }))}
                organizationId={currentOrganization.id}
              />
            )}

            <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
              <Button variant="outline" onClick={cancelAdd} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button onClick={addItem} className="w-full sm:w-auto">
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
            const isEditing = editingItemId === item.id;
            
            return (
              <Card key={item.id} className={cn('max-w-full overflow-hidden rounded-md', isEditing ? 'border-primary' : '')}>
                <CardContent className="p-3 sm:p-6">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="max-w-full gap-1">
                          <Icon className="h-3 w-3" />
                          <span className="truncate">{categoryInfo.label}</span>
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={cancelEditing}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {item.category === 'general' ? (
                        <>
                          <div className="min-w-0 space-y-2">
                            <Label>Título / Tema</Label>
                            <Input
                              value={editingItem.title}
                              onChange={(e) => setEditingItem(prev => ({ ...prev, title: e.target.value }))}
                              placeholder="Título del conocimiento"
                            />
                          </div>
                          <div className="min-w-0 space-y-2">
                            <Label>Contenido</Label>
                            <Textarea
                              value={editingItem.content}
                              onChange={(e) => setEditingItem(prev => ({ ...prev, content: e.target.value }))}
                              className="min-h-[120px]"
                              placeholder="Contenido del conocimiento"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="min-w-0 space-y-2">
                            <Label>Nombre del producto</Label>
                            <Input
                              value={editingItem.productName}
                              onChange={(e) => setEditingItem(prev => ({ ...prev, productName: e.target.value }))}
                              placeholder="Nombre del producto"
                            />
                          </div>
                          <div className="min-w-0 space-y-2">
                            <Label>¿Cuándo recomendar este producto?</Label>
                            <Input
                              value={editingItem.recommendWhen}
                              onChange={(e) => setEditingItem(prev => ({ ...prev, recommendWhen: e.target.value }))}
                              placeholder="Ej: Cuando pregunte por ropa casual"
                            />
                          </div>
                          <div className="min-w-0 space-y-2">
                            <Label>Detalles del producto</Label>
                            <Textarea
                              value={editingItem.content}
                              onChange={(e) => setEditingItem(prev => ({ ...prev, content: e.target.value }))}
                              className="min-h-[120px]"
                              placeholder="Características, tallas, precio, etc."
                            />
                          </div>
                        </>
                      )}
                      
                      {currentOrganization?.id && (
                        <KnowledgeImageUpload
                          images={editingItem.images || []}
                          onImagesChange={(images) => setEditingItem(prev => ({ ...prev, images }))}
                          organizationId={currentOrganization.id}
                        />
                      )}
                      <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
                        <Button variant="outline" onClick={cancelEditing} className="w-full sm:w-auto">
                          Cancelar
                        </Button>
                        <Button onClick={() => saveEditing(item.id)} className="w-full sm:w-auto">
                          <Check className="h-4 w-4 mr-2" />
                          Guardar cambios
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <Badge variant="outline" className="max-w-full gap-1">
                          <Icon className="h-3 w-3" />
                          <span className="truncate">{categoryInfo.label}</span>
                        </Badge>
                        <p className="break-words text-[15px] font-semibold leading-snug [overflow-wrap:anywhere] sm:text-base">
                          {item.category === 'product' ? item.productName || item.title : item.title}
                        </p>
                        {item.category === 'product' && item.recommendWhen && (
                          <p className="inline-block max-w-full break-words rounded-md bg-primary/5 px-2 py-1 text-xs text-primary/80 [overflow-wrap:anywhere]">
                            Recomendar: {item.recommendWhen}
                          </p>
                        )}
                        <p
                          className={cn(
                            "whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]",
                            !expandedItemIds.has(item.id) && "line-clamp-[10] sm:line-clamp-none"
                          )}
                        >
                          {item.content}
                        </p>
                        {item.content.length > 420 && (
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 text-sm"
                            onClick={() => toggleExpanded(item.id)}
                          >
                            {expandedItemIds.has(item.id) ? 'Ver menos' : 'Ver completo'}
                          </Button>
                        )}
                        {/* Display images */}
                        {item.images && item.images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.images.map((url, imgIndex) => (
                              <a
                                key={imgIndex}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-16 h-16 rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity"
                              >
                                <img
                                  src={url}
                                  alt={`Imagen ${imgIndex + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 justify-end gap-1 border-t pt-2 sm:border-t-0 sm:pt-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-primary"
                          onClick={() => startEditing(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Stats by Category */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CATEGORIES.map(cat => {
          const count = items.filter(i => i.category === cat.value).length;
          const Icon = cat.icon;
          return (
            <Card key={cat.value}>
              <CardContent className="p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="shrink-0 rounded-lg bg-muted p-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="truncate text-xs text-muted-foreground">{cat.label}</p>
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
          <div className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              return (
                <Button
                  key={cat.value}
                  variant="outline"
                  className="h-auto px-4 py-4 flex flex-col items-center gap-2 whitespace-normal hover:border-primary hover:bg-primary/5"
                  onClick={() => handleCategorySelect(cat.value)}
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-center text-sm font-medium leading-tight">{cat.label}</span>
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
