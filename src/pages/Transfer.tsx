import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { transferFormSchema, transferToSomeoneSchema } from '@/lib/validation/banking';
import type { Tables } from '@/integrations/supabase/types';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Shield } from 'lucide-react';

const Transfer = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Tables<'accounts'>[]>([]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [toAccountNumber, setToAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'someone' | 'between'>('someone');
  /** One key per submit attempt; reused if the user retries after a failure (cleared on success). */
  const transferIdempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('accounts')
      .select('*')
      .order('created_at')
      .then(({ data, error }) => {
        if (error) {
          toast({ title: 'Could not load accounts', description: error.message, variant: 'destructive' });
          return;
        }
        if (data) setAccounts(data);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast from useToast is stable
  }, [user]);

  const spendableAccounts = accounts.filter((a) => a.is_frozen !== true);

  useEffect(() => {
    const acc = accounts.find((a) => a.id === fromAccountId);
    if (acc?.is_frozen) setFromAccountId('');
  }, [accounts, fromAccountId]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Math.round(parseFloat(amount) * 100) / 100;

    if (tab === 'between') {
      const parsed = transferFormSchema.safeParse({
        fromAccountId,
        toAccountId,
        amount: amountNum,
        description: description.trim() || undefined,
      });

      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message ?? 'Invalid input';
        toast({ title: 'Invalid input', description: msg, variant: 'destructive' });
        return;
      }

      const idempotencyKey = transferIdempotencyKeyRef.current ?? crypto.randomUUID();
      transferIdempotencyKeyRef.current = idempotencyKey;

      setLoading(true);
      const { error } = await supabase.rpc('transfer_funds', {
        p_from_account_id: parsed.data.fromAccountId,
        p_to_account_id: parsed.data.toAccountId,
        p_amount: parsed.data.amount,
        p_description: parsed.data.description?.trim() || 'Internal Transfer',
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        transferIdempotencyKeyRef.current = null;
        toast({ title: 'Transfer failed', description: error.message, variant: 'destructive' });
      } else {
        transferIdempotencyKeyRef.current = null;
        toast({
          title: 'Transfer complete',
          description: `Successfully transferred ${formatCurrency(parsed.data.amount)}`,
        });
        setAmount('');
        setDescription('');
        const { data: refreshed } = await supabase.from('accounts').select('*').order('created_at');
        if (refreshed) setAccounts(refreshed);
      }
      setLoading(false);
      return;
    }

    const parsed = transferToSomeoneSchema.safeParse({
      fromAccountId,
      toAccountNumber,
      amount: amountNum,
      description: description.trim() || undefined,
    });

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid input';
      toast({ title: 'Invalid input', description: msg, variant: 'destructive' });
      return;
    }

    const idempotencyKey = transferIdempotencyKeyRef.current ?? crypto.randomUUID();
    transferIdempotencyKeyRef.current = idempotencyKey;

    setLoading(true);
    const { error } = await supabase.rpc('transfer_funds_by_account_number', {
      p_from_account_id: parsed.data.fromAccountId,
      p_to_account_number: parsed.data.toAccountNumber,
      p_amount: parsed.data.amount,
      p_description: parsed.data.description?.trim() || 'Transfer',
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      transferIdempotencyKeyRef.current = null;
      toast({ title: 'Transfer failed', description: error.message, variant: 'destructive' });
    } else {
      transferIdempotencyKeyRef.current = null;
      toast({
        title: 'Transfer complete',
        description: `Successfully sent ${formatCurrency(parsed.data.amount)}`,
      });
      setAmount('');
      setDescription('');
      setToAccountNumber('');
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
          <p className="mt-1 text-muted-foreground">
            Send to another customer using their account number, or move money between your own accounts.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-banking">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'someone' | 'between')} className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="someone">Pay someone</TabsTrigger>
              <TabsTrigger value="between">Between my accounts</TabsTrigger>
            </TabsList>

            <form onSubmit={handleTransfer} className="space-y-6">
              <div className="space-y-2">
                <Label>From Account</Label>
                {spendableAccounts.length === 0 ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    No spendable accounts — unfreeze a card on the Accounts page or all accounts are inactive.
                  </p>
                ) : (
                  <Select value={fromAccountId} onValueChange={setFromAccountId}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select source account" />
                    </SelectTrigger>
                    <SelectContent>
                      {spendableAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_name} — {formatCurrency(Number(acc.balance))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                  <ArrowRight className="h-5 w-5 text-accent" />
                </div>
              </div>

              <TabsContent value="someone" className="mt-0 space-y-2">
                <Label htmlFor="recipient-number">Recipient account number</Label>
                <Input
                  id="recipient-number"
                  value={toAccountNumber}
                  onChange={(e) => setToAccountNumber(e.target.value)}
                  placeholder="0000 0000 0000 0000"
                  className="h-12 font-mono text-lg tracking-wide"
                  autoComplete="off"
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground">
                  Ask the recipient for their 16-digit account number (shown on Accounts — copy button). Spaces are
                  optional.
                </p>
              </TabsContent>

              <TabsContent value="between" className="mt-0 space-y-2">
                <Label>To Account</Label>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select destination account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((a) => a.id !== fromAccountId)
                      .map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_name} — {formatCurrency(Number(acc.balance))}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </TabsContent>

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
          </Tabs>

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
