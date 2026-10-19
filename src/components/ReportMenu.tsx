// Denunciar contenido y bloquear usuarios (Apple 1.2 · Google, contenido de
// usuarios). Las denuncias van a `content_reports`; los bloqueos a `user_blocks`,
// y la RLS de `alert_messages` ya no devuelve los mensajes de quien has bloqueado.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag, MoreHorizontal, UserX, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { cn } from '../lib/cn';

type Target = { type: 'alert' | 'message' | 'user'; id: string };
const REASONS = ['spam', 'offensive', 'fake', 'danger', 'other'] as const;

export function ReportDialog({ target, onClose }: { target: Target; onClose: () => void }) {
  const { t } = useTranslation('moderation');
  const { showToast } = useApp();
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!reason || sending) return;
    setSending(true);
    const { error } = await supabase.from('content_reports').insert({
      target_type: target.type,
      target_id: target.id,
      reason,
      details: details.trim() || null,
    });
    setSending(false);
    if (error && error.code !== '23505') {
      console.error('[report] no se pudo enviar:', error);
      showToast(t('report.error'), 'error');
      return;
    }
    showToast(error ? t('report.already') : t('report.sent'), 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h3 id="report-title" className="text-lg font-bold">{t(`report.title.${target.type}`)}</h3>
          <button onClick={onClose} aria-label={t('common:actions.close')} className="p-2 -m-2 text-stone-500"><X className="w-5 h-5" /></button>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm text-stone-600 mb-2">{t('report.why')}</legend>
          {REASONS.map((r) => (
            <label key={r} className={cn('flex items-center gap-3 rounded-xl border px-4 py-3 text-sm cursor-pointer', reason === r ? 'border-orange-600 bg-orange-50' : 'border-stone-200')}>
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-orange-600" />
              {t(`report.reasons.${r}`)}
            </label>
          ))}
        </fieldset>
        <label className="block text-sm">
          <span className="text-stone-600">{t('report.details')}</span>
          <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 500))} rows={2}
            className="mt-1 w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-orange-600" />
        </label>
        <p className="text-xs text-stone-500">{t('report.promise')}</p>
        <button onClick={send} disabled={!reason || sending}
          className="w-full bg-orange-600 text-white font-semibold py-3 rounded-full disabled:opacity-50">
          {sending ? t('common:actions.loading') : t('report.send')}
        </button>
      </div>
    </div>
  );
}

/** Menú «⋯» junto a un mensaje o una alerta de otra persona. */
export default function ReportMenu({ target, userId, userName, onBlocked, tone = 'light' }: {
  target: Target;
  userId?: string;
  userName?: string;
  onBlocked?: (userId: string) => void;
  tone?: 'light' | 'dark';
}) {
  const { t } = useTranslation('moderation');
  const { showToast } = useApp();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);

  const block = async () => {
    if (!userId) return;
    setOpen(false);
    if (!window.confirm(t('block.confirm', { name: userName || t('block.thisUser') }))) return;
    const { error } = await supabase.from('user_blocks').insert({ blocked_id: userId });
    if (error && error.code !== '23505') {
      console.error('[block] no se pudo bloquear:', error);
      showToast(t('block.error'), 'error');
      return;
    }
    showToast(t('block.done', { name: userName || t('block.thisUser') }), 'success');
    onBlocked?.(userId);
  };

  return (
    <span className="relative inline-flex">
      <button onClick={() => setOpen((v) => !v)} aria-label={t('menu.label')} aria-expanded={open}
        className={cn('p-1.5 rounded-lg', tone === 'dark' ? 'text-white/80 hover:bg-white/10' : 'text-stone-500 hover:bg-stone-200')}>
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <span className="absolute right-0 top-full mt-1 z-20 w-56 bg-white border border-stone-200 rounded-xl shadow-lg py-1 text-sm text-stone-800">
          <button onClick={() => { setOpen(false); setReporting(true); }} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-stone-50 text-left">
            <Flag className="w-4 h-4 text-orange-600" /> {t(`menu.report.${target.type}`)}
          </button>
          {userId && (
            <button onClick={block} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-stone-50 text-left">
              <UserX className="w-4 h-4 text-red-600" /> {t('menu.block', { name: userName || t('block.thisUser') })}
            </button>
          )}
        </span>
      )}
      {reporting && <ReportDialog target={target} onClose={() => setReporting(false)} />}
    </span>
  );
}
