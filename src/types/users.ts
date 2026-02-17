
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  workshopId?: string;
  workshopName?: string;
  status: 'active' | 'inactive';
  requiresPasswordChange: boolean;
  createdAt: string;
  lastLogin?: string;
  createdBy: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean; // true for predefined roles
  usersCount: number;
}

export interface Permission {
  module: string;
  actions: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
}

export interface UserFormData {
  name: string;
  email: string;
  role: string;
  workshopId?: string;
  requiresPasswordChange: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  changedBy: string;
  timestamp: string;
  before: any;
  after: any;
}
