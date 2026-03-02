import { Link } from "react-router-dom";

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="text-primary hover:underline text-sm mb-8 inline-block">&larr; Volver al inicio</Link>

        <h1 className="text-3xl font-bold mb-2">Política de Privacidad</h1>
        <p className="text-muted-foreground mb-8">Última actualización: 1 de marzo de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Información que recopilamos</h2>
            <p>En Sewdle recopilamos la siguiente información cuando utilizas nuestra plataforma:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Información de cuenta: nombre, correo electrónico y contraseña.</li>
              <li>Información de perfil de redes sociales conectadas (Instagram, WhatsApp) como nombre de usuario e identificador de cuenta.</li>
              <li>Mensajes enviados y recibidos a través de nuestra plataforma de mensajería.</li>
              <li>Datos de uso y navegación dentro de la plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Cómo usamos tu información</h2>
            <p>Utilizamos la información recopilada para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Proveer y mantener nuestros servicios de gestión empresarial y mensajería.</li>
              <li>Facilitar la comunicación con tus clientes a través de Instagram y WhatsApp.</li>
              <li>Mejorar la experiencia del usuario y la funcionalidad de la plataforma.</li>
              <li>Enviar notificaciones relacionadas con el servicio.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. Compartición de datos</h2>
            <p>No vendemos ni compartimos tu información personal con terceros, excepto en los siguientes casos:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Con proveedores de servicios necesarios para operar la plataforma (Supabase, Meta/Facebook, Shopify).</li>
              <li>Cuando sea requerido por ley o autoridad competente.</li>
              <li>Con tu consentimiento explícito.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Seguridad de los datos</h2>
            <p>Implementamos medidas de seguridad técnicas y organizativas para proteger tu información, incluyendo cifrado de datos en tránsito y en reposo, autenticación segura y control de acceso basado en roles.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Retención de datos</h2>
            <p>Conservamos tu información mientras tu cuenta esté activa o sea necesaria para proporcionarte nuestros servicios. Puedes solicitar la eliminación de tus datos en cualquier momento.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Tus derechos</h2>
            <p>Tienes derecho a:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Acceder a tus datos personales.</li>
              <li>Rectificar información incorrecta.</li>
              <li>Solicitar la eliminación de tus datos.</li>
              <li>Retirar tu consentimiento en cualquier momento.</li>
              <li>Solicitar la portabilidad de tus datos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. Datos de redes sociales</h2>
            <p>Cuando conectas tu cuenta de Instagram o WhatsApp, accedemos únicamente a la información necesaria para gestionar mensajes en tu nombre. No almacenamos contenido multimedia de forma permanente ni accedemos a información más allá de lo autorizado por los permisos otorgados.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. Contacto</h2>
            <p>Si tienes preguntas sobre esta política de privacidad o deseas ejercer tus derechos, puedes contactarnos en: <a href="mailto:julian@dosmicos.com" className="text-primary hover:underline">julian@dosmicos.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
