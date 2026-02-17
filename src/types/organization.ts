export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'inactive' | 'suspended';
  settings: Record<string, unknown>;
  branding: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    customDomain?: string;
  };
  shopify_store_url?: string;
  shopify_credentials?: Record<string, unknown>;
  max_users: number;
  max_orders_per_month: number;
  max_workshops: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizationUser {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'inactive' | 'pending';
  invited_by?: string;
  invited_at?: string;
  joined_at: string;
  created_at: string;
  updated_at: string;
  organization?: Organization;
}

export interface OrganizationContextType {
  currentOrganization: Organization | null;
  userOrganizations: OrganizationUser[];
  isLoading: boolean;
  error: string | null;
  switchOrganization: (organizationId: string) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  createOrganization: (data: CreateOrganizationData) => Promise<Organization>;
  inviteUser: (email: string, role: 'admin' | 'member') => Promise<void>;
  updateOrganization: (id: string, data: Partial<Organization>) => Promise<void>;
  canAccessFeature: (feature: string) => boolean;
  getUsageStats: () => Promise<UsageStats>;
  canCreateOrganization: () => Promise<boolean>;
  validateLimit: (limitType: 'orders' | 'users' | 'workshops') => Promise<boolean>;
  getUserPlan: () => 'starter' | 'professional' | 'enterprise';
}

export interface CreateOrganizationData {
  name: string;
  slug: string;
  plan?: 'starter' | 'professional' | 'enterprise';
}

export interface UsageStats {
  ordersThisMonth: number;
  maxOrdersPerMonth: number;
  activeUsers: number;
  maxUsers: number;
  workshopsCount: number;
  maxWorkshops: number;
  storageUsed: number;
  maxStorage: number;
}

export interface PlanLimits {
  starter: {
    maxOrganizationsPerUser: 1;
    maxUsers: 3;
    maxOrdersPerMonth: 10;
    maxWorkshops: 5;
    maxStorage: 1024; // MB (1GB)
    features: string[];
  };
  professional: {
    maxOrganizationsPerUser: 1;
    maxUsers: 10;
    maxOrdersPerMonth: -1; // unlimited
    maxWorkshops: 20;
    maxStorage: 10240; // MB (10GB)
    features: string[];
  };
  enterprise: {
    maxOrganizationsPerUser: -1; // unlimited
    maxUsers: -1; // unlimited
    maxOrdersPerMonth: -1; // unlimited
    maxWorkshops: -1; // unlimited
    maxStorage: -1; // unlimited
    features: string[];
  };
}