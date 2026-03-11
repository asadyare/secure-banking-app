import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  const [accounts, setAccounts] = useState<any[]>([]);
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
    if (!newAccountName.trim()) return;
    setCreating(true);

    // Generate account number client-side
    const accNum = 'ACC' + Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');

    const { error } = await supabase.from('accounts').insert({
      user_id: user!.id,
      account_number: accNum,
      account_type: newAccountType as any,
      account_name: newAccountName.trim(),
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
    </DashboardLayout>
  );
};

export default Accounts;
