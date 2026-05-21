import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useStores, Store } from '@/hooks/useStores';

const STORAGE_KEY = 'sewdle_active_store';

interface StoreContextValue {
  stores: Store[];
  activeStoreId: string | null;  // null = "Todas las tiendas"
  activeStore: Store | null;
  setActiveStoreId: (id: string | null) => void;
  loading: boolean;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider: React.FC<{
  organizationId: string | null;
  children: React.ReactNode;
}> = ({ organizationId, children }) => {
  const { stores, loading } = useStores(organizationId);

  const [activeStoreId, setActiveStoreIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  // Validate stored store belongs to this org
  useEffect(() => {
    if (stores.length > 0 && activeStoreId) {
      const valid = stores.some(s => s.id === activeStoreId);
      if (!valid) {
        setActiveStoreIdState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [stores, activeStoreId]);

  const setActiveStoreId = (id: string | null) => {
    setActiveStoreIdState(id);
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore localStorage errors
    }
  };

  const activeStore = useMemo(
    () => (activeStoreId ? stores.find(s => s.id === activeStoreId) ?? null : null),
    [stores, activeStoreId]
  );

  return (
    <StoreContext.Provider value={{ stores, activeStoreId, activeStore, setActiveStoreId, loading }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStoreContext = (): StoreContextValue => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStoreContext must be used inside StoreProvider');
  return ctx;
};
