import * as crypto from 'crypto';

export interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
}

interface WebhookOptions {
  url: string;
  payload: WebhookPayload;
  signature: string;
}

/**
 * Generate HMAC SHA-256 signature for webhook payload
 */
export function generateWebhookSignature(
  payload: WebhookPayload,
  secret: string
): string {
  const payloadString = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

/**
 * Send a single webhook request
 * Fire-and-forget approach with error logging
 */
async function sendWebhook(options: WebhookOptions): Promise<void> {
  try {
    const response = await fetch(options.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': options.signature,
      },
      body: JSON.stringify(options.payload),
    });

    if (!response.ok) {
      console.error(
        `Webhook failed [${options.url}]:`,
        response.status,
        await response.text()
      );
    }
  } catch (error) {
    console.error(`Webhook error [${options.url}]:`, error);
    // Consider implementing retry logic or queue for failed webhooks
  }
}

/**
 * Send webhooks to multiple URLs in parallel
 * Non-blocking: failures won't affect the main application flow
 */
export async function sendWebhooks(
  urls: string[],
  payload: WebhookPayload,
  secret: string
): Promise<void> {
  if (!urls || urls.length === 0) {
    return; // No webhooks configured
  }

  const signature = generateWebhookSignature(payload, secret);

  // Send all webhooks in parallel using Promise.allSettled
  // This ensures all webhooks are attempted even if some fail
  const promises = urls.map((url) =>
    sendWebhook({
      url,
      payload,
      signature,
    })
  );

  await Promise.allSettled(promises);
}
