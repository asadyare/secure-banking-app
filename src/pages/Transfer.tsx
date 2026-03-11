import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Shield } from 'lucide-react';

const Transfer = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('accounts').select('*').order('created_at').then(({ data }) => {
      if (data) setAccounts(data);
    });
  }, [user]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);

    if (!fromAccountId || !toAccountId || isNaN(amountNum) || amountNum <= 0) {
      toast({ title: 'Invalid input', description: 'Please fill all fields correctly.', variant: 'destructive' });
      return;
    }
    if (fromAccountId === toAccountId) {
      toast({ title: 'Invalid transfer', description: 'Cannot transfer to the same account.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.rpc('transfer_funds', {
      p_from_account_id: fromAccountId,
      p_to_account_id: toAccountId,
      p_amount: amountNum,
      p_description: description || 'Internal Transfer',
    });

    if (error) {
      toast({ title: 'Transfer failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Transfer complete', description: `Successfully transferred ${formatCurrency(amountNum)}` });
      setAmount('');
      setDescription('');
      // Refresh accounts
      const { data: refreshed } = await supabase.from('accounts').select('*').order('created_at');
      if (refreshed) setAccounts(refreshed);
    }
    setLoading(false);
  };

  const fromAccount = accounts.find((a) => a.id === fromAccountId);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Transfer Funds</h1>
          <p className="mt-1 text-muted-foreground">Move money between your accounts</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-banking">
          <form onSubmit={handleTransfer} className="space-y-6">
            <div className="space-y-2">
              <Label>From Account</Label>
              <Select value={fromAccountId} onValueChange={setFromAccountId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select source account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_name} — {formatCurrency(Number(acc.balance))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                <ArrowRight className="h-5 w-5 text-accent" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>To Account</Label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select destination account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter((a) => a.id !== fromAccountId).map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_name} — {formatCurrency(Number(acc.balance))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-12 text-lg"
                required
              />
              {fromAccount && (
                <p className="text-xs text-muted-foreground">
                  Available: {formatCurrency(Number(fromAccount.balance))}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this transfer for?"
                maxLength={200}
                rows={2}
              />
            </div>

            <Button type="submit" disabled={loading} className="h-12 w-full text-base">
              {loading ? 'Processing...' : 'Transfer Funds'}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span>Transfers are encrypted and processed securely</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Transfer;
