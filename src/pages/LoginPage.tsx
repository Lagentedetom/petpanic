import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User as UserIcon, Mail, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName || 'Invitado',
              first_name: firstName,
              last_name: lastName,
            }
          }
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setAuthError(err.message || "Error de autenticación");
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setAuthError(error.message);
  };

  const handleGuestSignIn = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) setAuthError(error.message);
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center"
      >
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <img src="/petpanic-logo.svg" alt="PetPanic" className="w-20 h-20" />
        </div>
        <h1 className="text-4xl font-bold text-stone-900 mb-2 tracking-tight">PetPanic</h1>
        <p className="text-stone-500 mb-8 leading-relaxed text-sm">
          {isRegistering ? 'Crea tu cuenta para proteger a tus mascotas.' : 'Las primeras 2 horas son vitales. Únete a la red de protección.'}
        </p>

        <form onSubmit={handleEmailAuth} className="space-y-4 mb-8 text-left">
          {isRegistering && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">Nombre de Usuario</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)}
                    placeholder="Tu nombre de usuario"
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-12 pr-5 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">Nombre</label>
                  <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)}
                    placeholder="Nombre"
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">Apellidos</label>
                  <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)}
                    placeholder="Apellidos"
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
                </div>
              </div>
            </>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-12 pr-5 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-12 pr-5 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
            </div>
          </div>

          {authError && <p className="text-red-500 text-xs font-medium px-2">{authError}</p>}

          <button type="submit"
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-orange-100 flex items-center justify-center gap-3 mt-4">
            {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-100" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-4 text-stone-400 font-bold tracking-widest">O entrar con</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button onClick={handleGoogleSignIn}
            className="flex items-center justify-center gap-2 bg-white border border-stone-200 hover:border-stone-300 text-stone-600 font-bold py-3 px-4 rounded-2xl transition-all text-sm">
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
            Google
          </button>
          <button onClick={handleGuestSignIn}
            className="flex items-center justify-center gap-2 bg-white border border-stone-200 hover:border-stone-300 text-stone-600 font-bold py-3 px-4 rounded-2xl transition-all text-sm">
            <UserIcon className="w-4 h-4" />
            Invitado
          </button>
        </div>

        <button onClick={() => { setIsRegistering(!isRegistering); setAuthError(null); }}
          className="text-orange-600 font-bold text-sm hover:underline">
          {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate gratis'}
        </button>
      </motion.div>
    </div>
  );
}
