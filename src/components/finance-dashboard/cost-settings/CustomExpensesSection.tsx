import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Plus, Pencil, Trash2, Receipt } from 'lucide-react';
import type { FinanceExpense, ExpenseInput } from '@/hooks/useFinanceExpenses';

const CATEGORIES = [
  { value: 'custom', label: 'Custom' },
  { value: 'cogs', label: 'COGS' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'handling_fees', label: 'Handling Fees' },
  { value: 'payment_gateways', label: 'Payment Gateways' },
] as const;

const RECURRENCES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
  { value: 'one_time', label: 'One-time' },
] as const;

interface CustomExpensesSectionProps {
  expenses: FinanceExpense[];
  isLoading: boolean;
  onAdd: (input: ExpenseInput) => Promise<void>;
  onUpdate: (data: { id: string; updates: Partial<ExpenseInput> }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const defaultForm: ExpenseInput = {
  date: new Date().toISOString().split('T')[0],
  category: 'custom',
  description: '',
  amount: 0,
  is_recurring: true,
  start_date: new Date().toISOString().split('T')[0],
  end_date: null,
  recurrence: 'monthly',
  is_ad_spend: false,
};

export const CustomExpensesSection: React.FC<CustomExpensesSectionProps> = ({
  expenses,
  isLoading,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseInput>(defaultForm);

  const openAddDialog = () => {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEditDialog = (expense: FinanceExpense) => {
    setEditingId(expense.id);
    setForm({
      date: expense.date,
      category: expense.category,
      description: expense.description || '',
      amount: expense.amount,
      is_recurring: expense.is_recurring,
      start_date: expense.start_date,
      end_date: expense.end_date,
      recurrence: expense.recurrence,
      is_ad_spend: expense.is_ad_spend,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editingId) {
      await onUpdate({ id: editingId, updates: form });
    } else {
      await onAdd(form);
    }
    setDialogOpen(false);
  };

  const totalMonthly = expenses
    .filter((e) => e.recurrence === 'monthly')
    .reduce((sum, e) => sum + e.amount, 0);

  const adSpendExpenses = expenses.filter((e) => e.is_ad_spend);
  const nonAdExpenses = expenses.filter((e) => !e.is_ad_spend);

  const formatCOP = (value: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

  const updateForm = <K extends keyof ExpenseInput>(key: K, value: ExpenseInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-base">Custom Expenses</CardTitle>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Recurring fixed costs (rent, salaries, SaaS, etc.)
              </p>
              <Button size="sm" onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-1" />
                Add Expense
              </Button>
            </div>

            {isLoading ? (
              <div className="py-6 text-center text-sm text-gray-400">Loading expenses...</div>
            ) : expenses.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">
                No custom expenses added yet.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">Category</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">Amount</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-600 w-24">Recurrence</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-600 w-20">Ad Spend</th>
                      <th className="w-20" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{expense.description || '—'}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {expense.category}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatCOP(expense.amount)}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-500 capitalize">
                          {expense.recurrence.replace('_', ' ')}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {expense.is_ad_spend && (
                            <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => openEditDialog(expense)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                              onClick={() => onDelete(expense.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            {expenses.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Monthly Expenses</span>
                  <span className="font-semibold">{formatCOP(totalMonthly)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Non-ad expenses: {nonAdExpenses.length}</span>
                  <span>Ad spend expenses: {adSpendExpenses.length}</span>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Description</Label>
              <Input
                value={form.description || ''}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="e.g., Office rent, Shopify subscription"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => updateForm('category', e.target.value as ExpenseInput['category'])}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Amount (COP)</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => updateForm('amount', Number(e.target.value))}
                  min={0}
                  step={10000}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Recurrencia</Label>
                <select
                  value={form.recurrence}
                  onChange={(e) => updateForm('recurrence', e.target.value as ExpenseInput['recurrence'])}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {RECURRENCES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {form.recurrence === 'one_time' ? (
                <div className="space-y-1.5">
                  <Label className="text-sm">Fecha</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => updateForm('date', e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-sm">Desde</Label>
                  <Input
                    type="date"
                    value={form.start_date || ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      updateForm('start_date', val);
                      // Keep date in sync for backwards compat
                      if (val) updateForm('date', val);
                    }}
                  />
                </div>
              )}
            </div>

            {form.recurrence !== 'one_time' && (
              <div className="space-y-1.5">
                <Label className="text-sm">Hasta (opcional — vacío = indefinido)</Label>
                <Input
                  type="date"
                  value={form.end_date || ''}
                  onChange={(e) => updateForm('end_date', e.target.value || null)}
                />
              </div>
            )}

            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Switch
                checked={form.is_ad_spend || false}
                onCheckedChange={(checked) => updateForm('is_ad_spend', checked)}
              />
              <div>
                <Label className="text-sm">Count as Ad Spend</Label>
                <p className="text-xs text-gray-500">Include in marketing/CAC calculations</p>
              </div>
            </div>

            <Button onClick={handleSave} className="w-full">
              {editingId ? 'Save Changes' : 'Add Expense'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
