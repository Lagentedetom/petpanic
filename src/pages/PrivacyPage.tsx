import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-stone-100 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl p-10 space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-stone-100 rounded-full hover:bg-stone-200 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">Política de Privacidad</h1>
        </div>

        <p className="text-xs text-stone-400">Última actualización: abril 2026</p>

        <div className="prose prose-stone prose-sm max-w-none space-y-4 text-stone-600 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-stone-900">1. Responsable del Tratamiento</h2>
          <p>El responsable del tratamiento de tus datos personales es PetPanic. Puedes contactarnos en <strong>privacidad@petpanic.com</strong>.</p>

          <h2 className="text-lg font-bold text-stone-900">2. Datos que Recopilamos</h2>
          <p>Recopilamos los siguientes datos:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Datos de cuenta:</strong> email, nombre, apellidos, nombre de usuario, foto de perfil (si usas Google).</li>
            <li><strong>Datos de mascotas:</strong> nombre, especie, raza, color, características, foto, datos de contacto.</li>
            <li><strong>Datos de ubicación:</strong> tu posición geográfica aproximada (redondeada a ~100m) cuando usas la app.</li>
            <li><strong>Datos de uso:</strong> zonas de paseo a las que perteneces, alertas creadas, mensajes enviados.</li>
          </ul>

          <h2 className="text-lg font-bold text-stone-900">3. Finalidad del Tratamiento</h2>
          <p>Utilizamos tus datos para:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Gestionar tu cuenta y perfil.</li>
            <li>Facilitar la búsqueda de mascotas perdidas mediante alertas geolocalizadas.</li>
            <li>Mostrar presencia en zonas de paseo a otros usuarios registrados.</li>
            <li>Enviar notificaciones push sobre alertas cercanas.</li>
            <li>Permitir la comunicación entre usuarios a través de mensajes en alertas.</li>
          </ul>

          <h2 className="text-lg font-bold text-stone-900">4. Base Legal</h2>
          <p>El tratamiento de tus datos se basa en:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Consentimiento:</strong> al registrarte y aceptar estos términos.</li>
            <li><strong>Ejecución del contrato:</strong> para prestarte el servicio.</li>
            <li><strong>Interés legítimo:</strong> para mejorar la seguridad y el funcionamiento de la plataforma.</li>
          </ul>

          <h2 className="text-lg font-bold text-stone-900">5. Ubicación y Privacidad</h2>
          <p>Tu ubicación exacta nunca se almacena. Redondeamos las coordenadas a aproximadamente 100 metros antes de guardarlas. Otros usuarios solo pueden ver tu presencia en una zona de paseo si ambos sois miembros de esa zona. Solo tus amigos pueden ver tu nombre y mascota en las zonas.</p>

          <h2 className="text-lg font-bold text-stone-900">6. Compartición de Datos</h2>
          <p>No vendemos ni cedemos tus datos a terceros. Utilizamos Supabase como proveedor de infraestructura (base de datos, autenticación, almacenamiento). Los datos se almacenan en servidores de la Unión Europea (región eu-west-2).</p>

          <h2 className="text-lg font-bold text-stone-900">7. Conservación de Datos</h2>
          <p>Conservamos tus datos mientras mantengas tu cuenta activa. Las alertas resueltas se mantienen como histórico. Puedes solicitar la eliminación de tu cuenta y todos tus datos en cualquier momento desde tu perfil.</p>

          <h2 className="text-lg font-bold text-stone-900">8. Tus Derechos (RGPD)</h2>
          <p>Tienes derecho a:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Acceso:</strong> solicitar una copia de tus datos personales.</li>
            <li><strong>Rectificación:</strong> corregir datos inexactos desde tu perfil.</li>
            <li><strong>Supresión:</strong> eliminar tu cuenta y todos tus datos desde el perfil.</li>
            <li><strong>Portabilidad:</strong> solicitar tus datos en formato legible.</li>
            <li><strong>Oposición:</strong> oponerte al tratamiento de tus datos.</li>
            <li><strong>Limitación:</strong> solicitar la limitación del tratamiento.</li>
          </ul>
          <p>Para ejercer estos derechos, contacta con <strong>privacidad@petpanic.com</strong>.</p>

          <h2 className="text-lg font-bold text-stone-900">9. Seguridad</h2>
          <p>Implementamos medidas de seguridad técnicas y organizativas, incluyendo cifrado en tránsito (HTTPS), autenticación segura, y políticas de acceso a nivel de base de datos (Row Level Security).</p>

          <h2 className="text-lg font-bold text-stone-900">10. Cookies y Almacenamiento Local</h2>
          <p>PetPanic no utiliza cookies de terceros. Utilizamos almacenamiento local del navegador (localStorage) exclusivamente para mantener tu sesión activa. No se realiza seguimiento publicitario.</p>

          <h2 className="text-lg font-bold text-stone-900">11. Menores</h2>
          <p>PetPanic no está dirigido a menores de 16 años. No recopilamos intencionadamente datos de menores de esa edad.</p>

          <h2 className="text-lg font-bold text-stone-900">12. Autoridad de Control</h2>
          <p>Puedes presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD) en <strong>www.aepd.es</strong>.</p>
        </div>
      </div>
    </div>
  );
}
