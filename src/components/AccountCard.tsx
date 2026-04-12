import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Copy, Snowflake, Settings, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { formatCardStyleAccountNumber } from '@/lib/format-account';
import { fakePreviewTransactions, type PreviewTxnCategory } from '@/lib/fake-card-preview';
import { cn } from '@/lib/utils';

interface AccountCardProps {
  accountId: string;
  accountName: string;
  accountNumber: string;
  accountType: string;
  balance: number;
  currency: string;
  cardExpiry?: string;
  isFrozen?: boolean;
  /** Show full number + copy for sharing with someone who will pay you. */
  copyableAccountNumber?: boolean;
  onAccountUpdated?: () => void;
}

const categoryStyles: Record<PreviewTxnCategory, string> = {
  food: 'bg-emerald-500/25 text-emerald-100',
  shopping: 'bg-sky-500/25 text-sky-100',
  entertainment: 'bg-violet-500/25 text-violet-100',
};

const AccountCard = ({
  accountId,
  accountName,
  accountNumber,
  accountType,
  balance,
  currency,
  cardExpiry = '05/30',
  isFrozen: isFrozenProp = false,
  copyableAccountNumber = false,
  onAccountUpdated,
}: AccountCardProps) => {
  const { toast } = useToast();
  const [frozen, setFrozen] = useState(isFrozenProp);
  const [freezeLoading, setFreezeLoading] = useState(false);

  useEffect(() => {
    setFrozen(isFrozenProp);
  }, [isFrozenProp]);

  const previewTxns = useMemo(() => fakePreviewTransactions(accountId), [accountId]);

  const copyNumber = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void navigator.clipboard.writeText(accountNumber.replace(/\D/g, ''));
    toast({ title: 'Copied', description: 'Card number copied to clipboard.' });
  };

  const formatBalance = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const digits = accountNumber.replace(/\D/g, '');
  const displayNumber =
    copyableAccountNumber || digits.length === 16
      ? formatCardStyleAccountNumber(accountNumber)
      : `•••• •••• •••• ${digits.slice(-4) || accountNumber.slice(-4)}`;

  const toggleFreeze = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFreezeLoading(true);
    const next = !frozen;
    const { error } = await supabase.from('accounts').update({ is_frozen: next }).eq('id', accountId);
    setFreezeLoading(false);
    if (error) {
      toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
      return;
    }
    setFrozen(next);
    toast({
      title: next ? 'Card frozen' : 'Card unfrozen',
      description: next ? 'Outgoing transfers are paused for this account.' : 'You can send money from this account again.',
    });
    onAccountUpdated?.();
  };

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-2xl border border-white/15 p-5 text-white shadow-2xl',
        'bg-gradient-to-br from-[#151b60] via-[#1e2a7a] to-[#2a3aa8]',
        'transition-transform duration-200 hover:scale-[1.01] hover:shadow-[0_20px_50px_-12px_rgba(30,42,122,0.55)]',
      )}
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-8 left-1/3 h-32 w-32 rounded-full bg-fuchsia-500/10 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-12 rounded-md bg-gradient-to-br from-amber-200/90 to-amber-600/80 shadow-inner shadow-black/20" />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-white/60">Debit · {accountType}</p>
            <p className="font-heading text-sm font-semibold leading-tight text-white">{accountName}</p>
          </div>
        </div>
        <span
          className="select-none font-black italic tracking-[0.25em] text-white drop-shadow-sm"
          style={{ fontFamily: 'system-ui, sans-serif' }}
          aria-label="Visa"
        >
          VISA
        </span>
      </div>

      {frozen ? (
        <div className="relative mt-3 rounded-lg border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-center text-[11px] font-medium text-amber-100">
          Outgoing transfers paused — unfreeze to pay from this card
        </div>
      ) : null}

      <div className="relative mt-5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/55">Available balance</p>
        <p className="font-heading text-3xl font-bold tabular-nums tracking-tight text-white">{formatBalance(balance)}</p>
      </div>

      <div className="relative mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-mono text-base tracking-[0.12em] text-white/95 sm:text-lg">{displayNumber}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/65">
            <span>
              Good thru <span className="font-mono font-semibold text-white">{cardExpiry}</span>
            </span>
            {copyableAccountNumber ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-[11px] text-white/90 hover:bg-white/10 hover:text-white"
                onClick={copyNumber}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative mt-4 border-t border-white/10 pt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/45">Recent activity · demo</p>
        <ul className="space-y-2.5">
          {previewTxns.map((txn, i) => (
            <li key={`${txn.merchant}-${i}`} className="flex items-start justify-between gap-2 text-[11px] leading-snug">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white/95">{txn.merchant}</p>
                <p className="text-[10px] text-white/50">{format(txn.date, 'MMM d, yyyy · h:mm a')}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="tabular-nums text-white/90">−{formatBalance(txn.amount)}</span>
                <span
                  className={cn('ml-1.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase', categoryStyles[txn.category])}
                >
                  {txn.category}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-9 bg-white/15 text-xs font-medium text-white hover:bg-white/25"
          asChild
        >
          <Link to={`/accounts/${accountId}`} className="flex items-center justify-center gap-1">
            <Eye className="h-3.5 w-3.5 opacity-90" />
            Details
          </Link>
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={cn(
            'h-9 text-xs font-medium',
            frozen ? 'bg-emerald-500/30 text-white hover:bg-emerald-500/40' : 'bg-white/15 text-white hover:bg-white/25',
          )}
          disabled={freezeLoading}
          onClick={toggleFreeze}
        >
          <Snowflake className="mr-1 h-3.5 w-3.5" />
          {frozen ? 'Unfreeze' : 'Freeze'}
        </Button>
        <Button type="button" variant="secondary" size="sm" className="h-9 bg-white/15 text-xs font-medium text-white hover:bg-white/25" asChild>
          <Link to="/settings" className="flex items-center justify-center gap-1">
            <Settings className="h-3.5 w-3.5 opacity-90" />
            Settings
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default AccountCard;
