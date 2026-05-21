import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Store } from 'lucide-react';
import { useStoreContext } from '@/contexts/StoreContext';

const COUNTRY_FLAGS: Record<string, string> = {
  CO: '🇨🇴',
  US: '🇺🇸',
  MX: '🇲🇽',
  AR: '🇦🇷',
  BR: '🇧🇷',
  PE: '🇵🇪',
  CL: '🇨🇱',
};

const getFlag = (countryCode: string | null) =>
  countryCode ? (COUNTRY_FLAGS[countryCode.toUpperCase()] ?? '🏪') : '🏪';

export const StoreSwitcher: React.FC = () => {
  const { stores, activeStore, activeStoreId, setActiveStoreId } = useStoreContext();

  // Don't render if only one store (or no stores yet)
  if (stores.length <= 1 && !activeStoreId) return null;

  const label = activeStore
    ? `${getFlag(activeStore.country_code)} ${activeStore.name}`
    : '🏪 Todas las tiendas';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs font-medium border-dashed"
        >
          <span>{label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Filtrar por tienda
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setActiveStoreId(null)}
          className={!activeStoreId ? 'bg-muted font-medium' : ''}
        >
          <Store className="h-4 w-4 mr-2 text-muted-foreground" />
          Todas las tiendas
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {stores
          .filter(s => s.is_active)
          .map(store => (
            <DropdownMenuItem
              key={store.id}
              onClick={() => setActiveStoreId(store.id)}
              className={activeStoreId === store.id ? 'bg-muted font-medium' : ''}
            >
              <span className="mr-2 text-base leading-none">
                {getFlag(store.country_code)}
              </span>
              {store.name}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
