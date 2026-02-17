import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { STAGE_LABELS, ProspectStage } from '@/types/prospects';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface SelectCellProps {
  value: ProspectStage;
  prospectId: string;
  onSave: (value: ProspectStage) => Promise<any>;
}

const STAGE_COLORS: Record<ProspectStage, string> = {
  lead: 'bg-slate-500 hover:bg-slate-600',
  videocall_scheduled: 'bg-blue-500 hover:bg-blue-600',
  videocall_completed: 'bg-blue-600 hover:bg-blue-700',
  visit_scheduled: 'bg-purple-500 hover:bg-purple-600',
  visit_completed: 'bg-purple-600 hover:bg-purple-700',
  sample_in_progress: 'bg-amber-600 hover:bg-amber-700',
  sample_approved: 'bg-green-500 hover:bg-green-600',
  sample_rejected: 'bg-red-500 hover:bg-red-600',
  trial_production: 'bg-indigo-500 hover:bg-indigo-600',
  trial_approved: 'bg-green-600 hover:bg-green-700',
  trial_rejected: 'bg-red-600 hover:bg-red-700',
  approved_workshop: 'bg-emerald-600 hover:bg-emerald-700',
  rejected: 'bg-gray-600 hover:bg-gray-700',
};

export const SelectCell = ({ value, prospectId, onSave }: SelectCellProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (newValue: ProspectStage) => {
    if (newValue === value) return;

    setIsSaving(true);
    try {
      await onSave(newValue);
    } catch (err) {
      console.error('Error updating stage:', err);
    } finally {
      setIsSaving(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={value}
        onValueChange={handleChange}
        open={isOpen}
        onOpenChange={setIsOpen}
        disabled={isSaving}
      >
        <SelectTrigger className="w-full border-0 shadow-none p-0 h-auto focus:ring-0">
          <Badge className={cn('text-white text-xs', STAGE_COLORS[value])}>
            {STAGE_LABELS[value]}
          </Badge>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(STAGE_LABELS).map(([stage, label]) => (
            <SelectItem key={stage} value={stage}>
              <Badge className={cn('text-white text-xs', STAGE_COLORS[stage as ProspectStage])}>
                {label}
              </Badge>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
    </div>
  );
};