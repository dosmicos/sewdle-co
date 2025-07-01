
import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Plus, Search, RefreshCw, Filter, X } from 'lucide-react';

interface OrderFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedWorkshop: string;
  setSelectedWorkshop: (workshop: string) => void;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  workshops: any[];
  showFiltersSheet: boolean;
  setShowFiltersSheet: (show: boolean) => void;
  onRefetch: () => void;
  onClearFilters: () => void;
  getActiveFiltersCount: () => number;
  canCreateOrders: boolean;
  onCreateOrder: () => void;
}

const OrderFilters = ({
  searchTerm,
  setSearchTerm,
  selectedWorkshop,
  setSelectedWorkshop,
  selectedStatus,
  setSelectedStatus,
  workshops,
  showFiltersSheet,
  setShowFiltersSheet,
  onRefetch,
  onClearFilters,
  getActiveFiltersCount,
  canCreateOrders,
  onCreateOrder
}: OrderFiltersProps) => {
  const isMobile = useIsMobile();

  // Componente para el contenido de filtros
  const FiltersContent = () => (
    <div className="space-y-4">
      {/* Filtro por taller */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Taller</label>
        <Select value={selectedWorkshop} onValueChange={setSelectedWorkshop}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos los talleres" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los talleres</SelectItem>
            {workshops.map(workshop => (
              <SelectItem key={workshop.id} value={workshop.id}>
                {workshop.name}
              </SelectItem>
            ))}
            <SelectItem value="unassigned">Sin asignar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filtro por estado */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Estado</label>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="assigned">Asignada</SelectItem>
            <SelectItem value="in_progress">En Progreso</SelectItem>
            <SelectItem value="completed">Completada</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Botón limpiar filtros */}
      <div className="pt-4 border-t">
        <Button 
          variant="outline" 
          onClick={() => {
            onClearFilters();
            setShowFiltersSheet(false);
          }} 
          className="w-full flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Limpiar filtros
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="bg-white border-0 shadow-sm rounded-2xl">
      <CardContent className="p-4 md:p-6">
        {isMobile ? (
          // Vista móvil con drawer
          <div className="space-y-4">
            {/* Búsqueda principal siempre visible */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input 
                type="text" 
                placeholder="Buscar órdenes..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
              />
            </div>

            {/* Botones de acción móvil */}
            <div className="flex gap-3 justify-between">
              <div className="flex gap-2">
                {/* Botón de filtros con Sheet */}
                <Sheet open={showFiltersSheet} onOpenChange={setShowFiltersSheet}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2 px-4 py-3 bg-white border-gray-200 hover:bg-gray-50 rounded-xl relative">
                      <Filter className="w-4 h-4" />
                      Filtros
                      {getActiveFiltersCount() > 0 && (
                        <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-blue-600 text-white text-xs p-0 flex items-center justify-center">
                          {getActiveFiltersCount()}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-auto max-h-[80vh]">
                    <SheetHeader className="text-left pb-6">
                      <SheetTitle>Filtros de búsqueda</SheetTitle>
                      <SheetDescription>
                        Ajusta los filtros para encontrar las órdenes que necesitas
                      </SheetDescription>
                    </SheetHeader>
                    <FiltersContent />
                  </SheetContent>
                </Sheet>

                <Button 
                  variant="outline" 
                  onClick={onRefetch} 
                  className="flex items-center gap-2 px-4 py-3 bg-white border-gray-200 hover:bg-gray-50 rounded-xl"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              
              {canCreateOrders && (
                <Button 
                  onClick={onCreateOrder} 
                  className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  Nueva
                </Button>
              )}
            </div>
          </div>
        ) : (
          // Vista desktop original
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Búsqueda */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input 
                  type="text" 
                  placeholder="Buscar órdenes..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                />
              </div>

              {/* Filtro por taller */}
              <Select value={selectedWorkshop} onValueChange={setSelectedWorkshop}>
                <SelectTrigger className="h-12 rounded-xl border-gray-200">
                  <SelectValue placeholder="Todos los talleres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los talleres</SelectItem>
                  {workshops.map(workshop => (
                    <SelectItem key={workshop.id} value={workshop.id}>
                      {workshop.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="unassigned">Sin asignar</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro por estado */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-12 rounded-xl border-gray-200">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="assigned">Asignada</SelectItem>
                  <SelectItem value="in_progress">En Progreso</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>

              {/* Limpiar filtros */}
              <Button 
                variant="outline" 
                onClick={onClearFilters} 
                className="h-12 px-4 border-gray-200 hover:bg-gray-50 rounded-xl"
              >
                <Filter className="w-4 h-4" />
                Limpiar
              </Button>
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={onRefetch} 
                className="flex items-center gap-2 px-6 py-3 bg-white border-gray-200 hover:bg-gray-50 rounded-xl"
              >
                <RefreshCw className="w-4 h-4" />
                Actualizar
              </Button>
              
              {canCreateOrders && (
                <Button 
                  onClick={onCreateOrder} 
                  className="flex items-center gap-2 px-6 py-3 text-white rounded-xl shadow-lg bg-[#ff5c02]"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Orden
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrderFilters;
