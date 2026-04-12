import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authLoginSchema, authSignUpSchema } from '@/lib/validation/banking';
import { formatSupabaseAuthError } from '@/lib/supabase-errors';
import { supabase, supabaseConfigHint, supabaseConfigValid } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Shield, Infinity as InfinityIcon } from 'lucide-react';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseConfigValid) {
      toast({
        title: 'Supabase not configured',
        description: supabaseConfigHint,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const parsed = authLoginSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast({
            title: 'Invalid input',
            description: 'Use a valid email and a password of at least 8 characters.',
            variant: 'destructive',
          });
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        navigate('/dashboard');
      } else {
        const parsed = authSignUpSchema.safeParse({ email, password, fullName });
        if (!parsed.success) {
          toast({
            title: 'Invalid input',
            description: 'Check your name, email, and password (8+ characters).',
            variant: 'destructive',
          });
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            data: { full_name: parsed.data.fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: 'Account created',
          description: 'Please check your email to verify your account.',
        });
      }
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: formatSupabaseAuthError(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 banking-gradient flex-col justify-between p-12 text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-500/25">
            <InfinityIcon className="h-6 w-6 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-heading text-2xl font-bold">Baawisan Bank</span>
        </div>
        <div className="space-y-6">
          <h1 className="font-heading text-5xl font-bold leading-tight text-balance">
            Banking built on<br />trust & security
          </h1>
          <p className="max-w-md text-lg opacity-80">
            Manage your finances with confidence. Industry-leading security, real-time transactions, and seamless transfers.
          </p>
          <div className="flex items-center gap-3 rounded-lg border border-primary-foreground/20 bg-primary-foreground/5 px-4 py-3 backdrop-blur">
            <Shield className="h-5 w-5 text-accent" />
            <span className="text-sm">TLS in transit · Supabase Auth · Demo — not a chartered bank</span>
          </div>
        </div>
        <p className="text-sm opacity-50">© 2026 Baawisan Bank demo. All rights reserved.</p>
      </div>

      {/* Right panel - form */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-600">
              <InfinityIcon className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-heading text-xl font-bold text-foreground">Baawisan Bank</span>
          </div>

          <div>
            <h2 className="font-heading text-3xl font-bold text-foreground">
              {isLogin ? 'Welcome back' : 'Open your account'}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {isLogin ? 'Sign in to access your accounts' : 'Get started with Baawisan Bank today'}
            </p>
          </div>

          {!supabaseConfigValid ? (
            <Alert variant="destructive">
              <AlertTitle>Backend not connected</AlertTitle>
              <AlertDescription className="text-sm leading-relaxed">{supabaseConfigHint}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  required={!isLogin}
                  className="h-12"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="h-12"
              />
            </div>
            <Button type="submit" className="h-12 w-full text-base" disabled={loading}>
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="font-semibold text-accent hover:underline"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
