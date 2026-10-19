// Lista de usuarios bloqueados, con «Desbloquear». Va en el perfil.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';

type Blocked = { id: string; name: string };

export default function BlockedUsers() {
  const { t } = useTranslation('moderation');
  const [list, setList] = useState<Blocked[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: blocks } = await supabase.from('user_blocks').select('blocked_id');
      const ids = (blocks ?? []).map((b: { blocked_id: string }) => b.blocked_id);
      if (ids.length === 0) { if (alive) setList([]); return; }
      const { data: profiles } = await supabase.from('public_profiles').select('id, display_name').in('id', ids);
      const names = new Map((profiles ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name]));
      if (alive) setList(ids.map((id) => ({ id, name: names.get(id) || t('block.thisUser') })));
    })();
    return () => { alive = false; };
  }, [t]);

  const unblock = async (id: string) => {
    const { error } = await supabase.from('user_blocks').delete().eq('blocked_id', id);
    if (!error) setList((prev) => (prev ?? []).filter((b) => b.id !== id));
  };

  if (!list || list.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="block text-[11px] font-bold text-stone-500 uppercase tracking-widest ml-1">{t('blocked.title')}</p>
      <ul className="bg-stone-50 border border-stone-200 rounded-xl divide-y divide-stone-200">
        {list.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="text-stone-700 truncate">{b.name}</span>
            <button onClick={() => unblock(b.id)} className="text-orange-700 font-semibold py-1.5 px-2">{t('blocked.unblock')}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
