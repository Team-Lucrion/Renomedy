import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ApiError, api } from '../lib/api';
import { useAppData } from '../context/AppDataContext';
import { findFirst, includesText } from '../lib/collections';
import UpgradeModal from '../components/UpgradeModal';
import type {
  ParsedPrescriptionMedication,
  PrescriptionDetails,
  PrescriptionHistoryItem,
} from '../types/backend';
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
  dosage: string;
  frequency: string;
  timing: string;
  duration: string;
  instructions: string;
};

function createEmptyMedicationDraft(): MedicationDraft {
  return {
    medicine_name: '',
    dosage: '',
    frequency: '',
    timing: '',
    duration: '',
    instructions: '',
  };
}

function getPrimaryUpload(item?: PrescriptionHistoryItem | PrescriptionDetails | null) {
  if (!item?.prescription_uploads) return null;
  return Array.isArray(item.prescription_uploads) ? item.prescription_uploads[0] ?? null : item.prescription_uploads;
}

function formatPrescriptionDate(value?: string | null) {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
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

function stageLabel(stage: ProcessingStage) {
  if (stage === 'uploading') return 'Uploading prescription image';
  if (stage === 'ocr') return 'Reading prescription with Google Vision';
  if (stage === 'ai') return 'Structuring medicines with Gemini';
  if (stage === 'saving') return 'Saving structured data';
  return 'Ready to process';
}

function toMedicationDraft(medication?: ParsedPrescriptionMedication | null): MedicationDraft {
  if (!medication) {
    return createEmptyMedicationDraft();
  }

  return {
    medicine_name: medication.medicine_name ?? '',
    dosage: medication.dosage ?? '',
    frequency: medication.frequency ?? '',
    timing: medication.timing ?? medication.food_timing ?? '',
    duration: medication.duration ?? '',
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
  if (requiresManualVerification && (score === null || score === undefined || Number(score) < 0.85)) {
    return 'Please Double-Check';
  }

  if (score === null || score === undefined) {
    return 'Please Double-Check';
  }

  if (Number(score) >= 0.9) {
    return 'Clearly Read';
  }

  if (Number(score) >= 0.7) {
    return 'Please Double-Check';
  }

  return 'Could Not Read Clearly';
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
    medication.confidence_score !== null && medication.confidence_score !== undefined
      ? `OCR confidence: ${Math.round(Number(medication.confidence_score) * 100)}%.`
      : '',
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
      dosage: medicine.strength?.trim() || medicine.dose?.trim() || medicine.dosage?.trim() || null,
      frequency: medicine.frequency?.trim() || null,
      timing: medicine.timing?.trim() || null,
      duration: medicine.duration?.trim() || null,
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
      dosage: medicine.dosage ?? fallbackMedicine?.dosage ?? null,
      frequency: medicine.frequency ?? fallbackMedicine?.frequency ?? null,
      timing: medicine.timing ?? fallbackMedicine?.timing ?? null,
      duration: medicine.duration ?? fallbackMedicine?.duration ?? null,
      instructions: medicine.instructions ?? fallbackMedicine?.instructions ?? null,
      confidence_score: medicine.confidence_score ?? fallbackMedicine?.confidence_score ?? null,
      requires_manual_verification:
        medicine.requires_manual_verification ?? fallbackMedicine?.requires_manual_verification ?? true,
    };
  });
}

