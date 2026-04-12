import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TRANSFER_AMOUNT_MAX } from '@/lib/validation/banking';
import { Search, ShieldAlert } from 'lucide-react';
import { z } from 'zod';

const creditSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number().positive().max(TRANSFER_AMOUNT_MAX),
  description: z.string().max(200).optional(),
});

type CustomerRow = {
  account_id: string;
  account_name: string;
  account_number: string;
  balance: number;
  customer_email: string;
  full_name: string;
};

const AdminCredit = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [emailQuery, setEmailQuery] = useState('');
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n));

  const runSearch = async () => {
    const q = emailQuery.trim();
    if (q.length < 3) {
      toast({
        title: 'Enter more characters',
        description: 'Type at least part of the customer email to search.',
        variant: 'destructive',
      });
      return;
    }
    setSearching(true);
    setRows([]);
    setSelectedId('');

    const { data, error } = await supabase.rpc('admin_list_customer_accounts', {
      p_email: q,
    });

    setSearching(false);

    if (error) {
      toast({ title: 'Search failed', description: error.message, variant: 'destructive' });
      return;
    }

    const list = (data ?? []) as CustomerRow[];
    setRows(list);
    if (list.length === 0) {
      toast({ title: 'No accounts', description: 'No accounts matched that email.' });
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch();
  };

  const handleCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Math.round(parseFloat(amount) * 100) / 100;

    const parsed = creditSchema.safeParse({
      accountId: selectedId,
      amount: amountNum,
      description: note.trim() || undefined,
    });

    if (!parsed.success) {
      toast({
        title: 'Invalid',
        description: parsed.error.issues[0]?.message ?? 'Select an account and enter a valid amount.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.rpc('admin_credit_account', {
      p_to_account_id: parsed.data.accountId,
      p_amount: parsed.data.amount,
      p_description: parsed.data.description ?? 'Admin credit',
    });
    setSubmitting(false);

    if (error) {
      toast({ title: 'Transfer failed', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: 'Funds sent',
      description: `${formatCurrency(parsed.data.amount)} credited to the selected account.`,
    });
    setAmount('');
    setNote('');
    await runSearch();
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-lg rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 font-heading text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is for bank operators only. Your profile does not have the admin flag.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Admin · Credit customers</h1>
          <p className="mt-1 text-muted-foreground">
            Search by customer email, select an account, and send funds. This creates a credit on their ledger.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="email">Customer email</Label>
            <Input
              id="email"
              type="text"
              placeholder="customer@example.com"
              value={emailQuery}
              onChange={(e) => setEmailQuery(e.target.value)}
              className="h-11"
            />
          </div>
          <Button type="submit" disabled={searching} className="h-11 gap-2 sm:w-auto">
            <Search className="h-4 w-4" />
            {searching ? 'Searching…' : 'Find accounts'}
          </Button>
        </form>

        {rows.length > 0 ? (
          <form onSubmit={handleCredit} className="space-y-6">
            <div className="rounded-xl border border-border bg-card shadow-banking">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Account</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.account_id}>
                      <TableCell className="align-middle">
                        <input
                          type="radio"
                          name="admin-account"
                          className="h-4 w-4 accent-primary"
                          checked={selectedId === r.account_id}
                          onChange={() => setSelectedId(r.account_id)}
                          aria-label={`Select ${r.account_name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => setSelectedId(r.account_id)}
                        >
                          <div className="font-medium">{r.account_name}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {r.account_number}
                          </div>
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{r.full_name}</div>
                        <div className="text-xs text-muted-foreground">{r.customer_email}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(Number(r.balance))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Goodwill adjustment"
                  maxLength={200}
                  rows={2}
                />
              </div>
            </div>

            <Button type="submit" disabled={submitting || !selectedId} className="h-11 w-full sm:w-auto">
              {submitting ? 'Sending…' : 'Credit selected account'}
            </Button>
          </form>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default AdminCredit;
