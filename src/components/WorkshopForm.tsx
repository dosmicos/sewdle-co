
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Building2, Phone, Star } from 'lucide-react';
import { useWorkshops } from '@/hooks/useWorkshops';

interface WorkshopFormProps {
  onSuccess?: () => void;
}

const WorkshopForm = ({ onSuccess }: WorkshopFormProps) => {
  const { createWorkshop } = useWorkshops();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    contact_person: '',
    notes: ''
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

  const handleInputChange = (field: string, value: string) => {
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
      status: 'active' as const
    };

    const { error } = await createWorkshop(workshopData);
    
    if (!error) {
      // Reset form
      setFormData({
        name: '',
        address: '',
        city: '',
        phone: '',
        email: '',
        contact_person: '',
        notes: ''
      });
      setSelectedSpecialties([]);
      onSuccess?.();
    }

    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 pt-1 pb-6">
      <Card className="apple-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-500" />
            </div>
            <span>Nuevo Taller</span>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Información General */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-blue-500" />
                <span>Información General</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Taller *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Ej: Taller San Martín"
                    className="apple-input"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad *</Label>
                  <Select onValueChange={(value) => handleInputChange('city', value)}>
                    <SelectTrigger className="apple-input">
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
              
              <div className="space-y-2">
                <Label htmlFor="address">Dirección Completa *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Ej: Av. Industrial 123, Distrito, Lima"
                  className="apple-input"
                  required
                />
              </div>
            </div>

            <Separator />

            {/* Información de Contacto */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold flex items-center space-x-2">
                <Phone className="w-5 h-5 text-green-500" />
                <span>Información de Contacto</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono Principal *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Ej: +51 999 888 777"
                    className="apple-input"
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
                    className="apple-input"
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
                  className="apple-input"
                />
              </div>
            </div>

            <Separator />

            {/* Especialidades */}
            <div className="space-y-6">
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

            {/* Notas Adicionales */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Notas Adicionales</h3>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Comentarios o Información Adicional</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Información adicional sobre el taller, capacidades especiales, certificaciones, etc."
                  className="apple-input min-h-[100px]"
                />
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex justify-end space-x-4 pt-6">
              <Button 
                type="button" 
                variant="outline"
                className="border border-gray-300 bg-white hover:bg-gray-50 text-black rounded-xl px-6 py-3"
                onClick={() => onSuccess?.()}
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Creando...' : 'Crear Taller'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkshopForm;