function getPrescriptionAnalysisMeta(details?: PrescriptionDetails | null) {
  const summary = details?.parsed_medicine_json?.prescription_summary;
  const importantNotes = details?.parsed_medicine_json?.important_notes?.filter(Boolean) ?? [];
  const rawSummary = normalizeWhitespace(details?.parsed_medicine_json?.raw_detected_text_summary);

  return {
    totalMedicines: summary?.total_medicines ?? null,
    confidenceScore: summary?.confidence_score ?? null,
    importantNotes,
    rawSummary,
    ocrQuality: details?.parsed_medicine_json?.ocr_quality ?? null,
  };
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

function getPrescriptionFromApiError(error: ApiError) {
  if (!error.details || typeof error.details !== 'object') {
    return null;
  }

  const details = error.details as { prescription?: PrescriptionDetails };
  return details.prescription ?? null;
}

async function prepareImageForUpload(asset: ImagePicker.ImagePickerAsset): Promise<SelectedImage> {
  console.log('[prescription-upload] original asset before conversion', {
    uri: asset.uri,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    width: asset.width,
    height: asset.height,
  });

  const resizedWidth = asset.width && asset.width > 1800 ? 1800 : undefined;
  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    resizedWidth ? [{ resize: { width: resizedWidth } }] : [],
    {
      compress: 0.82,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  console.log('[prescription-upload] converted image for upload', manipulated);

  return normalizeAsset({
    ...asset,
    uri: manipulated.uri,
    fileName: `prescription-${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
    fileSize: undefined,
  });
}

export default function PrescriptionHubScreen() {
  const navigation = useNavigation<any>();
  const { prescriptions, familyMembers, isLoading, error, refreshAll } = useAppData();
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
  const [isSavingMedication, setIsSavingMedication] = useState(false);
  const [showOcrDetails, setShowOcrDetails] = useState(false);

  const targetFamilyMember = familyMembers[0] ?? null;
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
  const pipelineMeta = [
    decodedPrescription?.ai_provider ? `AI: ${decodedPrescription.ai_provider}` : null,
    decodedPrescription?.ai_model ? `Model: ${decodedPrescription.ai_model}` : null,
    decodedPrescription?.parse_status ? `Status: ${formatStatus(decodedPrescription.parse_status)}` : null,
    prescriptionAnalysisMeta.ocrQuality ? `OCR: ${formatStatus(prescriptionAnalysisMeta.ocrQuality)}` : null,
  ].filter((value): value is string => Boolean(value));

  const requestCameraPermission = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    console.log('[prescription-upload] camera permission', permission);
    return permission.granted;
  };

  const requestGalleryPermission = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log('[prescription-upload] gallery permission', permission);
    return permission.granted;
  };

  const selectImage = async (source: 'camera' | 'gallery') => {
    setUploadError('');
    setDecodedPrescription(null);
    setOcrPreviewText('');
    setManualMedication(createEmptyMedicationDraft());
    setEditingMedicationId(null);
    setIsManualFormVisible(false);
    setManualMedicationError('');
    setShowOcrDetails(false);
    setProcessingStage('idle');
    setUploadProgress(0);

    try {
      const hasPermission =
        source === 'camera' ? await requestCameraPermission() : await requestGalleryPermission();

      if (!hasPermission) {
        setUploadState('error');
        setUploadError(
          source === 'camera'
            ? 'Camera permission is required to scan a prescription.'
            : 'Photo library permission is required to upload a prescription.',
        );
        return;
      }

      const pickerResult =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: false,
              mediaTypes: ['images'],
              quality: 0.82,
            })
          : await ImagePicker.launchImageLibraryAsync({
              allowsEditing: false,
              mediaTypes: ['images'],
              quality: 0.82,
              selectionLimit: 1,
            });

      console.log('[prescription-upload] image picker result', pickerResult);

      if (pickerResult.canceled || !pickerResult.assets?.[0]) {
        return;
      }

      const finalImage = await prepareImageForUpload(pickerResult.assets[0]);
      setSelectedImage(finalImage);
      setUploadState('preview');

      setTimeout(() => {
        void uploadAndParse(finalImage);
      }, 250);
    } catch (pickerError) {
      console.log('[prescription-upload] picker/network failure', pickerError);
      setUploadState('error');
      setUploadError(pickerError instanceof Error ? pickerError.message : 'Unable to open image picker.');
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
      setUploadError('Add a family member before uploading prescriptions.');
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
    setEditingMedicationId(null);
    setIsManualFormVisible(false);
    setManualMedicationError('');
    setShowOcrDetails(false);

    let decodeStageTimer: ReturnType<typeof setTimeout> | undefined;
    let aiStageTimer: ReturnType<typeof setTimeout> | undefined;

    try {
      const formData = new FormData();
      formData.append('family_member_id', targetFamilyMember.id);
      formData.append('file', {
        uri: imageToUpload.uri,
        name: imageToUpload.name,
        type: imageToUpload.type || 'image/jpeg',
      } as unknown as Blob);

      console.log('[prescription-upload] upload payload', {
        familyMemberId: targetFamilyMember.id,
        uri: imageToUpload.uri,
        name: imageToUpload.name,
        type: imageToUpload.type,
        size: imageToUpload.size,
        platform: Platform.OS,
      });

      decodeStageTimer = setTimeout(() => {
        setUploadState('processing');
        setProcessingStage('ocr');
        setUploadProgress((current) => Math.max(current, 0.62));
      }, 700);

      aiStageTimer = setTimeout(() => {
        setUploadState('processing');
        setProcessingStage('ai');
        setUploadProgress((current) => Math.max(current, 0.82));
      }, 1600);

      const details = await api.upload<PrescriptionDetails>('api/prescriptions/decode', formData, {
        onProgress: (progress) => {
          const nextProgress = Math.max(0.08, Math.min(0.52, progress * 0.52));
          setUploadProgress(nextProgress);
          setProcessingStage('uploading');
        },
      });

      clearTimeout(decodeStageTimer);
      clearTimeout(aiStageTimer);
      console.log('[prescription-upload] decode response', details);

      setProcessingStage('saving');
      setUploadProgress(0.92);
      console.log('[prescription-upload] parsing output', details.prescription_medications);

      setDecodedPrescription(details);
      setOcrPreviewText(details.cleaned_ocr_text ?? details.raw_ocr_text ?? '');
      setUploadProgress(1);
      const decodedMedicineCount = getAnalysisMedicines(details).length;
      const hasReadableOcr = Boolean(normalizeWhitespace(details.cleaned_ocr_text ?? details.raw_ocr_text));
      if (!hasReadableOcr) {
        setUploadState('error');
        setUploadError(getDecodeFailureMessage(details));
      } else {
        setUploadState('success');
        setUploadError(
          decodedMedicineCount === 0
            ? 'OCR text was read, but no medicines were confidently extracted. Review the OCR text or add medicines manually.'
            : '',
        );
      }
      await refreshAll();
    } catch (uploadFailure) {
      if (decodeStageTimer) clearTimeout(decodeStageTimer);
      if (aiStageTimer) clearTimeout(aiStageTimer);
      console.log('[prescription-upload] backend/network error', uploadFailure);
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
    setEditingMedicationId(null);
    setIsManualFormVisible(false);
    setManualMedicationError('');
    setShowOcrDetails(false);
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
    } catch (loadFailure) {
      setUploadState('error');
      setUploadError(loadFailure instanceof Error ? loadFailure.message : 'Unable to load prescription details.');
    }
  };

  const openMedicationEditor = (medication?: ParsedPrescriptionMedication | null) => {
    setManualMedicationError('');
    setEditingMedicationId(medication?.id ?? null);
    setManualMedication(toMedicationDraft(medication));
    setIsManualFormVisible(true);
  };

  const closeMedicationEditor = () => {
    setEditingMedicationId(null);
    setManualMedication(createEmptyMedicationDraft());
    setIsManualFormVisible(false);
    setManualMedicationError('');
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

    const toOptional = (value: string) => {
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    };

    const payload = {
      medicine_name: manualMedication.medicine_name.trim(),
      dosage: toOptional(manualMedication.dosage),
      frequency: toOptional(manualMedication.frequency),
      timing: toOptional(manualMedication.timing),
      duration: toOptional(manualMedication.duration),
      instructions: toOptional(manualMedication.instructions),
      requires_manual_verification: false,
      verification_status: 'user_verified' as const,
      confidence_score: 1,
    };

    setIsSavingMedication(true);
    setManualMedicationError('');

    try {
      if (editingMedicationId) {
        await api.patch(`prescriptions/medications/${editingMedicationId}`, payload);
      } else {
        await api.post(`prescriptions/${decodedPrescription.id}/medications`, payload);
      }

      const details = await api.get<PrescriptionDetails>(`prescriptions/${decodedPrescription.id}`);
      setDecodedPrescription(details);
      setOcrPreviewText(details.cleaned_ocr_text ?? details.raw_ocr_text ?? '');
      closeMedicationEditor();
      setUploadState('success');
      setUploadError('');
      await refreshAll();
    } catch (saveFailure) {
      setManualMedicationError(saveFailure instanceof Error ? saveFailure.message : 'Unable to save the medicine.');
    } finally {
      setIsSavingMedication(false);
    }
  };

  const renderMedicineCards = (medicines: ParsedPrescriptionMedication[]) => {
    if (medicines.length === 0) {
      return (
        <View style={styles.rawTextBox}>
          <Text style={styles.rawTextTitle}>Prescription analysis needs review</Text>
          {prescriptionAnalysisMeta.rawSummary ? (
            <Text style={styles.rawText}>{prescriptionAnalysisMeta.rawSummary}</Text>
          ) : null}
          {prescriptionAnalysisMeta.importantNotes.length > 0 ? (
            <Text style={styles.rawText}>
              {prescriptionAnalysisMeta.importantNotes.join(' ')}
            </Text>
          ) : null}
          <Text style={styles.rawText}>
            {cleanedOcrText || 'Try a clearer image, crop the prescription, and retry processing.'}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.summaryStack}>
        <View style={styles.decodedHeroCard}>
          <View style={styles.decodedHeroText}>
            <View style={styles.decodedHeroBadge}>
              <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.decodedHeroCopy}>
              <Text style={styles.decodedHeroTitle}>Doctor&apos;s Instructions</Text>
              <Text style={styles.decodedHeroSubtitle}>Here&apos;s a clear, easy-to-understand summary from the prescription image.</Text>
            </View>
          </View>
          {decodedPrescription?.image_url ? (
            <Image source={{ uri: decodedPrescription.image_url }} style={styles.decodedHeroPreview} resizeMode="cover" />
          ) : null}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summarySection}>
            <Text style={styles.summarySectionLabel}>Prescription analysis</Text>
            <Text style={styles.analysisHeadline}>
              {prescriptionAnalysisMeta.totalMedicines ?? medicines.length} medicine
              {(prescriptionAnalysisMeta.totalMedicines ?? medicines.length) === 1 ? '' : 's'} identified
            </Text>
            <Text style={styles.analysisSubhead}>
              {prescriptionAnalysisMeta.rawSummary || 'Each medicine below is organized into dose, schedule, and review notes.'}
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
                Renomedy helps you understand and track. Always follow your doctor&apos;s instructions.
              </Text>
            </View>
          </View>
        </View>

        {medicines.map((medicine) => {
          const title = getMedicineTitle(medicine);
          const activeIngredient = getActiveIngredient(medicine);
          const useTags = getUseTags(medicine);
          const notes = getImportantNotes(medicine);
          const scheduleHighlight = getScheduleHighlight(medicine);

          return (
            <View key={medicine.id} style={styles.summaryCard}>
              <View style={styles.summarySection}>
                <Text style={styles.summarySectionLabel}>Medicine</Text>
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
                      {activeIngredient ? `Active ingredient: ${activeIngredient}` : 'Medicine details extracted from your prescription.'}
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
                <View style={styles.usesGrid}>
                  {useTags.map((tag) => (
                    <View key={`${medicine.id}-${tag}`} style={styles.useChip}>
                      <Ionicons name="reader-outline" size={16} color={colors.primary} />
                      <Text style={styles.useChipText}>{tag}</Text>
                    </View>
                  ))}
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
                <View style={styles.summaryFooter}>
                  <Text style={styles.confidenceText}>
                    {getConfidenceLabel(medicine.confidence_score, medicine.requires_manual_verification)}
                  </Text>
                  <TouchableOpacity style={styles.medicineEditButton} onPress={() => openMedicationEditor(medicine)}>
                    <Text style={styles.medicineEditButtonText}>Edit</Text>
                  </TouchableOpacity>
                </View>
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
          <Text style={styles.title}>Prescription Intelligence</Text>
          <Text style={styles.subtitle}>
            Camera or gallery upload, Google Vision text extraction, Gemini medicine structuring, then save your doctor&apos;s instructions to the family record.
          </Text>
        </View>

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
              ? stageLabel(processingStage)
              : uploadState === 'success'
                ? 'Structured medicines are ready'
                : selectedImage
                  ? 'Preview selected prescription'
                  : 'Upload a prescription to extract medicines'}
          </Text>
          <Text style={styles.uploadSubtitle}>
            {targetFamilyMember
              ? `Saving for ${targetFamilyMember.full_name}`
              : 'Add a family member before uploading prescriptions.'}
          </Text>

          {(uploadState === 'uploading' || uploadState === 'processing') ? (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.progressTitle}>{stageLabel(processingStage)}</Text>
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
              onPress={() => void selectImage('camera')}
            >
              <Ionicons name="camera-outline" size={20} color={colors.surface} />
              <Text style={styles.uploadButtonText}>{selectedImage ? 'Retake' : 'Camera'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={uploadState === 'uploading' || uploadState === 'processing'}
              style={[styles.uploadButton, styles.secondaryUploadButton]}
              onPress={() => void selectImage('gallery')}
            >
              <Ionicons name="images-outline" size={20} color={colors.primary} />
              <Text style={styles.secondaryUploadButtonText}>Gallery</Text>
            </TouchableOpacity>
          </View>

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
                {uploadState === 'error' ? 'Retry Processing' : 'Process Prescription'}
              </Text>
              <Ionicons name="scan-outline" size={19} color={colors.surface} />
            </TouchableOpacity>
          ) : null}

          {uploadState === 'success' ? (
            <View style={styles.successActions}>
              <TouchableOpacity style={styles.processButton} onPress={() => void refreshAll()}>
                <Text style={styles.processButtonText}>Save To Family Medication List</Text>
                <Ionicons name="checkmark" size={19} color={colors.surface} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.clearButton} onPress={resetUpload}>
                <Text style={styles.clearButtonText}>Scan Another</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!targetFamilyMember ? (
            <TouchableOpacity style={styles.clearButton} onPress={() => navigation.navigate('AddFamilyMember')}>
              <Text style={styles.clearButtonText}>Add Family Member</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pipeline status</Text>
          <View style={styles.timeline}>
            {[
              'Choose image',
              'Upload image',
              'Google Vision text extraction',
              'Gemini medicine structuring',
              'Save to Supabase',
              'Show medicine cards',
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
                <Text style={styles.sectionTitle}>Prescription summary</Text>
                <Text style={styles.countText}>{decodedMedicines.length}</Text>
              </View>
              {renderMedicineCards(decodedMedicines)}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>OCR and AI details</Text>
                <TouchableOpacity style={styles.manualActionChip} onPress={() => setShowOcrDetails((current) => !current)}>
                  <Text style={styles.manualActionChipText}>{showOcrDetails ? 'Hide details' : 'Show details'}</Text>
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
                    <Text style={styles.rawTextTitle}>Cleaned OCR text</Text>
                    <Text style={styles.rawText}>{cleanedOcrText || 'No OCR text returned.'}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.manualHelpText}>Hidden by default so the summary stays focused on medicines only.</Text>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Manual review</Text>
                <TouchableOpacity style={styles.manualActionChip} onPress={() => openMedicationEditor()}>
                  <Text style={styles.manualActionChipText}>
                    {decodedMedicines.length > 0 ? 'Add medicine' : 'Add first medicine'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.manualHelpText}>
                If OCR misses a medicine, add it here and it will be saved to the prescription record.
              </Text>

              {isManualFormVisible ? (
                <View style={styles.manualFormCard}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Medicine name</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="e.g. Telma 40"
                      value={manualMedication.medicine_name}
                      onChangeText={(value) => setManualMedication((current) => ({ ...current, medicine_name: value }))}
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>

                  <View style={styles.inlineFields}>
                    <View style={[styles.formGroup, styles.inlineField]}>
                      <Text style={styles.formLabel}>Dosage</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="40 mg"
                        value={manualMedication.dosage}
                        onChangeText={(value) => setManualMedication((current) => ({ ...current, dosage: value }))}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View style={[styles.formGroup, styles.inlineField]}>
                      <Text style={styles.formLabel}>Frequency</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="OD or 1-0-1"
                        value={manualMedication.frequency}
                        onChangeText={(value) => setManualMedication((current) => ({ ...current, frequency: value }))}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>

                  <View style={styles.inlineFields}>
                    <View style={[styles.formGroup, styles.inlineField]}>
                      <Text style={styles.formLabel}>Timing</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="After food"
                        value={manualMedication.timing}
                        onChangeText={(value) => setManualMedication((current) => ({ ...current, timing: value }))}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View style={[styles.formGroup, styles.inlineField]}>
                      <Text style={styles.formLabel}>Duration</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="5 days"
                        value={manualMedication.duration}
                        onChangeText={(value) => setManualMedication((current) => ({ ...current, duration: value }))}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Instructions</Text>
                    <TextInput
                      style={[styles.formInput, styles.formTextArea]}
                      placeholder="Any notes from the prescription"
                      value={manualMedication.instructions}
                      onChangeText={(value) => setManualMedication((current) => ({ ...current, instructions: value }))}
                      placeholderTextColor={colors.textMuted}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {manualMedicationError ? <Text style={styles.manualErrorText}>{manualMedicationError}</Text> : null}

                  <View style={styles.manualActionRow}>
                    <TouchableOpacity style={styles.clearButton} onPress={closeMedicationEditor} disabled={isSavingMedication}>
                      <Text style={styles.clearButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.processButton} onPress={() => void saveMedicationDraft()} disabled={isSavingMedication}>
                      <Text style={styles.processButtonText}>
                        {isSavingMedication ? 'Saving...' : editingMedicationId ? 'Update medicine' : 'Save medicine'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent prescriptions</Text>
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
              <TouchableOpacity style={styles.firstUploadButton} onPress={() => void selectImage('gallery')}>
                <Text style={styles.firstUploadText}>Upload Your First Prescription</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
      <UpgradeModal
        visible={Boolean(upgradeMessage)}
        title="Unlimited scans are in Care"
        message={upgradeMessage}
        onClose={() => setUpgradeMessage('')}
      />
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
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  menuButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
    ...shadows.sm,
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
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
    fontSize: 12,
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
  manualFormCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
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
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
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
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  firstUploadText: {
    ...typography.label,
    color: colors.surface,
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
});
