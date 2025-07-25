import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Building2, Phone, Star, DollarSign } from 'lucide-react';
import { useWorkshops, type Workshop } from '@/hooks/useWorkshops';

interface WorkshopEditModalProps {
  workshop: Workshop;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const WorkshopEditModal = ({ workshop, open, onOpenChange, onSuccess }: WorkshopEditModalProps) => {
  const { updateWorkshop } = useWorkshops();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    contact_person: '',
    notes: '',
    payment_method: 'approved',
    capacity: 0,
    status: 'active'
  });

  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

  const specialtyOptions = [
    'Ruanas',
    'Chaquetas',
    'Sleepings',
    'Camisetas',
    'Sudaderas',
    'Otros'
  ];

  // Initialize form data when workshop changes
  useEffect(() => {
    if (workshop) {
      setFormData({
        name: workshop.name || '',
        address: workshop.address || '',
        city: workshop.city || '',
        phone: workshop.phone || '',
        email: workshop.email || '',
        contact_person: workshop.contactPerson || '',
        notes: workshop.notes || '',
        payment_method: workshop.paymentMethod || 'approved',
        capacity: workshop.capacity || 0,
        status: workshop.status || 'active'
      });
      setSelectedSpecialties(workshop.specialties || []);
    }
  }, [workshop]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties(prev => {
      if (prev.includes(specialty)) {
        return prev.filter(s => s !== specialty);
      } else {
        return [...prev, specialty];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const workshopData = {
      name: formData.name,
      address: formData.address,
      city: formData.city,
      phone: formData.phone,
      email: formData.email,
      contact_person: formData.contact_person,
      specialties: selectedSpecialties,
      notes: formData.notes,
      status: formData.status as 'active' | 'inactive',
      payment_method: formData.payment_method as 'approved' | 'delivered',
      capacity: Number(formData.capacity)
    };

    const { error } = await updateWorkshop(workshop.id, workshopData);
    
    if (!error) {
      onOpenChange(false);
      onSuccess?.();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-500" />
            </div>
            <span>Editar Taller: {workshop.name}</span>
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información General */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-blue-500" />
              <span>Información General</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Taller *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Ej: Taller San Martín"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="city">Ciudad *</Label>
                <Select value={formData.city} onValueChange={(value) => handleInputChange('city', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una ciudad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bogota">Bogotá</SelectItem>
                    <SelectItem value="medellin">Medellín</SelectItem>
                    <SelectItem value="soacha">Soacha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Dirección Completa *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Ej: Av. Industrial 123, Distrito, Lima"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacidad</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => handleInputChange('capacity', Number(e.target.value))}
                  placeholder="Número de órdenes simultáneas"
                  min="0"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Información de Contacto */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center space-x-2">
              <Phone className="w-5 h-5 text-green-500" />
              <span>Información de Contacto</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono Principal *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Ej: +51 999 888 777"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Ej: contacto@taller.com"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contact_person">Persona de Contacto</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => handleInputChange('contact_person', e.target.value)}
                placeholder="Ej: Juan Pérez"
              />
            </div>
          </div>

          <Separator />

          {/* Especialidades */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center space-x-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <span>Especialidades</span>
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {specialtyOptions.map((specialty) => (
                <button
                  key={specialty}
                  type="button"
                  onClick={() => toggleSpecialty(specialty)}
                  className={`p-3 rounded-xl border text-sm transition-all duration-200 ${
                    selectedSpecialties.includes(specialty)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300'
                  }`}
                >
                  {specialty}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Configuración de Pago */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              <span>Configuración de Pago</span>
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="payment_method">Método de Pago del Taller</Label>
              <Select 
                value={formData.payment_method} 
                onValueChange={(value) => handleInputChange('payment_method', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el método de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Por unidades aprobadas</SelectItem>
                  <SelectItem value="delivered">Por unidades entregadas</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                <strong>Por unidades aprobadas:</strong> El taller solo cobra por las unidades que pasan control de calidad.<br />
                <strong>Por unidades entregadas:</strong> El taller cobra por todas las unidades entregadas, independientemente del control de calidad.
              </p>
            </div>
          </div>

          <Separator />

          {/* Estado y Notas */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Estado del Taller</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value) => handleInputChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Comentarios o Información Adicional</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Información adicional sobre el taller, capacidades especiales, certificaciones, etc."
                className="min-h-[100px]"
              />
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex justify-end space-x-4 pt-4">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default WorkshopEditModal;