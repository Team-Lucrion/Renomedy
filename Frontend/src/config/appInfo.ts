import appConfig from '../../app.json';

export const APP_VERSION = appConfig.expo.version ?? '1.0.0';
export const APP_BUILD_DATE = new Date().toISOString().slice(0, 10);
export const FEEDBACK_EMAIL = 'support@renomedy.app';

export const DATA_STORAGE_CONFIRMED = false;
export const DATA_STORAGE_SENTENCE =
  'TODO: Production data region is not confirmed; Swasthi uses Supabase for app data and prescription files, and Clerk for sign-in.';
