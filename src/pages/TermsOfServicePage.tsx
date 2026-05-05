import { Link } from "react-router-dom";

const TermsOfServicePage = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="text-primary hover:underline text-sm mb-8 inline-block">&larr; Volver al inicio</Link>

        <h1 className="text-3xl font-bold mb-2">Términos y Condiciones de Servicio</h1>
        <p className="text-muted-foreground mb-8">Última actualización: 1 de marzo de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Aceptación de los términos</h2>
            <p>Al acceder y utilizar la plataforma Sewdle, aceptas estar sujeto a estos términos y condiciones de servicio. Si no estás de acuerdo con alguno de estos términos, no debes utilizar nuestros servicios.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Descripción del servicio</h2>
            <p>Sewdle es una plataforma de gestión empresarial que ofrece:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Gestión de pedidos e inventario.</li>
              <li>Mensajería integrada con Instagram y WhatsApp para atención al cliente.</li>
              <li>Integración con Shopify para comercio electrónico.</li>
              <li>Herramientas de análisis financiero y reportes.</li>
              <li>Gestión de entregas y logística.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. Registro y cuenta</h2>
            <p>Para utilizar nuestros servicios debes crear una cuenta proporcionando información veraz y actualizada. Eres responsable de mantener la confidencialidad de tus credenciales de acceso y de todas las actividades que ocurran bajo tu cuenta.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Uso aceptable</h2>
            <p>Te comprometes a utilizar la plataforma únicamente para fines legales y de acuerdo con estos términos. No debes:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Usar el servicio para actividades ilegales o no autorizadas.</li>
              <li>Intentar acceder a áreas restringidas de la plataforma.</li>
              <li>Enviar mensajes de spam o contenido no solicitado a través de las integraciones de mensajería.</li>
              <li>Compartir tus credenciales de acceso con terceros no autorizados.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Integraciones con terceros</h2>
            <p>Sewdle se integra con servicios de terceros como Meta (Instagram, WhatsApp), Shopify y otros. El uso de estas integraciones está sujeto a los términos y políticas de cada proveedor. Sewdle no es responsable de cambios o interrupciones en los servicios de terceros.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Propiedad intelectual</h2>
            <p>Todo el contenido, diseño, código y funcionalidades de la plataforma Sewdle son propiedad de Sewdle y están protegidos por las leyes de propiedad intelectual aplicables.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. Limitación de responsabilidad</h2>
            <p>Sewdle se proporciona "tal cual" y no garantizamos que el servicio sea ininterrumpido o libre de errores. No seremos responsables por daños indirectos, incidentales o consecuentes derivados del uso de la plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. Terminación</h2>
            <p>Nos reservamos el derecho de suspender o cancelar tu acceso a la plataforma si violas estos términos. Puedes cancelar tu cuenta en cualquier momento contactándonos.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">9. Modificaciones</h2>
            <p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Te notificaremos de cambios significativos a través de la plataforma o por correo electrónico.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">10. Contacto</h2>
            <p>Para preguntas sobre estos términos, contáctanos en: <a href="mailto:julian@dosmicos.com" className="text-primary hover:underline">julian@dosmicos.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
