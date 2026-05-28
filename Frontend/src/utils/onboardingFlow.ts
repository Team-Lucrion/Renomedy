import AsyncStorage from '@react-native-async-storage/async-storage';

export const PENDING_FIRST_MEDICINE_FLOW_KEY = 'swasthi.pendingFirstMedicineFlow.v1';
export const FIRST_MEDICINE_ONBOARDING_ACTIVE_KEY = 'swasthi.firstMedicineOnboardingActive.v1';

export type PendingFirstMedicineFlow = 'upload' | 'manual';

export async function setPendingFirstMedicineFlow(flow: PendingFirstMedicineFlow) {
  await AsyncStorage.setItem(PENDING_FIRST_MEDICINE_FLOW_KEY, flow);
  await AsyncStorage.setItem(FIRST_MEDICINE_ONBOARDING_ACTIVE_KEY, 'true');
}

export async function consumePendingFirstMedicineFlow() {
  const flow = await AsyncStorage.getItem(PENDING_FIRST_MEDICINE_FLOW_KEY);
  if (flow === 'upload' || flow === 'manual') {
    await AsyncStorage.removeItem(PENDING_FIRST_MEDICINE_FLOW_KEY);
    return flow;
  }
  return null;
}

export async function getPendingFirstMedicineFlow() {
  const flow = await AsyncStorage.getItem(PENDING_FIRST_MEDICINE_FLOW_KEY);
  return flow === 'upload' || flow === 'manual' ? flow : null;
}

export async function isFirstMedicineOnboardingActive() {
  return (await AsyncStorage.getItem(FIRST_MEDICINE_ONBOARDING_ACTIVE_KEY)) === 'true';
}

export async function completeFirstMedicineOnboarding() {
  await AsyncStorage.removeItem(PENDING_FIRST_MEDICINE_FLOW_KEY);
  await AsyncStorage.removeItem(FIRST_MEDICINE_ONBOARDING_ACTIVE_KEY);
}
