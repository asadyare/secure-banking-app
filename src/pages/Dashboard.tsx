import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import AccountCard from '@/components/AccountCard';
import TransactionList from '@/components/TransactionList';
import { Wallet, TrendingUp, ArrowLeftRight, Clock } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [accountsRes, transactionsRes, profileRes] = await Promise.all([
        supabase.from('accounts').select('*').order('created_at', { ascending: true }),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      ]);

      if (accountsRes.data) setAccounts(accountsRes.data);
      if (transactionsRes.data) setTransactions(transactionsRes.data);
      if (profileRes.data) setProfile(profileRes.data);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}
          </h1>
          <p className="mt-1 text-muted-foreground">Here's your financial overview</p>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Total Balance', value: formatCurrency(totalBalance), icon: Wallet, accent: true },
            { label: 'Accounts', value: accounts.length.toString(), icon: TrendingUp },
            { label: 'Transactions', value: transactions.length.toString(), icon: ArrowLeftRight },
            { label: 'Pending', value: transactions.filter(t => t.status === 'pending').length.toString(), icon: Clock },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded-xl border border-border p-5 shadow-banking ${
                item.accent ? 'banking-gradient text-primary-foreground' : 'bg-card'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className={`text-sm ${item.accent ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {item.label}
                </p>
                <item.icon className={`h-5 w-5 ${item.accent ? 'text-primary-foreground/50' : 'text-muted-foreground/50'}`} />
              </div>
              <p className={`mt-2 font-heading text-2xl font-bold ${item.accent ? '' : 'text-card-foreground'}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Accounts */}
        <div>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-4">Your Accounts</h2>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  accountName={account.account_name}
                  accountNumber={account.account_number}
                  accountType={account.account_type}
                  balance={Number(account.balance)}
                  currency={account.currency}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-4">Recent Transactions</h2>
          <div className="rounded-xl border border-border bg-card p-4 shadow-banking">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : (
              <TransactionList transactions={transactions} />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
