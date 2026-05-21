const buildInfo = {
  commit: 'b44f4e9a816808f84be4d4a6314391f85202690e',
  builtAt: '2026-05-21T13:36:47Z',
  branch: 'main',
  message: 'revert: Stripe powrót z Paddle — AuthService + stripe-checkout/stripe-webhook edge functions',
};
console.log('[BUILD]', JSON.stringify(buildInfo));
// Also expose on window for dashboard inspection
if (typeof window !== 'undefined') {
  (window as any).__BUILD_INFO__ = buildInfo;
}
export default buildInfo;
