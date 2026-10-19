import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Edit2, User as UserIcon, LogOut, Trash2, AlertTriangle, Sparkles, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import BlockedUsers from '../components/BlockedUsers';
import { LANGUAGES, LANGUAGE_NAMES, setLanguage, type Language } from '../i18n';
import { useSubscription } from '../hooks/useSubscription';
import { supabase } from '../lib/supabase';

export default function ProfilePage() {
  const { t, i18n } = useTranslation('profile');
  const navigate = useNavigate();
  const { userProfile, updateProfile, logOut } = useApp();
  const { isTrialing, isActivePaid, daysLeftInTrial } = useSubscription();
  const planLabel = isActivePaid
    ? t('plan.paid')
    : isTrialing
      ? t('plan.trial', { count: daysLeftInTrial })
      : t('plan.free');
  const currentLanguage = i18n.resolvedLanguage ?? i18n.language;

  const [isEditing, setIsEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', display_name: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleEdit = () => {
    setProfileForm({ first_name: userProfile?.first_name || '', last_name: userProfile?.last_name || '', display_name: userProfile?.display_name || '' });
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateProfile({
        first_name: profileForm.first_name,
        last_name: profileForm.last_name,
        display_name: profileForm.display_name || `${profileForm.first_name} ${profileForm.last_name}`.trim(),
      });
      setIsEditing(false);
    } catch (err) { console.error("Error updating profile:", err); }
    finally { setIsSaving(false); }
  };

  return (
    <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => { if (isEditing) setIsEditing(false); else navigate('/'); }} aria-label={t('common:actions.back')} className="p-3 bg-white rounded-full shadow-sm border border-stone-200"><ChevronLeft className="w-6 h-6" /></button>
          <h2 className="text-2xl font-bold">{isEditing ? t('header.editTitle') : t('header.title')}</h2>
        </div>
        {!isEditing && <button onClick={handleEdit} aria-label={t('header.edit')} className="p-3 bg-stone-900 text-white rounded-xl shadow-lg shadow-stone-200"><Edit2 className="w-5 h-5" /></button>}
      </div>

      <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2"><label htmlFor="profile-first-name" className="text-sm font-bold uppercase tracking-wider text-stone-500">{t('fields.firstName')}</label>
                <input id="profile-first-name" required type="text" autoComplete="given-name" value={profileForm.first_name} onChange={e => setProfileForm(prev => ({ ...prev, first_name: e.target.value }))} className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 focus:ring-2 focus:ring-orange-500 outline-none" placeholder={t('form.firstNamePlaceholder')} /></div>
              <div className="space-y-2"><label htmlFor="profile-last-name" className="text-sm font-bold uppercase tracking-wider text-stone-500">{t('fields.lastName')}</label>
                <input id="profile-last-name" required type="text" autoComplete="family-name" value={profileForm.last_name} onChange={e => setProfileForm(prev => ({ ...prev, last_name: e.target.value }))} className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 focus:ring-2 focus:ring-orange-500 outline-none" placeholder={t('form.lastNamePlaceholder')} /></div>
              <div className="space-y-2"><label htmlFor="profile-display-name" className="text-sm font-bold uppercase tracking-wider text-stone-500">{t('fields.displayName')}</label>
                <input id="profile-display-name" type="text" autoComplete="username" value={profileForm.display_name} onChange={e => setProfileForm(prev => ({ ...prev, display_name: e.target.value }))} className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 focus:ring-2 focus:ring-orange-500 outline-none" placeholder={t('form.displayNamePlaceholder')} />
                <p className="text-[10px] text-stone-400">{t('form.displayNameHint')}</p></div>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setIsEditing(false)} className="flex-1 bg-stone-100 text-stone-600 font-bold py-4 rounded-2xl transition-all">{t('form.cancel')}</button>
              <button type="submit" disabled={isSaving} className="flex-1 bg-stone-900 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-stone-100 disabled:opacity-50">{isSaving ? t('form.saving') : t('form.save')}</button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-3xl bg-stone-100 overflow-hidden border-4 border-white shadow-lg">
                {userProfile?.photo_url ? <img src={userProfile.photo_url} alt={userProfile.display_name} className="w-full h-full object-cover" /> : <UserIcon className="w-full h-full p-6 text-stone-300" />}
              </div>
              <div className="text-center"><h3 className="text-xl font-bold">{userProfile?.display_name}</h3><p className="text-stone-400 text-sm">{userProfile?.email}</p></div>
            </div>
            <div className="space-y-4 pt-4 border-t border-stone-100">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">{t('fields.firstName')}</p><p className="bg-stone-50 p-3 rounded-xl font-medium text-stone-600">{userProfile?.first_name || '-'}</p></div>
                <div className="space-y-1"><p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">{t('fields.lastName')}</p><p className="bg-stone-50 p-3 rounded-xl font-medium text-stone-600">{userProfile?.last_name || '-'}</p></div>
              </div>
              <div className="space-y-1"><p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">{t('fields.friendCode')}</p><p className="bg-orange-50 p-3 rounded-xl font-bold text-orange-600 tracking-widest">{userProfile?.friend_code}</p></div>
            </div>
            <button
              onClick={() => navigate('/plan')}
              className="w-full flex items-center justify-between gap-2 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 text-stone-900 font-bold py-4 px-5 rounded-2xl hover:shadow-md transition-all mt-6"
            >
              <span className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-orange-500" />
                <span className="flex flex-col items-start">
                  <span>{t('plan.title')}</span>
                  <span className="text-[11px] font-medium text-stone-500">{planLabel}</span>
                </span>
              </span>
              <ChevronRight className="w-5 h-5 text-stone-400" />
            </button>

            <div className="space-y-1 mt-6">
              <label htmlFor="profile-language" className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">{t('common:language.label')}</label>
              <select
                id="profile-language"
                value={currentLanguage}
                onChange={e => setLanguage(e.target.value as Language)}
                className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl font-medium text-stone-600 focus:ring-2 focus:ring-orange-500 outline-none"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang} value={lang} lang={lang}>{LANGUAGE_NAMES[lang]}</option>
                ))}
              </select>
            </div>

            <BlockedUsers />

            <button onClick={logOut} className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-bold py-4 rounded-2xl hover:bg-red-100 transition-all mt-4"><LogOut className="w-5 h-5" /> {t('logout')}</button>
          </>
        )}
      </div>

      {!isEditing && (
        <button onClick={() => setShowDeleteConfirm(true)}
          className="w-full flex items-center justify-center gap-2 text-stone-400 text-xs font-medium hover:text-red-600 transition-colors py-4">
          <Trash2 className="w-4 h-4" /> {t('delete.button')}
        </button>
      )}

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-6"
            onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              aria-describedby="delete-account-desc"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle aria-hidden="true" className="w-8 h-8 text-red-600" />
              </div>
              <h3 id="delete-account-title" className="text-xl font-bold">{t('delete.title')}</h3>
              <p id="delete-account-desc" className="text-stone-500 text-sm">{t('delete.body')}</p>
              {deleteError && <p className="text-red-500 text-xs font-medium">{deleteError}</p>}
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}
                  className="flex-1 py-3 border border-stone-200 rounded-2xl font-bold text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50">
                  {t('delete.cancel')}
                </button>
                <button disabled={isDeleting} onClick={async () => {
                  setIsDeleting(true);
                  setDeleteError(null);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) throw new Error(t('delete.noSession'));
                    const res = await supabase.functions.invoke('delete-account');
                    if (res.error) throw res.error;
                    await supabase.auth.signOut();
                  } catch (err: any) {
                    setDeleteError(err.message || t('delete.failed'));
                    setIsDeleting(false);
                  }
                }}
                  className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50">
                  {isDeleting ? t('delete.deleting') : t('delete.confirm')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
