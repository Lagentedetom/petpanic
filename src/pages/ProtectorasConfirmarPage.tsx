import { useEffect, useState } from 'react';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; nombre: string; email: string }
  | { kind: 'invalid' }
  | { kind: 'error' };

export default function ProtectorasConfirmarPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('t');
    if (!token) {
      setState({ kind: 'invalid' });
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.rpc(
          'confirm_protectora_subscription',
          { p_token: token },
        );
        if (error || !data?.ok) {
          setState({ kind: 'invalid' });
          return;
        }
        setState({ kind: 'ok', nombre: data.nombre, email: data.email });
      } catch {
        setState({ kind: 'error' });
      }
    })();
  }, []);

  return (
    <Shell>
      {state.kind === 'loading' && (
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-orange-600 animate-spin mx-auto" />
          <p className="text-stone-600">Confirmando tu suscripción…</p>
        </div>
      )}

      {state.kind === 'ok' && (
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">¡Suscripción activada!</h1>
          <p className="text-stone-600 leading-relaxed">
            <strong>{state.nombre}</strong> recibirá un email en <strong>{state.email}</strong> cada vez que se pierda o se encuentre una mascota en vuestra zona.
          </p>
          <p className="text-sm text-stone-500 leading-relaxed pt-2">
            Podéis darte de baja con un solo click desde cualquiera de esos emails. Gracias por sumaros a la red de búsqueda.
          </p>
        </div>
      )}

      {state.kind === 'invalid' && (
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold">Enlace no válido</h1>
          <p className="text-stone-600 leading-relaxed">
            Este enlace de confirmación no es válido o ya ha sido usado. Si tenías una suscripción activa, ya la tienes — recibirás los emails normalmente.
          </p>
          <a
            href="/protectoras"
            className="inline-block mt-4 text-orange-600 font-bold hover:underline"
          >
            Volver al formulario de alta
          </a>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold">Algo ha fallado</h1>
          <p className="text-stone-600 leading-relaxed">
            No hemos podido confirmar tu suscripción ahora mismo. Inténtalo en un minuto, o vuelve a darte de alta.
          </p>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-100" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
      <div className="max-w-2xl mx-auto p-6">
        <a href="/" className="inline-block mb-6">
          <span className="text-2xl font-extrabold text-stone-900">Pet</span>
          <span className="text-2xl font-extrabold text-orange-600">Panic</span>
        </a>
        <div className="bg-white rounded-3xl shadow-xl p-10">{children}</div>
      </div>
    </div>
  );
}
