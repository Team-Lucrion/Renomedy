export type RenoItAnalyticsEvent =
  | 'reno_it_opened'
  | 'reno_it_popup_seen'
  | 'reno_it_whatsapp_share_clicked'
  | 'reno_it_share_success'
  | 'reno_it_share_failed';

export type AppAnalyticsEvent =
  | RenoItAnalyticsEvent
  | 'beta_gate_seen'
  | 'beta_code_entered'
  | 'beta_code_valid'
  | 'beta_code_invalid'
  | 'beta_code_redeemed'
  | 'beta_gate_blocked';

export function trackEvent(
  event: AppAnalyticsEvent,
  properties?: Record<string, unknown>,
) {
  console.log('[analytics]', event, properties ?? {});
}

export function trackRenoItEvent(event: RenoItAnalyticsEvent, properties?: Record<string, unknown>) {
  trackEvent(event, properties);
}
