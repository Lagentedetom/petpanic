import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-stone-100 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl p-10 space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-stone-100 rounded-full hover:bg-stone-200 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">Términos de Servicio</h1>
        </div>

        <p className="text-xs text-stone-400">Última actualización: abril 2026</p>

        <div className="prose prose-stone prose-sm max-w-none space-y-4 text-stone-600 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-stone-900">1. Aceptación de los Términos</h2>
          <p>Al acceder y utilizar PetPanic, aceptas estos términos de servicio. Si no estás de acuerdo, no utilices la aplicación.</p>

          <h2 className="text-lg font-bold text-stone-900">2. Descripción del Servicio</h2>
          <p>PetPanic es una plataforma comunitaria que permite a los dueños de mascotas registrar sus animales, crear alertas cuando se pierden, y conectar con otros usuarios cercanos para facilitar su búsqueda. También ofrece zonas de paseo comunitarias con presencia en tiempo real.</p>

          <h2 className="text-lg font-bold text-stone-900">3. Registro y Cuenta</h2>
          <p>Para usar PetPanic debes crear una cuenta con información veraz. Eres responsable de mantener la confidencialidad de tus credenciales. Debes ser mayor de 16 años para usar el servicio.</p>

          <h2 className="text-lg font-bold text-stone-900">4. Uso Aceptable</h2>
          <p>Te comprometes a:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>No crear alertas falsas de mascotas perdidas.</li>
            <li>No utilizar la plataforma para acosar, amenazar o molestar a otros usuarios.</li>
            <li>No compartir contenido ofensivo, ilegal o inapropiado en los mensajes.</li>
            <li>Proporcionar información veraz sobre tus mascotas.</li>
            <li>No intentar acceder a datos de otros usuarios sin autorización.</li>
          </ul>

          <h2 className="text-lg font-bold text-stone-900">5. Geolocalización</h2>
          <p>PetPanic utiliza tu ubicación para mostrar alertas cercanas y determinar tu presencia en zonas de paseo. Puedes desactivar la geolocalización en los ajustes de tu dispositivo, aunque algunas funciones no estarán disponibles.</p>

          <h2 className="text-lg font-bold text-stone-900">6. Contenido del Usuario</h2>
          <p>Eres responsable del contenido que publicas (fotos, mensajes, datos de mascotas). PetPanic se reserva el derecho de eliminar contenido que viole estos términos.</p>

          <h2 className="text-lg font-bold text-stone-900">7. Limitación de Responsabilidad</h2>
          <p>PetPanic es una herramienta de ayuda comunitaria. No garantizamos la recuperación de mascotas perdidas. No somos responsables de las interacciones entre usuarios fuera de la plataforma.</p>

          <h2 className="text-lg font-bold text-stone-900">8. Modificaciones</h2>
          <p>Nos reservamos el derecho de modificar estos términos. Los cambios serán notificados a través de la aplicación.</p>

          <h2 className="text-lg font-bold text-stone-900">9. Legislación Aplicable</h2>
          <p>Estos términos se rigen por la legislación española. Para cualquier disputa, serán competentes los juzgados y tribunales de España.</p>

          <h2 className="text-lg font-bold text-stone-900">10. Contacto</h2>
          <p>Para cualquier consulta sobre estos términos, contacta con nosotros en <strong>legal@petpanic.com</strong>.</p>
        </div>
      </div>
    </div>
  );
}
