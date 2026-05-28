import AsyncStorage from '@react-native-async-storage/async-storage';

const DOCTOR_RESPECT_DISMISSED_UNTIL_KEY = 'swasthi.doctorRespectNote.dismissedUntil.v1';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

let shownThisSession = false;

export const DOCTOR_RESPECT_NOTE_TEXT =
  'Swasthi helps you manage your prescription. For any medical questions, always consult your doctor.';

export async function shouldShowDoctorRespectNote() {
  if (shownThisSession) {
    return false;
  }

  const dismissedUntil = await AsyncStorage.getItem(DOCTOR_RESPECT_DISMISSED_UNTIL_KEY);
  if (dismissedUntil) {
    const dismissedUntilMs = Date.parse(dismissedUntil);
    if (!Number.isNaN(dismissedUntilMs) && dismissedUntilMs > Date.now()) {
      return false;
    }
  }

  shownThisSession = true;
  return true;
}

export async function dismissDoctorRespectNote() {
  await AsyncStorage.setItem(
    DOCTOR_RESPECT_DISMISSED_UNTIL_KEY,
    new Date(Date.now() + SEVEN_DAYS_MS).toISOString(),
  );
}
