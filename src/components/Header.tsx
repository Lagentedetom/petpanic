import { LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Header() {
  const { logOut } = useApp();

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <img src="/petpanic-logo.svg" alt="PetPanic" className="w-8 h-8" />
        <span className="text-2xl font-black tracking-tighter text-stone-900">PETPANIC</span>
      </div>
      <button onClick={logOut} className="p-2 text-stone-400 hover:text-stone-600">
        <LogOut className="w-6 h-6" />
      </button>
    </header>
  );
}
