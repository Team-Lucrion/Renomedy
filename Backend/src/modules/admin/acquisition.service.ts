import { supabaseAdmin } from "../../lib/supabase";
import { getBetaFunnel } from "./admin.service";
import { HttpError } from "../../utils/http-error";

export type AcquisitionLeadStatus =
  | "researched"
  | "qualified"
  | "awaiting_approval"
  | "approved"
  | "contacted"
  | "replied"
  | "qualified_conversation"
  | "beta_invited"
  | "beta_redeemed"
  | "first_upload"
  | "won"
  | "lost"
  | "do_not_contact";

export type AcquisitionConsentStatus = "research_only" | "opted_in" | "do_not_contact";

export type AcquisitionApprovalStatus = "not_required" | "pending" | "approved" | "rejected";

const ACQUISITION_LEAD_STATUSES = new Set<AcquisitionLeadStatus>(["researched", "qualified", "awaiting_approval", "approved", "contacted", "replied", "qualified_conversation", "beta_invited", "beta_redeemed", "first_upload", "won", "lost", "do_not_contact"]);

export function isAcquisitionLeadStatus(value: string): value is AcquisitionLeadStatus {
  return ACQUISITION_LEAD_STATUSES.has(value as AcquisitionLeadStatus);
}

export type AcquisitionLeadInput = {
  source: string;
  source_url?: string;
  public_handle?: string;
  contact_channel?: string;
  name?: string;
  city?: string;
  caregiver_type?: string;
  care_context?: string;
  medicine_complexity?: number;
  prescription_confusion?: boolean;
  reminder_refill_problem?: boolean;
  feedback_willing?: boolean;
  referral_likelihood?: boolean;
  consent_status?: AcquisitionConsentStatus;
  research_summary?: string;
  founder_notes?: string;
};

export type AcquisitionLeadUpdate = {
  status?: AcquisitionLeadStatus;
  consent_status?: AcquisitionConsentStatus;
  approval_status?: AcquisitionApprovalStatus;
  contacted_at?: string | null;
  last_response_at?: string | null;
  next_follow_up_at?: string | null;
  beta_invite_id?: string | null;
  founder_notes?: string;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function boundedComplexity(value: unknown) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(2, Math.round(number)));
}

export function scoreAcquisitionLead(input: Pick<AcquisitionLeadInput, "source" | "caregiver_type" | "care_context" | "medicine_complexity" | "prescription_confusion" | "reminder_refill_problem" | "feedback_willing" | "referral_likelihood">) {
  const caregiverType = (input.caregiver_type ?? "").toLowerCase();
  const context = (input.care_context ?? "").toLowerCase();
  const source = (input.source ?? "").toUpperCase();
  let score = 0;

  if (/(parent|elder|elderly|grandparent|mother|father)/.test(caregiverType)) score += 3;
  const complexity = boundedComplexity(input.medicine_complexity);
  score += complexity || (/(multiple|chronic|daily|polypharmacy|bp|diabetes|thyroid|asthma|arthritis)/.test(context) ? 2 : 0);
  if (input.prescription_confusion) score += 2;
  if (input.reminder_refill_problem) score += 1;
  if (input.feedback_willing) score += 1;
  if (input.referral_likelihood) score += 1;
  if (source === "DOC" || source === "PHARM") score += 1;

  return Math.min(10, score);
}

function buildResearchSummary(input: AcquisitionLeadInput) {
  if (text(input.research_summary)) return text(input.research_summary);
  const parts = [
    text(input.caregiver_type) && "Caregiver: " + text(input.caregiver_type),
    text(input.care_context) && "Context: " + text(input.care_context),
    input.prescription_confusion ? "Prescription confusion mentioned" : null,
    input.reminder_refill_problem ? "Reminder or refill burden mentioned" : null
  ].filter(Boolean);
  return parts.length ? parts.join(". ") + "." : null;
}

function buildOutreachDraft(input: AcquisitionLeadInput) {
  if (input.consent_status === "do_not_contact" || !text(input.public_handle) || !text(input.source_url)) return null;
  const name = text(input.name) || "there";
  const caregiver = text(input.caregiver_type) || "your family";
  return [
    "Hi " + name + " — I saw your public post about helping care for " + caregiver + ".",
    "I’m part of Renomedy, a small invite-only beta for Indian families who want prescriptions to be easier to understand and coordinate.",
    "We do not replace a doctor or change medical instructions. If this is relevant, may I share a short demo or beta invitation? No pressure."
  ].join(" ");
}

function initialState(score: number, consentStatus: AcquisitionConsentStatus) {
  if (consentStatus === "do_not_contact") return { status: "do_not_contact" as const, approval_status: "not_required" as const };
  if (score >= 5) return { status: "qualified" as const, approval_status: "not_required" as const };
  return { status: "researched" as const, approval_status: "not_required" as const };
}

