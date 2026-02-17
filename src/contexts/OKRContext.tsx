import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsDosmicos } from '@/hooks/useIsDosmicos';
import { toast } from 'sonner';

// Types basados en el schema de Supabase
interface OKRObjective {
  id: string;
  title: string;
  description?: string;
  level: 'area' | 'company' | 'team' | 'individual';
  tier: 'T1' | 'T2';
  area?: 'marketing' | 'diseno_prod' | 'operaciones';
  visibility: 'public' | 'area' | 'private';
  owner_id: string;
  parent_objective_id?: string;
  period_start: string;
  period_end: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

interface OKRKeyResult {
  id: string;
  title: string;
  current_value: number;
  target_value: number;
  unit: '%' | '#' | '$' | 'rate' | 'binary';
  progress_pct: number;
  confidence: 'low' | 'med' | 'high';
  data_source: 'manual' | 'auto' | 'computed';
  private: boolean;
  guardrail: boolean;
  objective_id: string;
  owner_id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

interface OKRCheckin {
  id: string;
  kr_id: string;
  author_id: string;
  delta_value?: number;
  progress_pct?: number;
  confidence: 'low' | 'med' | 'high';
  note?: string;
  blockers?: string;
  organization_id: string;
  created_at: string;
}

interface OKRContextValue {
  // Estado
  objectives: OKRObjective[];
  keyResults: OKRKeyResult[];
  checkins: OKRCheckin[];
  isLoading: boolean;
  error: string | null;

  // Funciones CRUD para Objetivos
  createObjective: (objective: Omit<OKRObjective, 'id' | 'created_at' | 'updated_at' | 'organization_id'>) => Promise<void>;
  updateObjective: (id: string, updates: Partial<OKRObjective>) => Promise<void>;
  deleteObjective: (id: string) => Promise<void>;

  // Funciones CRUD para Key Results
  createKeyResult: (keyResult: Omit<OKRKeyResult, 'id' | 'created_at' | 'updated_at' | 'organization_id' | 'progress_pct'>) => Promise<void>;
  updateKeyResult: (id: string, updates: Partial<OKRKeyResult>) => Promise<void>;
  deleteKeyResult: (id: string) => Promise<void>;

  // Funciones para Check-ins
  createCheckin: (checkin: Omit<OKRCheckin, 'id' | 'created_at' | 'organization_id'>) => Promise<void>;

  // Funciones de utilidad
  refreshData: () => Promise<void>;
  getObjectivesByOwner: (ownerId: string) => OKRObjective[];
  getKeyResultsByObjective: (objectiveId: string) => OKRKeyResult[];
  getCheckinsByKeyResult: (keyResultId: string) => OKRCheckin[];
}

const OKRContext = createContext<OKRContextValue | null>(null);

export const OKRProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { isDosmicos, organization } = useIsDosmicos();
  
  const [objectives, setObjectives] = useState<OKRObjective[]>([]);
  const [keyResults, setKeyResults] = useState<OKRKeyResult[]>([]);
  const [checkins, setCheckins] = useState<OKRCheckin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar todos los datos OKR
  const refreshData = useCallback(async () => {
    if (!user || !isDosmicos || !organization) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Cargar objetivos
      const { data: objectivesData, error: objectivesError } = await supabase
        .from('okr_objective')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });
      
      if (objectivesError) throw objectivesError;
      
