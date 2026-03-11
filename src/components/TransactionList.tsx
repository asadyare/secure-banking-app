import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  type: 'credit' | 'debit' | 'transfer';
  status: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
  counterparty_name?: string;
}

interface TransactionListProps {
  transactions: Transaction[];
  currency?: string;
}

const typeConfig = {
  credit: { icon: ArrowDownLeft, color: 'text-success', bg: 'bg-success/10', label: 'Credit' },
  debit: { icon: ArrowUpRight, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Debit' },
  transfer: { icon: ArrowLeftRight, color: 'text-accent', bg: 'bg-accent/10', label: 'Transfer' },
};

const TransactionList = ({ transactions, currency = 'USD' }: TransactionListProps) => {
  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ArrowLeftRight className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">No transactions yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {transactions.map((txn) => {
        const config = typeConfig[txn.type];
        const Icon = config.icon;
        return (
          <div key={txn.id} className="flex items-center gap-4 py-4 px-2 hover:bg-muted/50 rounded-lg transition-colors">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
              <Icon className={`h-5 w-5 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{txn.description}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(txn.created_at), 'MMM d, yyyy · h:mm a')}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${txn.type === 'credit' ? 'text-success' : 'text-foreground'}`}>
                {txn.type === 'credit' ? '+' : '-'}{formatAmount(txn.amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                Bal: {formatAmount(txn.balance_after)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TransactionList;
