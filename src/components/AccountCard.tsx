import { CreditCard, TrendingUp, TrendingDown } from 'lucide-react';

interface AccountCardProps {
  accountName: string;
  accountNumber: string;
  accountType: string;
  balance: number;
  currency: string;
}

const AccountCard = ({ accountName, accountNumber, accountType, balance, currency }: AccountCardProps) => {
  const formatBalance = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-banking transition-all hover:shadow-elevated">
      <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-accent/10" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground capitalize">{accountType}</p>
              <p className="font-heading text-base font-semibold text-card-foreground">{accountName}</p>
            </div>
          </div>
          {balance >= 0 ? (
            <TrendingUp className="h-5 w-5 text-success" />
          ) : (
            <TrendingDown className="h-5 w-5 text-destructive" />
          )}
        </div>

        <div className="mt-6">
          <p className="text-xs text-muted-foreground">Available Balance</p>
          <p className="font-heading text-3xl font-bold text-card-foreground">{formatBalance(balance)}</p>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground font-mono tracking-wider">
            •••• {accountNumber.slice(-4)}
          </p>
          <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">Active</span>
        </div>
      </div>
    </div>
  );
};

export default AccountCard;
