import { useOrganization } from '@/contexts/OrganizationContext';

export const useIsDosmicos = () => {
  const { currentOrganization, isLoading } = useOrganization();
  
  return {
    isDosmicos: currentOrganization?.slug === 'dosmicos',
    isLoading,
    organization: currentOrganization
  };
};