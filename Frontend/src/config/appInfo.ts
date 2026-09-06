import appConfig from '../../app.json';

export const APP_VERSION = appConfig.expo.version ?? '1.0.0';
export const APP_BUILD_DATE = new Date().toISOString().slice(0, 10);
export const FEEDBACK_EMAIL = 'support@renomedy.app';

export const DATA_STORAGE_CONFIRMED = true;
export const DATA_STORAGE_SENTENCE =
  'Swasthi securely stores your app data and prescription files in Supabase, and uses Clerk for secure sign-in.';
