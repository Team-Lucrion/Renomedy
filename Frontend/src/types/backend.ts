export type BackendUser = {
  id: string;
  full_name?: string | null;
  role?: "self" | "caregiver" | string | null;
  preferred_language?: string | null;
  beta_access_status?: "pending" | "active" | "revoked" | string;
  beta_access_approved?: boolean | null;
  beta_invite_code_used?: string | null;
  beta_approved_at?: string | null;
  onboarding_complete?: boolean | null;
  last_sanctuary_id?: string | null;
};

export type SubscriptionPlan = {
  id: string;
  slug: "free" | "care" | "family_plus" | string;
  display_name: string;
  monthly_price_inr: number;
  yearly_price_inr?: number | null;
  scan_limit_monthly?: number | null;
  family_member_limit?: number | null;
  reminder_limit?: number | null;
  caregiver_alerts_enabled?: boolean | null;
  refill_prediction_enabled?: boolean | null;
  adherence_history_enabled?: boolean | null;
  premium_support_enabled?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

export type UserSubscription = {
  id: string;
  plan_slug: "free" | "care" | "family_plus" | string;
  billing_cycle: "monthly" | "yearly" | "lifetime" | string;
  status: "active" | "past_due" | "cancelled" | "expired" | string;
  source?: string | null;
  subscription_plans?: SubscriptionPlan | null;
};

export type UsageTracking = {
  prescription_scans_used: number;
  reminders_created?: number;
  caregiver_alerts_used?: number;
  period_start?: string;
  period_end?: string;
};

export type SubscriptionSummary = {
  subscription: UserSubscription;
  plan: SubscriptionPlan;
  usage: UsageTracking;
};

export type InvitePreview = {
  valid: boolean;
  sanctuary_name: string;
  invite_code: string;
  expires_at?: string | null;
  expired?: boolean;
};

export type PaymentOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  mock?: boolean;
};

export type PaymentVerification = {
  success: boolean;
  plan_slug: string;
  billing_cycle?: string;
  subscription_status: string;
  expires_at?: string | null;
};

export type PaymentStatus = {
  razorpay_order_id: string;
  plan_slug: string;
  billing_cycle: string;
  status: string;
  captured: boolean;
  amount_inr: number;
};

export type BackendFamilyMember = {
  id: string;
  family_group_id: string;
  full_name: string;
  name?: string | null;
  age?: number | null;
  relationship: string;
  dob?: string | null;
  gender?: string | null;
  role?: "caregiver" | "patient" | "family_member" | string | null;
  avatar_url?: string | null;
  created_by?: string | null;
  updated_at?: string | null;
  is_archived?: boolean | null;
  chronic_conditions?: string[] | null;
  allergies?: string[] | null;
  notes?: string | null;
  is_primary_dependent?: boolean | null;
  active_medication_count?: number | null;
  active_reminder_count?: number | null;
  prescription_count?: number | null;
  medication_status?: string | null;
};

export type BackendFamilyGroup = {
  id: string;
  family_name: string;
  invite_code?: string | null;
  invite_expires_at?: string | null;
  plan_slug?: string | null;
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
  family_group_memberships?: Array<{
    user_id?: string | null;
    role?: string | null;
    status?: string | null;
  }>;
  family_members?: BackendFamilyMember[];
};

export type DashboardOverview = {
  family_members_count: number;
  active_schedules_count: number;
  missed_doses_last_24h: number;
  refill_risk_count: number;
};

export type RefillState = {
  medication_schedule_id: string;
  quantity_total?: number | null;
  quantity_remaining?: number | null;
  daily_depletion?: number | null;
  projected_runout_date?: string | null;
  continuity_status?: string | null;
};

export type MedicationSchedule = {
  id: string;
  family_member_id: string;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  reminder_times?: string[] | null;
  food_relation?: string | null;
  prescription_medications?: {
    medicine_name?: string | null;
    brand_name?: string | null;
    generic_name?: string | null;
    dosage?: string | null;
    frequency?: string | null;
    timing?: string | null;
    duration?: string | null;
    food_timing?: string | null;
    verified_at?: string | null;
  } | null;
  refill_states?: RefillState[] | RefillState | null;
};

export type PrescriptionHistoryItem = {
  id: string;
  image_url?: string | null;
  raw_ocr_text?: string | null;
  cleaned_ocr_text?: string | null;
  doctor_name?: string | null;
  hospital_name?: string | null;
  prescription_date?: string | null;
  verification_status?: string | null;
  parse_status?: string | null;
  ai_provider?: string | null;
  ai_model?: string | null;
  parsed_medicine_json?: {
    status?: "success" | "failed" | string | null;
    ocr_quality?: "high" | "medium" | "low" | string | null;
    prescription_summary?: {
      total_medicines?: number | null;
      confidence_score?: number | null;
    } | null;
    medicines?: Array<{
      id?: number | null;
      medicine_name?: string | null;
      generic_name?: string | null;
      strength?: string | null;
      form?: string | null;
      dose?: string | null;
      dosage?: string | null;
      frequency?: string | null;
      timing?: string | null;
      duration?: string | null;
      instructions?: string | null;
      uses?: string[] | null;
      warnings?: string[] | null;
      quantity?: string | null;
      confidence?: "high" | "medium" | "low" | string | null;
      confidence_score?: number | null;
      requires_manual_verification?: boolean | null;
    }>;
    important_notes?: string[] | null;
    raw_detected_text_summary?: string | null;
  } | null;
  family_members?: {
    full_name?: string | null;
  } | null;
  prescription_medications?: Array<{ id: string }>;
  prescription_uploads?: Array<{
    id: string;
    processing_status?: string | null;
    last_error?: string | null;
  }>;
};

export type ParsedPrescriptionMedication = {
  id: string;
  medicine_name: string;
  brand_name?: string | null;
  generic_name?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  timing?: string | null;
  duration?: string | null;
  food_timing?: string | null;
  instructions?: string | null;
  shorthand_detected?: string[] | null;
  shorthand_explanation?: string | null;
  confidence_score?: number | null;
  requires_manual_verification?: boolean | null;
};

export type PrescriptionDetails = PrescriptionHistoryItem & {
  prescription_medications?: ParsedPrescriptionMedication[];
};

export type ParsePrescriptionResult = {
  prescriptionId: string;
  parseStatus: string;
  medicationsDetected: number;
  ocrProvider: string;
  aiProvider?: string | null;
  aiModel?: string | null;
};

export type ScannedMedicine = {
  name: string;
  strength?: string;
  dose?: string;
  frequency?: string;
  frequencyMeaning?: string;
  foodTiming?: string;
  durationDays?: number | null;
  instructions?: string;
  confidence?: number;
  needsReview: boolean;
};

export type ScanPrescriptionResponse = {
  success: boolean;
  rawText?: string;
  confidence?: number;
  medicines: ScannedMedicine[];
  warnings?: string[];
  status?: "pending_verification" | "failed";
  error?: string;
  message?: string;
  prescriptionId?: string;
  prescription?: PrescriptionDetails | null;
  uploadError?: string | null;
};
