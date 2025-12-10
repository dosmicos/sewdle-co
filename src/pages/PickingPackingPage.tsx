import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PickingPackingLayout } from '@/components/picking/PickingPackingLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Package, ChevronLeft, ChevronRight, Plus, X, Users, ListChecks } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePickingOrders, OperationalStatus } from '@/hooks/usePickingOrders';
import { PickingOrderDetailsModal } from '@/components/picking/PickingOrderDetailsModal';
import { PickingBulkActionsBar } from '@/components/picking/PickingBulkActionsBar';
import { useOrganization } from '@/contexts/OrganizationContext';
import { FilterValueSelector } from '@/components/picking/FilterValueSelector';
import { SavedFiltersManager } from '@/components/picking/SavedFiltersManager';
import { PickingStatsBar } from '@/components/picking/PickingStatsBar';
import { ParaEmpacarItemsModal } from '@/components/picking/ParaEmpacarItemsModal';
import { FILTER_OPTIONS, FilterOption, ActiveFilter } from '@/types/picking';
import { useShopifyTags } from '@/hooks/useShopifyTags';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  picking: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  packing: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  ready_to_ship: 'bg-green-100 text-green-800 hover:bg-green-100',
  shipped: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
};

const statusLabels = {
  pending: 'Por Procesar',
  picking: 'Picking',
  packing: 'Empacando',
  ready_to_ship: 'Empacado',
  shipped: 'Enviado',
};

const paymentStatusColors = {
  paid: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  partially_paid: 'bg-orange-100 text-orange-800',
};

const paymentStatusLabels = {
  paid: 'Pagado',
  pending: 'Pago pendiente',
  partially_paid: 'Parcialmente pagado',
};

