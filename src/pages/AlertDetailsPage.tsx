import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { motion } from 'motion/react';
import ReportMenu from '../components/ReportMenu';
import { supabase } from '../lib/supabase';
import { Dog, MapPin, MessageSquare, ChevronLeft, Send, ImagePlus, Share2 } from 'lucide-react';
import { cn } from '../lib/cn';
import { useApp } from '../context/AppContext';
import { safeUuid } from '../utils';
import type { Message, Alert } from '../types';

/** «hace 5 minutos» / «fa 2 hores» / «3 days ago», en el idioma activo. */
function formatTimeAgo(iso: string, lang: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'always' });
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 48) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}

export default function AlertDetailsPage() {
  const { t, i18n } = useTranslation('alerts');
  const navigate = useNavigate();
  const { alertId } = useParams();
  const { activeAlerts, user, showToast } = useApp();

  // ME-04 fix: deep links from push notifications can point to alerts that
  // have been resolved by the time the user taps. activeAlerts only holds
  // current ones, so we'd 404 the user. Fall back to a direct fetch by id
  // (RLS allows owner-of-resolved + active-for-anyone via `alerts_select`).
  const [fallbackAlert, setFallbackAlert] = useState<Alert | null>(null);
  const [isLoadingAlert, setIsLoadingAlert] = useState(true);

  const inActive = activeAlerts.find(a => a.id === alertId);
  const selectedAlert: Alert | undefined = inActive ?? fallbackAlert ?? undefined;

  useEffect(() => {
    if (!alertId) { setIsLoadingAlert(false); return; }
    if (inActive) { setIsLoadingAlert(false); return; }

    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('alerts').select('*').eq('id', alertId).maybeSingle();
      if (cancelled) return;
      setFallbackAlert((data ?? null) as Alert | null);
      setIsLoadingAlert(false);
    })();
    return () => { cancelled = true; };
  }, [alertId, inActive?.id]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const lastSentRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!alertId) return;

    const fetchMessages = async () => {
      const { data } = await supabase.from('alert_messages').select('*')
        .eq('alert_id', alertId).order('created_at', { ascending: true });
      setMessages((data ?? []) as Message[]);
    };
    fetchMessages();

    const channel = supabase
      .channel(`alert-messages-${alertId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'alert_messages',
        filter: `alert_id=eq.${alertId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [alertId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newMessage.trim().slice(0, 500);
    if (!user || !alertId || !text || isSending) return;

    const now = Date.now();
    if (now - lastSentRef.current < 3000) return;

    setIsSending(true);
    lastSentRef.current = now;
    await supabase.from('alert_messages').insert({
      alert_id: alertId,
      sender_id: user.id,
      sender_name: user.user_metadata?.display_name || 'Usuario',
      text,
    });
    setNewMessage('');
    setIsSending(false);
  };

  const handlePhotoMessage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !alertId || isSending) return;

    const now = Date.now();
    if (now - lastSentRef.current < 3000) return;

    if (file.size > 5 * 1024 * 1024) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;

    setIsUploadingPhoto(true);
    lastSentRef.current = now;

    try {
      // Compress
      const img = new Image();
      const blob = await new Promise<Blob>((resolve) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const max = 800;
          if (width > max || height > max) {
            if (width > height) { height = (height / width) * max; width = max; }
            else { width = (width / height) * max; height = max; }
          }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
          canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.8);
        };
        img.src = URL.createObjectURL(file);
      });

      const filePath = `alerts/${alertId}/${safeUuid()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('pet-photos').upload(filePath, blob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('pet-photos').getPublicUrl(filePath);

      await supabase.from('alert_messages').insert({
        alert_id: alertId,
        sender_id: user.id,
        sender_name: user.user_metadata?.display_name || 'Usuario',
        text: newMessage.trim() || '📷 Foto',
        image_url: publicUrl,
      });
      setNewMessage('');
    } catch (err) {
      console.error('Photo upload error:', err);
    }
    setIsUploadingPhoto(false);
    e.target.value = '';
  };

  if (isLoadingAlert) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!selectedAlert) {
    return (
      <div className="text-center py-20 text-stone-400">
        <p>{t('details.notFound')}</p>
        <button onClick={() => navigate('/pets')} className="text-orange-600 font-bold mt-4">{t('common:actions.back')}</button>
      </div>
    );
  }

  const isResolved = selectedAlert.status === 'resolved';

  return (
    <motion.div
      key="alert-details"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/pets')} aria-label={t('common:actions.back')} className="p-3 bg-white rounded-full shadow-sm border border-stone-200">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold flex-1">{t('details.title')}</h2>
        {selectedAlert.owner_id !== user?.id && (
          <ReportMenu target={{ type: 'alert', id: selectedAlert.id }} userId={selectedAlert.owner_id} />
        )}
        <button
          aria-label={t('share.button')}
          onClick={async () => {
            const shareData = {
              title: t('share.title', { name: selectedAlert.pet_name }),
              text: t('share.text', { name: selectedAlert.pet_name, description: selectedAlert.pet_breed || selectedAlert.pet_color || t('share.fallbackDescription'), contact: selectedAlert.owner_contact }),
              url: window.location.href,
            };
            if (navigator.share) {
              await navigator.share(shareData).catch(() => {});
            } else {
              await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
              showToast(t('share.copied'), 'success');
            }
          }}
          className="p-3 bg-orange-600 text-white rounded-full shadow-sm hover:bg-orange-700 transition-colors"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {isResolved && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-800 text-sm">
          <Trans t={t} i18nKey="details.resolvedBanner" components={{ strong: <strong className="font-bold" /> }} />
        </div>
      )}

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-stone-100 overflow-hidden border border-stone-100">
            {selectedAlert.pet_photo ? (
              <img src={selectedAlert.pet_photo} alt={selectedAlert.pet_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Dog className="w-10 h-10 text-stone-300" /></div>
            )}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-red-600">{selectedAlert.pet_name}</h3>
            <p className="text-stone-500 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {t('details.lostSince', { time: formatTimeAgo(selectedAlert.created_at, i18n.language) })}
            </p>
          </div>
        </div>

        <div className="h-64 w-full bg-stone-100 relative border-b border-stone-100">
          <iframe width="100%" height="100%" frameBorder="0" scrolling="no" marginHeight={0} marginWidth={0}
            title={t('details.mapTitle')}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedAlert.lng - 0.002}%2C${selectedAlert.lat - 0.002}%2C${selectedAlert.lng + 0.002}%2C${selectedAlert.lat + 0.002}&layer=mapnik&marker=${selectedAlert.lat}%2C${selectedAlert.lng}`} />
          <div className="absolute bottom-4 right-4">
            <a href={`https://www.google.com/maps?q=${selectedAlert.lat},${selectedAlert.lng}`} target="_blank" rel="noopener noreferrer"
              className="bg-white/90 backdrop-blur-sm text-stone-900 text-[10px] font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 hover:bg-white transition-all hover:scale-105">
              <MapPin className="w-3 h-3 text-red-600" /> {t('details.openInMaps')}
            </a>
          </div>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4 border-b border-stone-100 bg-stone-50/50">
          <div><h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">{t('details.breed')}</h4><p className="text-sm font-medium">{selectedAlert.pet_breed || t('details.notSpecified')}</p></div>
          <div><h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">{t('details.color')}</h4><p className="text-sm font-medium">{selectedAlert.pet_color || t('details.notSpecified')}</p></div>
          <div className="col-span-2"><h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">{t('details.traits')}</h4><p className="text-sm text-stone-600 italic">"{selectedAlert.pet_traits || t('details.noDescription')}"</p></div>
        </div>

        <div className="p-6 bg-orange-50 border-b border-orange-100">
          <h4 className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-2">{t('details.ownerContact')}</h4>
          <p className="text-lg font-bold text-stone-900">{selectedAlert.owner_contact}</p>
          <p className="text-xs text-stone-500 mt-1 italic">{t('details.contactNote')}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-stone-500 mb-4">
            <MessageSquare className="w-5 h-5" />
            <span className="text-sm font-bold uppercase tracking-wider">{t('chat.title')}</span>
          </div>

          <div className="h-[300px] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {messages.length === 0 ? (
              <p className="text-center text-stone-400 py-10 italic">{t('chat.empty')}</p>
            ) : messages.map(msg => (
              <div key={msg.id}
                className={cn("max-w-[80%] p-4 rounded-2xl break-words",
                  msg.sender_id === user?.id ? "bg-orange-600 text-white ml-auto rounded-tr-none" : "bg-stone-100 text-stone-800 rounded-tl-none")}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest opacity-70">{msg.sender_name}</p>
                  {msg.sender_id !== user?.id && (
                    <ReportMenu
                      target={{ type: 'message', id: msg.id }}
                      userId={msg.sender_id}
                      userName={msg.sender_name}
                      onBlocked={(blocked) => setMessages((prev) => prev.filter((m) => m.sender_id !== blocked))}
                    />
                  )}
                </div>
                {msg.image_url && (
                  <img src={msg.image_url} alt={t('chat.photoAlt')} className="rounded-xl mb-2 max-w-full cursor-pointer" onClick={() => window.open(msg.image_url, '_blank')} />
                )}
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            ))}
          </div>

          {!isResolved ? (
            <form onSubmit={sendMessage} className="flex gap-2 pt-4">
              <label htmlFor="alert-message" className="sr-only">{t('chat.messageLabel')}</label>
              <input id="alert-message" type="text" value={newMessage} onChange={e => setNewMessage(e.target.value.slice(0, 500))}
                placeholder={t('chat.placeholder')}
                maxLength={500}
                className="flex-1 bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 outline-none focus:ring-2 focus:ring-orange-500" />
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoMessage} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploadingPhoto}
                aria-label={t('chat.attachPhoto')} className="bg-stone-100 text-stone-500 p-4 rounded-2xl hover:bg-stone-200 transition-colors disabled:opacity-50">
                <ImagePlus className="w-5 h-5" />
              </button>
              <button type="submit" disabled={isSending || !newMessage.trim()} aria-label={t('chat.send')} className="bg-orange-600 text-white p-4 rounded-2xl hover:bg-orange-700 transition-colors disabled:opacity-50">
                <Send className="w-5 h-5" />
              </button>
            </form>
          ) : (
            <div className="pt-4 text-center text-xs text-stone-400 italic">
              {t('chat.closed')}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
