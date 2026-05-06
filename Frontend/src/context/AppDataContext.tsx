import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/expo";
import { api, ApiError } from "../lib/api";
import type {
  BackendFamilyGroup,
  BackendFamilyMember,
  BackendUser,
  DashboardOverview,
  MedicationSchedule,
  PrescriptionHistoryItem,
  RefillState,
} from "../types/backend";

type AppDataContextValue = {
  currentUser: BackendUser | null;
  familyGroups: BackendFamilyGroup[];
  familyMembers: BackendFamilyMember[];
  overview: DashboardOverview | null;
  schedules: MedicationSchedule[];
  refillStates: RefillState[];
  prescriptions: PrescriptionHistoryItem[];
  isLoading: boolean;
  error: string;
  betaBlocked: boolean;
  refreshAll: () => Promise<void>;
  addFamilyMember: (input: {
    full_name: string;
    relationship: string;
    dob?: string;
    chronic_conditions: string[];
    notes?: string;
    is_primary_dependent: boolean;
  }) => Promise<void>;
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

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [currentUser, setCurrentUser] = useState<BackendUser | null>(null);
  const [familyGroups, setFamilyGroups] = useState<BackendFamilyGroup[]>([]);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
  const [refillStates, setRefillStates] = useState<RefillState[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionHistoryItem[]>([]);
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

      try {
        const [families, dashboard, scheduleList, refillList, history] = await Promise.all([
          api.get<BackendFamilyGroup[]>("family/list"),
          api.get<DashboardOverview>("dashboard/family-overview"),
          api.get<MedicationSchedule[]>("medications/schedules"),
          api.get<RefillState[]>("medications/refill-status"),
          api.get<PrescriptionHistoryItem[]>("prescriptions/history"),
        ]);

        setFamilyGroups(families);
        setOverview(dashboard);
        setSchedules(scheduleList);
        setRefillStates(refillList);
        setPrescriptions(history);
        setBetaBlocked(false);
      } catch (featureError) {
        if (featureError instanceof ApiError && featureError.statusCode === 403) {
          setFamilyGroups([]);
          setOverview(null);
          setSchedules([]);
          setRefillStates([]);
          setPrescriptions([]);
          setBetaBlocked(true);
          setError(featureError.message);
        } else {
          throw featureError;
        }
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

  const addFamilyMember = async (input: {
    full_name: string;
    relationship: string;
    dob?: string;
    chronic_conditions: string[];
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
      dob: input.dob || undefined,
      chronic_conditions: input.chronic_conditions,
      notes: input.notes || undefined,
      is_primary_dependent: input.is_primary_dependent,
      allergies: [],
    });

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
      isLoading,
      error,
      betaBlocked,
      refreshAll,
      addFamilyMember,
      logDose,
    }),
    [currentUser, familyGroups, familyMembers, overview, schedules, refillStates, prescriptions, isLoading, error, betaBlocked],
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
