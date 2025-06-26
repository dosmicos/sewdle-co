import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Edit, Shield, Users, UserCheck, UserX, Loader2, AlertTriangle } from 'lucide-react';
import UserModal from '@/components/UserModal';
import RoleModal from '@/components/RoleModal';
import { useUsers } from '@/hooks/useUsers';
import { useRoles } from '@/hooks/useRoles';
import { useUserTracking } from '@/hooks/useUserTracking';
const UsersRolesPage = () => {
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [userFilter, setUserFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [lastAccessData, setLastAccessData] = useState<Record<string, string>>({});
  const {
    users,
    loading: usersLoading,
    createUser,
    updateUser,
    deleteUser
  } = useUsers();
  const {
    roles,
    loading: rolesLoading,
    createRole,
    updateRole,
    deleteRole
  } = useRoles();
  const {
    getLastAccess
  } = useUserTracking();

  // Cargar información de último acceso para todos los usuarios
  useEffect(() => {
    const loadLastAccessData = async () => {
      if (users.length > 0) {
        const accessPromises = users.map(async user => {
          const lastAccess = await getLastAccess(user.id);
          return {
            userId: user.id,
            lastAccess
          };
        });
        const accessResults = await Promise.all(accessPromises);
        const accessMap = accessResults.reduce((acc, {
          userId,
          lastAccess
        }) => {
          acc[userId] = lastAccess;
          return acc;
        }, {} as Record<string, string>);
        setLastAccessData(accessMap);
      }
    };
    loadLastAccessData();
  }, [users, getLastAccess]);
  const activeUsers = users.filter(user => user.status === 'active').length;
  const inactiveUsers = users.filter(user => user.status === 'inactive').length;
  const usersWithoutRoles = users.filter(user => user.role === 'Sin Rol').length;
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(userFilter.toLowerCase()) || user.email.toLowerCase().includes(userFilter.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });
  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };
  const handleEditRole = (role: any) => {
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
  const handleUserSave = async (userData: any) => {
    if (selectedUser) {
      await updateUser(selectedUser.id, userData);
    } else {
      await createUser(userData);
    }
    setShowUserModal(false);
    setSelectedUser(null);
  };
  const handleRoleSave = async (roleData: any) => {
    if (selectedRole) {
      await updateRole(selectedRole.id, roleData);
    } else {
      await createRole(roleData);
    }
    setShowRoleModal(false);
    setSelectedRole(null);
  };
  if (usersLoading || rolesLoading) {
    return <div className="p-6 space-y-8 animate-fade-in">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="text-gray-600">Cargando usuarios y roles...</p>
          </div>
        </div>
      </div>;
  }
  return <div className="p-6 space-y-8 animate-fade-in">
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
          {/* KPIs actualizados */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
                <Users className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users.length}</div>
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sin Rol Asignado</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{usersWithoutRoles}</div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de usuarios */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Lista de Usuarios</CardTitle>
                <Button onClick={handleNewUser} className="bg-[#ff5c02]">
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Usuario
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input placeholder="Buscar por nombre o correo..." value={userFilter} onChange={e => setUserFilter(e.target.value)} className="pl-10" />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filtrar por rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    <SelectItem value="Sin Rol">Sin Rol</SelectItem>
                    {roles.map(role => <SelectItem key={role.id} value={role.name}>
                        {role.name}
                      </SelectItem>)}
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
                  {filteredUsers.map(user => <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || 'Sin nombre'}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'Sin Rol' ? 'destructive' : 'outline'} className={user.role === 'Sin Rol' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : ''}>
                          {user.role || 'Sin Rol'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.workshopName ? <Badge variant="secondary">{user.workshopName}</Badge> : <span className="text-gray-400">Sin taller</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                          {user.status === 'active' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={lastAccessData[user.id] === 'Nunca' ? 'text-yellow-600' : 'text-gray-600'}>
                          {lastAccessData[user.id] || 'Cargando...'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>)}
                  {filteredUsers.length === 0 && <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No se encontraron usuarios que coincidan con los filtros aplicados
                      </TableCell>
                    </TableRow>}
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
                  {roles.map(role => <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell>{role.description}</TableCell>
                      <TableCell>
                        <Badge variant={role.isSystem ? 'default' : 'secondary'}>
                          {role.isSystem ? 'Sistema' : 'Personalizado'}
                        </Badge>
                      </TableCell>
                      <TableCell>{role.usersCount}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => handleEditRole(role)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showUserModal && <UserModal user={selectedUser} onClose={() => {
      setShowUserModal(false);
      setSelectedUser(null);
    }} onSave={handleUserSave} />}

      {showRoleModal && <RoleModal role={selectedRole} onClose={() => {
      setShowRoleModal(false);
      setSelectedRole(null);
    }} onSave={handleRoleSave} />}
    </div>;
};
export default UsersRolesPage;