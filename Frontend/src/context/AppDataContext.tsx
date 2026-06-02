import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/expo";
import { api, ApiError } from "../lib/api";
import { trackEvent } from "../lib/analytics";
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
  isOffline: boolean;
  pendingDoseLogCount: number;
  refreshAll: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  activateBetaAccess: (enteredCode: string) => Promise<void>;
  completeOnboarding: (input: {
    accountName: string;
    patientName?: string;
    relationship?: string;
    skippedFirstPatient?: boolean;
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
const APP_DATA_CACHE_KEY = "swasthi.offlineAppData.v1";
const DOSE_LOG_QUEUE_KEY = "swasthi.offlineDoseLogQueue.v1";

type QueuedDoseLog = {
  client_id: string;
  medication_schedule_id: string;
  scheduled_time: string;
  taken_time?: string;
  status: "taken" | "missed" | "skipped" | "snoozed";
  queued_at: string;
};

type CachedAppData = {
  currentUser: BackendUser | null;
  familyGroups: BackendFamilyGroup[];
  overview: DashboardOverview | null;
  schedules: MedicationSchedule[];
  refillStates: RefillState[];
  prescriptions: PrescriptionHistoryItem[];
  subscriptionSummary: SubscriptionSummary | null;
  cachedAt: string;
};

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

function isNetworkApiError(error: unknown) {
  return error instanceof ApiError && error.statusCode === 0;
}

function hasBetaAccess(user: BackendUser | null) {
  return Boolean(user?.beta_access_approved || user?.beta_access_status === "active");
}

async function readCachedAppData(): Promise<CachedAppData | null> {
  await AsyncStorage.removeItem(APP_DATA_CACHE_KEY);
  return null;
}

async function writeCachedAppData(_data: Omit<CachedAppData, "cachedAt">) {
  await AsyncStorage.removeItem(APP_DATA_CACHE_KEY);
}

async function readDoseLogQueue() {
  await AsyncStorage.removeItem(DOSE_LOG_QUEUE_KEY);
  const raw = await SecureStore.getItemAsync(DOSE_LOG_QUEUE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as QueuedDoseLog[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeDoseLogQueue(queue: QueuedDoseLog[]) {
  await AsyncStorage.removeItem(DOSE_LOG_QUEUE_KEY);
  if (queue.length === 0) {
    await SecureStore.deleteItemAsync(DOSE_LOG_QUEUE_KEY);
    return;
  }

  await SecureStore.setItemAsync(DOSE_LOG_QUEUE_KEY, JSON.stringify(queue));
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
  const [isOffline, setIsOffline] = useState(false);
  const [pendingDoseLogCount, setPendingDoseLogCount] = useState(0);
  const isSyncingDoseQueueRef = useRef(false);

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
      setIsOffline(false);
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

      if (!hasBetaAccess(me)) {
        trackEvent("beta_gate_seen", { user_id: me.id });
        trackEvent("beta_gate_blocked", { user_id: me.id });
        setFamilyGroups([]);
        setOverview(null);
        setSchedules([]);
        setRefillStates([]);
        setPrescriptions([]);
        setSubscriptionSummary(null);
        setBetaBlocked(true);
        setError("");
        return;
      }

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
      if (!featureErrors.some(isNetworkApiError)) {
        setIsOffline(false);
        await writeCachedAppData({
          currentUser: me,
          familyGroups: familiesResult.status === "fulfilled" ? familiesResult.value : familyGroups,
          overview: dashboardResult.status === "fulfilled" ? dashboardResult.value : overview,
          schedules: schedulesResult.status === "fulfilled" ? schedulesResult.value : schedules,
          refillStates: refillResult.status === "fulfilled" ? refillResult.value : refillStates,
          prescriptions: historyResult.status === "fulfilled" ? historyResult.value : prescriptions,
          subscriptionSummary: subscriptionResult.status === "fulfilled" ? subscriptionResult.value : subscriptionSummary,
        });
        await syncQueuedDoseLogs();
      }

      const firstNonForbiddenFeatureError = findFirst(featureErrors, (featureError) => !isForbiddenApiError(featureError));
      if (firstNonForbiddenFeatureError) {
        if (isNetworkApiError(firstNonForbiddenFeatureError)) {
          setIsOffline(true);
          setError("");
          return;
        }
        setError(getErrorMessage(firstNonForbiddenFeatureError));
      }
    } catch (loadError) {
      if (isNetworkApiError(loadError)) {
        const cached = await readCachedAppData();
        if (cached) {
          setCurrentUser(cached.currentUser);
          setFamilyGroups(cached.familyGroups);
          setOverview(cached.overview);
          setSchedules(cached.schedules);
          setRefillStates(cached.refillStates);
          setPrescriptions(cached.prescriptions);
          setSubscriptionSummary(cached.subscriptionSummary);
          setBetaBlocked(false);
          setError("");
        } else {
          setError("This needs an internet connection.");
        }
        setIsOffline(true);
        return;
      }
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshAll();
  }, [isLoaded, isSignedIn, user?.fullName, user?.primaryEmailAddress?.emailAddress]);

  useEffect(() => {
    const loadPendingDoseCount = async () => {
      setPendingDoseLogCount((await readDoseLogQueue()).length);
    };

    void loadPendingDoseCount();
  }, []);

  const syncQueuedDoseLogs = async () => {
    if (isSyncingDoseQueueRef.current) return;

    const queue = await readDoseLogQueue();
    setPendingDoseLogCount(queue.length);
    if (queue.length === 0) return;

    isSyncingDoseQueueRef.current = true;
    try {
      const latestBySchedule = new Map<string, QueuedDoseLog>();
      queue.forEach((item) => {
        const existing = latestBySchedule.get(item.medication_schedule_id);
        if (!existing || Date.parse(item.queued_at) >= Date.parse(existing.queued_at)) {
          latestBySchedule.set(item.medication_schedule_id, item);
        }
      });

      const failed: QueuedDoseLog[] = [];
      for (const item of latestBySchedule.values()) {
        try {
          await api.post("medications/log-dose", {
            medication_schedule_id: item.medication_schedule_id,
            scheduled_time: item.scheduled_time,
            taken_time: item.taken_time,
            status: item.status,
          });
        } catch (syncError) {
          if (isNetworkApiError(syncError)) {
            failed.push(item);
          } else {
            trackEvent("offline_dose_log_sync_failed", {
              medication_schedule_id: item.medication_schedule_id,
              status: item.status,
            });
          }
        }
      }

      await writeDoseLogQueue(failed);
      setPendingDoseLogCount(failed.length);
      setIsOffline(failed.length > 0);
    } finally {
      isSyncingDoseQueueRef.current = false;
    }
  };

  useEffect(() => {
    if (pendingDoseLogCount === 0 || !isSignedIn) return undefined;

    const syncInterval = setInterval(() => {
      void syncQueuedDoseLogs();
    }, 30000);

    return () => clearInterval(syncInterval);
  }, [isSignedIn, pendingDoseLogCount]);

  const activateBetaAccess = async (enteredCode: string) => {
    const normalizedCode = enteredCode.trim().toUpperCase();
    trackEvent("beta_code_entered");
    await api.post("beta/validate", { invite_code: normalizedCode });
    trackEvent("beta_code_valid");
    const redeemed = await api.post<{ user: BackendUser }>("beta/redeem", { invite_code: normalizedCode });
    trackEvent("beta_code_redeemed");
    setCurrentUser(redeemed.user);
    setBetaBlocked(false);
    setError("");
    await refreshAll();
  };

  const refreshSubscription = async () => {
    const subscription = await api.get<SubscriptionSummary>("subscriptions/me");
    setSubscriptionSummary(subscription);
  };

  const completeOnboarding = async (input: {
    accountName: string;
    patientName?: string;
    relationship?: string;
    skippedFirstPatient?: boolean;
  }) => {
    await api.patch<BackendUser>("users/onboarding", {
      full_name: input.accountName.trim(),
      role: "caregiver",
      onboarding_complete: true,
    });

    if (!input.skippedFirstPatient && input.patientName?.trim()) {
      await api.post<BackendFamilyGroup>("family/create", {
        family_name: `${input.patientName.trim()}'s medicines`,
        member_role: "patient",
        primary_member_name: input.patientName.trim(),
        primary_member_relationship: input.relationship?.trim() || "Other",
        invite_family_later: true,
      });
    }

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
    try {
      return await api.get<InvitePreview>(`family/validate-invite/${inviteCode.trim().toUpperCase()}`);
    } catch (inviteError) {
      if (isNetworkApiError(inviteError)) {
        setIsOffline(true);
        throw new Error("This needs an internet connection.");
      }
      throw inviteError;
    }
  };

  const regenerateInvite = async () => {
    try {
      const result = await api.post<{ invite_code: string; invite_expires_at?: string | null }>("family/regenerate-invite");
      await refreshAll();
      return result;
    } catch (inviteError) {
      if (isNetworkApiError(inviteError)) {
        setIsOffline(true);
        throw new Error("This needs an internet connection.");
      }
      throw inviteError;
    }
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
    const payload = {
      medication_schedule_id: input.medication_schedule_id,
      scheduled_time: now,
      taken_time: input.status === "taken" ? now : undefined,
      status: input.status,
    };

    try {
      await api.post("medications/log-dose", payload);
      await syncQueuedDoseLogs();
    } catch (doseError) {
      if (!isNetworkApiError(doseError)) {
        throw doseError;
      }

      const queue = await readDoseLogQueue();
      const queuedLog: QueuedDoseLog = {
        ...payload,
        client_id: `${input.medication_schedule_id}:${now}`,
        queued_at: now,
      };
      const withoutOlderSameSchedule = queue.filter((item) => item.medication_schedule_id !== input.medication_schedule_id);
      const nextQueue = [...withoutOlderSameSchedule, queuedLog];
      await writeDoseLogQueue(nextQueue);
      setPendingDoseLogCount(nextQueue.length);
      setIsOffline(true);
      trackEvent("offline_dose_log_queued", {
        medication_schedule_id: input.medication_schedule_id,
        status: input.status,
      });
      return;
    }

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
      isOffline,
      pendingDoseLogCount,
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
    [currentUser, familyGroups, familyMembers, overview, schedules, refillStates, prescriptions, subscriptionSummary, isLoading, error, betaBlocked, isOffline, pendingDoseLogCount],
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
