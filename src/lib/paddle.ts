/**
 * Helper do otwierania Paddle Checkout z poziomu frontendu.
 *
 * Wymagana konfiguracja w dashboardzie Paddle:
 *   1. Utwórz produkty/ceny → skopiuj priceId (pri_xxx)
 *   2. Pobierz client-side token (Settings → Developer Tools → Authentication)
 *   3. Ustaw webhook secret w paddle-webhook Edge Function
 *
 * Token wklej poniżej zamiast placeholder_a.
 */
const PADDLE_CLIENT_TOKEN = 'client_token_placeholder';

/** Czy skrypt Paddle.js został już załadowany. */
let paddleReady: Promise<void> | null = null;

/**
 * Dynamicznie ładuje Paddle.js (jeśli nie załadowany) i inicjalizuje.
 * Bezpiecznie wołać wielokrotnie – wykonuje się tylko raz.
 */
function ensurePaddle(): Promise<void> {
  if (paddleReady) return paddleReady;
  paddleReady = new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload = () => {
      // @ts-ignore – Paddle dodaje global window.Paddle
      window.Paddle.Initialize({ token: PADDLE_CLIENT_TOKEN, environment: 'sandbox' });
      resolve();
    };
    script.onerror = () => {
      paddleReady = null;
      resolve(); // pozwalamy kontynuować, błąd zostanie złapany w openCheckout
    };
    document.head.appendChild(script);
  });
  return paddleReady;
}

/**
 * Otwiera nakładkę Paddle Checkout dla podanego priceId.
 *
 * @param priceId – ID ceny z Paddle dashboard (pri_xxx)
 * @param customData – dane przepuszczane do webhooka (userId, username itp.)
 */
export async function openPaddleCheckout(
  priceId: string,
  customData?: Record<string, string>,
): Promise<void> {
  await ensurePaddle();

  // @ts-ignore
  if (typeof window.Paddle?.Checkout?.open !== 'function') {
    throw new Error('Paddle SDK not loaded');
  }

  // @ts-ignore
  window.Paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    settings: {
      displayMode: 'overlay',
      theme: 'dark',
      successUrl: window.location.origin + '?checkout=success',
      cancelUrl: window.location.origin + '?checkout=cancel',
    },
    customData,
  });
}
