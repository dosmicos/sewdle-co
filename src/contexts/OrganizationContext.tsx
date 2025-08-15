import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import type { 
  Organization, 
  OrganizationUser, 
  OrganizationContextType, 
  CreateOrganizationData,
  UsageStats,
  PlanLimits 
} from '@/types/organization';

const OrganizationContext = createContext<OrganizationContextType | null>(null);

const PLAN_LIMITS: PlanLimits = {
  starter: {
    maxOrganizationsPerUser: 1,
    maxUsers: 3,
    maxOrdersPerMonth: 10,
    maxWorkshops: 5,
    maxStorage: 1024, // 1GB
    features: ['basic_dashboard', 'orders', 'workshops', 'basic_analytics', 'okr_module']
  },
  professional: {
    maxOrganizationsPerUser: 1,
    maxUsers: 10,
    maxOrdersPerMonth: -1, // unlimited
    maxWorkshops: 20,
    maxStorage: 10240, // 10GB
    features: [
      'advanced_dashboard', 
      'orders', 
      'workshops', 
      'advanced_analytics', 
      'shopify_integration', 
      'financial_reports',
      'smart_replenishment',
      'priority_support',
      'okr_module'
    ]
  },
  enterprise: {
    maxOrganizationsPerUser: -1, // unlimited
    maxUsers: -1,
    maxOrdersPerMonth: -1,
    maxWorkshops: -1,
    maxStorage: -1,
    features: [
      'all_features', 
      'custom_integrations', 
      'api_access',
      'unlimited_storage',
      'white_label',
      'priority_support',
      'okr_module'
    ]
  }
};

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session } = useAuth();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<OrganizationUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar organizaciones del usuario
  const loadUserOrganizations = useCallback(async () => {
    if (!user) {
      setUserOrganizations([]);
      setCurrentOrganization(null);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Obtener organizaciones del usuario con información completa
      const { data: orgUsers, error: orgError } = await supabase
        .from('organization_users')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('joined_at', { ascending: false });

      if (orgError) throw orgError;

      const organizationsWithData = (orgUsers || []).map(ou => ({
        ...ou,
        organization: {
          ...ou.organization,
          plan: ou.organization?.plan as 'starter' | 'professional' | 'enterprise' || 'starter',
          branding: ou.organization?.branding || {}
        } as Organization
      })) as OrganizationUser[];

      setUserOrganizations(organizationsWithData);

      // Determinar organización actual
      const savedOrgId = localStorage.getItem('current_organization_id');
      let targetOrganization: Organization | null = null;

      if (savedOrgId) {
        // Buscar la organización guardada
        const savedOrg = organizationsWithData.find(ou => ou.organization_id === savedOrgId);
        if (savedOrg) {
          targetOrganization = savedOrg.organization!;
        }
      }

      // Si no hay organización guardada o no es válida, usar la primera disponible
      if (!targetOrganization && organizationsWithData.length > 0) {
        targetOrganization = organizationsWithData[0].organization!;
        localStorage.setItem('current_organization_id', targetOrganization.id);
      }

      setCurrentOrganization(targetOrganization);

    } catch (err) {
      console.error('Error loading organizations:', err);
      setError('Error al cargar las organizaciones');
      toast.error('Error al cargar las organizaciones');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Cambiar organización activa
  const switchOrganization = useCallback(async (organizationId: string) => {
    const targetOrgUser = userOrganizations.find(ou => ou.organization_id === organizationId);
    
    if (!targetOrgUser?.organization) {
      toast.error('Organización no encontrada');
      return;
    }

    setCurrentOrganization(targetOrgUser.organization);
    localStorage.setItem('current_organization_id', organizationId);
    
    toast.success(`Cambiado a ${targetOrgUser.organization.name}`);
    
    // Recargar la página para aplicar el nuevo contexto
    window.location.reload();
  }, [userOrganizations]);

  // Refrescar organizaciones
  const refreshOrganizations = useCallback(async () => {
    await loadUserOrganizations();
  }, [loadUserOrganizations]);

  // Verificar si el usuario puede crear una organización
  const canCreateOrganization = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      // Contar organizaciones del usuario
      const { count } = await supabase
        .from('organization_users')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'active');

      const currentOrgsCount = count || 0;
      
      // Determinar el plan del usuario basado en sus organizaciones
      const userPlan = getUserPlan();
      const maxOrgs = PLAN_LIMITS[userPlan].maxOrganizationsPerUser;
      
      return maxOrgs === -1 || currentOrgsCount < maxOrgs;
    } catch (err) {
      console.error('Error checking organization limit:', err);
      return false;
    }
  }, [user]);

  // Obtener plan del usuario
  const getUserPlan = useCallback((): 'starter' | 'professional' | 'enterprise' => {
    if (!userOrganizations.length) return 'starter';
    
    // El plan más alto entre todas las organizaciones del usuario
    const plans = userOrganizations.map(ou => ou.organization?.plan || 'starter');
    
    if (plans.includes('enterprise')) return 'enterprise';
    if (plans.includes('professional')) return 'professional';
    return 'starter';
  }, [userOrganizations]);

  // Crear nueva organización
  const createOrganization = useCallback(async (data: CreateOrganizationData): Promise<Organization> => {
    if (!user) throw new Error('Usuario no autenticado');

    // Verificar límite de organizaciones
    const canCreate = await canCreateOrganization();
    if (!canCreate) {
      const userPlan = getUserPlan();
      const maxOrgs = PLAN_LIMITS[userPlan].maxOrganizationsPerUser;
      toast.error(`Tu plan ${userPlan} permite máximo ${maxOrgs} organización(es). Actualiza tu plan para crear más.`);
      throw new Error('Límite de organizaciones alcanzado');
    }

    try {
      const planToUse = data.plan || 'starter';
      
      // Aplicar límites según el plan
      const planLimits = PLAN_LIMITS[planToUse];
      
      // Crear organización con límites del plan
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert({
          name: data.name,
          slug: data.slug,
          plan: planToUse,
          status: 'active',
          max_users: planLimits.maxUsers,
          max_orders_per_month: planLimits.maxOrdersPerMonth,
          max_workshops: planLimits.maxWorkshops
        })
        .select()
        .single();

      if (createError) throw createError;

      // Agregar usuario como owner
      const { error: memberError } = await supabase
        .from('organization_users')
        .insert({
          organization_id: newOrg.id,
          user_id: user.id,
          role: 'owner',
          status: 'active'
        });

      if (memberError) throw memberError;

      // Recargar organizaciones
      await refreshOrganizations();
      
      toast.success(`Organización ${data.name} creada exitosamente`);
      return {
        ...newOrg,
        plan: newOrg.plan as 'starter' | 'professional' | 'enterprise',
        branding: newOrg.branding || {}
      } as Organization;

    } catch (err) {
      console.error('Error creating organization:', err);
      toast.error('Error al crear la organización');
      throw err;
    }
  }, [user, refreshOrganizations, canCreateOrganization, getUserPlan]);

  // Validar límites
  const validateLimit = useCallback(async (limitType: 'orders' | 'users' | 'workshops'): Promise<boolean> => {
    if (!currentOrganization) return false;

    try {
      const planLimits = PLAN_LIMITS[currentOrganization.plan];
      let currentCount = 0;
      let maxLimit = 0;

      switch (limitType) {
        case 'orders':
          const { count: ordersCount } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', currentOrganization.id)
            .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
          currentCount = ordersCount || 0;
          maxLimit = planLimits.maxOrdersPerMonth;
          break;

        case 'users':
          const { count: usersCount } = await supabase
            .from('organization_users')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', currentOrganization.id)
            .eq('status', 'active');
          currentCount = usersCount || 0;
          maxLimit = planLimits.maxUsers;
          break;

        case 'workshops':
          const { count: workshopsCount } = await supabase
            .from('workshops')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', currentOrganization.id)
            .eq('status', 'active');
          currentCount = workshopsCount || 0;
          maxLimit = planLimits.maxWorkshops;
          break;
      }

      return maxLimit === -1 || currentCount < maxLimit;
    } catch (err) {
      console.error('Error validating limit:', err);
      return false;
    }
  }, [currentOrganization]);

  // Invitar usuario
  const inviteUser = useCallback(async (email: string, role: 'admin' | 'member') => {
    if (!currentOrganization || !user) {
      toast.error('No hay organización activa');
      return;
    }

    try {
      // Aquí iría la lógica de invitación
      // Por ahora solo mostramos un toast
      toast.success(`Invitación enviada a ${email} como ${role}`);
      
    } catch (err) {
      console.error('Error inviting user:', err);
      toast.error('Error al enviar la invitación');
    }
  }, [currentOrganization, user]);

  // Actualizar organización
  const updateOrganization = useCallback(async (id: string, data: Partial<Organization>) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      // Actualizar estado local
      if (currentOrganization?.id === id) {
        setCurrentOrganization(prev => prev ? { ...prev, ...data } : null);
      }

      await refreshOrganizations();
      toast.success('Organización actualizada');

    } catch (err) {
      console.error('Error updating organization:', err);
      toast.error('Error al actualizar la organización');
    }
  }, [currentOrganization, refreshOrganizations]);

  // Verificar acceso a features
  const canAccessFeature = useCallback((feature: string): boolean => {
    if (!currentOrganization) return false;
    
    const planFeatures = PLAN_LIMITS[currentOrganization.plan].features;
    return planFeatures.includes('all_features') || planFeatures.includes(feature);
  }, [currentOrganization]);

  // Obtener estadísticas de uso
  const getUsageStats = useCallback(async (): Promise<UsageStats> => {
    if (!currentOrganization) {
      throw new Error('No hay organización activa');
    }

    try {
      // Obtener estadísticas de uso (simplificado por ahora)
      const { data: ordersCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact' })
        .eq('organization_id', currentOrganization.id)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

      const { data: usersCount } = await supabase
        .from('organization_users')
        .select('id', { count: 'exact' })
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'active');

      const { data: workshopsCount } = await supabase
        .from('workshops')
        .select('id', { count: 'exact' })
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'active');

      const planLimits = PLAN_LIMITS[currentOrganization.plan];

      return {
        ordersThisMonth: ordersCount?.length || 0,
        maxOrdersPerMonth: planLimits.maxOrdersPerMonth,
        activeUsers: usersCount?.length || 0,
        maxUsers: planLimits.maxUsers,
        workshopsCount: workshopsCount?.length || 0,
        maxWorkshops: planLimits.maxWorkshops,
        storageUsed: 0, // Por implementar
        maxStorage: planLimits.maxStorage
      };

    } catch (err) {
      console.error('Error getting usage stats:', err);
      throw err;
    }
  }, [currentOrganization]);

  // Cargar organizaciones cuando cambie el usuario
  useEffect(() => {
    loadUserOrganizations();
  }, [loadUserOrganizations]);

  const value: OrganizationContextType = {
    currentOrganization,
    userOrganizations,
    isLoading,
    error,
    switchOrganization,
    refreshOrganizations,
    createOrganization,
    inviteUser,
    updateOrganization,
    canAccessFeature,
    getUsageStats,
    canCreateOrganization,
    validateLimit,
    getUserPlan
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = (): OrganizationContextType => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};