const PickingPackingPage = () => {
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();
  const { availableTags } = useShopifyTags();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Clear URL filters on initial mount - user starts with clean slate
  useEffect(() => {
    const hasFilters = searchParams.toString().length > 0;
    if (hasFilters) {
      setSearchParams(new URLSearchParams(), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Enrich FILTER_OPTIONS with dynamic Shopify tags
  const enrichedFilterOptions = useMemo(() => {
    return FILTER_OPTIONS.map(option => {
      if (option.id === 'tags' || option.id === 'exclude_tags') {
        return {
          ...option,
          options: availableTags.map(tag => ({
            value: tag.toLowerCase(),
            label: tag
          }))
        };
      }
      return option;
    });
  }, [availableTags]);
  const { 
    orders, 
    loading, 
    currentPage, 
    totalCount, 
    totalPages, 
    pageSize,
    fetchOrders,
    bulkUpdateOrderStatus,
    bulkUpdateOrdersByDate
  } = usePickingOrders();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filterSelectorOpen, setFilterSelectorOpen] = useState(false);
  const [selectedFilterOption, setSelectedFilterOption] = useState<FilterOption | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [commandValue, setCommandValue] = useState('');
  const [lastWebhookUpdate, setLastWebhookUpdate] = useState<Date | null>(null);
  const [hasPendingUpdates, setHasPendingUpdates] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);

  // Read filters from URL - must be declared before handleRefreshList
  const searchTerm = searchParams.get('search') || '';
  const operationalStatuses = searchParams.get('operational_status')?.split(',').filter(Boolean) || [];
  const financialStatuses = searchParams.get('financial_status')?.split(',').filter(Boolean) || [];
  const fulfillmentStatuses = searchParams.get('fulfillment_status')?.split(',').filter(Boolean) || [];
  const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
  const excludeTags = searchParams.get('exclude_tags')?.split(',').filter(Boolean) || [];
  const priceRange = searchParams.get('price_range') || '';
  const dateRange = searchParams.get('date_range') || '';
  
  // Team division params
  const teamNumber = parseInt(searchParams.get('team') || '0'); // 0 = all, 1-4 = specific team
  const totalTeams = parseInt(searchParams.get('total_teams') || '1'); // 1-4 teams

  // Simple refresh - only fetches from local DB (webhook handles real-time updates from Shopify)
  const handleRefreshList = () => {
    fetchOrders({
      searchTerm: searchTerm || undefined,
      operationalStatuses: operationalStatuses.length > 0 ? operationalStatuses : undefined,
      financialStatuses: financialStatuses.length > 0 ? financialStatuses : undefined,
      fulfillmentStatuses: fulfillmentStatuses.length > 0 ? fulfillmentStatuses : undefined,
      tags: tags.length > 0 ? tags : undefined,
      excludeTags: excludeTags.length > 0 ? excludeTags : undefined,
      priceRange: priceRange || undefined,
      dateRange: dateRange || undefined,
      page: currentPage
    });
  };

  // Supabase Realtime - Auto refresh when shopify_orders table changes
  useEffect(() => {
    if (!currentOrganization?.id) return;

    const channel = supabase
      .channel('shopify-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopify_orders',
          filter: `organization_id=eq.${currentOrganization.id}`
        },
        (payload) => {
          console.log('🔔 Webhook update received:', payload.eventType);
          setLastWebhookUpdate(new Date());
          // Solo auto-refresh si NO hay modal abierto
          if (!selectedOrderId) {
            handleRefreshList();
          } else {
            // Marcar que hay updates pendientes para cuando se cierre el modal
            setHasPendingUpdates(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id, searchTerm, operationalStatuses.join(','), financialStatuses.join(','), 
      fulfillmentStatuses.join(','), tags.join(','), excludeTags.join(','), priceRange, dateRange, currentPage, selectedOrderId]);

  // Auto-refresh list when modal closes if there were pending updates
  useEffect(() => {
    if (!selectedOrderId && hasPendingUpdates) {
      handleRefreshList();
      setHasPendingUpdates(false);
    }
  }, [selectedOrderId, hasPendingUpdates]);

  // Auto-ajustar filtros cuando se usa tags=confirmado (Para Preparar)
  // Esto asegura que la vista coincida exactamente con Shopify
  useEffect(() => {
    const hasConfirmadoTag = tags.some(t => t.toLowerCase() === 'confirmado');
    
    if (hasConfirmadoTag) {
      const hasOperationalStatus = searchParams.has('operational_status');
      const hasExcludeEmpacado = excludeTags.some(t => t.toLowerCase() === 'empacado');
      
      // Auto-remover operational_status y auto-agregar exclude_tags=empacado
      if (hasOperationalStatus || !hasExcludeEmpacado) {
        const newParams = new URLSearchParams(searchParams);
        
        if (hasOperationalStatus) {
          newParams.delete('operational_status');
        }
        
        if (!hasExcludeEmpacado) {
          newParams.set('exclude_tags', 'empacado');
        }
        
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [tags, excludeTags, searchParams, setSearchParams]);

  // Update filter function
  const updateFilter = (key: string, value: string | string[] | null) => {
    const newParams = new URLSearchParams(searchParams);
    
    if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      newParams.delete(key);
    } else if (Array.isArray(value)) {
      newParams.set(key, value.join(','));
    } else {
      newParams.set(key, value);
    }
    
    setSearchParams(newParams);
  };

  // Search input state and handlers
  const [searchInput, setSearchInput] = useState(searchTerm);

  // Sync searchInput when searchTerm changes externally (e.g., filter cleared)
  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  const handleSearch = () => {
    updateFilter('search', searchInput);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  // Get current filters for saving
  const getCurrentFilters = () => ({
    search: searchTerm || undefined,
    operational_status: operationalStatuses.length > 0 ? operationalStatuses : undefined,
    financial_status: financialStatuses.length > 0 ? financialStatuses : undefined,
    fulfillment_status: fulfillmentStatuses.length > 0 ? fulfillmentStatuses : undefined,
    tags: tags.length > 0 ? tags : undefined,
    exclude_tags: excludeTags.length > 0 ? excludeTags : undefined,
    price_range: priceRange || undefined,
    date_range: dateRange || undefined,
  });

  // Load saved filter
  const loadSavedFilter = (filters: Record<string, any>) => {
    const newParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value) && value.length > 0) {
          newParams.set(key, value.join(','));
        } else if (!Array.isArray(value)) {
          newParams.set(key, value.toString());
        }
      }
    });
    
    setSearchParams(newParams);
  };

  // Build active filters for display
  const activeFilters: ActiveFilter[] = [];

  if (operationalStatuses.length > 0) {
    const labels = operationalStatuses.map(s => statusLabels[s as OperationalStatus] || s);
    activeFilters.push({
      id: 'operational_status',
      label: 'Preparación',
      value: operationalStatuses,
      displayText: `Preparación: ${labels.join(', ')}`
    });
  }

  if (financialStatuses.length > 0) {
    const labels = financialStatuses.map(s => paymentStatusLabels[s as keyof typeof paymentStatusLabels] || s);
    activeFilters.push({
      id: 'financial_status',
      label: 'Pago',
      value: financialStatuses,
      displayText: `Pago: ${labels.join(', ')}`
    });
  }

  if (fulfillmentStatuses.length > 0) {
    const fulfillmentLabels: Record<string, string> = {
      fulfilled: 'Confirmado',
      partial: 'Parcial',
      unfulfilled: 'Sin confirmar',
    };
    const labels = fulfillmentStatuses.map(s => fulfillmentLabels[s] || s);
    activeFilters.push({
      id: 'fulfillment_status',
      label: 'Entrega',
      value: fulfillmentStatuses,
      displayText: `Entrega: ${labels.join(', ')}`
    });
  }

  if (tags.length > 0) {
    activeFilters.push({
      id: 'tags',
      label: 'Incluir',
      value: tags,
      displayText: `Incluir: ${tags.join(', ')}`
    });
  }

  if (excludeTags.length > 0) {
    activeFilters.push({
      id: 'exclude_tags',
      label: 'Excluir',
      value: excludeTags,
      displayText: `Excluir: ${excludeTags.join(', ')}`
    });
  }

  if (priceRange) {
    const priceLabel = FILTER_OPTIONS.find(f => f.id === 'price_range')
      ?.options?.find(o => o.value === priceRange)?.label || priceRange;
    activeFilters.push({
      id: 'price_range',
      label: 'Precio',
      value: priceRange,
      displayText: `Precio: ${priceLabel}`
    });
  }

  if (dateRange) {
    const dateLabel = FILTER_OPTIONS.find(f => f.id === 'date_range')
      ?.options?.find(o => o.value === dateRange)?.label || dateRange;
    activeFilters.push({
      id: 'date_range',
      label: 'Fecha',
      value: dateRange,
      displayText: `Fecha: ${dateLabel}`
    });
  }

  const handleFilterSelect = (option: FilterOption) => {
    console.log('🔍 Filter selected:', option);
    setSelectedFilterOption(option);
    setPopoverOpen(false);
    setFilterSelectorOpen(true);
  };

  const handleFilterApply = (value: string | string[]) => {
    console.log('✅ Filter applied:', { filterId: selectedFilterOption?.id, value });
    if (selectedFilterOption) {
      updateFilter(selectedFilterOption.id, value);
    }
    setFilterSelectorOpen(false);
    setSelectedFilterOption(null);
  };

  const handleFilterCancel = () => {
    setFilterSelectorOpen(false);
    setSelectedFilterOption(null);
    setCommandValue('');
  };

  // Fetch orders when filters change
  useEffect(() => {
    if (currentOrganization?.id) {
      // Si hay búsqueda activa, ignorar los demás filtros para buscar globalmente
      if (searchTerm) {
        fetchOrders({ 
          searchTerm,
          page: 1 
        });
      } else {
        // Sin búsqueda, aplicar todos los filtros normalmente
        fetchOrders({ 
          operationalStatuses: operationalStatuses.length > 0 ? operationalStatuses : undefined,
          financialStatuses: financialStatuses.length > 0 ? financialStatuses : undefined,
          fulfillmentStatuses: fulfillmentStatuses.length > 0 ? fulfillmentStatuses : undefined,
          tags: tags.length > 0 ? tags : undefined,
          excludeTags: excludeTags.length > 0 ? excludeTags : undefined,
          priceRange: priceRange || undefined,
          dateRange: dateRange || undefined,
          page: 1 
        });
      }
    }
  }, [searchTerm, operationalStatuses.join(','), financialStatuses.join(','), 
      fulfillmentStatuses.join(','), tags.join(','), excludeTags.join(','), priceRange, dateRange, currentOrganization?.id]);

  

  const handlePageChange = (page: number) => {
    // Si hay búsqueda activa, ignorar los demás filtros
    if (searchTerm) {
      fetchOrders({ 
        searchTerm,
        page 
      });
    } else {
      fetchOrders({ 
        operationalStatuses: operationalStatuses.length > 0 ? operationalStatuses : undefined,
        financialStatuses: financialStatuses.length > 0 ? financialStatuses : undefined,
        fulfillmentStatuses: fulfillmentStatuses.length > 0 ? fulfillmentStatuses : undefined,
        tags: tags.length > 0 ? tags : undefined,
        excludeTags: excludeTags.length > 0 ? excludeTags : undefined,
        priceRange: priceRange || undefined,
        dateRange: dateRange || undefined,
        page 
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter orders by team using modulo
  const filteredOrdersByTeam = useMemo(() => {
    if (teamNumber === 0 || totalTeams === 1) {
      return orders; // Show all
    }
    
    return orders.filter(order => {
      const orderNum = parseInt(order.shopify_order?.order_number?.replace(/\D/g, '') || '0');
      // Modulo to assign to team (0-indexed internally)
      return (orderNum % totalTeams) === (teamNumber - 1);
    });
  }, [orders, teamNumber, totalTeams]);

  // Team management functions
  const updateTeamParams = (team: number, total: number) => {
    const newParams = new URLSearchParams(searchParams);
    
    if (total === 1) {
      newParams.delete('team');
      newParams.delete('total_teams');
    } else {
      newParams.set('total_teams', total.toString());
      if (team > total) {
        newParams.delete('team');
      } else if (team > 0) {
        newParams.set('team', team.toString());
      } else {
        newParams.delete('team');
      }
    }
    
    setSearchParams(newParams);
  };

  // Team colors
  const teamColors: Record<number, string> = {
    1: 'bg-blue-500 hover:bg-blue-600 text-white',
    2: 'bg-green-500 hover:bg-green-600 text-white',
    3: 'bg-orange-500 hover:bg-orange-600 text-white',
    4: 'bg-purple-500 hover:bg-purple-600 text-white',
  };

  const teamBgColors: Record<number, string> = {
    1: 'bg-blue-100 text-blue-800 border border-blue-300',
    2: 'bg-green-100 text-green-800 border border-green-300',
    3: 'bg-orange-100 text-orange-800 border border-orange-300',
    4: 'bg-purple-100 text-purple-800 border border-purple-300',
  };

  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  // For stats, we'll show totals from filtered orders
  const stats = {
    total: filteredOrdersByTeam.length,
    pending: filteredOrdersByTeam.filter(o => {
      if (o.operational_status !== 'pending') return false;
      const tags = (o.shopify_order?.tags || '').toLowerCase().trim();
      return tags.includes('confirmado') && !tags.includes('empacado');
    }).length,
    picking: filteredOrdersByTeam.filter(o => o.operational_status === 'picking').length,
    packing: filteredOrdersByTeam.filter(o => o.operational_status === 'packing').length,
    ready: filteredOrdersByTeam.filter(o => o.operational_status === 'ready_to_ship').length,
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(filteredOrdersByTeam.map(o => o.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    }
  };

  const handleBulkMarkAsPacked = async (orderIds: string[]) => {
    await bulkUpdateOrderStatus(orderIds, 'ready_to_ship');
  };

  const handleBulkUpdateByDate = async () => {
    const confirmed = window.confirm(
      '⚠️ Esto marcará como ENVIADAS todas las órdenes antes del 1 de Agosto 2025.\n\nEstas órdenes desaparecerán de Sewdle.\n\n¿Deseas continuar?'
    );
    
    if (!confirmed) return;

    try {
      const results = await bulkUpdateOrdersByDate('2025-08-01', 'shipped');
      console.log('✅ Actualización completada:', results);
    } catch (error) {
      console.error('❌ Error en actualización masiva:', error);
    }
  };

  const formatCurrency = (amount?: number, currency?: string) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return `Hoy ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return date.toLocaleDateString('es-CO', { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Mostrar loading mientras se carga la organización o los datos
  if (!currentOrganization || loading) {
    return (
      <PickingPackingLayout>
        <div className="flex items-center justify-center h-96">
          <div className="space-y-4 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">
              {!currentOrganization ? 'Cargando organización...' : 'Cargando órdenes...'}
            </p>
          </div>
        </div>
      </PickingPackingLayout>
    );
  }

  return (
    <PickingPackingLayout>
      <div className="space-y-6">
        {/* Search and Filters */}
        <div className="space-y-3 md:space-y-4">
          <div className="flex flex-col md:flex-row gap-2 md:gap-4">
            {/* Búsqueda */}
            <div className="relative flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar orden o cliente..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="pl-10 text-sm"
                />
              </div>
              <Button
                variant="default"
                size="default"
                onClick={handleSearch}
                className="gap-2 px-3"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Buscar</span>
              </Button>
            </div>
            
            {/* Botones de acción */}
            <div className="flex items-center gap-2 justify-between md:justify-end">
              {lastWebhookUpdate && (
                <span className="text-xs text-muted-foreground hidden lg:inline">
                  Última: {lastWebhookUpdate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowItemsModal(true)}
                className="gap-1.5 px-2 md:px-3"
                title="Ver lista de artículos para empacar"
              >
                <ListChecks className="w-4 h-4" />
                <span className="hidden sm:inline">Artículos</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshList}
                disabled={loading}
                title="Refrescar lista de pedidos"
                className="gap-1.5 px-2 md:px-3"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Actualizar</span>
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <PickingStatsBar
            onFilterClick={(filterType) => {
              const newParams = new URLSearchParams();
              switch (filterType) {
                case 'pedidos':
                  // Show both para_empacar and no_confirmados - clear filters to show all open orders
                  break;
                case 'para_empacar':
                  newParams.set('financial_status', 'paid,pending,partially_paid');
                  newParams.set('tags', 'confirmado');
                  newParams.set('exclude_tags', 'empacado');
                  break;
                case 'no_confirmados':
                  newParams.set('exclude_tags', 'confirmado');
                  break;
                case 'empacados':
                  newParams.set('tags', 'empacado');
                  break;
              }
              setSearchParams(newParams);
            }}
          />

          {/* Saved Filters Manager */}
          <SavedFiltersManager
            currentFilters={getCurrentFilters()}
            onLoadFilter={loadSavedFilter}
          />

          {/* Advanced Filters UI */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Active filter chips */}
            {activeFilters.map((filter) => (
              <Badge
                key={filter.id}
                variant="secondary"
                className="px-3 py-1.5 text-sm flex items-center gap-2"
              >
                {filter.displayText}
                <button
                  onClick={() => updateFilter(filter.id, null)}
                  className="hover:bg-muted rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            
            {/* Add filter button */}
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Agregar filtro
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command value={commandValue} onValueChange={setCommandValue}>
                  <CommandInput placeholder="Buscar filtro..." />
                  <CommandList>
                    <CommandEmpty>No se encontraron filtros</CommandEmpty>
                    <CommandGroup>
                      {enrichedFilterOptions.map((option) => (
                        <CommandItem
                          key={option.id}
                          value={option.id}
                          onSelect={(value) => {
                            const selected = enrichedFilterOptions.find(opt => opt.id === value);
                            if (selected) {
                              handleFilterSelect(selected);
                              setCommandValue('');
                            }
                          }}
                          className="cursor-pointer"
                        >
                          {option.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            
            {/* Clear all button */}
            {activeFilters.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                Borrar todo
              </Button>
            )}
          </div>
        </div>

        {/* Team Division Selector */}
        <div className="bg-muted/30 border rounded-lg p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Dividir en:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(n => (
                  <Button
                    key={n}
                    variant={totalTeams === n ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateTeamParams(0, n)}
                    className="min-w-[40px]"
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
            
            {totalTeams > 1 && (
              <div className="flex items-center gap-2 border-l pl-4">
                <span className="text-sm font-medium">Ver equipo:</span>
                <div className="flex gap-1">
                  <Button
                    variant={teamNumber === 0 ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateTeamParams(0, totalTeams)}
                  >
                    Todos
                  </Button>
                  {Array.from({length: totalTeams}, (_, i) => i + 1).map(n => (
                    <Button
                      key={n}
                      variant={teamNumber === n ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateTeamParams(n, totalTeams)}
                      className={teamNumber === n ? teamColors[n] : ''}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Team indicator */}
            {teamNumber > 0 && totalTeams > 1 && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${teamBgColors[teamNumber]}`}>
                <Users className="w-4 h-4" />
                <span className="font-semibold text-sm">
                  Equipo {teamNumber} de {totalTeams}
                </span>
                <Badge variant="secondary" className="bg-white/50">
                  {filteredOrdersByTeam.length} pedidos
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Stats Summary */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm">
            <Package className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">
              {teamNumber > 0 ? `Equipo ${teamNumber}:` : 'Total:'} {stats.total} órdenes
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">
              ⚡ En proceso: {stats.picking + stats.packing}
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">
              ✅ Listas: {stats.ready}
            </span>
          </div>
        </div>

        {/* Orders Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedOrders.length === filteredOrdersByTeam.length && filteredOrdersByTeam.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado del pago</TableHead>
                <TableHead>Estado de preparación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrdersByTeam.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    {teamNumber > 0 ? `No hay órdenes para el equipo ${teamNumber}` : 'No se encontraron órdenes'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrdersByTeam.map((order) => (
                  <TableRow 
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell 
                      className="font-medium"
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      #{order.shopify_order?.order_number}
                    </TableCell>
                    <TableCell onClick={() => setSelectedOrderId(order.id)}>
                      {formatDate(order.shopify_order?.created_at_shopify || order.created_at)}
                    </TableCell>
                    <TableCell onClick={() => setSelectedOrderId(order.id)}>
                      {order.shopify_order?.customer_first_name} {order.shopify_order?.customer_last_name}
                      {order.shopify_order?.customer_email && (
                        <div className="text-xs text-muted-foreground">
                          {order.shopify_order.customer_email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell onClick={() => setSelectedOrderId(order.id)}>
                      <Badge 
                        variant="secondary"
                        className={paymentStatusColors[order.shopify_order?.financial_status as keyof typeof paymentStatusColors] || ''}
                      >
                        {paymentStatusLabels[order.shopify_order?.financial_status as keyof typeof paymentStatusLabels] || order.shopify_order?.financial_status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => setSelectedOrderId(order.id)}>
                      <Badge 
                        variant="secondary"
                        className={statusColors[order.operational_status]}
                      >
                        {statusLabels[order.operational_status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Mostrando {startIndex}-{endIndex} de {totalCount} órdenes
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                </PaginationItem>
                
                {/* Smart pagination */}
                {(() => {
                  const pages = [];
                  
                  // Caso 1: Solo una página
                  if (totalPages === 1) {
                    return (
                      <PaginationItem key={1}>
                        <PaginationLink isActive={true}>1</PaginationLink>
                      </PaginationItem>
                    );
                  }
                  
                  // Caso 2: Pocas páginas (7 o menos) - mostrar todas
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(
                        <PaginationItem key={i}>
                          <PaginationLink
                            onClick={() => handlePageChange(i)}
                            isActive={currentPage === i}
                          >
                            {i}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    }
                    return pages;
                  }
                  
                  // Caso 3: Muchas páginas - smart pagination
                  const delta = 2;
                  
                  // Siempre mostrar primera página
                  pages.push(
                    <PaginationItem key={1}>
                      <PaginationLink
                        onClick={() => handlePageChange(1)}
                        isActive={currentPage === 1}
                      >
                        1
                      </PaginationLink>
                    </PaginationItem>
                  );
                  
                  // Determinar el rango de páginas a mostrar alrededor de la actual
                  let rangeStart = Math.max(2, currentPage - delta);
                  let rangeEnd = Math.min(totalPages - 1, currentPage + delta);
                  
                  // Ajustar rangos para evitar ellipsis innecesarios
                  if (currentPage <= delta + 2) {
                    // Cerca del inicio: mostrar más páginas al inicio
                    rangeStart = 2;
                    rangeEnd = Math.min(5, totalPages - 1);
                  } else if (currentPage >= totalPages - delta - 1) {
                    // Cerca del final: mostrar más páginas al final
                    rangeStart = Math.max(totalPages - 4, 2);
                    rangeEnd = totalPages - 1;
                  }
                  
                  // Agregar ellipsis inicial si hay gap
                  if (rangeStart > 2) {
                    pages.push(
                      <PaginationItem key="ellipsis-start">
                        <span className="px-4 text-muted-foreground">...</span>
                      </PaginationItem>
                    );
                  }
                  
                  // Agregar páginas del rango
                  for (let i = rangeStart; i <= rangeEnd; i++) {
                    pages.push(
                      <PaginationItem key={i}>
                        <PaginationLink
                          onClick={() => handlePageChange(i)}
                          isActive={currentPage === i}
                        >
                          {i}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  }
                  
                  // Agregar ellipsis final si hay gap
                  if (rangeEnd < totalPages - 1) {
                    pages.push(
                      <PaginationItem key="ellipsis-end">
                        <span className="px-4 text-muted-foreground">...</span>
                      </PaginationItem>
                    );
                  }
                  
                  // Siempre mostrar última página
                  pages.push(
                    <PaginationItem key={totalPages}>
                      <PaginationLink
                        onClick={() => handlePageChange(totalPages)}
                        isActive={currentPage === totalPages}
                      >
                        {totalPages}
                      </PaginationLink>
                    </PaginationItem>
                  );
                  
                  return pages;
                })()}

                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="gap-1"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrderId && (
        <PickingOrderDetailsModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          allOrderIds={filteredOrdersByTeam.map(o => o.id)}
          onNavigate={(newOrderId) => setSelectedOrderId(newOrderId)}
        />
      )}

      {/* Bulk Actions Bar */}
      {selectedOrders.length > 0 && (
        <PickingBulkActionsBar
          selectedCount={selectedOrders.length}
          selectedIds={selectedOrders}
          onMarkAsPacked={handleBulkMarkAsPacked}
          onClear={() => setSelectedOrders([])}
        />
      )}

      {/* Filter Value Selector Dialog */}
      {filterSelectorOpen && selectedFilterOption && (
        <FilterValueSelector
          filter={selectedFilterOption}
          currentValue={
            selectedFilterOption.type === 'multiselect'
              ? searchParams.get(selectedFilterOption.id)?.split(',').filter(Boolean) || []
              : searchParams.get(selectedFilterOption.id) || ''
          }
          onApply={handleFilterApply}
          onCancel={handleFilterCancel}
        />
      )}

      {/* Para Empacar Items Modal */}
      <ParaEmpacarItemsModal
        open={showItemsModal}
        onOpenChange={setShowItemsModal}
        onOrderClick={(shopifyOrderId) => {
          // Find the order in our list and select it
          const order = orders.find(o => o.shopify_order_id === shopifyOrderId);
          if (order) {
            setSelectedOrderId(order.id);
          }
          setShowItemsModal(false);
        }}
      />

    </PickingPackingLayout>
  );
};

export default PickingPackingPage;