export async function createAcquisitionLead(input: AcquisitionLeadInput) {
  const source = text(input.source);
  if (!source) throw new HttpError(400, "source is required");

  const consentStatus = input.consent_status ?? "research_only";
  const normalized = {
    source,
    source_url: text(input.source_url),
    public_handle: text(input.public_handle),
    contact_channel: text(input.contact_channel) || "manual",
    name: text(input.name),
    city: text(input.city),
    caregiver_type: text(input.caregiver_type),
    care_context: text(input.care_context),
    medicine_complexity: boundedComplexity(input.medicine_complexity),
    prescription_confusion: Boolean(input.prescription_confusion),
    reminder_refill_problem: Boolean(input.reminder_refill_problem),
    feedback_willing: Boolean(input.feedback_willing),
    referral_likelihood: Boolean(input.referral_likelihood),
    consent_status: consentStatus
  };
  const score = scoreAcquisitionLead(normalized);
  const state = initialState(score, consentStatus);
  const { data, error } = await supabaseAdmin
    .from("acquisition_leads")
    .insert({
      ...normalized,
      priority_score: score,
      status: state.status,
      approval_status: state.approval_status,
      research_summary: buildResearchSummary(input),
      outreach_draft: buildOutreachDraft(input),
      founder_notes: text(input.founder_notes)
    })
    .select("*")
    .single();

  if (error?.code === "23505") throw new HttpError(409, "Acquisition lead already exists for this source identity", error);
  if (error || !data) throw new HttpError(500, "Failed to create acquisition lead", error);
  return data;
}

export async function listAcquisitionLeads(status?: AcquisitionLeadStatus) {
  let query = supabaseAdmin
    .from("acquisition_leads")
    .select("*")
    .order("priority_score", { ascending: false })
    .order("next_follow_up_at", { ascending: true, nullsFirst: false })
    .limit(100);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new HttpError(500, "Failed to list acquisition leads", error);
  return data ?? [];
}

export async function updateAcquisitionLead(id: string, input: AcquisitionLeadUpdate) {
  const { data: existing, error: existingError } = await supabaseAdmin.from("acquisition_leads").select("status, approval_status").eq("id", id).single();
  if (existingError || !existing) throw new HttpError(404, "Acquisition lead not found", existingError);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ["status", "consent_status", "approval_status", "contacted_at", "last_response_at", "next_follow_up_at", "beta_invite_id", "founder_notes"] as const) {
    if (input[key] !== undefined) patch[key] = input[key];
  }
  if (input.status === "awaiting_approval" && existing.status !== "qualified") {
    throw new HttpError(409, "Only qualified leads can enter the approval queue");
  }
  if (input.status === "awaiting_approval") patch.approval_status = "pending";
  if (input.approval_status === "approved") {
    if (existing.status !== "awaiting_approval") throw new HttpError(409, "Lead must be awaiting approval before approval");
    patch.status = "approved";
    patch.approved_at = new Date().toISOString();
  }
  if (input.approval_status === "rejected") {
    patch.status = "lost";
  }
  if (input.consent_status === "do_not_contact") {
    patch.status = "do_not_contact";
    patch.approval_status = "not_required";
  }
  const { data, error } = await supabaseAdmin.from("acquisition_leads").update(patch).eq("id", id).select("*").single();
  if (error || !data) throw new HttpError(404, "Acquisition lead not found", error);
  return data;
}

export async function getAcquisitionDailyBrief() {
  const [{ data: leads, error: leadsError }, betaFunnel] = await Promise.all([
    supabaseAdmin
      .from("acquisition_leads")
      .select("id, source, source_url, public_handle, name, caregiver_type, care_context, priority_score, status, approval_status, next_follow_up_at, outreach_draft")
      .order("priority_score", { ascending: false })
      .order("next_follow_up_at", { ascending: true, nullsFirst: false })
      .limit(200),
    getBetaFunnel()
  ]);
  if (leadsError) throw new HttpError(500, "Failed to build acquisition brief", leadsError);

  const rows = leads ?? [];
  const today = new Date().toISOString();
  const metrics = rows.reduce<Record<string, number>>((counts, lead) => {
    counts[lead.status] = (counts[lead.status] ?? 0) + 1;
    return counts;
  }, {});

  return {
    generated_at: new Date().toISOString(),
    rules: {
      approval_required_before_contact: true,
      research_only_records_must_not_be_messaged_automatically: true,
      minimum_score_for_approval_queue: 5
    },
    lead_metrics: metrics,
    beta_funnel: betaFunnel.funnel,
    next_actions: rows
      .filter((lead) => lead.status === "qualified" || lead.approval_status === "pending" || (lead.next_follow_up_at && lead.next_follow_up_at <= today))
      .slice(0, 10)
  };
}
