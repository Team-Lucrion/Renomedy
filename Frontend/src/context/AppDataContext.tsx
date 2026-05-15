import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/expo";
import { api, ApiError } from "../lib/api";
import { findFirst } from "../lib/collections";
import type {
  BackendFamilyGroup,
  BackendFamilyMember,
  BackendUser,
  DashboardOverview,
  InvitePreview,
  MedicationSchedule,
  PaymentOrder,
  PaymentStatus,
  PaymentVerification,
  PrescriptionHistoryItem,
  RefillState,
  SubscriptionSummary,
} from "../types/backend";

type AppDataContextValue = {
  currentUser: BackendUser | null;
  familyGroups: BackendFamilyGroup[];
  familyMembers: BackendFamilyMember[];
  overview: DashboardOverview | null;
  schedules: MedicationSchedule[];
  refillStates: RefillState[];
  prescriptions: PrescriptionHistoryItem[];
  subscriptionSummary: SubscriptionSummary | null;
  isLoading: boolean;
  error: string;
  betaBlocked: boolean;
  refreshAll: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  activateBetaAccess: (enteredCode: string) => Promise<void>;
  completeOnboarding: (input: {
    familyName: string;
    role: "caregiver" | "family_member" | "patient";
    inviteFamilyLater: boolean;
  }) => Promise<void>;
  joinSanctuary: (inviteCode: string, role?: string) => Promise<void>;
  leaveSanctuary: () => Promise<void>;
  validateInvite: (inviteCode: string) => Promise<InvitePreview>;
  regenerateInvite: () => Promise<BackendFamilyGroup["invite_code"] extends string | null ? { invite_code: string; invite_expires_at?: string | null } : { invite_code: string; invite_expires_at?: string | null }>;
  createPaymentOrder: (input: { plan_slug: "care" | "family_plus"; billing_cycle: "monthly" | "yearly" }) => Promise<PaymentOrder>;
  verifyPayment: (input: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => Promise<PaymentVerification>;
  checkPaymentStatus: (razorpayOrderId: string) => Promise<PaymentStatus>;
  registerNotificationToken: (input: { fcm_token: string; platform: string }) => Promise<void>;
  unregisterNotificationToken: (fcmToken?: string) => Promise<void>;
  sendTestPush: () => Promise<void>;
  addFamilyMember: (input: {
    full_name: string;
    relationship: string;
    age?: number;
    dob?: string;
    gender?: string;
    role?: "caregiver" | "patient" | "family_member";
    avatar_url?: string;
    chronic_conditions: string[];
    allergies?: string[];
    notes?: string;
    is_primary_dependent: boolean;
  }) => Promise<void>;
  updateFamilyMember: (memberId: string, input: {
    full_name: string;
    relationship: string;
    age?: number | null;
    dob?: string | null;
    gender?: string | null;
    role?: "caregiver" | "patient" | "family_member";
    avatar_url?: string | null;
    chronic_conditions: string[];
    allergies?: string[];
    notes?: string | null;
    is_primary_dependent: boolean;
  }) => Promise<void>;
  archiveFamilyMember: (memberId: string) => Promise<void>;
  logDose: (input: {
    medication_schedule_id: string;
    status: "taken" | "missed" | "skipped" | "snoozed";
  }) => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while loading the app data.";
}

function isForbiddenApiError(error: unknown) {
  return error instanceof ApiError && error.statusCode === 403;
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [currentUser, setCurrentUser] = useState<BackendUser | null>(null);
  const [familyGroups, setFamilyGroups] = useState<BackendFamilyGroup[]>([]);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
  const [refillStates, setRefillStates] = useState<RefillState[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionHistoryItem[]>([]);
  const [subscriptionSummary, setSubscriptionSummary] = useState<SubscriptionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [betaBlocked, setBetaBlocked] = useState(false);

  const familyMembers = useMemo(
    () => familyGroups.flatMap((group) => group.family_members ?? []),
    [familyGroups],
  );

  const refreshAll = async () => {
    if (!isLoaded || !isSignedIn) {
      setCurrentUser(null);
      setFamilyGroups([]);
      setOverview(null);
      setSchedules([]);
      setRefillStates([]);
      setPrescriptions([]);
      setSubscriptionSummary(null);
      setError("");
      setBetaBlocked(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await api.post("auth/sync-clerk-user", {
        full_name: user?.fullName ?? undefined,
        email: user?.primaryEmailAddress?.emailAddress ?? undefined,
        role: "caregiver",
        preferred_language: "en",
      });

      const me = await api.get<BackendUser>("users/me");
      setCurrentUser(me);

      const featureResults = await Promise.allSettled([
        api.get<BackendFamilyGroup[]>("family/list"),
        api.get<DashboardOverview>("dashboard/family-overview"),
        api.get<MedicationSchedule[]>("medications/schedules"),
        api.get<RefillState[]>("medications/refill-status"),
        api.get<PrescriptionHistoryItem[]>("prescriptions/history"),
        api.get<SubscriptionSummary>("subscriptions/me"),
      ]);

      const featureErrors = featureResults
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason);

      if (featureErrors.length === featureResults.length && featureErrors.every(isForbiddenApiError)) {
        setFamilyGroups([]);
        setOverview(null);
        setSchedules([]);
        setRefillStates([]);
        setPrescriptions([]);
        setSubscriptionSummary(null);
        setBetaBlocked(true);
        setError(getErrorMessage(featureErrors[0]));
        return;
      }

      const [familiesResult, dashboardResult, schedulesResult, refillResult, historyResult, subscriptionResult] = featureResults;

      if (familiesResult.status === "fulfilled") {
        setFamilyGroups(familiesResult.value);
      }

      if (dashboardResult.status === "fulfilled") {
        setOverview(dashboardResult.value);
      }

      if (schedulesResult.status === "fulfilled") {
        setSchedules(schedulesResult.value);
      }

      if (refillResult.status === "fulfilled") {
        setRefillStates(refillResult.value);
      }

      if (historyResult.status === "fulfilled") {
        setPrescriptions(historyResult.value);
      }

      if (subscriptionResult.status === "fulfilled") {
        setSubscriptionSummary(subscriptionResult.value);
      }

      setBetaBlocked(false);

      const firstNonForbiddenFeatureError = findFirst(featureErrors, (featureError) => !isForbiddenApiError(featureError));
      if (firstNonForbiddenFeatureError) {
        setError(getErrorMessage(firstNonForbiddenFeatureError));
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshAll();
  }, [isLoaded, isSignedIn, user?.fullName, user?.primaryEmailAddress?.emailAddress]);

  const activateBetaAccess = async (enteredCode: string) => {
    const normalizedCode = enteredCode.trim().toUpperCase();

    console.log("[beta-invite] enteredCode", enteredCode);
    console.log("[beta-invite] normalizedCode", normalizedCode);

    const activatedUser = await api.patch<BackendUser>("users/onboarding", {
      invite_code: normalizedCode,
      onboarding_complete: true,
    });

    console.log("[beta-invite] activation response data", activatedUser);

    if (!activatedUser) {
      throw new Error("Closed beta access required");
    }

    setCurrentUser(activatedUser);
    setBetaBlocked(false);
    setError("");
    await refreshAll();
  };

  const refreshSubscription = async () => {
    const subscription = await api.get<SubscriptionSummary>("subscriptions/me");
    setSubscriptionSummary(subscription);
  };

  const completeOnboarding = async (input: {
    familyName: string;
    role: "caregiver" | "family_member" | "patient";
    inviteFamilyLater: boolean;
  }) => {
    const backendRole = input.role === "caregiver" ? "caregiver" : "self";

    await api.patch<BackendUser>("users/onboarding", {
      role: backendRole,
      onboarding_complete: true,
    });

    await api.post<BackendFamilyGroup>("family/create", {
      family_name: input.familyName.trim(),
      member_role: input.role,
      invite_family_later: input.inviteFamilyLater,
    });

    await refreshAll();
  };

  const joinSanctuary = async (inviteCode: string, role?: string) => {
    await api.post<BackendFamilyGroup>("family/join", {
      invite_code: inviteCode,
      role: role ?? "caregiver",
    });
    await refreshAll();
  };

  const leaveSanctuary = async () => {
    await api.post("family/leave");
    await refreshAll();
  };

  const validateInvite = async (inviteCode: string) => {
    return api.get<InvitePreview>(`family/validate-invite/${inviteCode.trim().toUpperCase()}`);
  };

  const regenerateInvite = async () => {
    const result = await api.post<{ invite_code: string; invite_expires_at?: string | null }>("family/regenerate-invite");
    await refreshAll();
    return result;
  };

  const createPaymentOrder = async (input: { plan_slug: "care" | "family_plus"; billing_cycle: "monthly" | "yearly" }) => {
    return api.post<PaymentOrder>("payments/create-order", input);
  };

  const verifyPayment = async (input: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
    const result = await api.post<PaymentVerification>("payments/verify", input);
    await refreshSubscription();
    await refreshAll();
    return result;
  };

  const checkPaymentStatus = async (razorpayOrderId: string) => {
    const result = await api.post<PaymentStatus>("payments/status", { razorpay_order_id: razorpayOrderId });
    await refreshSubscription();
    await refreshAll();
    return result;
  };

  const registerNotificationToken = async (input: { fcm_token: string; platform: string }) => {
    await api.post("notifications/register-token", input);
  };

  const unregisterNotificationToken = async (fcmToken?: string) => {
    await api.post("notifications/unregister-token", fcmToken ? { fcm_token: fcmToken } : {});
  };

  const sendTestPush = async () => {
    await api.post("notifications/test-push");
  };

  const addFamilyMember = async (input: {
    full_name: string;
    relationship: string;
    age?: number;
    dob?: string;
    gender?: string;
    role?: "caregiver" | "patient" | "family_member";
    avatar_url?: string;
    chronic_conditions: string[];
    allergies?: string[];
    notes?: string;
    is_primary_dependent: boolean;
  }) => {
    const targetGroup = familyGroups[0];

    if (!targetGroup) {
      throw new Error("Create or join a family group before adding a member.");
    }

    await api.post("family/add-member", {
      family_group_id: targetGroup.id,
      full_name: input.full_name,
      relationship: input.relationship,
      age: input.age,
      dob: input.dob || undefined,
      gender: input.gender || undefined,
      role: input.role || "family_member",
      avatar_url: input.avatar_url || undefined,
      chronic_conditions: input.chronic_conditions,
      notes: input.notes || undefined,
      is_primary_dependent: input.is_primary_dependent,
      allergies: input.allergies ?? [],
    });

    await refreshAll();
  };

  const updateFamilyMember = async (memberId: string, input: {
    full_name: string;
    relationship: string;
    age?: number | null;
    dob?: string | null;
    gender?: string | null;
    role?: "caregiver" | "patient" | "family_member";
    avatar_url?: string | null;
    chronic_conditions: string[];
    allergies?: string[];
    notes?: string | null;
    is_primary_dependent: boolean;
  }) => {
    await api.patch(`family/member/${memberId}`, {
      ...input,
      allergies: input.allergies ?? [],
    });

    await refreshAll();
  };

  const archiveFamilyMember = async (memberId: string) => {
    await api.post(`family/member/${memberId}/archive`);
    await refreshAll();
  };

  const logDose = async (input: {
    medication_schedule_id: string;
    status: "taken" | "missed" | "skipped" | "snoozed";
  }) => {
    const now = new Date().toISOString();

    await api.post("medications/log-dose", {
      medication_schedule_id: input.medication_schedule_id,
      scheduled_time: now,
      taken_time: input.status === "taken" ? now : undefined,
      status: input.status,
    });

    await refreshAll();
  };

  const value = useMemo<AppDataContextValue>(
    () => ({
      currentUser,
      familyGroups,
      familyMembers,
      overview,
      schedules,
      refillStates,
      prescriptions,
      subscriptionSummary,
      isLoading,
      error,
      betaBlocked,
      refreshAll,
      refreshSubscription,
      activateBetaAccess,
      completeOnboarding,
      joinSanctuary,
      leaveSanctuary,
      validateInvite,
      regenerateInvite,
      createPaymentOrder,
      verifyPayment,
      checkPaymentStatus,
      registerNotificationToken,
      unregisterNotificationToken,
      sendTestPush,
      addFamilyMember,
      updateFamilyMember,
      archiveFamilyMember,
      logDose,
    }),
    [currentUser, familyGroups, familyMembers, overview, schedules, refillStates, prescriptions, subscriptionSummary, isLoading, error, betaBlocked],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider.");
  }

  return context;
}
