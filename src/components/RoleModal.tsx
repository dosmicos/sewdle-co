import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Role, Permission } from '@/types/users';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle } from 'lucide-react';

interface RoleModalProps {
  role: Role | null;
  onClose: () => void;
  onSave: (roleData: Partial<Role>) => void;
}

const RoleModal: React.FC<RoleModalProps> = ({ role, onClose, onSave }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as Permission[]
  });

  const modules = [
    'Dashboard',
    'Órdenes',
    'Talleres',
    'Productos',
    'Insumos',
    'Entregas',
    'Usuarios',
    'Finanzas',
    'Reposición IA',
    'Shopify',
    'Reclutamiento'
  ];

  const actions = [
    { key: 'view', label: 'Ver' },
    { key: 'create', label: 'Crear' },
    { key: 'edit', label: 'Editar' },
    { key: 'delete', label: 'Eliminar' }
  ];

  useEffect(() => {
    // Siempre inicializar con todos los módulos disponibles
    const allModules = modules.map(module => {
      // Si estamos editando un rol, buscar permisos existentes para este módulo
      const existingPermission = role?.permissions?.find(p => p.module === module);
      
      return {
        module,
        actions: existingPermission?.actions || { view: false, create: false, edit: false, delete: false }
      };
    });

    if (role) {
      setFormData({
        name: role.name,
        description: role.description,
        permissions: allModules
      });
    } else {
      // Para roles nuevos, inicializar con todos los permisos en falso
      setFormData({
        name: '',
        description: '',
        permissions: allModules
      });
    }
  }, [role]);

  const handlePermissionChange = (moduleIndex: number, action: string, checked: boolean) => {
    const newPermissions = [...formData.permissions];
    newPermissions[moduleIndex] = {
      ...newPermissions[moduleIndex],
      actions: {
        ...newPermissions[moduleIndex].actions,
        [action]: checked
      }
    };
    setFormData({ ...formData, permissions: newPermissions });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.description) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos obligatorios",
        variant: "destructive"
      });
      return;
    }

    // Validate that at least one permission is granted
    const hasAnyPermission = formData.permissions.some(permission =>
      Object.values(permission.actions).some(action => action)
    );

    if (!hasAnyPermission) {
      toast({
        title: "Error",
        description: "Debes otorgar al menos un permiso al rol",
        variant: "destructive"
      });
      return;
    }

    onSave(formData);
    
    toast({
      title: role ? "Rol actualizado" : "Rol creado",
      description: role 
        ? "Los cambios han sido guardados correctamente"
        : "Rol creado exitosamente",
    });
  };

  const canDelete = role && !role.isSystem && role.usersCount === 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {role ? 'Editar Rol' : 'Crear Nuevo Rol'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del rol *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ej. Auditor, Compras"
                required
                disabled={role?.isSystem}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción del rol"
                required
              />
            </div>
          </div>

          {role?.isSystem && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Rol del sistema</p>
                <p className="text-sm text-yellow-700">
                  Este es un rol predefinido del sistema. Solo puedes modificar los permisos, no el nombre.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <Label className="text-base font-semibold">Permisos por módulo</Label>
            
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b grid grid-cols-5 gap-4 font-medium text-sm">
                <div>Módulo</div>
                {actions.map(action => (
                  <div key={action.key} className="text-center">{action.label}</div>
                ))}
              </div>
              
              {formData.permissions.map((permission, moduleIndex) => (
                <div key={permission.module} className="px-4 py-3 border-b last:border-b-0 grid grid-cols-5 gap-4 items-center">
                  <div className="font-medium text-sm">{permission.module}</div>
                  {actions.map(action => (
                    <div key={action.key} className="flex justify-center">
                      <Checkbox
                        checked={permission.actions[action.key as keyof typeof permission.actions]}
                        onCheckedChange={(checked) => 
                          handlePermissionChange(moduleIndex, action.key, checked as boolean)
                        }
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {role && role.usersCount > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Este rol está asignado a {role.usersCount} usuario(s). 
                Los cambios en permisos se aplicarán inmediatamente y requerirán que los usuarios 
                cierren sesión y vuelvan a iniciarla.
              </p>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <div>
              {role && !role.isSystem && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  disabled={!canDelete}
                  onClick={() => {
                    if (canDelete) {
                      // Lógica para eliminar rol
                      toast({
                        title: "Rol eliminado",
                        description: "El rol ha sido eliminado correctamente"
                      });
                      onClose();
                    }
                  }}
                >
                  Eliminar Rol
                </Button>
              )}
              {role && !role.isSystem && !canDelete && (
                <p className="text-sm text-gray-500">
                  No se puede eliminar: rol en uso
                </p>
              )}
            </div>
            <div className="space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">
                {role ? 'Actualizar' : 'Crear Rol'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RoleModal;
