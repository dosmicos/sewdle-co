import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCallback } from 'react';
import { differenceInCalendarDays, differenceInCalendarMonths, differenceInCalendarWeeks, isWithinInterval, parseISO } from 'date-fns';

export interface FinanceExpense {
  id: string;
  organization_id: string;
  date: string;
  category: 'cogs' | 'shipping' | 'handling_fees' | 'payment_gateways' | 'custom';
  description: string | null;
  amount: number;
  is_recurring: boolean;
  start_date: string | null;
  end_date: string | null;
  recurrence: 'monthly' | 'weekly' | 'daily' | 'one_time';
  is_ad_spend: boolean;
  created_at: string;
}

export type ExpenseInput = {
  date: string;
  category: FinanceExpense['category'];
  description?: string;
  amount: number;
  is_recurring?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  recurrence?: FinanceExpense['recurrence'];
  is_ad_spend?: boolean;
};

export function useFinanceExpenses() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['finance-expenses', orgId],
    queryFn: async (): Promise<FinanceExpense[]> => {
      const { data, error } = await supabase
        .from('finance_expenses')
        .select('*')
        .eq('organization_id', orgId!)
        .order('date', { ascending: false });

      if (error) throw error;
      return (data as unknown as FinanceExpense[]) || [];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const addMutation = useMutation({
    mutationFn: async (input: ExpenseInput) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase
        .from('finance_expenses')
        .insert({
          organization_id: orgId,
          ...input,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-expenses', orgId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ExpenseInput> }) => {
      const { error } = await supabase
        .from('finance_expenses')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-expenses', orgId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('finance_expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-expenses', orgId] });
    },
  });

  // Calculate total expenses within a date range
  const totalForPeriod = useCallback(
    (startDate: Date, endDate: Date): { total: number; adSpendTotal: number } => {
      const expenses = query.data || [];
      let total = 0;
      let adSpendTotal = 0;

      for (const expense of expenses) {
        let contribution = 0;

        if (expense.recurrence === 'one_time') {
          // One-time: include if expense date falls within range
          const expDate = parseISO(expense.date);
          if (
            isWithinInterval(expDate, { start: startDate, end: endDate })
          ) {
            contribution = expense.amount;
          }
        } else if (expense.recurrence === 'daily') {
          // Daily: amount * days overlapping
          const expStart = expense.start_date ? parseISO(expense.start_date) : parseISO(expense.date);
          const expEnd = expense.end_date ? parseISO(expense.end_date) : endDate;
          const effectiveStart = expStart > startDate ? expStart : startDate;
          const effectiveEnd = expEnd < endDate ? expEnd : endDate;
          if (effectiveStart <= effectiveEnd) {
            const days = differenceInCalendarDays(effectiveEnd, effectiveStart) + 1;
            contribution = expense.amount * days;
          }
        } else if (expense.recurrence === 'weekly') {
          const expStart = expense.start_date ? parseISO(expense.start_date) : parseISO(expense.date);
          const expEnd = expense.end_date ? parseISO(expense.end_date) : endDate;
          const effectiveStart = expStart > startDate ? expStart : startDate;
          const effectiveEnd = expEnd < endDate ? expEnd : endDate;
          if (effectiveStart <= effectiveEnd) {
            const weeks = differenceInCalendarWeeks(effectiveEnd, effectiveStart) + 1;
            contribution = expense.amount * weeks;
          }
        } else {
          // monthly (default for is_recurring)
          const expStart = expense.start_date ? parseISO(expense.start_date) : parseISO(expense.date);
          const expEnd = expense.end_date ? parseISO(expense.end_date) : endDate;
          const effectiveStart = expStart > startDate ? expStart : startDate;
          const effectiveEnd = expEnd < endDate ? expEnd : endDate;
          if (effectiveStart <= effectiveEnd) {
            const months = differenceInCalendarMonths(effectiveEnd, effectiveStart) + 1;
            contribution = expense.amount * months;
          }
        }

        total += contribution;
        if (expense.is_ad_spend) {
          adSpendTotal += contribution;
        }
      }

      return { total, adSpendTotal };
    },
    [query.data]
  );

  return {
    expenses: query.data || [],
    isLoading: query.isLoading,
    addExpense: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    updateExpense: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteExpense: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    totalForPeriod,
  };
}
