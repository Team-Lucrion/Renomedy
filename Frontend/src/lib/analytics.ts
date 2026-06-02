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
  | 'beta_gate_blocked'
  | 'manual_medicine_draft_saved'
  | 'manual_medicine_draft_restored'
  | 'manual_medicine_draft_discarded'
  | 'manual_medicine_search_selected'
  | 'manual_medicine_free_text_used'
  | 'excluded_medicine_attempted'
  | 'blocked_medicine_detected'
  | 'medicine_activation_blocked_support_mode'
  | 'decimal_dosage_confirmation_required'
  | 'decimal_dosage_confirmed'
  | 'prescription_reconciliation_interstitial_seen'
  | 'prescription_reconciliation_choice_made'
  | 'prescription_reconciliation_saved'
  | 'medicine_relationship_confirmation_required'
  | 'medicine_relationship_confirmed'
  | 'offline_dose_log_queued'
  | 'offline_dose_log_sync_failed'
  | 'medicine_verification_completed';

export function trackEvent(
  event: AppAnalyticsEvent,
  properties?: Record<string, unknown>,
) {
  void event;
  void properties;
}

export function trackRenoItEvent(event: RenoItAnalyticsEvent, properties?: Record<string, unknown>) {
  trackEvent(event, properties);
}
