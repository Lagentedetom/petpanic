import { LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Header() {
  const { logOut } = useApp();

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <img src="/petpanic-logo.svg" alt="PetPanic" className="w-8 h-8" />
        <span className="text-xl font-extrabold tracking-tight"><span className="text-stone-900">Pet</span><span className="text-orange-600">Panic</span></span>
      </div>
      <button onClick={logOut} aria-label="Cerrar sesión" className="p-3 text-stone-400 hover:text-stone-600">
        <LogOut className="w-6 h-6" />
      </button>
    </header>
  );
}
