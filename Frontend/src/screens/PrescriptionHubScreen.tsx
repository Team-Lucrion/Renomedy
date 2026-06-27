import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import DocumentScanner from 'react-native-document-scanner-plugin';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import RenoItModal from '../components/RenoItModal';
import { captureRef } from 'react-native-view-shot';
import { useTranslation } from 'react-i18next';
import { ApiError, api, scanPrescription } from '../lib/api';
import { trackEvent, trackRenoItEvent } from '../lib/analytics';
import { useAppData } from '../context/AppDataContext';
import { findFirst, includesText } from '../lib/collections';
import UpgradeModal from '../components/UpgradeModal';
import type {
  ParsedPrescriptionMedication,
  PrescriptionDetails,
  PrescriptionHistoryItem,
  ScanPrescriptionResponse,
} from '../types/backend';
import {
  RENO_IT_BADGE_CTA,
  RENO_IT_BADGE_LABEL,
  RENO_IT_LANDING_URL,
  RENO_IT_TRUST_DISCLAIMER,
} from '../config/renoIt';
import { translateMedicalText } from '../utils/medicalAbbreviations';
import {
  findIndianMedicine,
  getSupportModeSafety,
  searchIndianMedicines,
  type IndianMedicineCatalogItem,
} from '../data/indianMedicines';
import { detectExcludedMedicine, hasDecimalDosage, parsePositiveInteger } from '../utils/medicineSafety';
import { evaluateMedicineRelationships, getMedicineTrustProfile, type MedicineRelationshipNotice } from '../utils/medicineTrust';
import {
  GUIDED_VERIFICATION_ENABLED_KEY,
  GUIDED_VERIFICATION_FIRST_COMPLETED_KEY,
} from '../utils/verificationPreferences';
import {
  completeFirstMedicineOnboarding,
  consumePendingFirstMedicineFlow,
  isFirstMedicineOnboardingActive,
} from '../utils/onboardingFlow';
import { borderRadius, colors, shadows, spacing, typography } from '../theme/theme';

type UploadState = 'idle' | 'preview' | 'uploading' | 'processing' | 'success' | 'error';
type ProcessingStage = 'idle' | 'uploading' | 'ocr' | 'ai' | 'saving';

type SelectedImage = {
  uri: string;
  name: string;
  type: string;
  size?: number;
};

type MedicationDraft = {
  medicine_name: string;
  brand_name: string;
  generic_name: string;
  strength: string;
  dose: string;
  dosage: string;
  frequency: string;
  timing: string;
  food_timing: string;
  duration: string;
  quantity_purchased: string;
  start_date: string;
  instructions: string;
};

function createEmptyMedicationDraft(): MedicationDraft {
  return {
    medicine_name: '',
    brand_name: '',
    generic_name: '',
    strength: '',
    dose: '',
    dosage: '',
    frequency: '',
    timing: '',
    food_timing: '',
    duration: '',
    quantity_purchased: '',
    start_date: getTodayDateValue(),
    instructions: '',
  };
}

type MedicineReviewFieldKey =
  | 'medicineName'
  | 'strength'
  | 'dose'
  | 'frequency'
  | 'timing'
  | 'foodTiming'
  | 'duration'
  | 'quantityPurchased'
  | 'startDate';

type MedicineVerificationDraft = Record<MedicineReviewFieldKey, string>;

const REVIEW_FIELD_LABELS: Record<MedicineReviewFieldKey, string> = {
  medicineName: 'Medicine name',
  strength: 'Strength',
  dose: 'Dose',
  frequency: 'Frequency',
  timing: 'Timing',
  foodTiming: 'Food timing',
  duration: 'Duration',
  quantityPurchased: 'Quantity purchased',
  startDate: 'Start date',
};

const REVIEW_FIELD_ORDER: MedicineReviewFieldKey[] = [
  'medicineName',
  'strength',
  'dose',
  'frequency',
  'timing',
  'foodTiming',
  'duration',
  'quantityPurchased',
  'startDate',
];

const UNKNOWN_ABBREVIATION_HELP = "We're not sure what this means — please check your prescription.";
const MANUAL_MEDICATION_DRAFT_KEY_PREFIX = 'swasthi.manualMedicationDraft.v1';

const FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'As needed',
  'Every other day',
  'Once a week',
  'Twice a week',
  'Other',
];

const TIMING_OPTIONS = [
  { label: 'Morning / सुबह', value: 'Morning / सुबह' },
  { label: 'Afternoon / दोपहर', value: 'Afternoon / दोपहर' },
  { label: 'Evening / शाम', value: 'Evening / शाम' },
  { label: 'Night / रात', value: 'Night / रात' },
  { label: 'Bedtime / सोते समय', value: 'Bedtime / सोते समय' },
];

const FOOD_TIMING_OPTIONS = [
  { label: 'Before food / खाने से पहले', value: 'Before food / खाने से पहले' },
  { label: 'With food / खाने के साथ', value: 'With food / खाने के साथ' },
  { label: 'After food / खाने के बाद', value: 'After food / खाने के बाद' },
  { label: 'No food instruction / भोजन निर्देश नहीं', value: 'No food instruction' },
];

type ManualDraftRecovery = {
  patientName: string;
  familyMemberId: string;
  prescriptionId?: string | null;
  editingMedicationId?: string | null;
  medication: MedicationDraft;
  updatedAt: string;
};

type PendingAddFlow = { type: 'upload'; source: 'camera' | 'gallery' } | { type: 'manual' };

function getPrimaryUpload(item?: PrescriptionHistoryItem | PrescriptionDetails | null) {
  if (!item?.prescription_uploads) return null;
  return Array.isArray(item.prescription_uploads) ? item.prescription_uploads[0] ?? null : item.prescription_uploads;
}

