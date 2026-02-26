/**
 * Shared helper for sending WhatsApp Template Messages via Meta Graph API v21.0.
 * Template messages can be sent outside the 24-hour messaging window.
 */

export async function sendWhatsAppTemplate(
  phoneNumberId: string,
  token: string,
  to: string,
  templateName: string,
  languageCode: string,
  bodyParameters: Array<{ type: 'text'; text: string }>,
  buttonParameters?: Array<{ type: 'payload' | 'text'; payload?: string; text?: string }>
): Promise<{ ok: boolean; messageId?: string; error?: any }> {
  try {
    const components: any[] = [];

    // Add body parameters if any
    if (bodyParameters.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParameters,
      });
    }

    // Add button parameters if any (for quick reply buttons)
    if (buttonParameters && buttonParameters.length > 0) {
      buttonParameters.forEach((btn, index) => {
        components.push({
          type: 'button',
          sub_type: 'quick_reply',
          index: index.toString(),
          parameters: [btn],
        });
      });
    }

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };

    // Only add components if there are any
    if (components.length > 0) {
      payload.template.components = components;
    }

    console.log(`📤 Sending WhatsApp template "${templateName}" to ${to}`);

    const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('WhatsApp template send error:', data);
      return { ok: false, error: data };
    }

    console.log(`✅ Template sent, message ID: ${data?.messages?.[0]?.id}`);
    return { ok: true, messageId: data?.messages?.[0]?.id };
  } catch (e: any) {
    console.error('Error sending WhatsApp template:', e);
    return { ok: false, error: e.message };
  }
}
