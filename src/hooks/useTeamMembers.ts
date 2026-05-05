import { useMemo } from 'react';
import { useUsers } from './useUsers';

const TEAM_ROLES = ['Administrador', 'Marketing'];

export function useTeamMembers() {
  const { users, loading } = useUsers();

  const teamMembers = useMemo(
    () =>
      users
        .filter((u) => u.status === 'active' && TEAM_ROLES.includes(u.role))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  return { teamMembers, isLoading: loading };
}
