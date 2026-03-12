import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  CreditCard,
  ArrowLeftRight,
  History,
  Settings,
  LogOut,
  Building2,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/accounts', icon: CreditCard, label: 'Accounts' },
  { to: '/transfer', icon: ArrowLeftRight, label: 'Transfer' },
  { to: '/transactions', icon: History, label: 'Transactions' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 flex-col banking-gradient text-sidebar-foreground">
        <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
          <Building2 className="h-7 w-7 text-sidebar-primary" />
          <span className="font-heading text-xl font-bold text-sidebar-accent-foreground">BaawisanSecureBank</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border">
          <div className="px-4 py-2 mb-2">
            <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="lg:hidden flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-heading text-lg font-bold">BaawisanSecureBank</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-border bg-card px-4 py-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    isActive ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-secondary'
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
