import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { newAccountSchema } from '@/lib/validation/banking';
import type { Tables } from '@/integrations/supabase/types';
import DashboardLayout from '@/components/DashboardLayout';
import AccountCard from '@/components/AccountCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Accounts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Tables<'accounts'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<string>('checking');
  const [creating, setCreating] = useState(false);

  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('*').order('created_at');
    if (data) setAccounts(data);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchAccounts();
  }, [user]);

  const handleCreateAccount = async () => {
    const parsed = newAccountSchema.safeParse({
      accountName: newAccountName,
      accountType: newAccountType,
    });
    if (!parsed.success) {
      toast({
        title: 'Invalid input',
        description: parsed.error.issues[0]?.message ?? 'Check account details.',
        variant: 'destructive',
      });
      return;
    }
    setCreating(true);

    /* Empty object helps PostgREST match a zero-argument RPC signature */
    const { data: accNum, error: genErr } = await supabase.rpc('generate_account_number', {});
    if (genErr || typeof accNum !== 'string') {
      toast({
        title: 'Error',
        description: genErr?.message ?? 'Could not generate account number.',
        variant: 'destructive',
      });
      setCreating(false);
      return;
    }

    const { error } = await supabase.from('accounts').insert({
      user_id: user!.id,
      account_number: accNum,
      account_type: parsed.data.accountType,
      account_name: parsed.data.accountName,
      balance: 0,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Account created', description: `${newAccountName} has been opened.` });
      setNewAccountName('');
      setDialogOpen(false);
      fetchAccounts();
    }
    setCreating(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground">Accounts</h1>
            <p className="mt-1 text-muted-foreground">Manage your bank accounts</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading">Open New Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="e.g., Savings Account"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Select value={newAccountType} onValueChange={setNewAccountType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateAccount} disabled={creating} className="w-full">
                  {creating ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

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
                accountId={account.id}
                accountName={account.account_name}
                accountNumber={account.account_number}
                accountType={account.account_type}
                balance={Number(account.balance)}
                currency={account.currency}
                cardExpiry={account.card_expiry ?? '05/30'}
                isFrozen={account.is_frozen === true}
                copyableAccountNumber
                onAccountUpdated={fetchAccounts}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Accounts;
