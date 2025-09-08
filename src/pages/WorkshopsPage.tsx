import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Building2, Package, Star, Clock, ArrowLeft, Trash2, Edit } from 'lucide-react';
import WorkshopForm from '@/components/WorkshopForm';
import WorkshopDetails from '@/components/WorkshopDetails';
import WorkshopEditModal from '@/components/WorkshopEditModal';
import { WorkshopPricingDiagnostic } from '@/components/WorkshopPricingDiagnostic';

import { useWorkshopsWithStats } from '@/hooks/useWorkshopsWithStats';
import { useAuth } from '@/contexts/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const WorkshopsPage = () => {
  const [showForm, setShowForm] = useState(false);
  const [selectedWorkshop, setSelectedWorkshop] = useState<any>(null);
  const [editingWorkshop, setEditingWorkshop] = useState<any>(null);
  const {
    workshops,
    loading,
    deleteWorkshop,
    refetch
  } = useWorkshopsWithStats();
  const {
    hasPermission
  } = useAuth();

  // Verificar permisos
  const canCreateWorkshops = hasPermission('workshops', 'create');
  const canEditWorkshops = hasPermission('workshops', 'edit');
  const canDeleteWorkshops = hasPermission('workshops', 'delete');
  
  const handleWorkshopClick = (workshop: any) => {
    setSelectedWorkshop(workshop);
  };
  
  const handleBackToList = () => {
    setSelectedWorkshop(null);
  };
  
  const handleDeleteWorkshop = async (workshopId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteWorkshop(workshopId);
  };

  const handleEditWorkshop = (workshop: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWorkshop(workshop);
  };
  
  const handleFormSuccess = async () => {
    await refetch(); // Refetch the workshops list
    setShowForm(false);
  };

  const handleEditSuccess = async () => {
    await refetch(); // Refetch the workshops list
    setEditingWorkshop(null);
  };

  if (showForm) {
    return <div className="animate-fade-in">
        <div className="px-6 pb-3 pt-6">
          <Button onClick={() => setShowForm(false)} variant="outline" className="border border-gray-300 bg-white hover:bg-gray-50 text-black rounded-xl px-4 py-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Talleres
          </Button>
        </div>
        <WorkshopForm onSuccess={handleFormSuccess} />
      </div>;
  }
  if (selectedWorkshop) {
    return <WorkshopDetails workshop={selectedWorkshop} onBack={handleBackToList} />;
  }
  if (loading) {
    return <div className="p-6 space-y-8 animate-fade-in">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando talleres...</p>
          </div>
        </div>
      </div>;
  }
  return <div className="p-6 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">Talleres</h1>
          <p className="text-gray-600">Gestiona y supervisa todos los talleres</p>
        </div>
        {canCreateWorkshops && <Button onClick={() => setShowForm(true)} className="text-white font-medium rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98] bg-[#ff5c02]">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Taller
          </Button>}
      </div>

      <WorkshopPricingDiagnostic />


      {workshops.length === 0 ? <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay talleres registrados</h3>
          <p className="text-gray-600 mb-4">
            {canCreateWorkshops ? "Comienza agregando tu primer taller de confección" : "No tienes permisos para crear talleres"}
          </p>
          {canCreateWorkshops && <Button onClick={() => setShowForm(true)} className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl px-6 py-3">
              <Plus className="w-4 h-4 mr-2" />
              Crear Primer Taller
            </Button>}
        </div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workshops.map(workshop => <Card key={workshop.id} className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer group" onClick={() => handleWorkshopClick(workshop)}>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-black">{workshop.name}</h3>
                      <p className="text-sm text-gray-600">{workshop.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    {canEditWorkshops && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity" 
                        onClick={(e) => handleEditWorkshop(workshop, e)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {canDeleteWorkshops && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar taller?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará permanentemente el taller "{workshop.name}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={e => handleDeleteWorkshop(workshop.id, e)} className="bg-red-500 hover:bg-red-600">
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                {/* Métricas operativas */}
                <div className="grid grid-cols-3 gap-3 py-4 border-t border-gray-100">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Package className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="font-bold text-lg text-black">{workshop.stats.unitsDeliveredLastWeek}</div>
                    <div className="text-xs text-gray-600">Última semana</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Star className="w-4 h-4 text-yellow-500" />
                    </div>
                    <div className="font-bold text-lg text-black">{workshop.stats.qualityScore}%</div>
                    <div className="text-xs text-gray-600">Calidad</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Clock className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="font-bold text-lg text-black">{workshop.stats.activeOrders}</div>
                    <div className="text-xs text-gray-600">Pendientes</div>
                  </div>
                </div>

                <Button variant="outline" className="w-full border border-gray-300 bg-white hover:bg-gray-50 text-black rounded-xl py-2">
                  Ver Detalles
                </Button>
              </div>
            </Card>)}
        </div>}

      {/* Edit Workshop Modal */}
      {editingWorkshop && (
        <WorkshopEditModal
          workshop={editingWorkshop}
          open={!!editingWorkshop}
          onOpenChange={(open) => !open && setEditingWorkshop(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>;
};

export default WorkshopsPage;