function formatPrescriptionDate(value?: string | null) {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  return isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatStatus(value?: string | null) {
  if (!value) return 'Pending';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeAsset(asset: ImagePicker.ImagePickerAsset): SelectedImage {
  return {
    uri: asset.uri,
    name: `prescription-${Date.now()}.jpg`,
    type: 'image/jpeg',
    size: asset.fileSize,
  };
}

function stageLabel(stage: ProcessingStage, t: (key: string) => string) {
  if (stage === 'uploading') return t('prescriptions.processingUpload');
  if (stage === 'ocr') return t('prescriptions.processingOcr');
  if (stage === 'ai') return t('prescriptions.processingAi');
  if (stage === 'saving') return t('prescriptions.processingSaving');
  return t('prescriptions.processingReady');
}

function toMedicationDraft(medication?: ParsedPrescriptionMedication | null): MedicationDraft {
  if (!medication) {
    return createEmptyMedicationDraft();
  }

  return {
    medicine_name: medication.medicine_name ?? '',
    brand_name: medication.brand_name ?? '',
    generic_name: medication.generic_name ?? '',
    strength: medication.strength ?? medication.dosage ?? '',
    dose: medication.dose ?? medication.dosage ?? '',
    dosage: medication.dosage ?? '',
    frequency: medication.frequency ?? '',
    timing: medication.timing ?? medication.food_timing ?? '',
    food_timing: medication.food_timing ?? '',
    duration: medication.duration ?? '',
    quantity_purchased: medication.quantity_purchased ? String(medication.quantity_purchased) : '',
    start_date: medication.start_date ?? getTodayDateValue(),
    instructions: medication.instructions ?? '',
  };
}

function normalizeWhitespace(value?: string | null) {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function getMedicineTitle(medication: ParsedPrescriptionMedication) {
  const name = normalizeWhitespace(medication.medicine_name) || 'Medicine under review';
  const dosage = normalizeWhitespace(medication.dosage);
  return dosage && !includesText(name.toLowerCase(), dosage.toLowerCase()) ? `${name} ${dosage}` : name;
}

function getActiveIngredient(medication: ParsedPrescriptionMedication) {
  if (normalizeWhitespace(medication.generic_name)) {
    return normalizeWhitespace(medication.generic_name);
  }

  const match = medication.medicine_name.match(/\(([^)]+)\)/);
  return match?.[1]?.trim() ?? '';
}

function getMedicineBadge(medication: ParsedPrescriptionMedication) {
  const duration = normalizeWhitespace(medication.duration);
  const frequency = normalizeWhitespace(medication.frequency);
  const timing = normalizeWhitespace(medication.timing || medication.food_timing);
  return duration || frequency || timing || 'Prescription review';
}

function getConfidenceLabel(score?: number | null, requiresManualVerification?: boolean | null) {
  if (requiresManualVerification) return 'Needs review';
  if (score === null || score === undefined) return 'Needs review';
  return 'Review before saving';
}

function getHowToTakeText(medication: ParsedPrescriptionMedication) {
  const parts = [
    medication.dosage ? `Take ${normalizeWhitespace(medication.dosage)}` : '',
    normalizeWhitespace(medication.frequency),
    normalizeWhitespace(medication.timing || medication.food_timing),
    normalizeWhitespace(medication.duration) ? `for ${normalizeWhitespace(medication.duration)}` : '',
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(', ');
  }

  const instruction = normalizeWhitespace(medication.instructions);
  if (instruction && instruction.length <= 80) {
    return instruction;
  }

  return 'Follow the prescription instructions.';
}

function getScheduleHighlight(medication: ParsedPrescriptionMedication) {
  const frequency = normalizeWhitespace(medication.frequency);
  const timing = normalizeWhitespace(medication.timing || medication.food_timing);
  const duration = normalizeWhitespace(medication.duration);

  return frequency || timing || duration || 'See prescription';
}

function getUseTags(medication: ParsedPrescriptionMedication) {
  const tags = [
    normalizeWhitespace(medication.dosage) && `Dose: ${normalizeWhitespace(medication.dosage)}`,
    normalizeWhitespace(medication.frequency) && `Frequency: ${normalizeWhitespace(medication.frequency)}`,
    normalizeWhitespace(medication.timing || medication.food_timing) &&
      `Timing: ${normalizeWhitespace(medication.timing || medication.food_timing)}`,
    normalizeWhitespace(medication.duration) && `Duration: ${normalizeWhitespace(medication.duration)}`,
  ].filter((value): value is string => Boolean(value));

  if (tags.length > 0) {
    return tags.slice(0, 4);
  }

  return ['No structured schedule details found'];
}

function getImportantNotes(medication: ParsedPrescriptionMedication) {
  const notes = [
    medication.requires_manual_verification ? 'This medicine still needs manual verification against the prescription image.' : '',
  ].filter((value): value is string => Boolean(value));

  if (notes.length > 0) {
    return notes.slice(0, 3);
  }

  return [
    'Please compare this medicine with the uploaded prescription before relying on it.',
  ];
}

function getAnalysisMedicines(details?: PrescriptionDetails | null): ParsedPrescriptionMedication[] {
  if (!details) {
    return [];
  }

  const stored = (Array.isArray(details.prescription_medications) ? details.prescription_medications : []) as ParsedPrescriptionMedication[];
  const fallback =
    details.parsed_medicine_json?.medicines?.map((medicine, index) => ({
      id: `parsed-${index + 1}`,
      medicine_name: medicine.medicine_name?.trim() || '',
      generic_name: medicine.generic_name?.trim() || null,
      strength: medicine.strength?.trim() || medicine.dosage?.trim() || null,
      dose: medicine.dose?.trim() || medicine.dosage?.trim() || null,
      dosage: medicine.strength?.trim() || medicine.dose?.trim() || medicine.dosage?.trim() || null,
      frequency: medicine.frequency?.trim() || null,
      timing: medicine.timing?.trim() || null,
      food_timing: medicine.food_timing?.trim() || null,
      duration: medicine.duration?.trim() || null,
      quantity_purchased: medicine.quantity ? parsePositiveInteger(medicine.quantity) : null,
      start_date: null,
      instructions: medicine.instructions?.trim() || null,
      confidence_score: medicine.confidence_score ?? details.parsed_medicine_json?.prescription_summary?.confidence_score ?? null,
      requires_manual_verification:
        medicine.requires_manual_verification ?? (medicine.confidence ? medicine.confidence !== 'high' : true),
    })) ?? [];

  if (stored.length === 0) {
    return fallback.filter((medicine) => normalizeWhitespace(medicine.medicine_name));
  }

  return stored.map((medicine, index) => {
    const fallbackMedicine = fallback[index];
    return {
      ...medicine,
      id: medicine.id || fallbackMedicine?.id || `stored-${index + 1}`,
      medicine_name: normalizeWhitespace(medicine.medicine_name) || fallbackMedicine?.medicine_name || '',
      generic_name: medicine.generic_name ?? fallbackMedicine?.generic_name ?? null,
      strength: medicine.strength ?? fallbackMedicine?.strength ?? null,
      dose: medicine.dose ?? fallbackMedicine?.dose ?? null,
      dosage: medicine.dosage ?? fallbackMedicine?.dosage ?? null,
      frequency: medicine.frequency ?? fallbackMedicine?.frequency ?? null,
      timing: medicine.timing ?? fallbackMedicine?.timing ?? null,
      food_timing: medicine.food_timing ?? fallbackMedicine?.food_timing ?? null,
      duration: medicine.duration ?? fallbackMedicine?.duration ?? null,
      quantity_purchased: medicine.quantity_purchased ?? fallbackMedicine?.quantity_purchased ?? null,
      start_date: medicine.start_date ?? fallbackMedicine?.start_date ?? null,
      instructions: medicine.instructions ?? fallbackMedicine?.instructions ?? null,
      confidence_score: medicine.confidence_score ?? fallbackMedicine?.confidence_score ?? null,
      requires_manual_verification:
        medicine.requires_manual_verification ?? fallbackMedicine?.requires_manual_verification ?? true,
    };
  });
}

function getPrescriptionAnalysisMeta(details?: PrescriptionDetails | null) {
  const summary = details?.parsed_medicine_json?.prescription_summary;
  const rawSummary = normalizeWhitespace(details?.parsed_medicine_json?.raw_detected_text_summary);
  const importantNotes = (details?.parsed_medicine_json?.important_notes?.filter(Boolean) ?? [])
    .map((note) => normalizeWhitespace(note))
    .filter((note, index, array) => Boolean(note) && array.indexOf(note) === index && note !== rawSummary);

  return {
    totalMedicines: summary?.total_medicines ?? null,
    confidenceScore: summary?.confidence_score ?? null,
    importantNotes,
    rawSummary,
    ocrQuality: details?.parsed_medicine_json?.ocr_quality ?? null,
  };
}

function isLikelyHandwrittenPrescription(details?: PrescriptionDetails | null) {
  const quality = details?.parsed_medicine_json?.ocr_quality;
  const confidence = details?.parsed_medicine_json?.prescription_summary?.confidence_score;
  return quality === 'low' || (typeof confidence === 'number' && confidence < 0.75);
}

function shouldFlagMedicineField() {
  return true;
}

function getMedicineReviewFields(medication: ParsedPrescriptionMedication) {
  const draft = createVerificationDraft(medication);
  return getDraftReviewFields(draft);
}

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function splitStrengthAndDose(medication: ParsedPrescriptionMedication) {
  const dosage = normalizeWhitespace(medication.dosage);
  return {
    strength: normalizeWhitespace(medication.strength) || dosage,
    dose: normalizeWhitespace(medication.dose) || dosage,
  };
}

function createVerificationDraft(medication: ParsedPrescriptionMedication): MedicineVerificationDraft {
  const dosageParts = splitStrengthAndDose(medication);
  return {
    medicineName: normalizeWhitespace(medication.medicine_name),
    strength: dosageParts.strength,
    dose: dosageParts.dose,
    frequency: normalizeWhitespace(medication.frequency),
    timing: normalizeWhitespace(medication.timing),
    foodTiming: normalizeWhitespace(medication.food_timing),
    duration: normalizeWhitespace(medication.duration),
    quantityPurchased: medication.quantity_purchased ? String(medication.quantity_purchased) : '',
    startDate: normalizeWhitespace(medication.start_date) || getTodayDateValue(),
  };
}

function getDraftReviewFields(draft: MedicineVerificationDraft) {
  const fields: Array<{
    key: MedicineReviewFieldKey;
    label: string;
    value: string;
    shouldVerify: boolean;
  }> = REVIEW_FIELD_ORDER.map((key) => ({
    key,
    label: REVIEW_FIELD_LABELS[key],
    value: draft[key],
    shouldVerify: shouldFlagMedicineField(),
  }));

  return fields;
}

function getMedicationDraftPayload(draft: MedicineVerificationDraft) {
  const strength = normalizeWhitespace(draft.strength);
  const dose = normalizeWhitespace(draft.dose);
  const dosage = strength && dose && strength !== dose ? `${dose} ${strength}` : dose || strength;

  return {
    medicine_name: normalizeWhitespace(draft.medicineName) || 'Medicine under review',
    dosage: dosage || undefined,
    strength: strength || undefined,
    dose: dose || undefined,
    frequency: normalizeWhitespace(draft.frequency) || undefined,
    timing: normalizeWhitespace(draft.timing) || undefined,
    food_timing: normalizeWhitespace(draft.foodTiming) || undefined,
    duration: normalizeWhitespace(draft.duration) || undefined,
    quantity_purchased: parsePositiveInteger(draft.quantityPurchased) || undefined,
    start_date: getMedicationStartDate(draft),
    requires_manual_verification: false,
    verification_status: 'user_verified' as const,
    confidence_score: 1,
  };
}

function getMedicationStartDate(draft: MedicineVerificationDraft) {
  return normalizeWhitespace(draft.startDate) || getTodayDateValue();
}

function getManualDraftStorageKey(familyMemberId?: string | null) {
  return `${MANUAL_MEDICATION_DRAFT_KEY_PREFIX}:${familyMemberId || 'single-patient'}`;
}

function hasManualMedicationContent(draft: MedicationDraft) {
  return Object.entries(draft).some(([key, value]) => key !== 'start_date' && normalizeWhitespace(value));
}

function getManualMedicationDosage(draft: MedicationDraft) {
  const strength = normalizeWhitespace(draft.strength);
  const dose = normalizeWhitespace(draft.dose);
  const dosage = normalizeWhitespace(draft.dosage);
  if (dose && strength && dose !== strength) return `${dose} ${strength}`;
  return dose || strength || dosage;
}

function getCatalogQueryForMedication(input: {
  medicineName?: string | null;
  medicine_name?: string | null;
  brandName?: string | null;
  brand_name?: string | null;
  genericName?: string | null;
  generic_name?: string | null;
}) {
  return (
    normalizeWhitespace(input.brandName || input.brand_name) ||
    normalizeWhitespace(input.medicineName || input.medicine_name) ||
    normalizeWhitespace(input.genericName || input.generic_name)
  );
}

function isInsulinOrInjectableDiabetesMedicine(input: {
  medicineName?: string | null;
  brandName?: string | null;
  genericName?: string | null;
  form?: string | null;
  category?: string | null;
  medicineType?: string | null;
}) {
  const text = normalizeWhitespace(
    [
      input.medicineName,
      input.brandName,
      input.genericName,
      input.form,
      input.category,
      input.medicineType,
    ]
      .filter(Boolean)
      .join(' '),
  ).toLowerCase();
  return /insulin|injectable diabetes|injection/.test(text) && /insulin|diabetes/.test(text);
}

function estimateDailyDepletion(frequency: string) {
  const normalized = normalizeWhitespace(frequency).toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('four')) return 4;
  if (normalized.includes('three')) return 3;
  if (normalized.includes('twice') || normalized.includes('2 times')) return 2;
  if (normalized.includes('every other')) return 0.5;
  if (normalized.includes('once a week')) return 1 / 7;
  if (normalized.includes('twice a week')) return 2 / 7;
  if (normalized.includes('once') || normalized.includes('daily')) return 1;
  return null;
}

function getProjectedRunoutDate(quantity: number, dailyDepletion: number | null) {
  if (!dailyDepletion || dailyDepletion <= 0) return undefined;
  const days = Math.floor(quantity / dailyDepletion);
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getPrescriptionImageUri(details?: PrescriptionDetails | null, selected?: SelectedImage | null) {
  return details?.image_url || selected?.uri || '';
}

function getDecodeFailureMessage(details?: PrescriptionDetails | null) {
  const upload = getPrimaryUpload(details);
  const uploadError = normalizeWhitespace(upload?.last_error);
  if (uploadError) {
    return uploadError;
  }

  const note = details?.parsed_medicine_json?.important_notes
    ? findFirst(details.parsed_medicine_json.important_notes, (value) => Boolean(normalizeWhitespace(value)))
    : null;
  if (note) {
    return note;
  }

  return 'We could not clearly read this prescription. Please upload a clearer image.';
}

function isPrescriptionVerified(status?: string | null) {
  return Boolean(status && ['user_verified', 'pharmacist_verified', 'doctor_verified'].includes(status));
}

function buildMedicationLine(medication: ParsedPrescriptionMedication) {
  const title = getMedicineTitle(medication);
  const details = [
    normalizeWhitespace(medication.frequency),
    normalizeWhitespace(medication.timing || medication.food_timing),
    normalizeWhitespace(medication.duration) ? `for ${normalizeWhitespace(medication.duration)}` : '',
  ].filter(Boolean);

  return details.length > 0 ? `${title}: ${details.join(', ')}` : title;
}

function buildRenoItShareText(details: PrescriptionDetails, medicines: ParsedPrescriptionMedication[]) {
  const patientName = details.family_members?.full_name?.trim() || 'Family member';
  const doctorLabel = normalizeWhitespace(details.doctor_name || details.hospital_name) || 'Doctor not listed';
  const dateLabel = formatPrescriptionDate(details.prescription_date);
  const summaryLines = medicines.slice(0, 4).map((medicine, index) => `${index + 1}. ${buildMedicationLine(medicine)}`);
  const notes = medicines
    .map((medicine) => normalizeWhitespace(medicine.instructions))
    .filter(Boolean)
    .slice(0, 2);

  return [
    `Prescription decoded for ${patientName}`,
    `Doctor/Clinic: ${doctorLabel}`,
    `Date: ${dateLabel}`,
    '',
    'Medicines:',
    ...(summaryLines.length > 0 ? summaryLines : ['1. Prescription details need manual review before sharing.']),
    ...(notes.length > 0 ? ['', `Notes: ${notes.join(' | ')}`] : []),
    '',
    RENO_IT_BADGE_LABEL,
    RENO_IT_BADGE_CTA,
    RENO_IT_LANDING_URL,
  ].join('\n');
}

function getRenoItTimingBadge(medication: ParsedPrescriptionMedication) {
  const timing = normalizeWhitespace(medication.timing || medication.food_timing);
  if (timing) return timing;

  const frequency = normalizeWhitespace(medication.frequency);
  if (frequency) return frequency;

  return 'As directed';
}

function getRenoItInstructionLine(medication: ParsedPrescriptionMedication) {
  const parts = [
    normalizeWhitespace(medication.instructions),
    normalizeWhitespace(medication.duration) ? `for ${normalizeWhitespace(medication.duration)}` : '',
  ].filter(Boolean);

  return parts[0] || 'Follow the prescribed dose and timing.';
}

function getPrescriptionFromApiError(error: ApiError) {
  if (!error.details || typeof error.details !== 'object') {
    return null;
  }

  const details = error.details as { prescription?: PrescriptionDetails };
  return details.prescription ?? null;
}

async function prepareImageForUpload(asset: ImagePicker.ImagePickerAsset): Promise<SelectedImage> {
  const resizedWidth = asset.width && asset.width > 1800 ? 1800 : undefined;
  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    resizedWidth ? [{ resize: { width: resizedWidth } }] : [],
    {
      compress: 0.82,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return normalizeAsset({
    ...asset,
    uri: manipulated.uri,
    fileName: `prescription-${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
    fileSize: undefined,
  });
}

export default function PrescriptionHubScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { prescriptions, familyMembers, schedules, isLoading, error, refreshAll } = useAppData();
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [upgradeMessage, setUpgradeMessage] = useState('');
  const [decodedPrescription, setDecodedPrescription] = useState<PrescriptionDetails | null>(null);
  const [ocrPreviewText, setOcrPreviewText] = useState('');
  const [manualMedication, setManualMedication] = useState<MedicationDraft>(createEmptyMedicationDraft());
  const [editingMedicationId, setEditingMedicationId] = useState<string | null>(null);
  const [isManualFormVisible, setIsManualFormVisible] = useState(false);
  const [manualMedicationError, setManualMedicationError] = useState('');
  const [manualDraftRecovery, setManualDraftRecovery] = useState<ManualDraftRecovery | null>(null);
  const [selectedMedicineStrengths, setSelectedMedicineStrengths] = useState<string[]>([]);
  const [isSavingMedication, setIsSavingMedication] = useState(false);
  const [showOcrDetails, setShowOcrDetails] = useState(false);
  const [isRenoItModalVisible, setIsRenoItModalVisible] = useState(false);
  const [isRenoItSharing, setIsRenoItSharing] = useState(false);
  const [verificationDrafts, setVerificationDrafts] = useState<Record<string, MedicineVerificationDraft>>({});
  const [isGuidedVerificationEnabled, setIsGuidedVerificationEnabled] = useState(false);
  const [isVerificationPreferenceLoaded, setIsVerificationPreferenceLoaded] = useState(false);
  const [guidedMedicineIndex, setGuidedMedicineIndex] = useState(0);
  const [guidedFieldIndex, setGuidedFieldIndex] = useState(0);
  const [guidedEditingField, setGuidedEditingField] = useState<MedicineReviewFieldKey | null>(null);
  const [abbreviationTooltip, setAbbreviationTooltip] = useState('');
  const [isPrescriptionModalVisible, setIsPrescriptionModalVisible] = useState(false);
  const [activatingMedicationId, setActivatingMedicationId] = useState<string | null>(null);
  const [activatedMedicationIds, setActivatedMedicationIds] = useState<Set<string>>(() => new Set());
  const [decimalDoseConfirmations, setDecimalDoseConfirmations] = useState<Set<string>>(() => new Set());
  const [activationError, setActivationError] = useState('');
  const [pendingAddFlow, setPendingAddFlow] = useState<PendingAddFlow | null>(null);
  const [isFirstMedicineFlowActive, setIsFirstMedicineFlowActive] = useState(false);
  const [reconciliationMode, setReconciliationMode] = useState<'updates_current' | 'adds_alongside' | null>(null);
  const [reconciliationActions, setReconciliationActions] = useState<Record<string, 'keep_active' | 'discontinue'>>({});
  const [isSavingReconciliation, setIsSavingReconciliation] = useState(false);
  const [reconciliationSaved, setReconciliationSaved] = useState(false);
  const [relationshipConfirmations, setRelationshipConfirmations] = useState<Record<string, string>>({});
  const renoItCardRef = useRef<View | null>(null);
  const lastManualExcludedSignalRef = useRef('');

  const targetFamilyMember = familyMembers[0] ?? null;
  const activeSchedulesForPatient = useMemo(
    () => schedules.filter((schedule) => schedule.family_member_id === targetFamilyMember?.id && (schedule.status ?? 'active') === 'active'),
    [schedules, targetFamilyMember?.id],
  );
  const activeMedicationRelationshipInputs = useMemo(
    () =>
      activeSchedulesForPatient.map((schedule) => ({
        id: schedule.id,
        scheduleId: schedule.id,
        prescriptionMedicationId: schedule.prescription_medication_id ?? null,
        prescriptionId: schedule.prescription_medications?.prescription_id ?? null,
        medicineName: schedule.prescription_medications?.medicine_name ?? '',
        brandName: schedule.prescription_medications?.brand_name ?? '',
        genericName: schedule.prescription_medications?.generic_name ?? '',
        strength: schedule.prescription_medications?.strength ?? '',
        dosage: schedule.prescription_medications?.dosage ?? '',
      })),
    [activeSchedulesForPatient],
  );
  const recentPrescriptions = useMemo(() => {
    const merged =
      decodedPrescription && !prescriptions.some((item) => item.id === decodedPrescription.id)
        ? [decodedPrescription, ...prescriptions]
        : prescriptions;
    return merged.slice(0, 3);
  }, [decodedPrescription, prescriptions]);
  const decodedMedicines = getAnalysisMedicines(decodedPrescription);
  const cleanedOcrText = decodedPrescription?.cleaned_ocr_text ?? decodedPrescription?.raw_ocr_text ?? ocrPreviewText;
  const prescriptionAnalysisMeta = getPrescriptionAnalysisMeta(decodedPrescription);
  const isDecodedPrescriptionVerified = isPrescriptionVerified(decodedPrescription?.verification_status);
  const hasShareRisk =
    !isDecodedPrescriptionVerified || decodedMedicines.some((medicine) => medicine.requires_manual_verification);
  const renoItShareText = decodedPrescription ? buildRenoItShareText(decodedPrescription, decodedMedicines) : '';
  const pipelineMeta = [
    decodedPrescription?.ai_provider ? `AI: ${decodedPrescription.ai_provider}` : null,
    decodedPrescription?.ai_model ? `Model: ${decodedPrescription.ai_model}` : null,
    decodedPrescription?.parse_status ? `Status: ${formatStatus(decodedPrescription.parse_status)}` : null,
    prescriptionAnalysisMeta.ocrQuality ? `OCR: ${formatStatus(prescriptionAnalysisMeta.ocrQuality)}` : null,
  ].filter((value): value is string => Boolean(value));
  const emptyAnalysisFallback =
    prescriptionAnalysisMeta.rawSummary ||
    prescriptionAnalysisMeta.importantNotes[0] ||
    cleanedOcrText ||
    t('prescriptions.retryHelp');
  const prescriptionImageUri = getPrescriptionImageUri(decodedPrescription, selectedImage);
  const shouldUseGuidedVerification =
    isVerificationPreferenceLoaded && isGuidedVerificationEnabled && decodedMedicines.length > 0;
  const medicineSearchResults = useMemo(
    () => searchIndianMedicines(manualMedication.medicine_name, 8),
    [manualMedication.medicine_name],
  );
  const manualCatalogMedicine = useMemo(
    () => findIndianMedicine(getCatalogQueryForMedication({
      medicineName: manualMedication.medicine_name,
      brandName: manualMedication.brand_name,
      genericName: manualMedication.generic_name,
    })),
    [manualMedication.brand_name, manualMedication.generic_name, manualMedication.medicine_name],
  );
  const manualSupportSafety = getSupportModeSafety(manualCatalogMedicine || 'recognition_only');
  const manualNeedsHighRiskMessage =
    manualSupportSafety.supportMode === 'manual_only_high_risk' ||
    isInsulinOrInjectableDiabetesMedicine({
      medicineName: manualMedication.medicine_name,
      brandName: manualMedication.brand_name,
      genericName: manualMedication.generic_name,
      form: manualCatalogMedicine?.form,
      category: manualCatalogMedicine?.category,
      medicineType: manualCatalogMedicine?.medicineType,
    });
  const manualExcludedSignal = detectExcludedMedicine({
    medicineName: manualMedication.medicine_name,
    brandName: manualMedication.brand_name,
    genericName: manualMedication.generic_name,
    instructions: manualMedication.instructions,
  });
  const manualTrustProfile = useMemo(
    () =>
      getMedicineTrustProfile({
        medicineName: manualMedication.medicine_name,
        brandName: manualMedication.brand_name,
        genericName: manualMedication.generic_name,
        strength: manualMedication.strength,
        dosage: getManualMedicationDosage(manualMedication),
      }),
    [manualMedication],
  );
  const manualRelationshipNotices = useMemo(
    () =>
      evaluateMedicineRelationships(
        {
          medicineName: manualMedication.medicine_name,
          brandName: manualMedication.brand_name,
          genericName: manualMedication.generic_name,
          strength: manualMedication.strength,
          dosage: getManualMedicationDosage(manualMedication),
        },
        activeMedicationRelationshipInputs,
      ),
    [activeMedicationRelationshipInputs, manualMedication],
  );

  const persistManualMedicationDraft = async () => {
    if (!targetFamilyMember || !hasManualMedicationContent(manualMedication)) return;
    const draft: ManualDraftRecovery = {
      patientName: targetFamilyMember.full_name || 'this patient',
      familyMemberId: targetFamilyMember.id,
      prescriptionId: decodedPrescription?.id ?? null,
      editingMedicationId,
      medication: manualMedication,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.removeItem(getManualDraftStorageKey(targetFamilyMember.id));
    await SecureStore.setItemAsync(getManualDraftStorageKey(targetFamilyMember.id), JSON.stringify(draft));
    trackEvent('manual_medicine_draft_saved', {
      family_member_id: targetFamilyMember.id,
      prescription_id: decodedPrescription?.id ?? null,
      has_prescription_context: Boolean(decodedPrescription?.id),
    });
  };

  const clearManualMedicationDraft = async () => {
    if (!targetFamilyMember) return;
    await AsyncStorage.removeItem(getManualDraftStorageKey(targetFamilyMember.id));
    await SecureStore.deleteItemAsync(getManualDraftStorageKey(targetFamilyMember.id));
    setManualDraftRecovery(null);
  };

  const updateManualMedication = (patch: Partial<MedicationDraft>) => {
    setManualMedication((current) => ({ ...current, ...patch }));
  };

  useEffect(() => {
    let isMounted = true;

    const loadGuidedPreference = async () => {
      try {
        const [explicitPreference, firstCompleted] = await Promise.all([
          AsyncStorage.getItem(GUIDED_VERIFICATION_ENABLED_KEY),
          AsyncStorage.getItem(GUIDED_VERIFICATION_FIRST_COMPLETED_KEY),
        ]);

        if (!isMounted) return;

        if (explicitPreference === null) {
          setIsGuidedVerificationEnabled(firstCompleted !== 'true');
        } else {
          setIsGuidedVerificationEnabled(explicitPreference === 'true');
        }
      } catch {
        if (isMounted) {
          setIsGuidedVerificationEnabled(true);
        }
      } finally {
        if (isMounted) {
          setIsVerificationPreferenceLoaded(true);
        }
      }
    };

    void loadGuidedPreference();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setVerificationDrafts((current) => {
      const next: Record<string, MedicineVerificationDraft> = {};
      decodedMedicines.forEach((medicine) => {
        next[medicine.id] = current[medicine.id] ?? createVerificationDraft(medicine);
      });
      return next;
    });
  }, [decodedPrescription?.id, decodedMedicines.length]);

  useEffect(() => {
    setGuidedMedicineIndex(0);
    setGuidedFieldIndex(0);
    setGuidedEditingField(null);
    setActivationError('');
    setActivatedMedicationIds(new Set());
    setDecimalDoseConfirmations(new Set());
    setRelationshipConfirmations({});
    setReconciliationActions({});
    setReconciliationSaved(false);
  }, [decodedPrescription?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadManualDraft = async () => {
      if (!targetFamilyMember?.id) return;
      try {
        await AsyncStorage.removeItem(getManualDraftStorageKey(targetFamilyMember.id));
        const stored = await SecureStore.getItemAsync(getManualDraftStorageKey(targetFamilyMember.id));
        if (!isMounted || !stored) return;
        const parsed = JSON.parse(stored) as ManualDraftRecovery;
        if (parsed?.familyMemberId === targetFamilyMember.id && hasManualMedicationContent(parsed.medication)) {
          setManualDraftRecovery(parsed);
        }
      } catch {
        if (isMounted) {
          setManualDraftRecovery(null);
        }
      }
    };

    void loadManualDraft();

    return () => {
      isMounted = false;
    };
  }, [targetFamilyMember?.id]);

  useEffect(() => {
    if (!isManualFormVisible || !hasManualMedicationContent(manualMedication)) return undefined;
    const timeout = setTimeout(() => {
      void persistManualMedicationDraft();
    }, 700);
    return () => clearTimeout(timeout);
  }, [isManualFormVisible, manualMedication, decodedPrescription?.id, targetFamilyMember?.id, editingMedicationId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if ((state === 'background' || state === 'inactive') && isManualFormVisible && hasManualMedicationContent(manualMedication)) {
        void persistManualMedicationDraft();
      }
    });
    return () => subscription.remove();
  }, [isManualFormVisible, manualMedication, decodedPrescription?.id, targetFamilyMember?.id, editingMedicationId]);

  useEffect(() => {
    if (!manualExcludedSignal || !isManualFormVisible) return;
    const signalKey = `${manualExcludedSignal.category}:${manualExcludedSignal.matchedTerm}`;
    if (lastManualExcludedSignalRef.current === signalKey) return;
    lastManualExcludedSignalRef.current = signalKey;
    trackEvent('excluded_medicine_attempted', {
      source: 'manual_entry_detection',
      category: manualExcludedSignal.category,
      matched_term: manualExcludedSignal.matchedTerm,
      prescription_id: decodedPrescription?.id ?? null,
    });
  }, [manualExcludedSignal, isManualFormVisible, decodedPrescription?.id]);

  const requestCameraPermission = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    return permission.granted;
  };

  const requestGalleryPermission = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return permission.granted;
  };

  const beginAddFlow = (flow: PendingAddFlow) => {
    setUploadError('');
    if (activeSchedulesForPatient.length > 0 && reconciliationMode === null) {
      setPendingAddFlow(flow);
      trackEvent('prescription_reconciliation_interstitial_seen', {
        family_member_id: targetFamilyMember?.id ?? null,
        active_schedule_count: activeSchedulesForPatient.length,
        flow_type: flow.type,
      });
      return;
    }

    if (flow.type === 'upload') {
      void selectImage(flow.source);
      return;
    }

    void openManualEntryOption();
  };

  const continuePendingAddFlow = (mode: 'updates_current' | 'adds_alongside') => {
    const flow = pendingAddFlow;
    setReconciliationMode(mode);
    setPendingAddFlow(null);
    trackEvent('prescription_reconciliation_choice_made', {
      family_member_id: targetFamilyMember?.id ?? null,
      active_schedule_count: activeSchedulesForPatient.length,
      mode,
      flow_type: flow?.type ?? null,
    });

    if (!flow) return;
    if (flow.type === 'upload') {
      void selectImage(flow.source);
    } else {
      void openManualEntryOption();
    }
  };

  useEffect(() => {
    let isMounted = true;

    const openPendingFlow = async () => {
      if (!targetFamilyMember) return;
      const flow = await consumePendingFirstMedicineFlow();
      const firstMedicineFlowActive = await isFirstMedicineOnboardingActive();
      if (!isMounted || !flow) return;
      setIsFirstMedicineFlowActive(firstMedicineFlowActive);
      beginAddFlow(flow === 'upload' ? { type: 'upload', source: 'gallery' } : { type: 'manual' });
    };

    void openPendingFlow();

    return () => {
      isMounted = false;
    };
  }, [targetFamilyMember?.id]);

  const selectImage = async (source: 'camera' | 'gallery') => {
    setUploadError('');
    setDecodedPrescription(null);
    setOcrPreviewText('');
    setManualMedication(createEmptyMedicationDraft());
    setSelectedMedicineStrengths([]);
    setEditingMedicationId(null);
    setIsManualFormVisible(false);
    setManualMedicationError('');
    setShowOcrDetails(false);
    setProcessingStage('idle');
    setUploadProgress(0);

    try {
      let finalImage: SelectedImage | null = null;

      if (source === 'camera') {
        const scannerResult = await DocumentScanner.scanDocument({
          maxNumDocuments: 1,
          letUserAdjustCrop: true,
        } as any);

        if (scannerResult.scannedImages && scannerResult.scannedImages.length > 0) {
          const uri = scannerResult.scannedImages[0];
          finalImage = {
            uri,
            name: `prescription-${Date.now()}.jpg`,
            type: 'image/jpeg',
          };
        }
      } else {
        const hasPermission = await requestGalleryPermission();
        if (!hasPermission) {
          setUploadState('error');
          setUploadError('Photo library permission is required to upload a prescription.');
          return;
        }

        const pickerResult = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: false,
          mediaTypes: ['images'],
          quality: 0.82,
          selectionLimit: 1,
        });

        if (!pickerResult.canceled && pickerResult.assets?.[0]) {
          finalImage = await prepareImageForUpload(pickerResult.assets[0]);
        }
      }

      if (!finalImage) {
        return; // User canceled
      }

      setSelectedImage(finalImage);
      setUploadState('preview');

      setTimeout(() => {
        void uploadAndParse(finalImage);
      }, 250);
    } catch (pickerError) {
      setUploadState('error');
      setUploadError(pickerError instanceof Error ? pickerError.message : 'Unable to open image scanner.');
    }
  };

  const uploadAndParse = async (imageOverride?: SelectedImage) => {
    const imageToUpload = imageOverride ?? selectedImage;

    if (!imageToUpload) {
      setUploadError('Choose a prescription image first.');
      setUploadState('error');
      return;
    }

    if (!targetFamilyMember) {
      setUploadError('Add a person you are caring for before uploading prescriptions.');
      setUploadState('error');
      return;
    }

    setUploadState('uploading');
    setProcessingStage('uploading');
    setUploadProgress(0.08);
    setUploadError('');
    setDecodedPrescription(null);
    setOcrPreviewText('');
    setManualMedication(createEmptyMedicationDraft());
    setSelectedMedicineStrengths([]);
    setEditingMedicationId(null);
    setIsManualFormVisible(false);
    setManualMedicationError('');
    setShowOcrDetails(false);

    let decodeStageTimer: ReturnType<typeof setTimeout> | undefined;
    let aiStageTimer: ReturnType<typeof setTimeout> | undefined;
    let extractedText = '';

    try {
      decodeStageTimer = setTimeout(() => {
        setUploadState('processing');
        setProcessingStage('ocr');
        setUploadProgress((current) => Math.max(current, 0.42));
      }, 200);

      // Perform Edge OCR using ML Kit Text Recognition
      try {
        const result = await TextRecognition.recognize(imageToUpload.uri);
        if (result && result.text) {
          extractedText = result.text;
          trackEvent('edge_ocr_success', { text_length: extractedText.length });
        }
      } catch (ocrError) {
        console.warn('Edge OCR failed, falling back to server OCR', ocrError);
        trackEvent('edge_ocr_failed', { error: String(ocrError) });
      }

      setUploadProgress((current) => Math.max(current, 0.62));

      aiStageTimer = setTimeout(() => {
        setUploadState('processing');
        setProcessingStage('ai');
        setUploadProgress((current) => Math.max(current, 0.82));
      }, 1000);

      // Pass the extractedText to the backend
      const scanResult: ScanPrescriptionResponse = await scanPrescription(imageToUpload.uri, targetFamilyMember.id, extractedText);

      clearTimeout(decodeStageTimer);
      clearTimeout(aiStageTimer);

      setProcessingStage('saving');
      setUploadProgress(0.92);

      const details = scanResult.prescription ?? null;
      setDecodedPrescription(details);
      setOcrPreviewText(scanResult.rawText ?? details?.cleaned_ocr_text ?? details?.raw_ocr_text ?? '');
      setUploadProgress(1);
      const decodedMedicineCount = details ? getAnalysisMedicines(details).length : scanResult.medicines.length;
      const hasReadableOcr = Boolean(normalizeWhitespace(scanResult.rawText ?? details?.cleaned_ocr_text ?? details?.raw_ocr_text));
      if (!hasReadableOcr || !scanResult.success && scanResult.error === 'OCR_FAILED') {
        setUploadState('error');
        setUploadError(scanResult.message || (details ? getDecodeFailureMessage(details) : 'We could not clearly read this prescription. Please upload a clearer image.'));
      } else {
        setUploadState('success');
        setUploadError(
          decodedMedicineCount === 0
            ? scanResult.message || 'OCR text was read, but no medicines were confidently extracted. Review the OCR text or add medicines manually.'
            : '',
        );
      }
      await refreshAll();
    } catch (uploadFailure) {
      if (decodeStageTimer) clearTimeout(decodeStageTimer);
      if (aiStageTimer) clearTimeout(aiStageTimer);
      if (uploadFailure instanceof ApiError && uploadFailure.statusCode === 0) {
        setUploadState('error');
        setProcessingStage('idle');
        setUploadProgress(0);
        setUploadError('This needs an internet connection.');
        return;
      }

      if (uploadFailure instanceof ApiError && uploadFailure.statusCode === 402) {
        setUpgradeMessage(uploadFailure.message);
        setUploadState('idle');
        setProcessingStage('idle');
        setUploadProgress(0);
        return;
      }

      if (uploadFailure instanceof ApiError && uploadFailure.statusCode === 422) {
        const failedPrescription = getPrescriptionFromApiError(uploadFailure);
        if (failedPrescription) {
          setDecodedPrescription(failedPrescription);
          setOcrPreviewText(failedPrescription.cleaned_ocr_text ?? failedPrescription.raw_ocr_text ?? '');
        }
        setUploadState('error');
        setProcessingStage('idle');
        setUploadProgress(failedPrescription ? 1 : 0);
        setUploadError(uploadFailure.message || getDecodeFailureMessage(failedPrescription));
        await refreshAll();
        return;
      }

      setUploadState('error');
      setProcessingStage('idle');
      setUploadProgress(0);
      setUploadError(
        uploadFailure instanceof Error
          ? uploadFailure.message
          : 'Prescription upload failed. Please retry with a clearer image.',
      );
    }
  };

  const resetUpload = () => {
    setUploadState('idle');
    setProcessingStage('idle');
    setUploadProgress(0);
    setSelectedImage(null);
    setUploadError('');
    setDecodedPrescription(null);
    setOcrPreviewText('');
    setManualMedication(createEmptyMedicationDraft());
    setSelectedMedicineStrengths([]);
    setEditingMedicationId(null);
    setIsManualFormVisible(false);
    setManualMedicationError('');
    setShowOcrDetails(false);
    setIsRenoItModalVisible(false);
    setIsRenoItSharing(false);
    setVerificationDrafts({});
    setGuidedMedicineIndex(0);
    setGuidedFieldIndex(0);
    setGuidedEditingField(null);
    setAbbreviationTooltip('');
    setIsPrescriptionModalVisible(false);
    setActivatingMedicationId(null);
    setActivatedMedicationIds(new Set());
    setActivationError('');
    setPendingAddFlow(null);
    setReconciliationMode(null);
    setReconciliationActions({});
    setReconciliationSaved(false);
    setRelationshipConfirmations({});
  };

  const openManualEntryOption = async () => {
    setUploadError('');
    setManualMedicationError('');

    if (manualDraftRecovery) {
      await restoreManualDraft();
      return;
    }

    if (decodedPrescription) {
      openMedicationEditor();
      return;
    }

    const latestPrescription = recentPrescriptions[0];
    if (latestPrescription?.id) {
      await openPrescriptionDetails(latestPrescription.id);
      setTimeout(() => openMedicationEditor(), 0);
      return;
    }

    if (!targetFamilyMember?.id) {
      setUploadState('error');
      setUploadError('Add a patient before adding medicines manually.');
      return;
    }

    try {
      const manualDraft = await api.post<PrescriptionDetails>('prescriptions/manual-draft', {
        family_member_id: targetFamilyMember.id,
      });
      setDecodedPrescription(manualDraft);
      setOcrPreviewText('');
      setSelectedImage(null);
      setUploadState('success');
      setShowOcrDetails(false);
      setProcessingStage('idle');
      setUploadProgress(1);
      setTimeout(() => openMedicationEditor(), 0);
    } catch (manualDraftError) {
      setUploadState('error');
      setUploadError(manualDraftError instanceof Error ? manualDraftError.message : 'Unable to start manual entry.');
    }
  };

  const openPrescriptionDetails = async (prescriptionId: string) => {
    setUploadError('');
    setManualMedicationError('');

    try {
      const details = await api.get<PrescriptionDetails>(`prescriptions/${prescriptionId}`);
      setDecodedPrescription(details);
      setOcrPreviewText(details.cleaned_ocr_text ?? details.raw_ocr_text ?? '');
      setSelectedImage(null);
      setUploadState('success');
      setShowOcrDetails(false);
      setProcessingStage('idle');
      setUploadProgress(1);
      setIsRenoItModalVisible(false);
      setIsRenoItSharing(false);
    } catch (loadFailure) {
      setUploadState('error');
      setUploadError(loadFailure instanceof Error ? loadFailure.message : 'Unable to load prescription details.');
    }
  };

  const openMedicationEditor = (medication?: ParsedPrescriptionMedication | null) => {
    setManualMedicationError('');
    setEditingMedicationId(medication?.id ?? null);
    setManualMedication(toMedicationDraft(medication));
    setSelectedMedicineStrengths([]);
    setIsManualFormVisible(true);
  };

  const closeMedicationEditor = async () => {
    setEditingMedicationId(null);
    setManualMedication(createEmptyMedicationDraft());
    setSelectedMedicineStrengths([]);
    setIsManualFormVisible(false);
    setManualMedicationError('');
    await clearManualMedicationDraft();
    trackEvent('manual_medicine_draft_discarded', {
      family_member_id: targetFamilyMember?.id ?? null,
      prescription_id: decodedPrescription?.id ?? null,
    });
  };

  const restoreManualDraft = async () => {
    if (!manualDraftRecovery) return;
    if (manualDraftRecovery.prescriptionId && manualDraftRecovery.prescriptionId !== decodedPrescription?.id) {
      await openPrescriptionDetails(manualDraftRecovery.prescriptionId);
    }
    setManualMedication(manualDraftRecovery.medication);
    setEditingMedicationId(manualDraftRecovery.editingMedicationId ?? null);
    setSelectedMedicineStrengths([]);
    setIsManualFormVisible(true);
    setManualMedicationError('');
    setManualDraftRecovery(null);
    trackEvent('manual_medicine_draft_restored', {
      family_member_id: manualDraftRecovery.familyMemberId,
      prescription_id: manualDraftRecovery.prescriptionId ?? null,
    });
  };

  const discardManualDraft = async () => {
    await clearManualMedicationDraft();
    setManualMedication(createEmptyMedicationDraft());
    setEditingMedicationId(null);
    setSelectedMedicineStrengths([]);
    setIsManualFormVisible(false);
    trackEvent('manual_medicine_draft_discarded', {
      family_member_id: targetFamilyMember?.id ?? null,
      prescription_id: manualDraftRecovery?.prescriptionId ?? null,
    });
  };

  const selectMedicineSuggestion = (medicine: IndianMedicineCatalogItem) => {
    updateManualMedication({
      medicine_name: medicine.brandName,
      brand_name: medicine.brandName,
      generic_name: medicine.genericName,
      strength: medicine.selectedStrength || (medicine.strengths.length === 1 ? medicine.strengths[0] : manualMedication.strength),
    });
    setSelectedMedicineStrengths(medicine.strengths.length > 1 ? medicine.strengths : []);
    trackEvent('manual_medicine_search_selected', {
      catalog_id: medicine.id,
      brand_name: medicine.brandName,
      generic_name: medicine.genericName,
      category: medicine.category,
      support_mode: medicine.supportMode,
      has_multiple_strengths: medicine.strengths.length > 1,
    });
  };

  const saveMedicationDraft = async () => {
    if (!decodedPrescription) {
      setManualMedicationError('Open a saved prescription before adding medicines.');
      return;
    }

    if (!manualMedication.medicine_name.trim()) {
      setManualMedicationError('Medicine name is required.');
      return;
    }

    if (manualExcludedSignal) {
      trackEvent('excluded_medicine_attempted', {
        source: 'manual_entry',
        category: manualExcludedSignal.category,
        matched_term: manualExcludedSignal.matchedTerm,
        prescription_id: decodedPrescription.id,
      });
    }

    const toOptional = (value: string) => {
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    };

    const payload = {
      medicine_name: manualMedication.medicine_name.trim(),
      brand_name: toOptional(manualMedication.brand_name || manualMedication.medicine_name),
      generic_name: toOptional(manualMedication.generic_name),
      strength: toOptional(manualMedication.strength),
      dose: toOptional(manualMedication.dose),
      dosage: toOptional(getManualMedicationDosage(manualMedication)),
      frequency: toOptional(manualMedication.frequency),
      timing: toOptional(manualMedication.timing),
      food_timing: toOptional(manualMedication.food_timing),
      duration: toOptional(manualMedication.duration),
      quantity_purchased: parsePositiveInteger(manualMedication.quantity_purchased) || undefined,
      start_date: toOptional(manualMedication.start_date),
      instructions: toOptional(manualMedication.instructions),
      requires_manual_verification: true,
      verification_status: 'unverified' as const,
      confidence_score: 0,
    };

    setIsSavingMedication(true);
    setManualMedicationError('');

    try {
      if (editingMedicationId) {
        await api.patch(`prescriptions/medications/${editingMedicationId}`, payload);
      } else {
        await api.post(`prescriptions/${decodedPrescription.id}/medications`, payload);
      }

      if (medicineSearchResults.length === 0) {
        trackEvent('manual_medicine_free_text_used', {
          prescription_id: decodedPrescription.id,
          medicine_name_entered: manualMedication.medicine_name.trim(),
        });
      }

      const details = await api.get<PrescriptionDetails>(`prescriptions/${decodedPrescription.id}`);
      setDecodedPrescription(details);
      setOcrPreviewText(details.cleaned_ocr_text ?? details.raw_ocr_text ?? '');
      await clearManualMedicationDraft();
      setEditingMedicationId(null);
      setManualMedication(createEmptyMedicationDraft());
      setSelectedMedicineStrengths([]);
      setIsManualFormVisible(false);
      setManualMedicationError('');
      setUploadState('success');
      setUploadError('');
      await refreshAll();
    } catch (saveFailure) {
      setManualMedicationError(saveFailure instanceof Error ? saveFailure.message : 'Unable to save the medicine.');
    } finally {
      setIsSavingMedication(false);
    }
  };

  const openRenoIt = () => {
    if (!decodedPrescription || decodedMedicines.length === 0) {
      return;
    }

    trackRenoItEvent('reno_it_opened', {
      prescription_id: decodedPrescription.id,
      verification_status: decodedPrescription.verification_status ?? 'unknown',
      medicine_count: decodedMedicines.length,
      has_share_risk: hasShareRisk,
    });
    trackRenoItEvent('reno_it_popup_seen', {
      prescription_id: decodedPrescription.id,
    });
    setIsRenoItModalVisible(true);
  };

  const shareRenoItToWhatsApp = async () => {
    if (!decodedPrescription) {
      return;
    }

    setIsRenoItSharing(true);
    trackRenoItEvent('reno_it_whatsapp_share_clicked', {
      prescription_id: decodedPrescription.id,
      share_mode: 'card_image_preferred',
    });

    try {
      let sharedAsImage = false;
      if (renoItCardRef.current && Platform.OS !== 'web') {
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          const imageUri = await captureRef(renoItCardRef, {
            format: 'png',
            quality: 1,
            result: 'tmpfile',
          });

          await Sharing.shareAsync(imageUri, {
            dialogTitle: 'Share Reno It card',
            mimeType: 'image/png',
          });
          sharedAsImage = true;
        }
      }

      if (!sharedAsImage) {
        const encodedText = encodeURIComponent(renoItShareText);
        const nativeWhatsappUrl = `whatsapp://send?text=${encodedText}`;
        const webWhatsappUrl = `https://wa.me/?text=${encodedText}`;

        let opened = false;
        if (Platform.OS !== 'web') {
          const canOpenNative = await Linking.canOpenURL(nativeWhatsappUrl);
          if (canOpenNative) {
            await Linking.openURL(nativeWhatsappUrl);
            opened = true;
          }
        }

        if (!opened) {
          const canOpenWeb = await Linking.canOpenURL(webWhatsappUrl);
          if (canOpenWeb) {
            await Linking.openURL(webWhatsappUrl);
            opened = true;
          }
        }

        if (!opened) {
          await Share.share({
            message: renoItShareText,
            title: 'Reno It',
          });
        }
      }

      trackRenoItEvent('reno_it_share_success', {
        prescription_id: decodedPrescription.id,
        share_mode: sharedAsImage ? 'card_image' : 'text_fallback',
      });
      setIsRenoItModalVisible(false);
    } catch (shareError) {
      trackRenoItEvent('reno_it_share_failed', {
        prescription_id: decodedPrescription.id,
        reason: shareError instanceof Error ? shareError.message : 'unknown_error',
      });
      setUploadError('Unable to open WhatsApp right now. Try again in a moment.');
    } finally {
      setIsRenoItSharing(false);
    }
  };

  const updateVerificationDraft = (medicationId: string, fieldKey: MedicineReviewFieldKey, value: string) => {
    const fallbackMedicine = decodedMedicines.find((medicine) => medicine.id === medicationId);
    if (!fallbackMedicine) {
      return;
    }

    setVerificationDrafts((current) => ({
      ...current,
      [medicationId]: {
        ...(current[medicationId] ?? createVerificationDraft(fallbackMedicine)),
        [fieldKey]: value,
      },
    }));
  };

  const renderAbbreviationHelp = (fieldKey: MedicineReviewFieldKey, value: string) => {
    if (!['frequency', 'timing', 'foodTiming'].includes(fieldKey)) {
      return null;
    }

    const translation = translateMedicalText(value);
    if (!translation.displayText && translation.unknownAbbreviations.length === 0) {
      return null;
    }

    return (
      <View style={styles.abbreviationHelpRow}>
        {translation.knownTranslations.length > 0 ? (
          <Text style={styles.abbreviationHelpText}>Shows as: {translation.displayText}</Text>
        ) : null}
        {translation.unknownAbbreviations.map((abbreviation) => (
          <TouchableOpacity
            key={`${fieldKey}-${abbreviation}`}
            style={styles.unknownAbbreviationButton}
            onPress={() => setAbbreviationTooltip(`${abbreviation}: ${UNKNOWN_ABBREVIATION_HELP}`)}
          >
            <Text style={styles.unknownAbbreviationText}>{abbreviation} ?</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const saveVerificationDraft = async (medicine: ParsedPrescriptionMedication, draft: MedicineVerificationDraft) => {
    await api.patch(`prescriptions/medications/${medicine.id}`, getMedicationDraftPayload(draft));
    const details = decodedPrescription ? await api.get<PrescriptionDetails>(`prescriptions/${decodedPrescription.id}`) : null;
    if (details) {
      setDecodedPrescription(details);
      setOcrPreviewText(details.cleaned_ocr_text ?? details.raw_ocr_text ?? '');
    }
    await refreshAll();
  };

  const getRelationshipNoticesForDraft = (
    medicine: ParsedPrescriptionMedication,
    draft: MedicineVerificationDraft,
  ): MedicineRelationshipNotice[] =>
    evaluateMedicineRelationships(
      {
        medicineName: draft.medicineName,
        brandName: medicine.brand_name,
        genericName: medicine.generic_name,
        strength: draft.strength,
        dosage: draft.dose || draft.strength,
      },
      activeMedicationRelationshipInputs.filter((item) => item.prescriptionMedicationId !== medicine.id),
    );

  const getRelationshipConfirmationKey = (notices: MedicineRelationshipNotice[]) =>
    notices[0]?.existingScheduleId || notices[0]?.type || 'acknowledged';

  const getReconciliationGroups = () => {
    const matched = decodedMedicines.map((medicine) => {
      const draft = verificationDrafts[medicine.id] ?? createVerificationDraft(medicine);
      return {
        medicine,
        notices: getRelationshipNoticesForDraft(medicine, draft),
      };
    });
    const matchedScheduleIds = new Set(
      matched.flatMap((item) => item.notices.map((notice) => notice.existingScheduleId).filter((id): id is string => Boolean(id))),
    );
    const oldOnly = activeMedicationRelationshipInputs.filter((item) => !matchedScheduleIds.has(item.scheduleId));

    return {
      matched: matched.filter((item) => item.notices.length > 0),
      newOnly: matched.filter((item) => item.notices.length === 0),
      oldOnly,
    };
  };

  const saveContinuityReview = async () => {
    if (!decodedPrescription) return;
    const groups = getReconciliationGroups();
    const actions: Array<Record<string, unknown>> = [
      ...groups.matched.map((item) => {
        const notice = item.notices.find((relationship) => relationship.existingScheduleId);
        const oldMedication = activeMedicationRelationshipInputs.find((active) => active.scheduleId === notice?.existingScheduleId);
        return {
          type: 'replace_existing',
          existing_medication_id: oldMedication?.prescriptionMedicationId ?? undefined,
          new_medication_id: item.medicine.id,
          stop_old: false,
          begin_date: getTodayDateValue(),
          note: 'Matched during continuity review; old schedule stops only when replacement is activated.',
        };
      }),
      ...groups.newOnly.map((item) => ({
        type: 'add_new',
        new_medication_id: item.medicine.id,
        begin_date: getTodayDateValue(),
        note: 'New medicine from continuity review; verification required before activation.',
      })),
      ...groups.oldOnly.map((item) => ({
        type: reconciliationActions[item.scheduleId] === 'discontinue' ? 'discontinue' : 'keep_active',
        existing_medication_id: item.prescriptionMedicationId ?? undefined,
        stop_old: reconciliationActions[item.scheduleId] === 'discontinue',
        begin_date: getTodayDateValue(),
        note:
          reconciliationActions[item.scheduleId] === 'discontinue'
            ? 'Caregiver marked old-only medicine to stop during continuity review.'
            : 'Caregiver kept old-only medicine active during continuity review.',
      })),
    ].filter((action) => ('existing_medication_id' in action && action.existing_medication_id) || ('new_medication_id' in action && action.new_medication_id));
    const supersededPrescriptionIds = Array.from(
      new Set(
        [...groups.matched, ...groups.oldOnly]
          .map((item: any) => item.prescriptionId || activeMedicationRelationshipInputs.find((active) => active.scheduleId === item.notices?.[0]?.existingScheduleId)?.prescriptionId)
          .filter((id): id is string => Boolean(id && id !== decodedPrescription.id)),
      ),
    );

    setIsSavingReconciliation(true);
    setActivationError('');
    try {
      await api.post(`prescriptions/${decodedPrescription.id}/reconcile`, {
        actions,
        superseded_prescription_ids: supersededPrescriptionIds,
      });
      setReconciliationSaved(true);
      trackEvent('prescription_reconciliation_saved', {
        prescription_id: decodedPrescription.id,
        matched_count: groups.matched.length,
        new_only_count: groups.newOnly.length,
        old_only_count: groups.oldOnly.length,
      });
      await refreshAll();
    } catch (error) {
      setActivationError(error instanceof Error ? error.message : 'Unable to save continuity review.');
    } finally {
      setIsSavingReconciliation(false);
    }
  };

  const activateVerifiedMedicine = async (medicine: ParsedPrescriptionMedication) => {
    const draft = verificationDrafts[medicine.id] ?? createVerificationDraft(medicine);
    const familyMemberId = decodedPrescription?.family_member_id || targetFamilyMember?.id;
    const excludedSignal = detectExcludedMedicine({
      medicineName: draft.medicineName,
      brandName: medicine.brand_name,
      genericName: medicine.generic_name,
      instructions: medicine.instructions,
    });
    const catalogMedicine = findIndianMedicine(getCatalogQueryForMedication({
      medicineName: draft.medicineName,
      brandName: medicine.brand_name,
      genericName: medicine.generic_name,
    }));
    const supportSafety = getSupportModeSafety(catalogMedicine || 'recognition_only');
    const needsHighRiskMessage =
      excludedSignal?.category === 'insulin' ||
      supportSafety.supportMode === 'manual_only_high_risk' ||
      isInsulinOrInjectableDiabetesMedicine({
        medicineName: draft.medicineName,
        brandName: medicine.brand_name,
        genericName: medicine.generic_name,
        form: catalogMedicine?.form,
        category: catalogMedicine?.category,
        medicineType: catalogMedicine?.medicineType,
      });
    const needsDecimalConfirmation = hasDecimalDosage(draft.dose, draft.strength);
    const relationshipNotices = getRelationshipNoticesForDraft(medicine, draft);
    const relationshipConfirmationKey = getRelationshipConfirmationKey(relationshipNotices);
    const replacementNotice = relationshipNotices.find((notice) => notice.existingScheduleId) ?? null;

    if (!familyMemberId) {
      setActivationError('Choose the person this prescription belongs to before saving.');
      return;
    }

    if (excludedSignal) {
      trackEvent('excluded_medicine_attempted', {
        source: 'activation',
        category: excludedSignal.category,
        matched_term: excludedSignal.matchedTerm,
        prescription_id: decodedPrescription?.id ?? null,
        prescription_medication_id: medicine.id,
      });
      setActivationError(needsHighRiskMessage
        ? 'This medicine requires careful manual management. Please verify timing and dosage directly with your doctor or pharmacist.'
        : `${excludedSignal.label} can be saved for recognition, but cannot be activated for automated scheduling in this beta.`);
      return;
    }

    if (!supportSafety.normalAutomationAllowed) {
      trackEvent(supportSafety.supportMode === 'blocked' ? 'blocked_medicine_detected' : 'medicine_activation_blocked_support_mode', {
        source: 'activation',
        catalog_id: catalogMedicine?.id ?? null,
        support_mode: supportSafety.supportMode,
        prescription_id: decodedPrescription?.id ?? null,
        prescription_medication_id: medicine.id,
      });
      setActivationError(needsHighRiskMessage
        ? 'This medicine requires careful manual management. Please verify timing and dosage directly with your doctor or pharmacist.'
        : supportSafety.message);
      return;
    }

    if (needsDecimalConfirmation && !decimalDoseConfirmations.has(medicine.id)) {
      trackEvent('decimal_dosage_confirmation_required', {
        prescription_id: decodedPrescription?.id ?? null,
        prescription_medication_id: medicine.id,
      });
      setActivationError('Please confirm the decimal or fraction dose matches the prescription before saving.');
      return;
    }

    if (relationshipNotices.length > 0 && relationshipConfirmations[medicine.id] !== relationshipConfirmationKey) {
      trackEvent('medicine_relationship_confirmation_required', {
        prescription_id: decodedPrescription?.id ?? null,
        prescription_medication_id: medicine.id,
        relationship_types: relationshipNotices.map((notice) => notice.type),
      });
      setActivationError('Please confirm how this medicine relates to the active plan before saving.');
      return;
    }

    setActivatingMedicationId(medicine.id);
    setActivationError('');

    try {
      await saveVerificationDraft(medicine, draft);
      const quantityPurchased = parsePositiveInteger(draft.quantityPurchased);
      const dailyDepletion = estimateDailyDepletion(draft.frequency);
      await api.post('medications/activate', {
        family_member_id: familyMemberId,
        prescription_medication_id: medicine.id,
        start_date: getMedicationStartDate(draft),
        reminder_times: [],
        food_relation: normalizeWhitespace(draft.foodTiming) || undefined,
        quantity_total: quantityPurchased || undefined,
        quantity_remaining: quantityPurchased || undefined,
        daily_depletion: dailyDepletion || undefined,
        projected_runout_date: quantityPurchased ? getProjectedRunoutDate(quantityPurchased, dailyDepletion) : undefined,
        relationship_confirmation: relationshipNotices.length > 0
          ? {
              acknowledged_duplicate_risk: true,
              replacing_schedule_id: replacementNotice?.existingScheduleId ?? undefined,
              stop_replaced_schedule: Boolean(replacementNotice?.existingScheduleId),
              begins_at: getMedicationStartDate(draft),
            }
          : undefined,
      });
      await AsyncStorage.setItem(GUIDED_VERIFICATION_FIRST_COMPLETED_KEY, 'true');
      const explicitPreference = await AsyncStorage.getItem(GUIDED_VERIFICATION_ENABLED_KEY);
      const hasNextGuidedMedicine =
        shouldUseGuidedVerification &&
        decodedMedicines[guidedMedicineIndex]?.id === medicine.id &&
        guidedMedicineIndex < decodedMedicines.length - 1;
      if (explicitPreference === null && !hasNextGuidedMedicine) {
        setIsGuidedVerificationEnabled(false);
      }
      setActivatedMedicationIds((current) => new Set([...current, medicine.id]));
      trackEvent('medicine_verification_completed', {
        prescription_id: decodedPrescription?.id ?? null,
        prescription_medication_id: medicine.id,
        verification_completion_time: new Date().toISOString(),
        had_decimal_confirmation: needsDecimalConfirmation,
        quantity_purchased: quantityPurchased ?? null,
      });
      if (shouldUseGuidedVerification && decodedMedicines[guidedMedicineIndex]?.id === medicine.id) {
        if (hasNextGuidedMedicine) {
          setGuidedMedicineIndex((current) => current + 1);
          setGuidedFieldIndex(0);
          setGuidedEditingField(null);
        }
      }
      await refreshAll();
      if (isFirstMedicineFlowActive) {
        setIsFirstMedicineFlowActive(false);
        await completeFirstMedicineOnboarding();
        navigation.dispatch(DrawerActions.jumpTo('Medications'));
      }
    } catch (activateFailure) {
      setActivationError(activateFailure instanceof Error ? activateFailure.message : 'Unable to save this medicine.');
    } finally {
      setActivatingMedicationId(null);
    }
  };

  const advanceGuidedField = () => {
    const currentMedicine = decodedMedicines[guidedMedicineIndex];
    const isLastField = guidedFieldIndex >= REVIEW_FIELD_ORDER.length - 1;

    setGuidedEditingField(null);

    if (!currentMedicine) {
      return;
    }

    if (!isLastField) {
      setGuidedFieldIndex((current) => current + 1);
      return;
    }

    setGuidedFieldIndex(REVIEW_FIELD_ORDER.length);
  };

  const renderActivationPrompt = (medicine: ParsedPrescriptionMedication, draft: MedicineVerificationDraft) => {
    const isActivated = activatedMedicationIds.has(medicine.id);
    const isActivating = activatingMedicationId === medicine.id;
    const excludedSignal = detectExcludedMedicine({
      medicineName: draft.medicineName,
      brandName: medicine.brand_name,
      genericName: medicine.generic_name,
      instructions: medicine.instructions,
    });
    const catalogMedicine = findIndianMedicine(getCatalogQueryForMedication({
      medicineName: draft.medicineName,
      brandName: medicine.brand_name,
      genericName: medicine.generic_name,
    }));
    const supportSafety = getSupportModeSafety(catalogMedicine || 'recognition_only');
    const needsHighRiskMessage =
      excludedSignal?.category === 'insulin' ||
      supportSafety.supportMode === 'manual_only_high_risk' ||
      isInsulinOrInjectableDiabetesMedicine({
        medicineName: draft.medicineName,
        brandName: medicine.brand_name,
        genericName: medicine.generic_name,
        form: catalogMedicine?.form,
        category: catalogMedicine?.category,
        medicineType: catalogMedicine?.medicineType,
      });
    const requiresDecimalConfirmation = hasDecimalDosage(draft.dose, draft.strength);
    const hasConfirmedDecimalDose = decimalDoseConfirmations.has(medicine.id);
    const trustProfile = getMedicineTrustProfile({
      medicineName: draft.medicineName,
      brandName: medicine.brand_name,
      genericName: medicine.generic_name,
      strength: draft.strength,
      dosage: draft.dose || draft.strength,
    });
    const relationshipNotices = getRelationshipNoticesForDraft(medicine, draft);
    const relationshipConfirmationKey = getRelationshipConfirmationKey(relationshipNotices);
    const hasConfirmedRelationship = relationshipConfirmations[medicine.id] === relationshipConfirmationKey;
    const isActivationBlocked =
      Boolean(excludedSignal) ||
      !supportSafety.normalAutomationAllowed ||
      (requiresDecimalConfirmation && !hasConfirmedDecimalDose) ||
      (relationshipNotices.length > 0 && !hasConfirmedRelationship);

    return (
      <View style={styles.activationPanel}>
        <Text style={styles.activationPrompt}>
          Please confirm the medicine name, dose, and timing match your prescription before saving.
        </Text>
        <View style={styles.trustMetadataCard}>
          <Text style={styles.trustMetadataTitle}>Trust state</Text>
          <Text style={styles.trustMetadataText}>
            Family name: {trustProfile.familyDisplayName || draft.medicineName} | Formulation: {trustProfile.formulation.toUpperCase()}
          </Text>
          <Text style={styles.trustMetadataText}>
            Safety molecule: {trustProfile.genericName || 'not identified'} | Risk: {trustProfile.riskTier} | Refill: {trustProfile.refillCriticality}
          </Text>
          <Text style={styles.trustMetadataText}>
            Catalog support: {supportSafety.supportMode.replace(/_/g, ' ')}; automated scheduling {supportSafety.normalAutomationAllowed ? 'allowed' : 'not allowed'}.
          </Text>
          <Text style={styles.trustMetadataText}>
            Last verified: {medicine.verified_at ? formatPrescriptionDate(medicine.verified_at) : 'not verified yet'}
          </Text>
        </View>
        {excludedSignal ? (
          <View style={styles.safetyNotice}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#92400E" />
            <Text style={styles.safetyNoticeText}>
              {needsHighRiskMessage
                ? 'This medicine requires careful manual management. Please verify timing and dosage directly with your doctor or pharmacist.'
                : `${excludedSignal.label} can be saved for recognition, but cannot be activated for automated scheduling in this beta.`}
            </Text>
          </View>
        ) : null}
        {!excludedSignal && !supportSafety.normalAutomationAllowed ? (
          <View style={needsHighRiskMessage || supportSafety.supportMode === 'blocked' ? styles.safetyNotice : styles.catalogNotice}>
            <Ionicons
              name={needsHighRiskMessage || supportSafety.supportMode === 'blocked' ? 'shield-checkmark-outline' : 'information-circle-outline'}
              size={18}
              color={needsHighRiskMessage || supportSafety.supportMode === 'blocked' ? '#92400E' : colors.primary}
            />
            <Text style={needsHighRiskMessage || supportSafety.supportMode === 'blocked' ? styles.safetyNoticeText : styles.catalogNoticeText}>
              {needsHighRiskMessage
                ? 'This medicine requires careful manual management. Please verify timing and dosage directly with your doctor or pharmacist.'
                : supportSafety.message}
            </Text>
          </View>
        ) : null}
        {requiresDecimalConfirmation ? (
          <TouchableOpacity
            style={[styles.decimalConfirmRow, hasConfirmedDecimalDose ? styles.decimalConfirmRowDone : null]}
            onPress={() => {
              setDecimalDoseConfirmations((current) => new Set([...current, medicine.id]));
              trackEvent('decimal_dosage_confirmed', {
                prescription_id: decodedPrescription?.id ?? null,
                prescription_medication_id: medicine.id,
              });
            }}
          >
            <Ionicons
              name={hasConfirmedDecimalDose ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={hasConfirmedDecimalDose ? colors.success : colors.primary}
            />
            <Text style={styles.decimalConfirmText}>
              I checked this decimal or fraction dose against the prescription.
            </Text>
          </TouchableOpacity>
        ) : null}
        {relationshipNotices.length > 0 ? (
          <View style={styles.relationshipNotice}>
            <Ionicons name="git-compare-outline" size={18} color="#92400E" />
            <View style={styles.relationshipNoticeCopy}>
              <Text style={styles.relationshipNoticeTitle}>Active medicine relationship found</Text>
              {relationshipNotices.slice(0, 2).map((notice) => (
                <Text key={`${medicine.id}-${notice.type}-${notice.existingScheduleId}`} style={styles.relationshipNoticeText}>
                  {notice.message} Current active: {notice.existingMedicationName}.
                </Text>
              ))}
              <TouchableOpacity
                style={[styles.decimalConfirmRow, hasConfirmedRelationship ? styles.decimalConfirmRowDone : null]}
                onPress={() => {
                  setRelationshipConfirmations((current) => ({
                    ...current,
                    [medicine.id]: relationshipConfirmationKey,
                  }));
                  trackEvent('medicine_relationship_confirmed', {
                    prescription_id: decodedPrescription?.id ?? null,
                    prescription_medication_id: medicine.id,
                    relationship_types: relationshipNotices.map((notice) => notice.type),
                  });
                }}
              >
                <Ionicons
                  name={hasConfirmedRelationship ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={hasConfirmedRelationship ? colors.success : colors.primary}
                />
                <Text style={styles.decimalConfirmText}>
                  I checked whether this replaces the active medicine. Stop the old active reminder when saving this replacement.
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        <TouchableOpacity
          disabled={isActivating || isActivated || isActivationBlocked}
          style={[styles.activationButton, isActivated ? styles.activationButtonDone : null, isActivationBlocked ? styles.disabledButton : null]}
          onPress={() => void activateVerifiedMedicine(medicine)}
        >
          <Text style={styles.activationButtonText}>
            {isActivated
              ? 'Medicine saved'
              : isActivating
                ? 'Saving...'
                : 'These details are correct — save this medicine'}
          </Text>
          <Ionicons name={isActivated ? 'checkmark-circle' : 'checkmark'} size={19} color={colors.surface} />
        </TouchableOpacity>
        <Text style={styles.activationMeta}>Start date: {getMedicationStartDate(draft)}</Text>
      </View>
    );
  };

  const renderEditableField = (
    medicine: ParsedPrescriptionMedication,
    draft: MedicineVerificationDraft,
    field: { key: MedicineReviewFieldKey; label: string; value: string; shouldVerify: boolean },
  ) => (
    <View key={`${medicine.id}-${field.key}`} style={[styles.fieldReviewRow, field.shouldVerify ? styles.fieldReviewRowWarning : null]}>
      <View style={styles.fieldReviewHeader}>
        <Text style={styles.fieldReviewLabel}>{field.label}</Text>
        {field.shouldVerify ? (
          <View style={styles.fieldWarningPill}>
            <Ionicons name="warning-outline" size={14} color="#92400E" />
            <Text style={styles.fieldWarningText}>Please verify this field</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.editableInputShell}>
        <TextInput
          style={styles.fieldReviewInput}
          value={draft[field.key]}
          onChangeText={(value) => updateVerificationDraft(medicine.id, field.key, value)}
          placeholder={field.label}
          placeholderTextColor={colors.textMuted}
        />
        <Ionicons name="pencil-outline" size={18} color={colors.primary} />
      </View>
      {renderAbbreviationHelp(field.key, draft[field.key])}
      <Text style={styles.fieldReviewSublabel}>Tap to edit if incorrect</Text>
    </View>
  );

  const renderGuidedVerification = (medicines: ParsedPrescriptionMedication[]) => {
    const medicine = medicines[Math.min(guidedMedicineIndex, medicines.length - 1)];
    if (!medicine) {
      return null;
    }

    const draft = verificationDrafts[medicine.id] ?? createVerificationDraft(medicine);
    const fields = getDraftReviewFields(draft);
    const isReadyToActivate = guidedFieldIndex >= fields.length;
    const field = fields[Math.min(guidedFieldIndex, fields.length - 1)];
    const isEditing = !isReadyToActivate && guidedEditingField === field.key;

    return (
      <View style={styles.summaryStack}>
        <View style={styles.guidedCard}>
          <View style={styles.guidedHeaderRow}>
            <Text style={styles.summarySectionLabel}>
              Medicine {guidedMedicineIndex + 1} of {medicines.length}
            </Text>
            <TouchableOpacity style={styles.viewPrescriptionChip} onPress={() => setIsPrescriptionModalVisible(true)}>
              <Ionicons name="image-outline" size={16} color={colors.primary} />
              <Text style={styles.viewPrescriptionChipText}>View Prescription</Text>
            </TouchableOpacity>
          </View>

          {isReadyToActivate ? (
            <>
              <Text style={styles.guidedTitle}>{draft.medicineName || getMedicineTitle(medicine)}</Text>
              <Text style={styles.guidedValue}>All fields for this medicine have been checked.</Text>
            </>
          ) : isEditing ? (
            <View style={styles.guidedEditBlock}>
              {renderEditableField(medicine, draft, field)}
              <TouchableOpacity style={styles.processButton} onPress={() => setGuidedEditingField(null)}>
                <Text style={styles.processButtonText}>Check this value again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.guidedTitle}>{field.label}</Text>
              <Text style={styles.guidedValue}>{translateMedicalText(field.value).displayText || field.value || 'Not found'}</Text>
              {renderAbbreviationHelp(field.key, field.value)}
              <Text style={styles.guidedQuestion}>Does this match your prescription?</Text>
              <View style={styles.guidedActions}>
                <TouchableOpacity style={styles.guidedYesButton} onPress={advanceGuidedField}>
                  <Text style={styles.guidedYesText}>Yes, correct</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.guidedNoButton} onPress={() => setGuidedEditingField(field.key)}>
                  <Text style={styles.guidedNoText}>No, let me fix it</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {isReadyToActivate ? renderActivationPrompt(medicine, draft) : null}
      </View>
    );
  };

  const renderContinuityReview = () => {
    if (reconciliationMode !== 'updates_current' || !decodedPrescription || activeMedicationRelationshipInputs.length === 0) {
      return null;
    }

    const groups = getReconciliationGroups();

    return (
      <View style={styles.summaryCard}>
        <View style={styles.summarySection}>
          <Text style={styles.summarySectionLabel}>Continuity review</Text>
          <Text style={styles.analysisHeadline}>Check what changes in the active plan</Text>
          <Text style={styles.analysisSubhead}>
            Nothing is changed automatically. New medicines still go through verification before activation.
          </Text>

          {groups.matched.length > 0 ? (
            <View style={styles.reconciliationGroup}>
              <Text style={styles.relationshipNoticeTitle}>In both current and new plan</Text>
              {groups.matched.map(({ medicine, notices }) => (
                <Text key={`matched-${medicine.id}`} style={styles.relationshipNoticeText}>
                  {getMedicineTitle(medicine)} may replace {notices[0]?.existingMedicationName}. The old reminder will stop only when you confirm replacement during activation.
                </Text>
              ))}
            </View>
          ) : null}

          {groups.newOnly.length > 0 ? (
            <View style={styles.reconciliationGroup}>
              <Text style={styles.relationshipNoticeTitle}>Only in new prescription</Text>
              {groups.newOnly.map(({ medicine }) => (
                <Text key={`new-${medicine.id}`} style={styles.relationshipNoticeText}>
                  {getMedicineTitle(medicine)} will stay as an unverified draft until you verify it.
                </Text>
              ))}
            </View>
          ) : null}

          {groups.oldOnly.length > 0 ? (
            <View style={styles.reconciliationGroup}>
              <Text style={styles.relationshipNoticeTitle}>Active medicines not seen in this prescription</Text>
              {groups.oldOnly.map((item) => (
                <View key={`old-${item.scheduleId}`} style={styles.oldOnlyRow}>
                  <Text style={styles.relationshipNoticeText}>
                    {item.medicineName || item.brandName || item.genericName || 'Active medicine'}
                  </Text>
                  <View style={styles.oldOnlyActions}>
                    <TouchableOpacity
                      style={[styles.optionChip, reconciliationActions[item.scheduleId] !== 'discontinue' ? styles.optionChipSelected : null]}
                      onPress={() => setReconciliationActions((current) => ({ ...current, [item.scheduleId]: 'keep_active' }))}
                    >
                      <Text style={[styles.optionChipText, reconciliationActions[item.scheduleId] !== 'discontinue' ? styles.optionChipTextSelected : null]}>
                        Keep active
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.optionChip, reconciliationActions[item.scheduleId] === 'discontinue' ? styles.optionChipSelected : null]}
                      onPress={() => setReconciliationActions((current) => ({ ...current, [item.scheduleId]: 'discontinue' }))}
                    >
                      <Text style={[styles.optionChipText, reconciliationActions[item.scheduleId] === 'discontinue' ? styles.optionChipTextSelected : null]}>
                        Stop old
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.processButton, reconciliationSaved ? styles.activationButtonDone : null]}
            disabled={isSavingReconciliation || reconciliationSaved}
            onPress={() => void saveContinuityReview()}
          >
            <Text style={styles.processButtonText}>
              {reconciliationSaved ? 'Continuity review saved' : isSavingReconciliation ? 'Saving review...' : 'Save continuity review'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderMedicineCards = (medicines: ParsedPrescriptionMedication[]) => {
    const isHandwritten = isLikelyHandwrittenPrescription(decodedPrescription);

    if (medicines.length === 0) {
      return (
        <View style={styles.rawTextBox}>
          <Text style={styles.rawTextTitle}>{t('prescriptions.analysisNeedsReview')}</Text>
          {prescriptionAnalysisMeta.rawSummary ? (
            <Text style={styles.rawText}>{prescriptionAnalysisMeta.rawSummary}</Text>
          ) : null}
          {prescriptionAnalysisMeta.importantNotes.length > 0 ? (
            <Text style={styles.rawText}>
              {prescriptionAnalysisMeta.importantNotes.join(' ')}
            </Text>
          ) : null}
          {!prescriptionAnalysisMeta.rawSummary && prescriptionAnalysisMeta.importantNotes.length === 0 ? (
            <Text style={styles.rawText}>{emptyAnalysisFallback}</Text>
          ) : null}
        </View>
      );
    }

    if (shouldUseGuidedVerification) {
      return renderGuidedVerification(medicines);
    }

    return (
      <View style={styles.summaryStack}>
        <View style={styles.decodedHeroCard}>
          <View style={styles.decodedHeroText}>
            <View style={styles.decodedHeroBadge}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.decodedHeroCopy}>
              <Text style={styles.decodedHeroTitle}>We found these medicines — please check each one</Text>
              <Text style={styles.decodedHeroSubtitle}>Swasthi gives you a starting point. Every field can be edited.</Text>
            </View>
          </View>
          {decodedPrescription?.image_url ? (
            <Image source={{ uri: decodedPrescription.image_url }} style={styles.decodedHeroPreview} resizeMode="cover" />
          ) : null}
        </View>

        {isHandwritten ? (
          <View style={styles.handwritingWarningBanner}>
            <Ionicons name="warning-outline" size={18} color="#92400E" />
            <Text style={styles.handwritingWarningText}>
              This looks like a handwritten prescription. Please check every field carefully.
            </Text>
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <View style={styles.summarySection}>
            <Text style={styles.summarySectionLabel}>Prescription analysis</Text>
            <Text style={styles.analysisHeadline}>
              We found these medicines — please check each one
            </Text>
            <Text style={styles.analysisSubhead}>
              {prescriptionAnalysisMeta.rawSummary || 'Each medicine below is a draft from OCR. Tap any field to edit if incorrect.'}
            </Text>
            <View style={styles.analysisMetaRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>
                  {getConfidenceLabel(prescriptionAnalysisMeta.confidenceScore, false)}
                </Text>
              </View>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>
                  {prescriptionAnalysisMeta.ocrQuality ? `OCR ${formatStatus(prescriptionAnalysisMeta.ocrQuality)}` : 'Medicine analysis'}
                </Text>
              </View>
            </View>
            {prescriptionAnalysisMeta.importantNotes.length > 0 ? (
              <View style={styles.analysisNotes}>
                {prescriptionAnalysisMeta.importantNotes.slice(0, 3).map((note) => (
                  <View key={note} style={styles.noteRow}>
                    <Ionicons name="information-circle-outline" size={17} color={colors.primary} />
                    <Text style={styles.noteText}>{note}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.disclaimerCard}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
              <Text style={styles.disclaimerText}>
                Swasthi interprets — you decide. Review every medicine before activation and always follow your doctor&apos;s instructions.
              </Text>
            </View>
          </View>
        </View>

        {medicines.map((medicine) => {
          const draft = verificationDrafts[medicine.id] ?? createVerificationDraft(medicine);
          const title = draft.medicineName || getMedicineTitle(medicine);
          const activeIngredient = getActiveIngredient(medicine);
          const reviewFields = getDraftReviewFields(draft);
          const notes = getImportantNotes(medicine);
          const scheduleHighlight = draft.timing || draft.foodTiming || draft.frequency || getScheduleHighlight(medicine);

          return (
            <View key={medicine.id} style={styles.summaryCard}>
              <View style={styles.summarySection}>
                <Text style={styles.summarySectionLabel}>
                  Medicine {medicines.findIndex((item) => item.id === medicine.id) + 1} of {medicines.length}
                </Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryIconOrb}>
                    <Ionicons name="medical-outline" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.summaryContent}>
                    <View style={styles.summaryTitleRow}>
                      <Text style={styles.summaryMedicineTitle}>{title}</Text>
                      <View style={styles.summaryBadge}>
                        <Text style={styles.summaryBadgeText}>{getMedicineBadge(medicine)}</Text>
                      </View>
                    </View>
                    {activeIngredient ? <Text style={styles.summaryIngredient}>({activeIngredient})</Text> : null}
                    <Text style={styles.summaryDetailLine}>
                      {activeIngredient ? `Active ingredient: ${activeIngredient}` : 'Draft medicine details from your prescription photo.'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.summarySection}>
                <Text style={styles.summarySectionLabel}>How to take</Text>
                <View style={styles.howToTakeCard}>
                  <View style={styles.howToTakeCopy}>
                    <Text style={styles.howToTakeText}>{getHowToTakeText(medicine)}</Text>
                  </View>
                  <View style={styles.schedulePill}>
                    <Ionicons name="time-outline" size={22} color={colors.primary} />
                    <Text style={styles.schedulePillText}>{scheduleHighlight}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.summarySection}>
                <Text style={styles.summarySectionLabel}>Prescription details</Text>
                <View style={styles.fieldReviewGrid}>
                  {reviewFields.map((field) => renderEditableField(medicine, draft, field))}
                </View>
              </View>

              <View style={[styles.summarySection, styles.importantNotesCard]}>
                <Text style={[styles.summarySectionLabel, styles.importantNotesLabel]}>Important notes</Text>
                {notes.map((note) => (
                  <View key={`${medicine.id}-${note}`} style={styles.noteRow}>
                    <Ionicons name="alert-circle-outline" size={17} color={colors.warning} />
                    <Text style={styles.noteText}>{note}</Text>
                  </View>
                ))}
                <Text style={styles.confidenceText}>
                  {getConfidenceLabel(medicine.confidence_score, medicine.requires_manual_verification)}
                </Text>
                {renderActivationPrompt(medicine, draft)}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const activeSteps = {
    uploading: uploadProgress > 0 ? 1 : 0,
    ocr: uploadState === 'processing' || uploadState === 'success' ? 2 : 0,
    ai: processingStage === 'ai' || processingStage === 'saving' || uploadState === 'success' ? 3 : 0,
    saving: processingStage === 'saving' || uploadState === 'success' ? 4 : 0,
    done: uploadState === 'success' ? 5 : 0,
  };

  const completedStepCount = Math.max(
    activeSteps.uploading,
    activeSteps.ocr,
    activeSteps.ai,
    activeSteps.saving,
    activeSteps.done,
    selectedImage ? 1 : 0,
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.menuButton} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
            <Ionicons name="menu" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshButton} onPress={() => void refreshAll()}>
            <Ionicons name="refresh" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroBlock}>
          <Text style={styles.title}>{t('prescriptions.title')}</Text>
          <Text style={styles.subtitle}>
            {t('prescriptions.subtitle')}
          </Text>
        </View>

        <View style={styles.entryOptions}>
          <TouchableOpacity
            disabled={uploadState === 'uploading' || uploadState === 'processing'}
            style={styles.entryOptionButton}
            onPress={() => beginAddFlow({ type: 'upload', source: 'gallery' })}
          >
            <Ionicons name="cloud-upload-outline" size={24} color={colors.surface} />
            <View style={styles.entryOptionCopy}>
              <Text style={styles.entryOptionTitle}>Upload Prescription Photo</Text>
              <Text style={styles.entryOptionSubtitle}>uses OCR assist</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={uploadState === 'uploading' || uploadState === 'processing'}
            style={styles.entryOptionButton}
            onPress={() => beginAddFlow({ type: 'manual' })}
          >
            <Ionicons name="create-outline" size={24} color={colors.surface} />
            <View style={styles.entryOptionCopy}>
              <Text style={styles.entryOptionTitle}>Add Medicine Manually</Text>
              <Text style={styles.entryOptionSubtitle}>type details in</Text>
            </View>
          </TouchableOpacity>
        </View>

        {manualDraftRecovery && !isManualFormVisible && !decodedPrescription ? (
          <View style={styles.draftRecoveryCard}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <View style={styles.draftRecoveryCopy}>
              <Text style={styles.draftRecoveryTitle}>
                You have an unfinished medicine entry for {manualDraftRecovery.patientName} — continue?
              </Text>
            </View>
            <View style={styles.draftRecoveryActions}>
              <TouchableOpacity style={styles.draftContinueButton} onPress={() => void restoreManualDraft()}>
                <Text style={styles.draftContinueText}>Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.draftDiscardButton} onPress={() => void discardManualDraft()}>
                <Text style={styles.draftDiscardText}>Discard and start fresh</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.uploadCard}>
          {selectedImage ? (
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.uploadIcon}>
              <Ionicons name="cloud-upload-outline" size={38} color={colors.primary} />
            </View>
          )}

          <Text style={styles.uploadTitle}>
            {uploadState === 'uploading' || uploadState === 'processing'
              ? stageLabel(processingStage, t)
              : uploadState === 'success'
                ? 'We found these medicines — please check each one'
                : selectedImage
                  ? 'Preview selected prescription'
                  : 'Upload a prescription photo for OCR assist'}
          </Text>
          <Text style={styles.uploadSubtitle}>
            {targetFamilyMember
              ? `Saving for ${targetFamilyMember.full_name}`
              : 'Add a person you are caring for before uploading prescriptions.'}
          </Text>

          {(uploadState === 'uploading' || uploadState === 'processing') ? (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.progressTitle}>{stageLabel(processingStage, t)}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(uploadProgress * 100, 6)}%` }]} />
              </View>
              <Text style={styles.progressText}>{Math.round(uploadProgress * 100)}% complete</Text>
            </View>
          ) : null}

          {uploadState === 'error' || uploadError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
              <Text style={styles.errorText}>{uploadError || 'Upload failed. Please try again.'}</Text>
            </View>
          ) : null}

          <View style={styles.uploadActions}>
            <TouchableOpacity
              disabled={uploadState === 'uploading' || uploadState === 'processing'}
              style={styles.uploadButton}
              onPress={() => beginAddFlow({ type: 'upload', source: 'camera' })}
            >
              <Ionicons name="camera-outline" size={20} color={colors.surface} />
              <Text style={styles.uploadButtonText}>{selectedImage ? 'Retake' : 'Camera'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={uploadState === 'uploading' || uploadState === 'processing'}
              style={[styles.uploadButton, styles.secondaryUploadButton]}
              onPress={() => beginAddFlow({ type: 'upload', source: 'gallery' })}
            >
              <Ionicons name="images-outline" size={20} color={colors.primary} />
              <Text style={styles.secondaryUploadButtonText}>Gallery</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.prescriptionPrivacyText}>
            Your prescription is stored privately and is only visible to people you invite.
          </Text>

          {selectedImage && uploadState !== 'success' ? (
            <TouchableOpacity
              disabled={uploadState === 'uploading' || uploadState === 'processing' || !targetFamilyMember}
              style={[
                styles.processButton,
                uploadState === 'uploading' || uploadState === 'processing' || !targetFamilyMember
                  ? styles.disabledButton
                  : null,
              ]}
              onPress={() => void uploadAndParse()}
            >
              <Text style={styles.processButtonText}>
                {uploadState === 'error' ? 'Retry OCR Assist' : 'Use OCR Assist'}
              </Text>
              <Ionicons name="scan-outline" size={19} color={colors.surface} />
            </TouchableOpacity>
          ) : null}

          {uploadState === 'success' ? (
            <View style={styles.successActions}>
              <TouchableOpacity style={styles.processButton} onPress={() => setIsPrescriptionModalVisible(true)}>
                <Text style={styles.processButtonText}>View Prescription</Text>
                <Ionicons name="image-outline" size={19} color={colors.surface} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.clearButton} onPress={resetUpload}>
                <Text style={styles.clearButtonText}>Start another prescription</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!targetFamilyMember ? (
            <TouchableOpacity style={styles.clearButton} onPress={() => navigation.navigate('AddFamilyMember')}>
              <Text style={styles.clearButtonText}>Add a person you&apos;re caring for</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {reconciliationMode ? (
          <View style={styles.continuityBanner}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            <Text style={styles.continuityBannerText}>
              {reconciliationMode === 'updates_current'
                ? 'Continuity review is on. New or changed medicines still require verification, and overlapping active reminders must be confirmed before saving.'
                : 'Adding alongside the current plan. Swasthi will still warn about duplicate molecules or formulation overlaps.'}
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('prescriptions.pipelineStatus')}</Text>
          <View style={styles.timeline}>
            {[
              t('prescriptions.chooseImage'),
              t('prescriptions.uploadImage'),
              t('prescriptions.googleVision'),
              t('prescriptions.geminiStructuring'),
              t('prescriptions.saveSupabase'),
              t('prescriptions.showMedicineCards'),
            ].map((step, index) => {
              const isActive = index < completedStepCount;
              return (
                <View key={step} style={styles.timelineItem}>
                  <View style={[styles.timelineDot, isActive ? styles.timelineDotActive : null]} />
                  <Text style={[styles.timelineText, isActive ? styles.timelineTextActive : null]}>{step}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {decodedPrescription ? (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('prescriptions.summary')}</Text>
                <Text style={styles.countText}>{decodedMedicines.length}</Text>
              </View>
              {renderContinuityReview()}
              {renderMedicineCards(decodedMedicines)}
              {activationError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                  <Text style={styles.errorText}>{activationError}</Text>
                </View>
              ) : null}
            </View>

            {decodedMedicines.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Reno It</Text>
                  <View style={styles.renoItStatusPill}>
                    <Text style={styles.renoItStatusText}>
                      {isDecodedPrescriptionVerified ? 'Ready to share' : 'Share with care'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.manualHelpText}>
                  Turn this decoded prescription into a calm, family-friendly WhatsApp card.
                </Text>

                {hasShareRisk ? (
                  <View style={styles.renoItWarningCard}>
                    <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
                    <Text style={styles.renoItWarningText}>
                      Please verify medicines before sharing with family.
                    </Text>
                  </View>
                ) : null}

                <View style={styles.renoItCardShell}>
                  <View collapsable={false} ref={renoItCardRef} style={styles.renoItCard}>
                    <View style={styles.renoItCardTop}>
                      <View style={styles.renoItHeaderCopy}>
                        <Text style={styles.renoItTopEyebrow}>PRESCRIPTION FOR</Text>
                        <Text style={styles.renoItPatientName}>
                          {decodedPrescription.family_members?.full_name?.trim() || 'Family member'}
                        </Text>
                        <Text style={styles.renoItDoctorLine}>
                          {normalizeWhitespace(decodedPrescription.doctor_name || decodedPrescription.hospital_name) || 'Doctor / clinic pending'}
                        </Text>
                      </View>
                      <View style={styles.renoItDateBadge}>
                        <Text style={styles.renoItDateBadgeText}>
                          {formatPrescriptionDate(decodedPrescription.prescription_date)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.renoItBody}>
                      {decodedMedicines.map((medicine) => (
                        <View key={`reno-${medicine.id}`} style={styles.renoItListRow}>
                          <View style={styles.renoItListIcon}>
                            <Ionicons name="grid-outline" size={15} color={colors.primary} />
                          </View>
                          <View style={styles.renoItListCopy}>
                            <Text style={styles.renoItListTitle}>{getMedicineTitle(medicine)}</Text>
                            <Text style={styles.renoItListSubline}>{getHowToTakeText(medicine)}</Text>
                          </View>
                          <View style={styles.renoItListPill}>
                            <Text style={styles.renoItListPillText}>{getRenoItTimingBadge(medicine)}</Text>
                          </View>
                        </View>
                      ))}

                      <View style={styles.renoItNotesCard}>
                        <Ionicons name="warning-outline" size={16} color="#BE7B12" />
                        <Text style={styles.renoItNotesText}>
                          {decodedMedicines
                            .map((medicine) => getRenoItInstructionLine(medicine))
                            .filter(Boolean)
                            .slice(0, 2)
                            .join(' ')
                            .trim() || 'Doctor notes will appear here when available.'}
                        </Text>
                      </View>

                      <View style={styles.renoItTrustCard}>
                        <View style={styles.renoItTrustDot} />
                        <Text style={styles.renoItTrustText}>{RENO_IT_TRUST_DISCLAIMER}</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.renoItBottomBadge}
                        onPress={() => void Linking.openURL(RENO_IT_LANDING_URL)}
                      >
                        <View style={styles.renoItBottomBadgeIcon}>
                          <Ionicons name="layers-outline" size={18} color={colors.surface} />
                        </View>
                        <View style={styles.renoItBottomBadgeCopy}>
                          <Text style={styles.renoItBottomBadgeTitle}>{RENO_IT_BADGE_LABEL}</Text>
                          <Text style={styles.renoItBottomBadgeSubtitle}>{RENO_IT_BADGE_CTA}</Text>
                        </View>
                        <View style={styles.renoItBottomBadgeArrow}>
                          <Ionicons name="arrow-forward" size={16} color={colors.surface} />
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={styles.processButton} onPress={openRenoIt}>
                  <Text style={styles.processButtonText}>Reno It</Text>
                  <Ionicons name="logo-whatsapp" size={19} color={colors.surface} />
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('prescriptions.ocrDetails')}</Text>
                <TouchableOpacity style={styles.manualActionChip} onPress={() => setShowOcrDetails((current) => !current)}>
                  <Text style={styles.manualActionChipText}>{showOcrDetails ? t('prescriptions.hideDetails') : t('prescriptions.showDetails')}</Text>
                </TouchableOpacity>
              </View>
              {showOcrDetails ? (
                <>
                  <View style={styles.metaCard}>
                    {pipelineMeta.map((item) => (
                      <View key={item} style={styles.metaPill}>
                        <Text style={styles.metaPillText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.rawTextBox}>
                    <Text style={styles.rawTextTitle}>{t('prescriptions.cleanedOcrText')}</Text>
                    <Text style={styles.rawText}>{cleanedOcrText || t('prescriptions.noOcrText')}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.manualHelpText}>Hidden by default so the summary stays focused on medicines only.</Text>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('prescriptions.manualReview')}</Text>
                <TouchableOpacity style={styles.manualActionChip} onPress={() => openMedicationEditor()}>
                  <Text style={styles.manualActionChipText}>
                    {decodedMedicines.length > 0 ? t('prescriptions.addMedicine') : t('prescriptions.addFirstMedicine')}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.manualHelpText}>
                {t('prescriptions.manualReviewHelp')}
              </Text>

              {manualDraftRecovery && !isManualFormVisible ? (
                <View style={styles.draftRecoveryCard}>
                  <Ionicons name="time-outline" size={20} color={colors.primary} />
                  <View style={styles.draftRecoveryCopy}>
                    <Text style={styles.draftRecoveryTitle}>
                      You have an unfinished medicine entry for {manualDraftRecovery.patientName} — continue?
                    </Text>
                    <Text style={styles.draftRecoveryMeta}>
                      Last saved {formatPrescriptionDate(manualDraftRecovery.updatedAt)}
                    </Text>
                  </View>
                  <View style={styles.draftRecoveryActions}>
                    <TouchableOpacity style={styles.draftContinueButton} onPress={() => void restoreManualDraft()}>
                      <Text style={styles.draftContinueText}>Continue</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.draftDiscardButton} onPress={() => void discardManualDraft()}>
                      <Text style={styles.draftDiscardText}>Discard and start fresh</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {isManualFormVisible ? (
                <View style={styles.manualFormCard}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Medicine name</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="e.g. Telma 40"
                      value={manualMedication.medicine_name}
                      onChangeText={(value) => {
                        updateManualMedication({ medicine_name: value, brand_name: '', generic_name: '' });
                        setSelectedMedicineStrengths([]);
                      }}
                      placeholderTextColor={colors.textMuted}
                    />
                    {medicineSearchResults.length > 0 ? (
                      <View style={styles.searchResultList}>
                        {medicineSearchResults.map((medicine) => (
                          <TouchableOpacity
                            key={medicine.id}
                            style={styles.searchResultRow}
                            onPress={() => selectMedicineSuggestion(medicine)}
                          >
                            <View style={styles.searchResultCopy}>
                              <Text style={styles.searchResultTitle}>{medicine.brandName}</Text>
                              <Text style={styles.searchResultMeta}>
                                {medicine.selectedStrength ? `${medicine.selectedStrength} matched | ` : ''}
                                Safety molecule: {medicine.genericName} | {medicine.strengths.join(', ')}
                              </Text>
                              <Text style={styles.searchResultMeta}>
                                {medicine.supportMode.replace(/_/g, ' ')} | priority {medicine.indiaPriorityScore}
                              </Text>
                            </View>
                            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                    {selectedMedicineStrengths.length > 0 ? (
                      <View style={styles.optionWrap}>
                        {selectedMedicineStrengths.map((strength) => (
                          <TouchableOpacity
                            key={strength}
                            style={[styles.optionChip, manualMedication.strength === strength ? styles.optionChipSelected : null]}
                            onPress={() => updateManualMedication({ strength })}
                          >
                            <Text style={[styles.optionChipText, manualMedication.strength === strength ? styles.optionChipTextSelected : null]}>
                              {strength}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                    {manualMedication.medicine_name.trim() ? (
                      <View style={styles.trustMetadataCard}>
                        <Text style={styles.trustMetadataTitle}>Medicine trust state</Text>
                        <Text style={styles.trustMetadataText}>
                          Family name: {manualTrustProfile.familyDisplayName || manualMedication.medicine_name} | Formulation {manualTrustProfile.formulation.toUpperCase()}
                        </Text>
                        <Text style={styles.trustMetadataText}>
                          Safety molecule: {manualTrustProfile.genericName || 'not identified'} | Risk {manualTrustProfile.riskTier}
                        </Text>
                        <Text style={styles.trustMetadataText}>
                          Refill criticality {manualTrustProfile.refillCriticality}; verification required before activation.
                        </Text>
                        <Text style={styles.trustMetadataText}>
                          Catalog support: {manualSupportSafety.supportMode.replace(/_/g, ' ')}; automated scheduling {manualSupportSafety.normalAutomationAllowed ? 'allowed after verification' : 'not allowed'}.
                        </Text>
                      </View>
                    ) : null}
                    {manualRelationshipNotices.length > 0 ? (
                      <View style={styles.relationshipNotice}>
                        <Ionicons name="git-compare-outline" size={18} color="#92400E" />
                        <View style={styles.relationshipNoticeCopy}>
                          <Text style={styles.relationshipNoticeTitle}>Possible overlap with active plan</Text>
                          {manualRelationshipNotices.slice(0, 2).map((notice) => (
                            <Text key={`manual-${notice.type}-${notice.existingScheduleId}`} style={styles.relationshipNoticeText}>
                              {notice.message} Current active: {notice.existingMedicationName}.
                            </Text>
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.inlineFields}>
                    <View style={[styles.formGroup, styles.inlineField]}>
                      <Text style={styles.formLabel}>Strength</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="e.g. 40 mg"
                        value={manualMedication.strength}
                        onChangeText={(value) => updateManualMedication({ strength: value })}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View style={[styles.formGroup, styles.inlineField]}>
                      <Text style={styles.formLabel}>Dose</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="e.g. 1 tablet"
                        value={manualMedication.dose}
                        onChangeText={(value) => updateManualMedication({ dose: value })}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Frequency</Text>
                    <View style={styles.optionWrap}>
                      {FREQUENCY_OPTIONS.map((frequency) => (
                        <TouchableOpacity
                          key={frequency}
                          style={[styles.optionChip, manualMedication.frequency === frequency ? styles.optionChipSelected : null]}
                          onPress={() => updateManualMedication({ frequency: frequency === 'Other' ? '' : frequency })}
                        >
                          <Text style={[styles.optionChipText, manualMedication.frequency === frequency ? styles.optionChipTextSelected : null]}>
                            {frequency}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {!FREQUENCY_OPTIONS.includes(manualMedication.frequency) ? (
                      <TextInput
                        style={[styles.formInput, styles.customFrequencyInput]}
                        placeholder="Custom frequency"
                        value={manualMedication.frequency}
                        onChangeText={(value) => updateManualMedication({ frequency: value })}
                        placeholderTextColor={colors.textMuted}
                      />
                    ) : null}
                  </View>

                  <View style={styles.inlineFields}>
                    <View style={[styles.formGroup, styles.inlineField]}>
                      <Text style={styles.formLabel}>Timing</Text>
                      <View style={styles.optionWrap}>
                        {TIMING_OPTIONS.map((option) => (
                          <TouchableOpacity
                            key={option.value}
                            style={[styles.optionChip, manualMedication.timing === option.value ? styles.optionChipSelected : null]}
                            onPress={() => updateManualMedication({ timing: option.value })}
                          >
                            <Text style={[styles.optionChipText, manualMedication.timing === option.value ? styles.optionChipTextSelected : null]}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={[styles.formGroup, styles.inlineField]}>
                      <Text style={styles.formLabel}>Food timing</Text>
                      <View style={styles.optionWrap}>
                        {FOOD_TIMING_OPTIONS.map((option) => (
                          <TouchableOpacity
                            key={option.value}
                            style={[styles.optionChip, manualMedication.food_timing === option.value ? styles.optionChipSelected : null]}
                            onPress={() => updateManualMedication({ food_timing: option.value })}
                          >
                            <Text style={[styles.optionChipText, manualMedication.food_timing === option.value ? styles.optionChipTextSelected : null]}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.inlineFields}>
                    <View style={[styles.formGroup, styles.inlineField]}>
                      <Text style={styles.formLabel}>Duration</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="e.g. 30 days"
                        value={manualMedication.duration}
                        onChangeText={(value) => updateManualMedication({ duration: value })}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View style={[styles.formGroup, styles.inlineField]}>
                      <Text style={styles.formLabel}>Quantity purchased</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="e.g. 30"
                        value={manualMedication.quantity_purchased}
                        onChangeText={(value) => updateManualMedication({ quantity_purchased: value })}
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Start date</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="YYYY-MM-DD"
                      value={manualMedication.start_date}
                      onChangeText={(value) => updateManualMedication({ start_date: value })}
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Instructions</Text>
                    <TextInput
                      style={[styles.formInput, styles.formTextArea]}
                      placeholder="Any notes from the prescription"
                      value={manualMedication.instructions}
                      onChangeText={(value) => updateManualMedication({ instructions: value })}
                      placeholderTextColor={colors.textMuted}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {manualExcludedSignal ? (
                    <View style={styles.safetyNotice}>
                      <Ionicons name="shield-checkmark-outline" size={18} color="#92400E" />
                      <Text style={styles.safetyNoticeText}>
                        {manualExcludedSignal.category === 'insulin'
                          ? 'This medicine requires careful manual management. Please verify timing and dosage directly with your doctor or pharmacist.'
                          : `${manualExcludedSignal.label} can be saved for recognition, but cannot be activated for automated scheduling in this beta.`}
                      </Text>
                    </View>
                  ) : null}

                  {manualCatalogMedicine && !manualSupportSafety.normalAutomationAllowed ? (
                    <View style={manualNeedsHighRiskMessage || manualSupportSafety.supportMode === 'blocked' ? styles.safetyNotice : styles.catalogNotice}>
                      <Ionicons
                        name={manualNeedsHighRiskMessage || manualSupportSafety.supportMode === 'blocked' ? 'shield-checkmark-outline' : 'information-circle-outline'}
                        size={18}
                        color={manualNeedsHighRiskMessage || manualSupportSafety.supportMode === 'blocked' ? '#92400E' : colors.primary}
                      />
                      <Text style={manualNeedsHighRiskMessage || manualSupportSafety.supportMode === 'blocked' ? styles.safetyNoticeText : styles.catalogNoticeText}>
                        {manualNeedsHighRiskMessage
                          ? 'This medicine requires careful manual management. Please verify timing and dosage directly with your doctor or pharmacist.'
                          : manualSupportSafety.message}
                      </Text>
                    </View>
                  ) : null}

                  {manualMedicationError ? <Text style={styles.manualErrorText}>{manualMedicationError}</Text> : null}

                  <View style={styles.manualActionRow}>
                    <TouchableOpacity style={styles.clearButton} onPress={() => void closeMedicationEditor()} disabled={isSavingMedication}>
                      <Text style={styles.clearButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.processButton}
                      onPress={() => void saveMedicationDraft()}
                      disabled={isSavingMedication}
                    >
                      <Text style={styles.processButtonText}>
                        {isSavingMedication ? 'Saving...' : editingMedicationId ? 'Update draft' : 'Save as unverified draft'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('prescriptions.recentPrescriptions')}</Text>
          {recentPrescriptions.length > 0 ? (
            recentPrescriptions.map((item) => {
              const uploadMeta = getPrimaryUpload(item);
              const uploadStatus = uploadMeta?.processing_status ? formatStatus(uploadMeta.processing_status) : null;
              const uploadError = uploadMeta?.last_error?.trim() || null;

              return (
                <TouchableOpacity key={item.id} style={styles.historyCard} onPress={() => void openPrescriptionDetails(item.id)}>
                  <View style={styles.historyIcon}>
                    <Ionicons name="document-text-outline" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyTitle}>
                      {item.doctor_name || item.hospital_name || 'Prescription record'}
                    </Text>
                    <Text style={styles.historyDate}>
                      {formatPrescriptionDate(item.prescription_date)}
                      {item.family_members?.full_name ? ` | ${item.family_members.full_name}` : ''}
                    </Text>
                    <Text style={styles.historyMeta}>
                      OCR: {formatStatus(item.parse_status)} | Medicines: {item.prescription_medications?.length ?? 0}
                    </Text>
                    {uploadStatus ? (
                      <Text style={styles.historyMeta}>Pipeline: {uploadStatus}</Text>
                    ) : null}
                    {uploadError ? (
                      <Text style={styles.historyError}>{uploadError}</Text>
                    ) : null}
                    <Text style={styles.historyHint}>Tap to review OCR text and medicines</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="document-attach-outline" size={38} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>{isLoading ? 'Loading prescriptions...' : 'No prescriptions yet'}</Text>
              <Text style={styles.emptyText}>
                Start with a clear prescription photo. Renomedy will extract medicine names, doses, and timing data.
              </Text>
              <View style={styles.emptyActionRow}>
                <TouchableOpacity style={styles.firstUploadButton} onPress={() => beginAddFlow({ type: 'upload', source: 'gallery' })}>
                  <Text style={styles.firstUploadText}>Upload Prescription</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.firstUploadButton, styles.firstManualButton]} onPress={() => beginAddFlow({ type: 'manual' })}>
                  <Text style={[styles.firstUploadText, styles.firstManualText]}>Add Manually</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      <Modal
        transparent
        visible={Boolean(pendingAddFlow)}
        animationType="fade"
        onRequestClose={() => undefined}
      >
        <View style={styles.reconciliationBackdrop}>
          <View style={styles.reconciliationCard}>
            <Ionicons name="git-compare-outline" size={24} color={colors.primary} />
            <Text style={styles.reconciliationTitle}>
              {targetFamilyMember?.full_name || 'This patient'} already has active medicines.
            </Text>
            <Text style={styles.reconciliationBody}>
              Is this a new prescription from a recent doctor visit?
            </Text>
            <TouchableOpacity
              style={styles.reconciliationPrimaryButton}
              onPress={() => continuePendingAddFlow('updates_current')}
            >
              <Text style={styles.reconciliationPrimaryText}>Yes, this updates the current plan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reconciliationSecondaryButton}
              onPress={() => continuePendingAddFlow('adds_alongside')}
            >
              <Text style={styles.reconciliationSecondaryText}>No, this adds medicines alongside the existing ones</Text>
            </TouchableOpacity>
            <Text style={styles.reconciliationFootnote}>
              Swasthi will keep the old plan visible until you confirm what should stop or continue.
            </Text>
          </View>
        </View>
      </Modal>
      <UpgradeModal
        visible={Boolean(upgradeMessage)}
        title="Unlimited scans are in Care"
        message={upgradeMessage}
        onClose={() => setUpgradeMessage('')}
      />
      <RenoItModal
        visible={isRenoItModalVisible}
        loading={isRenoItSharing}
        onConfirm={() => void shareRenoItToWhatsApp()}
        onCancel={() => setIsRenoItModalVisible(false)}
      />
      {decodedPrescription ? (
        <TouchableOpacity style={styles.floatingPrescriptionButton} onPress={() => setIsPrescriptionModalVisible(true)}>
          <Ionicons name="image-outline" size={18} color={colors.surface} />
          <Text style={styles.floatingPrescriptionText}>View Prescription</Text>
        </TouchableOpacity>
      ) : null}
      <Modal visible={isPrescriptionModalVisible} animationType="slide" onRequestClose={() => setIsPrescriptionModalVisible(false)}>
        <View style={styles.prescriptionModal}>
          <View style={styles.prescriptionModalHeader}>
            <Text style={styles.prescriptionModalTitle}>Prescription</Text>
            <TouchableOpacity style={styles.prescriptionModalClose} onPress={() => setIsPrescriptionModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          {prescriptionImageUri ? (
            <Image source={{ uri: prescriptionImageUri }} style={styles.prescriptionModalImage} resizeMode="contain" />
          ) : (
            <View style={styles.prescriptionMissingImage}>
              <Ionicons name="document-text-outline" size={42} color={colors.primary} />
              <Text style={styles.manualHelpText}>Prescription image is not available for this saved record.</Text>
            </View>
          )}
        </View>
      </Modal>
      <Modal transparent visible={Boolean(abbreviationTooltip)} animationType="fade" onRequestClose={() => setAbbreviationTooltip('')}>
        <TouchableOpacity style={styles.tooltipBackdrop} activeOpacity={1} onPress={() => setAbbreviationTooltip('')}>
          <View style={styles.tooltipCard}>
            <Text style={styles.tooltipText}>{abbreviationTooltip}</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const boxBase = {
  alignItems: 'center' as const,
  borderRadius: borderRadius.md,
  flexDirection: 'row' as const,
  gap: spacing.sm,
  marginTop: spacing.md,
  padding: spacing.md,
  width: '100%' as const,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    padding: spacing.lg,
    paddingTop: 52,
    paddingBottom: 100,
    gap: spacing.lg,
  },
  reconciliationBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.46)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  reconciliationCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
    maxWidth: 420,
    padding: spacing.lg,
    width: '100%',
    ...shadows.md,
  },
  reconciliationTitle: {
    ...typography.h2,
    color: colors.text,
  },
  reconciliationBody: {
    ...typography.body,
    color: colors.textMuted,
  },
  reconciliationPrimaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  reconciliationPrimaryText: {
    ...typography.label,
    color: colors.surface,
  },
  reconciliationSecondaryButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  reconciliationSecondaryText: {
    ...typography.label,
    color: colors.text,
    textAlign: 'center',
  },
  reconciliationFootnote: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  continuityBanner: {
    ...boxBase,
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  continuityBannerText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  menuButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
    ...shadows.sm,
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
    ...shadows.sm,
  },
  heroBlock: {
    gap: spacing.xs,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 23,
  },
  entryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    width: '100%',
  },
  entryOptionButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 74,
    minWidth: 144,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  entryOptionCopy: {
    flexShrink: 1,
    gap: 2,
  },
  entryOptionTitle: {
    ...typography.label,
    color: colors.surface,
    fontSize: 16,
  },
  entryOptionSubtitle: {
    ...typography.bodySmall,
    color: '#D6F7EB',
    fontSize: 14,
  },
  uploadCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: `${colors.secondary}70`,
    borderRadius: borderRadius.lg,
    borderStyle: Platform.OS === 'web' ? 'dashed' : 'solid',
    borderWidth: 1,
    padding: spacing.lg,
    ...shadows.md,
  },
  uploadIcon: {
    alignItems: 'center',
    backgroundColor: `${colors.secondary}28`,
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 68,
  },
  previewImage: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    height: 230,
    marginBottom: spacing.md,
    width: '100%',
  },
  uploadTitle: {
    ...typography.h3,
    fontSize: 20,
    textAlign: 'center',
  },
  uploadSubtitle: {
    ...typography.bodySmall,
    lineHeight: 20,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  progressCard: {
    backgroundColor: `${colors.primary}08`,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    padding: spacing.md,
    width: '100%',
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressTitle: {
    ...typography.label,
    color: colors.primary,
  },
  progressTrack: {
    backgroundColor: `${colors.primary}18`,
    borderRadius: borderRadius.pill,
    height: 10,
    marginTop: spacing.md,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    height: '100%',
  },
  progressText: {
    ...typography.bodySmall,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  uploadActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    width: '100%',
  },
  uploadButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 50,
  },
  secondaryUploadButton: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
  },
  uploadButtonText: {
    ...typography.label,
    color: colors.surface,
  },
  secondaryUploadButtonText: {
    ...typography.label,
    color: colors.primary,
  },
  prescriptionPrivacyText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  processButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 50,
    width: '100%',
  },
  processButtonText: {
    ...typography.label,
    color: colors.surface,
  },
  disabledButton: {
    opacity: 0.6,
  },
  clearButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 48,
    width: '100%',
  },
  clearButtonText: {
    ...typography.label,
    color: colors.primary,
  },
  successActions: {
    width: '100%',
  },
  activationPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  activationPrompt: {
    ...typography.body,
    color: colors.text,
    lineHeight: 23,
  },
  trustMetadataCard: {
    backgroundColor: '#F8FAFC',
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  trustMetadataTitle: {
    ...typography.label,
    color: colors.text,
  },
  trustMetadataText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
  },
  activationButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  activationButtonDone: {
    backgroundColor: colors.success,
  },
  activationButtonText: {
    ...typography.label,
    color: colors.surface,
    flexShrink: 1,
    fontSize: 16,
    textAlign: 'center',
  },
  activationMeta: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  safetyNotice: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  safetyNoticeText: {
    ...typography.bodySmall,
    color: '#78350F',
    flex: 1,
    lineHeight: 20,
  },
  catalogNotice: {
    alignItems: 'flex-start',
    backgroundColor: '#F5FBFA',
    borderColor: '#CFE8E2',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  catalogNoticeText: {
    ...typography.bodySmall,
    color: colors.primary,
    flex: 1,
    lineHeight: 20,
  },
  decimalConfirmRow: {
    alignItems: 'center',
    backgroundColor: '#F5FBFA',
    borderColor: '#CFE8E2',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  decimalConfirmRowDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  decimalConfirmText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
    lineHeight: 20,
  },
  relationshipNotice: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  relationshipNoticeCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  relationshipNoticeTitle: {
    ...typography.label,
    color: '#78350F',
  },
  relationshipNoticeText: {
    ...typography.bodySmall,
    color: '#78350F',
    lineHeight: 20,
  },
  reconciliationGroup: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  oldOnlyRow: {
    gap: spacing.sm,
  },
  oldOnlyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  errorBox: {
    ...boxBase,
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.danger,
    flex: 1,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.h3,
  },
  countText: {
    ...typography.label,
    color: colors.primary,
  },
  summaryStack: {
    gap: spacing.md,
  },
  decodedHeroCard: {
    alignItems: 'center',
    backgroundColor: '#F7FBFA',
    borderColor: '#E5F1EE',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    overflow: 'hidden',
    padding: spacing.md,
    ...shadows.sm,
  },
  decodedHeroText: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  decodedHeroBadge: {
    alignItems: 'center',
    backgroundColor: '#E7F5F2',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  decodedHeroCopy: {
    flex: 1,
    gap: 2,
  },
  decodedHeroTitle: {
    ...typography.label,
    color: '#245E61',
    fontSize: 18,
  },
  decodedHeroSubtitle: {
    ...typography.bodySmall,
    color: '#5E7A7A',
  },
  decodedHeroPreview: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    height: 72,
    width: 92,
  },
  guidedCard: {
    backgroundColor: '#FFFDF9',
    borderColor: '#F1E7D9',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    ...shadows.sm,
  },
  guidedHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  viewPrescriptionChip: {
    alignItems: 'center',
    backgroundColor: `${colors.secondary}28`,
    borderRadius: borderRadius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  viewPrescriptionChipText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  guidedTitle: {
    ...typography.h3,
    color: colors.text,
  },
  guidedValue: {
    ...typography.h2,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  guidedQuestion: {
    ...typography.body,
    color: colors.text,
    lineHeight: 23,
    marginTop: spacing.lg,
  },
  guidedActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  guidedYesButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
    minWidth: 132,
    paddingHorizontal: spacing.md,
  },
  guidedYesText: {
    ...typography.label,
    color: colors.surface,
    fontSize: 16,
    textAlign: 'center',
  },
  guidedNoButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
    minWidth: 132,
    paddingHorizontal: spacing.md,
  },
  guidedNoText: {
    ...typography.label,
    color: colors.primary,
    fontSize: 16,
    textAlign: 'center',
  },
  guidedEditBlock: {
    marginTop: spacing.md,
  },
  handwritingWarningBanner: {
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  handwritingWarningText: {
    ...typography.body,
    color: '#78350F',
    flex: 1,
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: '#FFFDF9',
    borderColor: '#F1E7D9',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.sm,
  },
  summarySection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  summarySectionLabel: {
    ...typography.label,
    color: colors.primary,
    fontSize: 14,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryIconOrb: {
    alignItems: 'center',
    backgroundColor: '#E7EEFF',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  summaryContent: {
    flex: 1,
    gap: 2,
  },
  summaryTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryMedicineTitle: {
    ...typography.h3,
    color: '#2F3340',
    flexShrink: 1,
    fontSize: 18,
  },
  summaryBadge: {
    backgroundColor: '#FFE5BE',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  summaryBadgeText: {
    ...typography.bodySmall,
    color: '#C46F10',
    fontWeight: '700',
  },
  summaryIngredient: {
    ...typography.body,
    color: '#545B6A',
  },
  analysisHeadline: {
    ...typography.h3,
    color: '#2F3340',
    fontSize: 20,
  },
  analysisSubhead: {
    ...typography.body,
    color: '#66707C',
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  analysisMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  analysisNotes: {
    marginTop: spacing.md,
  },
  disclaimerCard: {
    alignItems: 'center',
    backgroundColor: '#F5FBFA',
    borderColor: '#D5ECE7',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  disclaimerText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
    lineHeight: 19,
  },
  summaryDetailLine: {
    ...typography.bodySmall,
    color: '#66707C',
    marginTop: 2,
  },
  howToTakeCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EEF0',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  howToTakeCopy: {
    flex: 1,
  },
  howToTakeText: {
    ...typography.body,
    color: '#2F3340',
    lineHeight: 24,
  },
  schedulePill: {
    alignItems: 'center',
    borderColor: '#C8DDF0',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
    minWidth: 108,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  schedulePillText: {
    ...typography.bodySmall,
    color: '#355F7A',
    fontWeight: '700',
    textAlign: 'center',
  },
  usesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  fieldReviewGrid: {
    gap: spacing.sm,
  },
  fieldReviewRow: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EEF0',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  fieldReviewRowWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  fieldReviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  fieldReviewLabel: {
    ...typography.label,
    color: colors.text,
    fontSize: 16,
  },
  fieldReviewValue: {
    ...typography.body,
    color: '#2F3340',
    marginTop: spacing.xs,
  },
  editableInputShell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  fieldReviewInput: {
    ...typography.body,
    color: '#2F3340',
    flex: 1,
    minHeight: 48,
    paddingVertical: 10,
  },
  fieldReviewSublabel: {
    ...typography.bodySmall,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  abbreviationHelpRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  abbreviationHelpText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  unknownAbbreviationButton: {
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.pill,
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  unknownAbbreviationText: {
    ...typography.bodySmall,
    color: '#92400E',
    fontWeight: '700',
  },
  fieldWarningPill: {
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.pill,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  fieldWarningText: {
    ...typography.bodySmall,
    color: '#92400E',
    fontWeight: '700',
  },
  useChip: {
    alignItems: 'center',
    backgroundColor: '#F8FCFB',
    borderColor: '#E1EEEB',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  useChipText: {
    ...typography.bodySmall,
    color: '#2F5F58',
    fontWeight: '600',
  },
  importantNotesCard: {
    backgroundColor: '#FFF8EE',
    borderTopColor: '#F4E2C0',
    borderTopWidth: 1,
  },
  importantNotesLabel: {
    color: '#E18719',
  },
  noteRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  noteText: {
    ...typography.bodySmall,
    color: '#6B5C44',
    flex: 1,
    lineHeight: 20,
  },
  summaryFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  medicineCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  medIcon: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  medicineInfo: {
    flex: 1,
  },
  medicineName: {
    ...typography.label,
    fontSize: 16,
  },
  medicineMeta: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  medicineInstruction: {
    ...typography.bodySmall,
    color: colors.text,
    marginTop: 4,
  },
  confidenceText: {
    ...typography.bodySmall,
    color: colors.success,
    fontWeight: '700',
  },
  medicineActions: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  medicineEditButton: {
    backgroundColor: `${colors.secondary}28`,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  medicineEditButtonText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  metaCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metaPill: {
    backgroundColor: `${colors.secondary}28`,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaPillText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  rawTextBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  rawTextTitle: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  rawText: {
    ...typography.bodySmall,
    lineHeight: 20,
  },
  manualActionChip: {
    backgroundColor: `${colors.secondary}28`,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  manualActionChipText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  manualHelpText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  renoItStatusPill: {
    backgroundColor: '#E6F4F1',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  renoItStatusText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  renoItWarningCard: {
    alignItems: 'center',
    backgroundColor: '#FFF9EB',
    borderColor: '#F1D59B',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  renoItWarningText: {
    ...typography.bodySmall,
    color: '#8A630F',
    flex: 1,
    lineHeight: 20,
  },
  renoItCardShell: {
    alignItems: 'center',
  },
  renoItCard: {
    backgroundColor: '#F7F7F5',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    width: '100%',
    ...shadows.md,
  },
  renoItCardTop: {
    backgroundColor: '#20A273',
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  renoItHeaderCopy: {
    flex: 1,
  },
  renoItTopEyebrow: {
    ...typography.bodySmall,
    color: '#DDF8EE',
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  renoItPatientName: {
    ...typography.h3,
    color: colors.surface,
    fontSize: 27,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  renoItDoctorLine: {
    ...typography.bodySmall,
    color: '#E5FFF6',
    fontSize: 14,
    marginTop: spacing.xs,
  },
  renoItDateBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  renoItDateBadgeText: {
    ...typography.bodySmall,
    color: colors.surface,
    fontWeight: '700',
  },
  renoItBody: {
    backgroundColor: '#F7F7F5',
    padding: spacing.md,
    gap: spacing.sm,
  },
  renoItListRow: {
    alignItems: 'center',
    borderBottomColor: '#E1E2DE',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 12,
  },
  renoItListIcon: {
    alignItems: 'center',
    backgroundColor: '#DBF0E8',
    borderRadius: 12,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  renoItListCopy: {
    flex: 1,
  },
  renoItListTitle: {
    ...typography.label,
    color: '#1E2328',
    fontSize: 16,
  },
  renoItListSubline: {
    ...typography.bodySmall,
    color: '#4E555B',
    marginTop: 2,
  },
  renoItListPill: {
    backgroundColor: '#D7F0E5',
    borderRadius: borderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  renoItListPillText: {
    ...typography.bodySmall,
    color: '#1B6F58',
    fontWeight: '700',
  },
  renoItNotesCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF7E8',
    borderColor: '#EDCA7B',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  renoItNotesText: {
    ...typography.bodySmall,
    color: '#7A5814',
    flex: 1,
    lineHeight: 20,
  },
  renoItTrustCard: {
    alignItems: 'center',
    backgroundColor: '#F0F1EF',
    borderColor: '#D7D9D5',
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  renoItTrustDot: {
    backgroundColor: '#20A273',
    borderRadius: borderRadius.pill,
    height: 8,
    width: 8,
  },
  renoItTrustText: {
    ...typography.bodySmall,
    color: '#343A40',
    flex: 1,
    lineHeight: 19,
  },
  renoItBottomBadge: {
    alignItems: 'center',
    backgroundColor: '#20A273',
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  renoItBottomBadgeIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  renoItBottomBadgeCopy: {
    flex: 1,
  },
  renoItBottomBadgeTitle: {
    ...typography.bodySmall,
    color: colors.surface,
    fontWeight: '700',
  },
  renoItBottomBadgeSubtitle: {
    ...typography.bodySmall,
    color: '#D6F7EB',
    marginTop: 2,
  },
  renoItBottomBadgeArrow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  manualFormCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  draftRecoveryCard: {
    alignItems: 'flex-start',
    backgroundColor: '#F5FBFA',
    borderColor: '#CFE8E2',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.md,
  },
  draftRecoveryCopy: {
    flex: 1,
    minWidth: 180,
  },
  draftRecoveryTitle: {
    ...typography.label,
    color: colors.text,
    lineHeight: 21,
  },
  draftRecoveryMeta: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
  },
  draftRecoveryActions: {
    gap: spacing.sm,
    minWidth: 150,
  },
  draftContinueButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  draftContinueText: {
    ...typography.label,
    color: colors.surface,
  },
  draftDiscardButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  draftDiscardText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  inlineFields: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inlineField: {
    flex: 1,
  },
  formLabel: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  formInput: {
    ...typography.body,
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  formTextArea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  customFrequencyInput: {
    marginTop: spacing.sm,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionChipSelected: {
    backgroundColor: `${colors.primary}14`,
    borderColor: colors.primary,
  },
  optionChipText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  optionChipTextSelected: {
    color: colors.primary,
  },
  searchResultList: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  searchResultRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchResultCopy: {
    flex: 1,
  },
  searchResultTitle: {
    ...typography.label,
    color: colors.text,
  },
  searchResultMeta: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
  },
  manualActionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  manualErrorText: {
    ...typography.bodySmall,
    color: colors.danger,
    marginTop: -4,
    marginBottom: spacing.sm,
  },
  historyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  historyIcon: {
    alignItems: 'center',
    backgroundColor: `${colors.secondary}25`,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    ...typography.label,
    fontSize: 16,
  },
  historyDate: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  historyMeta: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
  },
  historyError: {
    ...typography.bodySmall,
    color: colors.danger,
    marginTop: 4,
  },
  historyHint: {
    ...typography.bodySmall,
    color: colors.primary,
    marginTop: 4,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.sm,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: `${colors.secondary}24`,
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 68,
  },
  emptyTitle: {
    ...typography.h3,
  },
  emptyText: {
    ...typography.bodySmall,
    lineHeight: 20,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  firstUploadButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    flex: 1,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  firstManualButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  firstUploadText: {
    ...typography.label,
    color: colors.surface,
  },
  firstManualText: {
    color: colors.primary,
  },
  emptyActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    width: '100%',
  },
  timeline: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  timelineItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  timelineDot: {
    backgroundColor: colors.border,
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  timelineDotActive: {
    backgroundColor: colors.primary,
  },
  timelineText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  timelineTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  floatingPrescriptionButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    bottom: 24,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    position: 'absolute',
    right: 18,
    ...shadows.md,
  },
  floatingPrescriptionText: {
    ...typography.label,
    color: colors.surface,
    fontSize: 16,
  },
  prescriptionModal: {
    backgroundColor: '#101820',
    flex: 1,
  },
  prescriptionModalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 52,
    paddingBottom: spacing.md,
  },
  prescriptionModalTitle: {
    ...typography.h3,
    color: colors.surface,
  },
  prescriptionModalClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: borderRadius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  prescriptionModalImage: {
    flex: 1,
    width: '100%',
  },
  prescriptionMissingImage: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  tooltipBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(16,24,32,0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  tooltipCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    maxWidth: 320,
    padding: spacing.lg,
  },
  tooltipText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 23,
  },
});
