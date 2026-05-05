import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { FinanceSettings } from '@/hooks/useFinanceSettings';
import type { MonthlyTarget } from '@/hooks/useMonthlyTargets';
import { format, startOfMonth, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';

interface FinanceSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: FinanceSettings | null;
  target: MonthlyTarget | null;
  onSaveSettings: (partial: Partial<Omit<FinanceSettings, 'id' | 'organization_id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  onSaveTarget: (data: Partial<Omit<MonthlyTarget, 'id' | 'organization_id' | 'created_at' | 'updated_at'>> & { month: string }) => Promise<void>;
  isUpdating: boolean;
  isUpserting: boolean;
}

interface SettingsForm {
  cogs_percent: number;
  shipping_cost_percent: number;
  payment_gateway_percent: number;
  handling_cost_percent: number;
  monthly_opex: number;
  return_rate_percent: number;
  cm_target_percent: number;
}

interface TargetForm {
  month: string;
  revenue_target: number;
  cm_target: number;
  ad_spend_budget: number;
  new_customers_target: number;
}

const PercentSlider: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
  step?: number;
  hint?: string;
}> = ({ label, value, onChange, max = 50, step = 0.5, hint }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 h-7 text-sm text-right"
          step={step}
          min={0}
          max={100}
        />
        <span className="text-sm text-gray-400">%</span>
      </div>
    </div>
    <Slider
      value={[value]}
      onValueChange={([v]) => onChange(v)}
      min={0}
      max={max}
      step={step}
      className="cursor-pointer"
    />
    {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
  </div>
);

export const FinanceSettingsModal: React.FC<FinanceSettingsModalProps> = ({
  open,
  onOpenChange,
  settings,
  target,
  onSaveSettings,
  onSaveTarget,
  isUpdating,
  isUpserting,
}) => {
  const navigate = useNavigate();

  // Settings form state
  const [form, setForm] = useState<SettingsForm>({
    cogs_percent: 20,
    shipping_cost_percent: 10,
    payment_gateway_percent: 3.5,
    handling_cost_percent: 2,
    monthly_opex: 0,
    return_rate_percent: 5,
    cm_target_percent: 25,
  });

  // Target form state
  const currentMonthStr = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const nextMonthStr = format(startOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd');
  const [targetForm, setTargetForm] = useState<TargetForm>({
    month: currentMonthStr,
    revenue_target: 0,
    cm_target: 0,
    ad_spend_budget: 0,
    new_customers_target: 0,
  });

  // Sync settings into form
  useEffect(() => {
    if (settings) {
      setForm({
        cogs_percent: settings.cogs_percent,
        shipping_cost_percent: settings.shipping_cost_percent,
        payment_gateway_percent: settings.payment_gateway_percent,
        handling_cost_percent: settings.handling_cost_percent,
        monthly_opex: settings.monthly_opex,
        return_rate_percent: settings.return_rate_percent,
        cm_target_percent: settings.cm_target_percent,
      });
    }
  }, [settings]);

  // Sync target into form
  useEffect(() => {
    if (target) {
      setTargetForm({
        month: target.month,
        revenue_target: target.revenue_target,
        cm_target: target.cm_target,
        ad_spend_budget: target.ad_spend_budget,
        new_customers_target: target.new_customers_target,
      });
    }
  }, [target]);

  const handleSaveSettings = async () => {
    try {
      await onSaveSettings(form);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  const handleSaveTarget = async () => {
    try {
      await onSaveTarget(targetForm);
      toast.success('Target saved');
    } catch {
      toast.error('Failed to save target');
    }
  };

  const updateForm = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const updateTarget = <K extends keyof TargetForm>(key: K, value: TargetForm[K]) => {
    setTargetForm(prev => ({ ...prev, [key]: value }));
  };

  // Preview: total variable cost %
  const totalVarPct = form.cogs_percent + form.shipping_cost_percent + form.payment_gateway_percent + form.handling_cost_percent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finance Settings</DialogTitle>
          <DialogDescription>
            Configure cost percentages and monthly targets for the Prophit dashboard.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="costs" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="costs">Cost Structure</TabsTrigger>
            <TabsTrigger value="targets">Monthly Targets</TabsTrigger>
          </TabsList>

          {/* COSTS TAB */}
          <TabsContent value="costs" className="space-y-5 mt-4">
            {/* Link to detailed Cost Settings page */}
            <button
              onClick={() => {
                onOpenChange(false);
                navigate('/cost-settings');
              }}
              className="w-full flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-blue-800">Detailed Cost Settings</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Configure per-product COGS, shipping, gateway fees & custom expenses
                </p>
              </div>
              <ExternalLink className="h-4 w-4 text-blue-500" />
            </button>

            <PercentSlider
              label="Return Rate"
              value={form.return_rate_percent}
              onChange={(v) => updateForm('return_rate_percent', v)}
              max={30}
              hint="Estimated % of revenue returned (accrual)"
            />
            <PercentSlider
              label="CM Target"
              value={form.cm_target_percent}
              onChange={(v) => updateForm('cm_target_percent', v)}
              hint="Contribution Margin target %"
            />

            <div className="space-y-2">
              <Label className="text-sm">Monthly OpEx (COP)</Label>
              <Input
                type="number"
                value={form.monthly_opex}
                onChange={(e) => updateForm('monthly_opex', Number(e.target.value))}
                className="h-9"
                step={100000}
                min={0}
              />
              <p className="text-[10px] text-gray-400">
                Fixed monthly operating expenses (rent, salaries, SaaS, etc.)
              </p>
            </div>

            <Button onClick={handleSaveSettings} disabled={isUpdating} className="w-full">
              {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Settings
            </Button>
          </TabsContent>

          {/* TARGETS TAB */}
          <TabsContent value="targets" className="space-y-5 mt-4">
            <div className="space-y-2">
              <Label className="text-sm">Month</Label>
              <select
                value={targetForm.month}
                onChange={(e) => updateTarget('month', e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {Array.from({ length: 6 }, (_, i) => {
                  const d = addMonths(new Date(), i - 1);
                  const val = format(startOfMonth(d), 'yyyy-MM-dd');
                  const label = format(d, 'MMMM yyyy', { locale: es });
                  return <option key={val} value={val}>{label}</option>;
                })}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Revenue Target (COP)</Label>
              <Input
                type="number"
                value={targetForm.revenue_target}
                onChange={(e) => updateTarget('revenue_target', Number(e.target.value))}
                className="h-9"
                step={1000000}
                min={0}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">CM Target (COP)</Label>
              <Input
                type="number"
                value={targetForm.cm_target}
                onChange={(e) => updateTarget('cm_target', Number(e.target.value))}
                className="h-9"
                step={500000}
                min={0}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Ad Spend Budget (COP)</Label>
              <Input
                type="number"
                value={targetForm.ad_spend_budget}
                onChange={(e) => updateTarget('ad_spend_budget', Number(e.target.value))}
                className="h-9"
                step={500000}
                min={0}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">New Customers Target</Label>
              <Input
                type="number"
                value={targetForm.new_customers_target}
                onChange={(e) => updateTarget('new_customers_target', Number(e.target.value))}
                className="h-9"
                step={10}
                min={0}
              />
            </div>

            <Button onClick={handleSaveTarget} disabled={isUpserting} className="w-full">
              {isUpserting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Monthly Target
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default FinanceSettingsModal;
