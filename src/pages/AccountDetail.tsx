import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/integrations/supabase/types';
import DashboardLayout from '@/components/DashboardLayout';
import TransactionList from '@/components/TransactionList';
import { Button } from '@/components/ui/button';
import { formatCardStyleAccountNumber } from '@/lib/format-account';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Copy, Loader2, Snowflake } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AccountDetail = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [account, setAccount] = useState<Tables<'accounts'> | null>(null);
  const [txns, setTxns] = useState<Tables<'transactions'>[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !accountId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: acc, error: accErr } = await supabase.from('accounts').select('*').eq('id', accountId).maybeSingle();
    if (accErr || !acc) {
      setAccount(null);
      setLoading(false);
      return;
    }
    setAccount(acc);
    const { data: t } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (t) setTxns(t);
    setLoading(false);
  }, [user, accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user?.id || !accountId) return;
    const channel = supabase
      .channel(`account-live-${accountId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accounts', filter: `id=eq.${accountId}` },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `account_id=eq.${accountId}` },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, accountId, load]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: account?.currency ?? 'USD' }).format(n);

  const copyNumber = () => {
    if (!account) return;
    void navigator.clipboard.writeText(account.account_number);
    toast({ title: 'Copied', description: 'Account number copied.' });
  };

  if (loading && !account) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      </DashboardLayout>
    );
  }

  if (!account) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-lg space-y-4 text-center">
          <p className="text-muted-foreground">We couldn’t find that account or you don’t have access.</p>
          <Button asChild variant="outline">
            <Link to="/accounts">Back to accounts</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Button variant="ghost" className="mb-2 -ml-2 gap-2 text-muted-foreground" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="font-heading text-3xl font-bold text-foreground">{account.account_name}</h1>
            <p className="mt-1 capitalize text-muted-foreground">{account.account_type} · Live balance</p>
          </div>
          <div className="rounded-xl border border-border bg-gradient-to-br from-fuchsia-500/10 to-violet-600/10 p-6 shadow-banking">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Available balance</p>
            <p className="mt-1 font-heading text-4xl font-bold tabular-nums text-foreground">
              {formatCurrency(Number(account.balance))}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm tracking-widest text-foreground">
                {formatCardStyleAccountNumber(account.account_number)}
              </span>
              <span className="text-xs text-muted-foreground">
                Good thru <span className="font-mono font-medium text-foreground">{account.card_expiry ?? '05/30'}</span>
              </span>
              <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={copyNumber} aria-label="Copy account number">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {account.is_frozen ? (
          <Alert className="border-amber-500/40 bg-amber-500/10">
            <Snowflake className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            <AlertTitle>Account frozen</AlertTitle>
            <AlertDescription>
              Outgoing transfers from this account are paused. Unfreeze the card on the Accounts page to send money.
            </AlertDescription>
          </Alert>
        ) : null}

        <div>
          <h2 className="font-heading mb-3 text-xl font-semibold text-foreground">Activity</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Each line shows the running balance after that transaction posts.
          </p>
          <div className="rounded-xl border border-border bg-card p-4 shadow-banking">
            <TransactionList transactions={txns} currency={account.currency} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AccountDetail;
