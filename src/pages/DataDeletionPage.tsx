import { Link } from "react-router-dom";

const DataDeletionPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="text-primary hover:underline text-sm mb-8 inline-block">&larr; Volver al inicio</Link>

        <h1 className="text-3xl font-bold mb-2">Eliminación de Datos del Usuario</h1>
        <p className="text-muted-foreground mb-8">Última actualización: 1 de marzo de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-2">Tu derecho a la eliminación de datos</h2>
            <p>En Sewdle respetamos tu derecho a controlar tus datos personales. Puedes solicitar la eliminación completa de tu información en cualquier momento.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">¿Qué datos se eliminan?</h2>
            <p>Al solicitar la eliminación, se borrarán de forma permanente:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Tu cuenta de usuario y credenciales de acceso.</li>
              <li>Información de perfil y preferencias.</li>
              <li>Historial de mensajes procesados a través de la plataforma.</li>
              <li>Datos de integraciones con redes sociales (Instagram, WhatsApp).</li>
              <li>Cualquier otro dato personal almacenado en nuestros sistemas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Cómo solicitar la eliminación de tus datos</h2>
            <p>Puedes solicitar la eliminación de tus datos de las siguientes maneras:</p>
            <div className="space-y-4 mt-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-1">Opción 1: Por correo electrónico</h3>
                <p>Envía un correo a <a href="mailto:julian@dosmicos.com" className="text-primary hover:underline">julian@dosmicos.com</a> con el asunto "Solicitud de eliminación de datos" incluyendo el correo electrónico asociado a tu cuenta.</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-1">Opción 2: Desde tu cuenta</h3>
                <p>Inicia sesión en tu cuenta de Sewdle, ve a Configuración y selecciona la opción de eliminar tu cuenta y datos.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Plazo de procesamiento</h2>
            <p>Las solicitudes de eliminación de datos se procesan dentro de los 30 días siguientes a la recepción de la solicitud. Recibirás una confirmación por correo electrónico una vez que el proceso se haya completado.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Datos de Facebook e Instagram</h2>
            <p>Si conectaste tu cuenta de Facebook o Instagram a nuestra plataforma, al solicitar la eliminación de datos también eliminaremos toda la información recibida a través de las APIs de Meta, incluyendo datos de perfil, mensajes y cualquier contenido asociado.</p>
            <p>También puedes gestionar los permisos de tu cuenta directamente desde la <a href="https://www.facebook.com/settings?tab=applications" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">configuración de aplicaciones de Facebook</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Contacto</h2>
            <p>Si tienes preguntas sobre la eliminación de datos, contáctanos en: <a href="mailto:julian@dosmicos.com" className="text-primary hover:underline">julian@dosmicos.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default DataDeletionPage;
