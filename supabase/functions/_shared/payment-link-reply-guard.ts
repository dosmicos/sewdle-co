function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s:/._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function containsUrl(value: unknown): boolean {
  return /https?:\/\/\S+/i.test(String(value || ''));
}

function actionResultsContainPaymentUrl(actionResults: unknown): boolean {
  if (!Array.isArray(actionResults)) return false;
  return actionResults.some((result) => {
    if (!result || typeof result !== 'object') return false;
    const typed = result as Record<string, unknown>;
    return containsUrl(typed.paymentUrl) || containsUrl(typed.payment_url) || containsUrl(typed.bold_payment_url);
  });
}

function isPaymentLinkThreadText(normalizedText: string): boolean {
  return normalizedText.includes('link de pago') ||
    normalizedText.includes('link para pagar') ||
    normalizedText.includes('link para hacer el pago') ||
    (normalizedText.includes('link') && normalizedText.includes('pago')) ||
    (normalizedText.includes('link') && normalizedText.includes('pagar'));
}

function latestContextLine(context: unknown): string {
  return String(context || '')
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .at(-1) || '';
}

export function claimsPaymentLinkWasSent(reply: unknown, context: unknown = ''): boolean {
  const normalizedReply = normalizeText(reply);
  const normalizedContext = normalizeText(context);
  const normalizedLatestContextLine = latestContextLine(context);
  if (!normalizedReply) return false;

  const replyMentionsPaymentLink = isPaymentLinkThreadText(normalizedReply);

  const latestContextIsPaymentLinkRequest = isPaymentLinkThreadText(normalizedLatestContextLine);

  const contextIsPaymentLinkThread = isPaymentLinkThreadText(normalizedContext);

  const saysAlreadySentOrGenerated =
    normalizedReply.includes('ya te generamos') ||
    normalizedReply.includes('ya generamos') ||
    normalizedReply.includes('generamos el link') ||
    normalizedReply.includes('hemos generado') ||
    normalizedReply.includes('link esta listo') ||
    normalizedReply.includes('link esta activo') ||
    normalizedReply.includes('te dejo el link') ||
    normalizedReply.includes('te comparto el link') ||
    normalizedReply.includes('te envio el link') ||
    normalizedReply.includes('te lo envio nuevamente') ||
    normalizedReply.includes('lo envio nuevamente') ||
    normalizedReply.includes('te lo envio de nuevo') ||
    normalizedReply.includes('te lo mando nuevamente');

  if (!saysAlreadySentOrGenerated) return false;
  if (replyMentionsPaymentLink) return true;

  const vagueResendWording =
    normalizedReply.includes('te lo envio nuevamente') ||
    normalizedReply.includes('lo envio nuevamente') ||
    normalizedReply.includes('te lo envio de nuevo') ||
    normalizedReply.includes('te lo mando nuevamente');

  if (vagueResendWording) return latestContextIsPaymentLinkRequest;
  return contextIsPaymentLinkThread;
}

export function shouldReplacePaymentLinkReplyWithoutUrl(
  reply: unknown,
  actionResults: unknown = [],
  context: unknown = '',
): boolean {
  if (containsUrl(reply)) return false;
  if (actionResultsContainPaymentUrl(actionResults)) return false;
  return claimsPaymentLinkWasSent(reply, context);
}

export function buildPaymentLinkMissingUrlFallbackReply(): string {
  return 'Perdón, el link no salió en el mensaje. Lo revisa una asesora y te lo enviamos correctamente por aquí.';
}
