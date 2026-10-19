import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { User as UserIcon, Mail, Lock } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import { isNative } from '../lib/native';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const { t } = useTranslation('auth');
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
      setAuthError(err.message || t('login.error'));
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
      setAuthError(err.message || t('reset.error'));
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
    <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-6"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center"
      >
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <img src="/petpanic-logo.svg" alt={t('logoAlt')} className="w-20 h-20" />
        </div>
        <h1 className="text-4xl font-extrabold mb-2 tracking-tight"><span className="text-stone-900">Pet</span><span className="text-orange-600">Panic</span></h1>
        <p className="text-stone-500 mb-8 leading-relaxed text-sm">
          {mode === 'register' ? t('tagline.register')
            : mode === 'reset' ? t('tagline.reset')
            : t('tagline.login')}
        </p>

        {signupSent ? (
          <div className="space-y-6 mb-8">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
              <Mail className="w-8 h-8 text-green-600 mx-auto mb-3" />
              <p className="text-green-700 font-medium text-sm"><Trans t={t} i18nKey="register.sent" values={{ email }} components={{ strong: <strong /> }} /></p>
            </div>
            <button onClick={() => { setSignupSent(false); switchMode('login'); }}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-6 rounded-2xl transition-all">
              {t('register.goToLogin')}
            </button>
          </div>
        ) : mode === 'reset' ? (
          resetSent ? (
            <div className="space-y-6 mb-8">
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                <p className="text-green-700 font-medium text-sm">{t('reset.sent')}</p>
              </div>
              <button onClick={() => switchMode('login')}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-6 rounded-2xl transition-all">
                {t('reset.backToLogin')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4 mb-8 text-left">
              <div className="space-y-1">
                <label htmlFor="reset-email" className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">{t('fields.email')}</label>
                <div className="relative">
                  <Mail aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input id="reset-email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder={t('fields.emailPlaceholder')}
                    autoComplete="email"
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-12 pr-5 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
                </div>
              </div>
              {authError && <p className="text-red-500 text-xs font-medium px-2">{authError}</p>}
              <button type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-orange-100 mt-4">
                {t('reset.submit')}
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleEmailAuth} className="space-y-4 mb-8 text-left">
            {mode === 'register' && (
              <>
                <div className="space-y-1">
                  <label htmlFor="auth-display-name" className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">{t('fields.displayName')}</label>
                  <div className="relative">
                    <UserIcon aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <input id="auth-display-name" type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)}
                      placeholder={t('fields.displayNamePlaceholder')}
                      autoComplete="username"
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-12 pr-5 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="auth-first-name" className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">{t('fields.firstName')}</label>
                    <input id="auth-first-name" type="text" required value={firstName} onChange={e => setFirstName(e.target.value)}
                      placeholder={t('fields.firstNamePlaceholder')}
                      autoComplete="given-name"
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="auth-last-name" className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">{t('fields.lastName')}</label>
                    <input id="auth-last-name" type="text" required value={lastName} onChange={e => setLastName(e.target.value)}
                      placeholder={t('fields.lastNamePlaceholder')}
                      autoComplete="family-name"
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-1">
              <label htmlFor="auth-email" className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">{t('fields.email')}</label>
              <div className="relative">
                <Mail aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input id="auth-email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={t('fields.emailPlaceholder')}
                  autoComplete="email"
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-12 pr-5 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="auth-password" className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-2">{t('fields.password')}</label>
              <div className="relative">
                <Lock aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input id="auth-password" type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-12 pr-5 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
              </div>
            </div>

            {mode === 'register' && (
              <label className="flex items-start gap-3 px-2 cursor-pointer">
                <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-orange-600 rounded" />
                <span className="text-xs text-stone-500 leading-relaxed">
                  <Trans
                    t={t}
                    i18nKey="register.acceptTerms"
                    components={{
                      terms: <Link to="/terminos" className="text-orange-600 hover:underline" target="_blank" />,
                      privacy: <Link to="/privacidad" className="text-orange-600 hover:underline" target="_blank" />,
                    }}
                  />
                </span>
              </label>
            )}

            {authError && <p className="text-red-500 text-xs font-medium px-2">{authError}</p>}

            <button type="submit" disabled={mode === 'register' && !acceptedTerms}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-orange-100 flex items-center justify-center gap-3 mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
              {mode === 'register' ? t('register.submit') : t('login.submit')}
            </button>

            {mode === 'login' && (
              <button type="button" onClick={() => switchMode('reset')}
                className="w-full text-stone-400 text-xs font-medium hover:text-orange-600 transition-colors">
                {t('login.forgotPassword')}
              </button>
            )}
          </form>
        )}

        {/* Login con Google solo en la web: en la app nativa Google bloquea el OAuth
            dentro de un WebView y Apple exigiría además «Iniciar sesión con Apple» (4.8). */}
        {!signupSent && mode !== 'reset' && !isNative() && (
          <>
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-100" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-4 text-stone-400 font-bold tracking-widest">{t('social.divider')}</span>
              </div>
            </div>

            <div className="mb-8">
              <button onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-2 bg-white border border-stone-200 hover:border-stone-300 text-stone-600 font-bold py-3 px-4 rounded-2xl transition-all text-sm">
                <svg viewBox="0 0 48 48" className="w-4 h-4" role="img" aria-label={t('social.googleAlt')}><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>
                {t('social.google')}
              </button>
            </div>
          </>
        )}

        {!signupSent && (
          <button onClick={() => switchMode(mode === 'register' ? 'login' : mode === 'reset' ? 'login' : 'register')}
            className="text-orange-600 font-bold text-sm hover:underline">
            {mode === 'register' ? t('register.toLogin')
              : mode === 'reset' ? t('reset.backToLogin')
              : t('login.toRegister')}
          </button>
        )}

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-6 pt-4 border-t border-stone-100">
          <Link to="/terminos" className="text-[10px] text-stone-400 hover:text-stone-600 transition-colors">{t('footer.terms')}</Link>
          <Link to="/privacidad" className="text-[10px] text-stone-400 hover:text-stone-600 transition-colors">{t('footer.privacy')}</Link>
          <Link to="/protectoras" className="text-[10px] text-stone-400 hover:text-stone-600 transition-colors">{t('footer.shelters')}</Link>
        </div>
      </motion.div>
    </div>
  );
}
