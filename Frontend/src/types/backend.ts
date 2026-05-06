export type BackendUser = {
  id: string;
  full_name?: string | null;
  preferred_language?: string | null;
  beta_access_status?: "pending" | "active" | "revoked" | string;
  onboarding_complete?: boolean | null;
};

export type BackendFamilyMember = {
  id: string;
  family_group_id: string;
  full_name: string;
  relationship: string;
  dob?: string | null;
  gender?: string | null;
  chronic_conditions?: string[] | null;
  allergies?: string[] | null;
  notes?: string | null;
  is_primary_dependent?: boolean | null;
};

export type BackendFamilyGroup = {
  id: string;
  family_name: string;
  invite_code?: string | null;
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
  doctor_name?: string | null;
  hospital_name?: string | null;
  prescription_date?: string | null;
  verification_status?: string | null;
  parse_status?: string | null;
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
