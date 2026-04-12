import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/integrations/supabase/types';
import DashboardLayout from '@/components/DashboardLayout';
import TransactionList from '@/components/TransactionList';

const Transactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<'transactions'>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setTransactions(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`transactions-all-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          void fetchTransactions();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, fetchTransactions]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Transactions</h1>
          <p className="mt-1 text-muted-foreground">
            Full history with balance after each completed transaction (updates live).
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-banking">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : (
            <TransactionList transactions={transactions} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Transactions;
