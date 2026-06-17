import {
  buildPaymentLinkMissingUrlFallbackReply,
  claimsPaymentLinkWasSent,
  shouldReplacePaymentLinkReplyWithoutUrl,
} from './payment-link-reply-guard.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('payment link guard catches generated-link claims without a URL', () => {
  const reply = 'Ya te generamos el link de pago por tarjeta 😊 Cuando quede aprobado, seguimos con el alistamiento de tu pedido.';

  assert(claimsPaymentLinkWasSent(reply), 'expected generated-link claim to be detected');
  assert(
    shouldReplacePaymentLinkReplyWithoutUrl(reply, [], 'Ok esperamos el link'),
    'must replace payment-link confirmation when no URL is present',
  );
});

Deno.test('payment link guard catches resend wording in a payment-link thread', () => {
  const reply = 'Claro, te lo envío nuevamente por aquí 😊';
  const context = 'No me aparece el link para hacer el pago';

  assert(
    shouldReplacePaymentLinkReplyWithoutUrl(reply, [], context),
    'must replace resend wording when the payment-link thread has no URL',
  );
});

Deno.test('payment link guard does not revive old link fallback on a new thanks/order-note message', () => {
  const reply = 'Claro, te lo envío nuevamente por aquí 😊';
  const context = [
    'No me aparece el link para hacer el pago',
    'Pues ya lo del pago en su totalidad',
    'Gracias',
  ].join('\n');

  assert(
    !shouldReplacePaymentLinkReplyWithoutUrl(reply, [], context),
    'must not replace with link-missing fallback when the latest customer message is not asking for the link',
  );
});

Deno.test('payment link guard allows replies that include the real URL', () => {
  const reply = 'Claro 😊 tu link de pago sigue activo:\nhttps://checkout.bold.co/LNK_123';

  assert(
    !shouldReplacePaymentLinkReplyWithoutUrl(reply, [], 'No me aparece el link'),
    'must not replace a reply that includes an URL',
  );
});

Deno.test('payment link guard allows successful action results with a paymentUrl', () => {
  const reply = '¡Listo! Te dejo el link de pago por PSE 😊';
  const actionResults = [{ type: 'send_payment_link', success: true, paymentUrl: 'https://checkout.bold.co/LNK_123' }];

  assert(
    !shouldReplacePaymentLinkReplyWithoutUrl(reply, actionResults, 'Ok esperamos el link'),
    'must not replace when the commerce action returned a paymentUrl',
  );
});

Deno.test('payment link guard fallback does not pretend that a link was sent', () => {
  const fallback = buildPaymentLinkMissingUrlFallbackReply();
  assert(!fallback.includes('http'), 'fallback must not invent an URL');
  assert(!fallback.toLowerCase().includes('generamos'), 'fallback must not claim a link was generated');
});
