import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { User as UserIcon, Mail, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [signupSent, setSignupSent] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (mode === 'register') {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName || 'Usuario',
              first_name: firstName,
              last_name: lastName,
            }
          }
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setSignupSent(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setAuthError(err.message || "Error de autenticación");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      console.error("Reset error:", err);
      setAuthError(err.message || "Error al enviar el email");
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setAuthError(error.message);
  };

  const switchMode = (newMode: 'login' | 'register' | 'reset') => {
    setMode(newMode);
    setAuthError(null);
    setResetSent(false);
    setSignupSent(false);
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
        <h1 className="text-4xl font-extrabold mb-2 tracking-tight"><span className="text-stone-900">Pet</span><span className="text-orange-600">Panic</span></h1>
        <p className="text-stone-500 mb-8 leading-relaxed text-sm">
          {mode === 'register' ? 'Crea tu cuenta para proteger a tus mascotas.'
            : mode === 'reset' ? 'Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.'
            : 'Las primeras 2 horas son vitales. Únete a la red de protección.'}
        </p>

        {signupSent ? (
          <div className="space-y-6 mb-8">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
              <Mail className="w-8 h-8 text-green-600 mx-auto mb-3" />
              <p className="text-green-700 font-medium text-sm">¡Cuenta creada! Revisa tu email en <strong>{email}</strong> y haz clic en el enlace de confirmación para activar tu cuenta.</p>
            </div>
            <button onClick={() => { setSignupSent(false); switchMode('login'); }}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-6 rounded-2xl transition-all">
              Ir al inicio de sesión
            </button>
          </div>
        ) : mode === 'reset' ? (
          resetSent ? (
            <div className="space-y-6 mb-8">
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                <p className="text-green-700 font-medium text-sm">¡Email enviado! Revisa tu bandeja de entrada y sigue el enlace para restablecer tu contraseña.</p>
              </div>
              <button onClick={() => switchMode('login')}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-6 rounded-2xl transition-all">
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4 mb-8 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-12 pr-5 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
                </div>
              </div>
              {authError && <p className="text-red-500 text-xs font-medium px-2">{authError}</p>}
              <button type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-orange-100 mt-4">
                Enviar enlace de recuperación
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleEmailAuth} className="space-y-4 mb-8 text-left">
            {mode === 'register' && (
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

            {mode === 'register' && (
              <label className="flex items-start gap-3 px-2 cursor-pointer">
                <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-orange-600 rounded" />
                <span className="text-xs text-stone-500 leading-relaxed">
                  He leído y acepto los{' '}
                  <Link to="/terminos" className="text-orange-600 hover:underline" target="_blank">Términos de Servicio</Link>
                  {' '}y la{' '}
                  <Link to="/privacidad" className="text-orange-600 hover:underline" target="_blank">Política de Privacidad</Link>.
                </span>
              </label>
            )}

            {authError && <p className="text-red-500 text-xs font-medium px-2">{authError}</p>}

            <button type="submit" disabled={mode === 'register' && !acceptedTerms}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-orange-100 flex items-center justify-center gap-3 mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
              {mode === 'register' ? 'Crear Cuenta' : 'Iniciar Sesión'}
            </button>

            {mode === 'login' && (
              <button type="button" onClick={() => switchMode('reset')}
                className="w-full text-stone-400 text-xs font-medium hover:text-orange-600 transition-colors">
                ¿Has olvidado tu contraseña?
              </button>
            )}
          </form>
        )}

        {!signupSent && mode !== 'reset' && (
          <>
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-100" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-4 text-stone-400 font-bold tracking-widest">O entrar con</span>
              </div>
            </div>

            <div className="mb-8">
              <button onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-2 bg-white border border-stone-200 hover:border-stone-300 text-stone-600 font-bold py-3 px-4 rounded-2xl transition-all text-sm">
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                Google
              </button>
            </div>
          </>
        )}

        {!signupSent && (
          <button onClick={() => switchMode(mode === 'register' ? 'login' : mode === 'reset' ? 'login' : 'register')}
            className="text-orange-600 font-bold text-sm hover:underline">
            {mode === 'register' ? '¿Ya tienes cuenta? Inicia sesión'
              : mode === 'reset' ? 'Volver al inicio de sesión'
              : '¿No tienes cuenta? Regístrate gratis'}
          </button>
        )}

        <div className="flex justify-center gap-4 mt-6 pt-4 border-t border-stone-100">
          <Link to="/terminos" className="text-[10px] text-stone-400 hover:text-stone-600 transition-colors">Términos de Servicio</Link>
          <Link to="/privacidad" className="text-[10px] text-stone-400 hover:text-stone-600 transition-colors">Política de Privacidad</Link>
        </div>
      </motion.div>
    </div>
  );
}
