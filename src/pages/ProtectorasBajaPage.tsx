import { useEffect, useState } from 'react';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; email: string }
  | { kind: 'invalid' }
  | { kind: 'error' };

export default function ProtectorasBajaPage() {
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
          'unsubscribe_protectora',
          { p_token: token },
        );
        if (error || !data?.ok) {
          setState({ kind: 'invalid' });
          return;
        }
        setState({ kind: 'ok', email: data.email });
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
          <p className="text-stone-600">Procesando baja…</p>
        </div>
      )}

      {state.kind === 'ok' && (
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">Os habéis dado de baja</h1>
          <p className="text-stone-600 leading-relaxed">
            <strong>{state.email}</strong> ya no recibirá más alertas. Gracias por el tiempo que estuvisteis ayudando a encontrar mascotas perdidas.
          </p>
          <p className="text-sm text-stone-500 leading-relaxed pt-2">
            Si fue un error o cambiáis de opinión, podéis volver a daros de alta cuando queráis.
          </p>
          <a
            href="/protectoras"
            className="inline-block mt-4 text-orange-600 font-bold hover:underline"
          >
            Volver a darse de alta
          </a>
        </div>
      )}

      {state.kind === 'invalid' && (
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold">Enlace no válido</h1>
          <p className="text-stone-600 leading-relaxed">
            Este enlace no es válido o la suscripción ya estaba dada de baja. No recibiréis más emails.
          </p>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold">Algo ha fallado</h1>
          <p className="text-stone-600 leading-relaxed">
            No hemos podido procesar la baja ahora mismo. Inténtalo en un minuto. Si el problema persiste, escríbenos a hola@petpanic.es.
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
