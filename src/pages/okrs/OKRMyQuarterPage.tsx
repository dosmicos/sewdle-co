import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { OKRStatsCards } from '@/components/okr/OKRStatsCards';
import { ObjectiveCard } from '@/components/okr/ObjectiveCard';
import { ObjectiveForm } from '@/components/okr/ObjectiveForm';
import { useOKR } from '@/contexts/OKRContext';
import { useAuth } from '@/contexts/AuthContext';

export const OKRMyQuarterPage = () => {
  const { objectives } = useOKR();
  const { user } = useAuth();
  const [showObjectiveForm, setShowObjectiveForm] = useState(false);

  // Filter user's objectives
  const userObjectives = objectives.filter(obj => obj.owner_id === user?.id);

  return (
    <div className="space-y-6">
      {/* Personal Stats */}
      <OKRStatsCards variant="personal" ownerId={user?.id} />
      
      {/* My Objectives */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Mis Objetivos</h2>
        <Button onClick={() => setShowObjectiveForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Objetivo
        </Button>
      </div>

      {/* Objectives Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {userObjectives.map((objective) => (
          <ObjectiveCard
            key={objective.id}
            objective={objective}
            showActions
          />
        ))}
      </div>

      {/* Objective Form Modal */}
      <ObjectiveForm
        open={showObjectiveForm}
        onClose={() => setShowObjectiveForm(false)}
        mode="create"
      />
    </div>
  );
};