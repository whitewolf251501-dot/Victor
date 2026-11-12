import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { signOutAction } from './(auth)/login/actions';

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Retrieve owner profile display name
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  const ownerName =
    profile?.display_name ??
    user.user_metadata?.display_name ??
    user.email?.split('@')[0] ??
    'Commander';

  return (
    <main className="min-h-screen bg-[#090a0f] text-slate-200 flex flex-col justify-between p-6 sm:p-12 font-mono">
      {/* Top HUD Bar */}
      <header className="flex items-center justify-between border-b border-[#1f293d] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50" />
          <span className="text-sm font-semibold tracking-wider text-white">VICTOR NOCTIS</span>
          <span className="text-xs text-slate-500 tracking-widest hidden sm:inline">
            // VELMORA INTEL CORE
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-sky-400 border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 rounded">
            AUTHORITY: L0-L4
          </span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-xs text-slate-400 hover:text-red-400 border border-[#1f293d] hover:border-red-900/60 bg-[#0d1117] px-3 py-1 rounded transition-colors"
            >
              DISENGAGE
            </button>
          </form>
        </div>
      </header>

      {/* Main Wakeup Display */}
      <section className="flex flex-col items-center justify-center my-auto text-center py-12">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full border border-sky-500/40 bg-sky-500/5 flex items-center justify-center">
            <span className="text-2xl text-sky-400 font-bold">VN</span>
          </div>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500" />
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-wide mb-2">
          Victor is waking up...
        </h1>
        <p className="text-sm text-slate-400 max-w-md">
          Systems initializing for <span className="text-sky-400 font-medium">{ownerName}</span>.
        </p>

        {/* HUD Subsystem Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10 w-full max-w-xl text-left">
          <div className="p-3 rounded border border-[#1f293d] bg-[#0d1117]">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">SYS 02 CORE</p>
            <p className="text-xs text-emerald-400 mt-1 font-semibold">GEMINI 1.5 PRO</p>
          </div>
          <div className="p-3 rounded border border-[#1f293d] bg-[#0d1117]">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">SYS 03 MEMORY</p>
            <p className="text-xs text-emerald-400 mt-1 font-semibold">SUPABASE POSTGRES</p>
          </div>
          <div className="p-3 rounded border border-[#1f293d] bg-[#0d1117]">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">SYS 06 ENGINE</p>
            <p className="text-xs text-sky-400 mt-1 font-semibold">VTE ARMED</p>
          </div>
          <div className="p-3 rounded border border-[#1f293d] bg-[#0d1117]">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">SYS 07 INFRA</p>
            <p className="text-xs text-emerald-400 mt-1 font-semibold">AUTHENTICATED</p>
          </div>
        </div>
      </section>

      {/* Footer Status */}
      <footer className="flex flex-col sm:flex-row items-center justify-between border-t border-[#1f293d] pt-4 text-xs text-slate-500 gap-2">
        <span>SESSION IDENTIFIER: {user.id.slice(0, 8)}...</span>
        <span>AESTHETIC: VELMORA HUD // COMPANION: ACTIVE</span>
      </footer>
    </main>
  );
}
