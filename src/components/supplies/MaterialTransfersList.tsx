import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, CheckCircle, Clock, Package, X, ArrowRight } from 'lucide-react';
import { useMaterialTransfers } from '@/hooks/useMaterialTransfers';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const MaterialTransfersList: React.FC = () => {
  const { transfers, loading, approveTransfer, processTransfer, cancelTransfer } = useMaterialTransfers();
  const { hasPermission } = useAuth();

  const canManageTransfers = hasPermission('insumos', 'edit') || hasPermission('insumos', 'delete');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'approved':
        return <AlertCircle className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <X className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'approved':
        return 'default';
      case 'completed':
        return 'default';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600';
      case 'approved':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'cancelled':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobada';
      case 'completed':
        return 'Completada';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center">
            <Package className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p>Cargando transferencias...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Historial de Transferencias
        </CardTitle>
      </CardHeader>
      <CardContent>
        {transfers.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No hay transferencias registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="text-center">
                    <ArrowRight className="h-4 w-4 mx-auto" />
                  </TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  {canManageTransfers && <TableHead>Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{transfer.material?.name}</div>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-xs">
                            {transfer.material?.sku}
                          </Badge>
                          {transfer.material?.color && (
                            <Badge variant="secondary" className="text-xs">
                              {transfer.material?.color}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{transfer.from_location_name}</div>
                        <Badge variant="outline" className="text-xs">
                          {transfer.from_location_type === 'warehouse' ? 'Bodega' : 'Taller'}
                        </Badge>
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{transfer.to_location_name}</div>
                        <Badge variant="outline" className="text-xs">
                          {transfer.to_location_type === 'warehouse' ? 'Bodega' : 'Taller'}
                        </Badge>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="font-medium">
                        {transfer.quantity} {transfer.material?.unit}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge 
                        variant={getStatusVariant(transfer.status)}
                        className={`flex items-center gap-1 w-fit ${getStatusColor(transfer.status)}`}
                      >
                        {getStatusIcon(transfer.status)}
                        {getStatusText(transfer.status)}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(transfer.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </div>
                      {transfer.transfer_date && (
                        <div className="text-xs text-muted-foreground">
                          Completada: {format(new Date(transfer.transfer_date), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </div>
                      )}
                    </TableCell>
                    
                    {canManageTransfers && (
                      <TableCell>
                        <div className="flex gap-1">
                          {transfer.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approveTransfer(transfer.id)}
                              >
                                Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => cancelTransfer(transfer.id)}
                              >
                                Cancelar
                              </Button>
                            </>
                          )}
                          {transfer.status === 'approved' && (
                            <Button
                              size="sm"
                              onClick={() => processTransfer(transfer.id)}
                            >
                              Procesar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MaterialTransfersList;