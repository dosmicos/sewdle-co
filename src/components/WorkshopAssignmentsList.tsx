
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Building2, Package, Trash2, Edit } from 'lucide-react';
import { useWorkshopAssignments } from '@/hooks/useWorkshopAssignments';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const WorkshopAssignmentsList: React.FC = () => {
  const { assignments, loading, updateAssignment, deleteAssignment } = useWorkshopAssignments();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      assigned: { label: 'Asignado', variant: 'default' as const },
      in_progress: { label: 'En Progreso', variant: 'secondary' as const },
      completed: { label: 'Completado', variant: 'default' as const },
      cancelled: { label: 'Cancelado', variant: 'destructive' as const },
      delayed: { label: 'Retrasado', variant: 'secondary' as const }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.assigned;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleStatusChange = async (assignmentId: string, newStatus: string) => {
    setUpdatingId(assignmentId);
    await updateAssignment(assignmentId, { status: newStatus });
    setUpdatingId(null);
  };

  const handleDelete = async (assignmentId: string) => {
    await deleteAssignment(assignmentId);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-black">Asignaciones de Trabajo</h2>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay asignaciones</h3>
          <p className="text-gray-600">Comienza asignando órdenes a los talleres</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Taller</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha Asignación</TableHead>
                <TableHead>Fecha Esperada</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Package className="w-4 h-4 text-blue-500" />
                      <div>
                        <p className="font-medium">{(assignment as Record<string, unknown>).orders?.order_number}</p>
                        <p className="text-sm text-gray-600">{(assignment as Record<string, unknown>).orders?.client_name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-green-500" />
                      <span>{(assignment as Record<string, unknown>).workshops?.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={assignment.status || 'assigned'}
                      onValueChange={(value) => handleStatusChange(assignment.id, value)}
                      disabled={updatingId === assignment.id}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assigned">Asignado</SelectItem>
                        <SelectItem value="in_progress">En Progreso</SelectItem>
                        <SelectItem value="completed">Completado</SelectItem>
                        <SelectItem value="delayed">Retrasado</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {assignment.assigned_date 
                          ? format(new Date(assignment.assigned_date), 'dd/MM/yyyy', { locale: es })
                          : 'No asignada'
                        }
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {assignment.expected_completion_date 
                          ? format(new Date(assignment.expected_completion_date), 'dd/MM/yyyy', { locale: es })
                          : 'No definida'
                        }
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar asignación?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará la asignación y la orden volverá al estado pendiente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(assignment.id)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default WorkshopAssignmentsList;
