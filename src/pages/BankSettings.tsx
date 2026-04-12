import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Shield, User } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

const BankSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('user_id', user.id).single().then(({ data }) => {
      if (data) {
        setProfile(data);
        setFullName(data.full_name || '');
        setPhone(data.phone || '');
        setAddress(data.address || '');
      }
    });
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim(), address: address.trim() })
      .eq('user_id', user!.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated', description: 'Your information has been saved.' });
    }
    setSaving(false);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-muted-foreground">Manage your profile and preferences</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-banking space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-card-foreground">Personal Information</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" maxLength={200} />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-banking">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-accent" />
            <div>
              <p className="text-sm font-medium text-card-foreground">KYC Verification</p>
              <p className="text-xs text-muted-foreground">
                {profile?.kyc_verified ? 'Your identity has been verified' : 'Identity verification pending'}
              </p>
            </div>
            <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${
              profile?.kyc_verified
                ? 'bg-success/10 text-success'
                : 'bg-accent/10 text-accent'
            }`}>
              {profile?.kyc_verified ? 'Verified' : 'Pending'}
            </span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default BankSettings;
