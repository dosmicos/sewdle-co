
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Camera, CheckCircle, Clock, File, AlertTriangle, Plus, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Mock data for delivery details and quality check
const mockVariantDetails = [
  { id: 'v1', name: 'Blanco / S', delivered: 20, approved: null, defective: null, reason: null },
  { id: 'v2', name: 'Blanco / M', delivered: 24, approved: null, defective: null, reason: null },
  { id: 'v3', name: 'Azul / S', delivered: 16, approved: null, defective: null, reason: null },
  { id: 'v4', name: 'Azul / M', delivered: 12, approved: null, defective: null, reason: null }
];

const mockFiles = [
  { id: '1', name: 'entrega-frontal.jpg', type: 'image/jpeg', url: '#' },
  { id: '2', name: 'detalle-costura.jpg', type: 'image/jpeg', url: '#' },
  { id: '3', name: 'recibo-entrega.pdf', type: 'application/pdf', url: '#' }
];

const mockTimelineEvents = [
  {
    id: '1',
    type: 'delivery-created',
    date: '2023-06-10T10:30:00',
    user: 'Taller Central',
    details: 'Entrega registrada con 72 unidades'
  }
];

const DeliveryDetails = ({ delivery, onBack }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('delivery');
  const [qualityData, setQualityData] = useState(mockVariantDetails.map(v => ({ ...v })));
  const [observations, setObservations] = useState('');
  const [showDefectiveForm, setShowDefectiveForm] = useState(false);
  const [defectiveItem, setDefectiveItem] = useState(null);
  const [defectiveReason, setDefectiveReason] = useState('');
  const [defectiveCount, setDefectiveCount] = useState(0);

  const userRole = user?.role || 'workshop'; // Default to workshop role if undefined

  // Calculate status and determine if user can approve
  const isQCLeader = userRole === 'admin' || userRole === 'qc_leader';
  const canEditQuality = isQCLeader && delivery.status === 'en-calidad';
  
  const handleOpenDefectiveForm = (item) => {
    setDefectiveItem(item);
    setDefectiveReason('');
    setDefectiveCount(0);
    setShowDefectiveForm(true);
  };
  
  const handleSaveDefective = () => {
    if (!defectiveItem || defectiveCount <= 0) return;
    
    const updatedQualityData = qualityData.map(item => {
      if (item.id === defectiveItem.id) {
        const approved = Math.max(0, item.delivered - defectiveCount);
        return {
          ...item,
          approved,
          defective: defectiveCount,
          reason: defectiveReason || 'Defectos en producto'
        };
      }
      return item;
    });
    
    setQualityData(updatedQualityData);
    setShowDefectiveForm(false);
  };
  
  const handleClearDefective = (itemId) => {
    const updatedQualityData = qualityData.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          approved: item.delivered,
          defective: null,
          reason: null
        };
      }
      return item;
    });
    
    setQualityData(updatedQualityData);
  };
  
  const handleApproveAll = () => {
    const updatedQualityData = qualityData.map(item => ({
      ...item,
      approved: item.delivered,
      defective: 0,
      reason: null
    }));
    
    setQualityData(updatedQualityData);
  };
  
  const handleApproveDelivery = () => {
    // Submit quality approval
    console.log('Approved delivery with quality data:', {
      deliveryId: delivery.id,
      qualityData,
      observations
    });
    
    // In a real app, this would update the backend and then:
    onBack();
  };
  
  const handleRejectDelivery = () => {
    // Submit quality rejection
    console.log('Rejected delivery with quality data:', {
      deliveryId: delivery.id,
      qualityData,
      observations
    });
    
    // In a real app, this would update the backend and then:
    onBack();
  };
  
  // Calculate summary data
  const totalDelivered = qualityData.reduce((sum, item) => sum + item.delivered, 0);
  const totalApproved = qualityData.reduce((sum, item) => sum + (item.approved || 0), 0);
  const totalDefective = qualityData.reduce((sum, item) => sum + (item.defective || 0), 0);
  const hasDefects = totalDefective > 0;
  const allChecked = qualityData.every(item => item.approved !== null);
  
  const getFileIcon = (fileType) => {
    if (fileType.includes('image')) return <Camera className="w-5 h-5" />;
    if (fileType.includes('pdf')) return <File className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header with back button */}
      <div className="flex items-center space-x-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onBack}
          className="flex items-center"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black">{delivery.orderId} - Entrega #{delivery.deliveryNumber}</h1>
          <div className="flex space-x-4 text-gray-600 text-sm mt-1">
            <span>Taller: {delivery.workshop}</span>
            <span>•</span>
            <span>Fecha: {new Date(delivery.date).toLocaleDateString()}</span>
            <span>•</span>
            <span className="flex items-center">
              {delivery.status === 'en-calidad' && (
                <><Clock className="w-4 h-4 text-blue-500 mr-1" /> En Calidad</>
              )}
              {delivery.status === 'aprobado' && (
                <><CheckCircle className="w-4 h-4 text-green-500 mr-1" /> Aprobado</>
              )}
              {delivery.status === 'devuelto' && (
                <><XCircle className="w-4 h-4 text-red-500 mr-1" /> Devuelto</>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative pb-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex items-center justify-center min-w-9 h-9 rounded-full bg-blue-100 text-blue-700">
            <Clock className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="h-2 bg-gray-200 rounded-full">
              <div className="h-2 bg-blue-500 rounded-full" style={{ width: delivery.status === 'en-calidad' ? '50%' : '100%' }}></div>
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-600">
              <span>Entrega registrada</span>
              <span>Revisión de calidad</span>
              <span>{delivery.status !== 'en-calidad' ? (delivery.status === 'aprobado' ? 'Aprobada' : 'Devuelta') : 'Pendiente'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left column */}
        <div className="md:col-span-7 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="delivery">Detalles de la Entrega</TabsTrigger>
              <TabsTrigger value="documents">Documentos ({mockFiles.length})</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
            </TabsList>
            <TabsContent value="delivery" className="space-y-4 mt-4">
              <Card className="p-4">
                <h3 className="font-medium text-lg mb-3">Variantes entregadas</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variante</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qualityData.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right font-medium">{item.delivered}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">{totalDelivered}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
            
            <TabsContent value="documents" className="space-y-4 mt-4">
              <Card className="p-4">
                <h3 className="font-medium text-lg mb-3">Documentos adjuntos</h3>
                <div className="grid gap-3">
                  {mockFiles.map(file => (
                    <div key={file.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                      <div className="flex items-center">
                        {getFileIcon(file.type)}
                        <span className="ml-2 text-sm">{file.name}</span>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={file.url} target="_blank" rel="noopener noreferrer">Ver</a>
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>
            
            <TabsContent value="history" className="space-y-4 mt-4">
              <Card className="p-4">
                <h3 className="font-medium text-lg mb-3">Historial de eventos</h3>
                <div className="space-y-4">
                  {mockTimelineEvents.map(event => (
                    <div key={event.id} className="flex">
                      <div className="mt-1 mr-3">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <div className="w-px h-full bg-gray-200 mx-auto"></div>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{event.type === 'delivery-created' ? 'Entrega registrada' : 'Evento'}</p>
                        <p className="text-sm text-gray-600">{event.details}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Por {event.user} • {new Date(event.date).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Right column - Quality Control */}
        <div className="md:col-span-5">
          <Card className="p-4 space-y-4">
            <h3 className="font-medium text-lg flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
              Control de Calidad
            </h3>
            
            {isQCLeader ? (
              <>
                {canEditQuality ? (
                  <>
                    <div className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Variante</TableHead>
                            <TableHead className="text-center">Entregado</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {qualityData.map(item => (
                            <TableRow key={item.id}>
                              <TableCell>
                                {item.name}
                                {item.defective > 0 && (
                                  <div className="mt-1">
                                    <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">
                                      {item.defective} defectuosos: {item.reason}
                                    </span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-center">{item.delivered}</TableCell>
                              <TableCell className="text-right">
                                {item.defective ? (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleClearDefective(item.id)}
                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                  >
                                    Limpiar
                                  </Button>
                                ) : (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleOpenDefectiveForm(item)}
                                    className="text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                                  >
                                    Reportar
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      {!showDefectiveForm && (
                        <div className="flex justify-between">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleApproveAll}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Aprobar Todos
                          </Button>
                          <span className="text-sm text-gray-600">
                            {totalApproved}/{totalDelivered} aprobados
                          </span>
                        </div>
                      )}
                      
                      {/* Defective Form */}
                      {showDefectiveForm && defectiveItem && (
                        <div className="border p-3 rounded-md space-y-3 mt-2">
                          <h4 className="font-medium text-sm flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-1 text-amber-500" />
                            Reportar defectos para {defectiveItem.name}
                          </h4>
                          
                          <div>
                            <label className="text-sm text-gray-700 block mb-1">
                              Cantidad de unidades defectuosas
                            </label>
                            <input
                              type="number"
                              min="1"
                              max={defectiveItem.delivered}
                              value={defectiveCount}
                              onChange={(e) => setDefectiveCount(parseInt(e.target.value, 10) || 0)}
                              className="w-full p-2 border rounded"
                            />
                          </div>
                          
                          <div>
                            <label className="text-sm text-gray-700 block mb-1">
                              Motivo del rechazo
                            </label>
                            <Textarea
                              value={defectiveReason}
                              onChange={(e) => setDefectiveReason(e.target.value)}
                              placeholder="Describir problema encontrado..."
                              className="w-full"
                            />
                          </div>
                          
                          <div className="flex justify-end space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setShowDefectiveForm(false)}
                            >
                              Cancelar
                            </Button>
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={handleSaveDefective}
                              disabled={defectiveCount <= 0}
                            >
                              Guardar
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      <div className="pt-2 border-t">
                        <label className="text-sm font-medium block mb-2">
                          Observaciones generales
                        </label>
                        <Textarea
                          value={observations}
                          onChange={(e) => setObservations(e.target.value)}
                          placeholder="Agregar observaciones sobre esta entrega..."
                          className="w-full"
                        />
                      </div>
                      
                      <div className="space-y-3 pt-3">
                        {hasDefects && (
                          <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                            <AlertDescription className="text-sm">
                              Has reportado {totalDefective} unidades defectuosas de {totalDelivered}.
                            </AlertDescription>
                          </Alert>
                        )}
                        
                        <div className="flex space-x-3">
                          <Button 
                            variant="outline"
                            className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={handleRejectDelivery}
                            disabled={!allChecked || totalDefective === 0}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Devolver al Taller
                          </Button>
                          <Button 
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={handleApproveDelivery}
                            disabled={!allChecked || totalDefective === totalDelivered}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Aprobar Entrega
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-amber-500" />
                    <p>
                      Esta entrega ya fue {delivery.status === 'aprobado' ? 'aprobada' : 'devuelta'} y 
                      no puede ser modificada.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 text-blue-500" />
                <h4 className="font-medium">En revisión</h4>
                <p className="text-sm mt-1">
                  El equipo de calidad está revisando tu entrega.
                  Recibirás una notificación cuando el proceso finalice.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DeliveryDetails;
