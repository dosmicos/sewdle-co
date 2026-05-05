import React from 'react';
import { Check, ChevronsUpDown, Building2, Crown, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/contexts/OrganizationContext';
import { cn } from '@/lib/utils';

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'owner':
      return <Crown className="h-3 w-3 text-yellow-500" />;
    case 'admin':
      return <Shield className="h-3 w-3 text-blue-500" />;
    default:
      return <User className="h-3 w-3 text-gray-500" />;
  }
};

const getRoleLabel = (role: string) => {
  switch (role) {
    case 'owner':
      return 'Propietario';
    case 'admin':
      return 'Administrador';
    default:
      return 'Miembro';
  }
};

const getPlanColor = (plan: string) => {
  switch (plan) {
    case 'enterprise':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'professional':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
};

export const OrganizationSelector: React.FC = () => {
  const { 
    currentOrganization, 
    userOrganizations, 
    switchOrganization, 
    isLoading 
  } = useOrganization();
  
  const [open, setOpen] = React.useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <Building2 className="h-4 w-4 animate-pulse" />
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  if (!currentOrganization || userOrganizations.length === 0) {
    return (
      <div className="flex items-center space-x-2 text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span className="text-sm">Sin organización</span>
      </div>
    );
  }

  // Si solo hay una organización, mostrar solo el nombre
  if (userOrganizations.length === 1) {
    const userOrg = userOrganizations[0];
    return (
      <div className="flex items-center space-x-2">
        <Building2 className="h-4 w-4 text-primary" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{currentOrganization.name}</span>
          <div className="flex items-center space-x-1">
            {getRoleIcon(userOrg.role)}
            <span className="text-xs text-muted-foreground">
              {getRoleLabel(userOrg.role)}
            </span>
            <Badge variant="secondary" className={cn("text-xs", getPlanColor(currentOrganization.plan))}>
              {currentOrganization.plan}
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  // Si hay múltiples organizaciones, mostrar selector
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[250px] justify-between"
        >
          <div className="flex items-center space-x-2 truncate">
            <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex flex-col items-start truncate">
              <span className="text-sm font-medium truncate">
                {currentOrganization.name}
              </span>
              <div className="flex items-center space-x-1">
                {getRoleIcon(userOrganizations.find(ou => ou.organization_id === currentOrganization.id)?.role || 'member')}
                <Badge variant="secondary" className={cn("text-xs", getPlanColor(currentOrganization.plan))}>
                  {currentOrganization.plan}
                </Badge>
              </div>
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandInput placeholder="Buscar organización..." />
          <CommandEmpty>No se encontraron organizaciones.</CommandEmpty>
          <CommandGroup>
            {userOrganizations.map((userOrg) => (
              <CommandItem
                key={userOrg.organization_id}
                value={userOrg.organization?.name}
                onSelect={() => {
                  if (userOrg.organization_id !== currentOrganization.id) {
                    switchOrganization(userOrg.organization_id);
                  }
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                <div className="flex items-center space-x-2 w-full">
                  <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">
                        {userOrg.organization?.name}
                      </span>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          currentOrganization.id === userOrg.organization_id
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                    </div>
                    <div className="flex items-center space-x-1 mt-1">
                      {getRoleIcon(userOrg.role)}
                      <span className="text-xs text-muted-foreground">
                        {getRoleLabel(userOrg.role)}
                      </span>
                      <Badge variant="secondary" className={cn("text-xs", getPlanColor(userOrg.organization?.plan || 'starter'))}>
                        {userOrg.organization?.plan}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};