      // Cargar key results
      const { data: keyResultsData, error: keyResultsError } = await supabase
        .from('okr_key_result')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });
      
      if (keyResultsError) throw keyResultsError;
      
      // Cargar check-ins
      const { data: checkinsData, error: checkinsError } = await supabase
        .from('okr_checkin')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });
      
      if (checkinsError) throw checkinsError;
      
      setObjectives(objectivesData || []);
      setKeyResults(keyResultsData || []);
      setCheckins(checkinsData || []);
      
    } catch (error: unknown) {
      console.error('Error loading OKR data:', error);
      setError(error.message);
      toast.error('Error cargando datos de OKR');
    } finally {
      setIsLoading(false);
    }
  }, [user, isDosmicos, organization]);

  // Cargar datos al montar y cuando cambie la organización
  useEffect(() => {
    if (isDosmicos) {
      refreshData();
    }
  }, [isDosmicos, refreshData]);

  // CRUD Functions para Objetivos
  const createObjective = useCallback(async (objective: Omit<OKRObjective, 'id' | 'created_at' | 'updated_at' | 'organization_id'>) => {
    if (!organization) return;
    
    try {
      const { error } = await supabase
        .from('okr_objective')
        .insert({
          ...objective,
          organization_id: organization.id
        });
      
      if (error) throw error;
      
      toast.success('Objetivo creado exitosamente');
      await refreshData();
      
    } catch (error: unknown) {
      console.error('Error creating objective:', error);
      toast.error('Error creando objetivo');
      throw error;
    }
  }, [organization, refreshData]);

  const updateObjective = useCallback(async (id: string, updates: Partial<OKRObjective>) => {
    try {
      const { error } = await supabase
        .from('okr_objective')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('Objetivo actualizado');
      await refreshData();
      
    } catch (error: unknown) {
      console.error('Error updating objective:', error);
      toast.error('Error actualizando objetivo');
      throw error;
    }
  }, [refreshData]);

  const deleteObjective = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('okr_objective')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('Objetivo eliminado');
      await refreshData();
      
    } catch (error: unknown) {
      console.error('Error deleting objective:', error);
      toast.error('Error eliminando objetivo');
      throw error;
    }
  }, [refreshData]);

  // CRUD Functions para Key Results
  const createKeyResult = useCallback(async (keyResult: Omit<OKRKeyResult, 'id' | 'created_at' | 'updated_at' | 'organization_id' | 'progress_pct'>) => {
    if (!organization) return;
    
    try {
      const { error } = await supabase
        .from('okr_key_result')
        .insert({
          ...keyResult,
          organization_id: organization.id
        });
      
      if (error) throw error;
      
      toast.success('Key Result creado exitosamente');
      await refreshData();
      
    } catch (error: unknown) {
      console.error('Error creating key result:', error);
      toast.error('Error creando Key Result');
      throw error;
    }
  }, [organization, refreshData]);

  const updateKeyResult = useCallback(async (id: string, updates: Partial<OKRKeyResult>) => {
    try {
      const { error } = await supabase
        .from('okr_key_result')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('Key Result actualizado');
      await refreshData();
      
    } catch (error: unknown) {
      console.error('Error updating key result:', error);
      toast.error('Error actualizando Key Result');
      throw error;
    }
  }, [refreshData]);

  const deleteKeyResult = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('okr_key_result')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('Key Result eliminado');
      await refreshData();
      
    } catch (error: unknown) {
      console.error('Error deleting key result:', error);
      toast.error('Error eliminando Key Result');
      throw error;
    }
  }, [refreshData]);

  // Función para Check-ins
  const createCheckin = useCallback(async (checkin: Omit<OKRCheckin, 'id' | 'created_at' | 'organization_id'>) => {
    if (!organization) return;
    
    try {
      const { error } = await supabase
        .from('okr_checkin')
        .insert({
          ...checkin,
          organization_id: organization.id
        });
      
      if (error) throw error;
      
      toast.success('Check-in registrado');
      await refreshData();
      
    } catch (error: unknown) {
      console.error('Error creating checkin:', error);
      toast.error('Error registrando check-in');
      throw error;
    }
  }, [organization, refreshData]);

  // Funciones de utilidad
  const getObjectivesByOwner = useCallback((ownerId: string) => {
    return objectives.filter(obj => obj.owner_id === ownerId);
  }, [objectives]);

  const getKeyResultsByObjective = useCallback((objectiveId: string) => {
    return keyResults.filter(kr => kr.objective_id === objectiveId);
  }, [keyResults]);

  const getCheckinsByKeyResult = useCallback((keyResultId: string) => {
    return checkins.filter(checkin => checkin.kr_id === keyResultId);
  }, [checkins]);

  // Solo renderizar el contexto si el usuario pertenece a Dosmicos
  if (!isDosmicos) {
    return <>{children}</>;
  }

  const value: OKRContextValue = {
    objectives,
    keyResults,
    checkins,
    isLoading,
    error,
    createObjective,
    updateObjective,
    deleteObjective,
    createKeyResult,
    updateKeyResult,
    deleteKeyResult,
    createCheckin,
    refreshData,
    getObjectivesByOwner,
    getKeyResultsByObjective,
    getCheckinsByKeyResult
  };

  return (
    <OKRContext.Provider value={value}>
      {children}
    </OKRContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useOKR = () => {
  const context = useContext(OKRContext);
  if (!context) {
    throw new Error('useOKR debe ser usado dentro de OKRProvider');
  }
  return context;
};
