import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/navigation/sidebar';
import { MobileNav } from '@/components/navigation/mobile-nav';
import { WolfAvatar } from '@/components/victor/wolf-avatar';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();

  const ownerName =
    profile?.display_name ??
    user.user_metadata?.display_name ??
    user.email?.split('@')[0] ??
    'Commander';

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-[#e2e8f0] overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar ownerName={ownerName} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[#2a2a3a] bg-[#111118]/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5">
            <WolfAvatar state="idle" size="sm" />
            <div>
              <span className="font-mono text-sm font-bold tracking-wider text-white">
                VICTOR NOCTIS
              </span>
              <span className="block text-[10px] font-mono text-slate-500">
                Velmora Core
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ONLINE
          </div>
        </header>

        {/* Page Children (Padding bottom on mobile for MobileNav) */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0 relative flex flex-col">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
