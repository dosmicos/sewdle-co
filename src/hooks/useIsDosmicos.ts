import { useOrganization } from '@/contexts/OrganizationContext';

export const useIsDosmicos = () => {
  const { currentOrganization, isLoading } = useOrganization();

  const slug = currentOrganization?.slug?.toLowerCase();
  const isDosmicos = slug ? ['dosmicos', 'dosmicos-org'].includes(slug) : false;
  
  return {
    isDosmicos,
    isLoading,
    organization: currentOrganization
  };
};