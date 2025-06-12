
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Edit, Shield, Users, UserCheck, UserX } from 'lucide-react';
import UserModal from '@/components/UserModal';
import RoleModal from '@/components/RoleModal';
import { User, Role } from '@/types/users';

const UsersRolesPage = () => {
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [userFilter, setUserFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Mock data
  const mockUsers: User[] = [
    {
      id: '1',
      name: 'Juan Pérez',
      email: 'admin@textilflow.com',
      role: 'Administrador',
      status: 'active',
      requiresPasswordChange: false,
      createdAt: '2024-01-15',
      lastLogin: '2024-06-12',
      createdBy: 'system'
    },
    {
      id: '2',
      name: 'María García',
      email: 'maria@ejemplo.com',
      role: 'Diseñador',
      status: 'active',
      requiresPasswordChange: false,
      createdAt: '2024-02-20',
      lastLogin: '2024-06-11',
      createdBy: 'admin@textilflow.com'
    },
    {
      id: '3',
      name: 'Carlos López',
      email: 'taller1@ejemplo.com',
      role: 'Taller',
      workshopId: '1',
      workshopName: 'Taller Principal',
      status: 'active',
      requiresPasswordChange: true,
      createdAt: '2024-03-10',
      createdBy: 'admin@textilflow.com'
    }
  ];

  const mockRoles: Role[] = [
    {
      id: '1',
      name: 'Administrador',
      description: 'Control total de la plataforma',
      isSystem: true,
      usersCount: 1,
      permissions: [
        { module: 'Dashboard', actions: { view: true, create: true, edit: true, delete: true } },
        { module: 'Órdenes', actions: { view: true, create: true, edit: true, delete: true } },
        { module: 'Talleres', actions: { view: true, create: true, edit: true, delete: true } },
        { module: 'Productos', actions: { view: true, create: true, edit: true, delete: true } },
        { module: 'Entregas', actions: { view: true, create: true, edit: true, delete: true } },
        { module: 'Usuarios', actions: { view: true, create: true, edit: true, delete: true } }
      ]
    },
    {
      id: '2',
      name: 'Diseñador',
      description: 'Gestión de órdenes y reportes',
      isSystem: true,
      usersCount: 1,
      permissions: [
        { module: 'Dashboard', actions: { view: true, create: false, edit: false, delete: false } },
        { module: 'Órdenes', actions: { view: true, create: true, edit: true, delete: false } },
        { module: 'Talleres', actions: { view: true, create: false, edit: false, delete: false } },
        { module: 'Productos', actions: { view: true, create: true, edit: true, delete: false } },
        { module: 'Entregas', actions: { view: true, create: false, edit: false, delete: false } }
      ]
    },
    {
      id: '3',
      name: 'Taller',
      description: 'Acceso a órdenes asignadas y entregas',
      isSystem: true,
      usersCount: 1,
      permissions: [
        { module: 'Dashboard', actions: { view: true, create: false, edit: false, delete: false } },
        { module: 'Órdenes', actions: { view: true, create: false, edit: true, delete: false } },
        { module: 'Entregas', actions: { view: true, create: true, edit: true, delete: false } }
      ]
    }
  ];

  const activeUsers = mockUsers.filter(user => user.status === 'active').length;
  const inactiveUsers = mockUsers.filter(user => user.status === 'inactive').length;

  const filteredUsers = mockUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(userFilter.toLowerCase()) ||
                         user.email.toLowerCase().includes(userFilter.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setShowRoleModal(true);
  };

  const handleNewUser = () => {
    setSelectedUser(null);
    setShowUserModal(true);
  };

  const handleNewRole = () => {
    setSelectedRole(null);
    setShowRoleModal(true);
  };

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">Usuarios & Roles</h1>
          <p className="text-gray-600">Gestiona usuarios, roles y permisos del sistema</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-fit grid-cols-2">
          <TabsTrigger value="users" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Usuarios</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span>Roles</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
                <Users className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockUsers.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
                <UserCheck className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{activeUsers}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuarios Inactivos</CardTitle>
                <UserX className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{inactiveUsers}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros y botón nuevo usuario */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Lista de Usuarios</CardTitle>
                <Button onClick={handleNewUser} className="bg-blue-500 hover:bg-blue-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Usuario
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por nombre o correo..."
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filtrar por rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    <SelectItem value="Administrador">Administrador</SelectItem>
                    <SelectItem value="Diseñador">Diseñador</SelectItem>
                    <SelectItem value="Taller">Taller</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Taller</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Último Acceso</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.workshopName ? (
                          <Badge variant="secondary">{user.workshopName}</Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                          {user.status === 'active' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.lastLogin ? user.lastLogin : (
                          <span className="text-yellow-600">Nunca</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Gestión de Roles</CardTitle>
                <Button onClick={handleNewRole} className="bg-blue-500 hover:bg-blue-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Rol
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Usuarios Asignados</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRoles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell>{role.description}</TableCell>
                      <TableCell>
                        <Badge variant={role.isSystem ? 'default' : 'secondary'}>
                          {role.isSystem ? 'Sistema' : 'Personalizado'}
                        </Badge>
                      </TableCell>
                      <TableCell>{role.usersCount}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditRole(role)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showUserModal && (
        <UserModal
          user={selectedUser}
          onClose={() => setShowUserModal(false)}
          onSave={() => {
            setShowUserModal(false);
            // Aquí iría la lógica para guardar el usuario
          }}
        />
      )}

      {showRoleModal && (
        <RoleModal
          role={selectedRole}
          onClose={() => setShowRoleModal(false)}
          onSave={() => {
            setShowRoleModal(false);
            // Aquí iría la lógica para guardar el rol
          }}
        />
      )}
    </div>
  );
};

export default UsersRolesPage;
