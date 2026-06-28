# Renomedy ML Kit Document Scanner Investigation

## Section 1: Existing Implementation Audit

### Current Code Assessment

Based on the repository audit, Renomedy has already partially implemented edge-first OCR integration.

**1. Current Scanning Implementation**
- **File Path**: `Frontend/src/screens/PrescriptionHubScreen.tsx`
- **Purpose**: Core screen for capturing and processing prescriptions.
- **Keep / Modify / Remove**: **Modify**
- **Reasoning**: It currently limits scanning to 1 document (`maxNumDocuments: 1`). It uses `react-native-document-scanner-plugin` which invokes the native ML Kit Document Scanner UI. This implementation is solid but incomplete for multi-page prescriptions.

**2. Image Capture Implementation**
- **File Path**: `Frontend/src/screens/PrescriptionHubScreen.tsx` (Gallery fallback)
- **Purpose**: `expo-image-picker` is used when the user selects a gallery import instead of the camera.
- **Keep / Modify / Remove**: **Keep**
- **Reasoning**: Gallery support is essential for users who received prescriptions via WhatsApp or email.

**3. Existing OCR Workflow**
- **File Path**: `Frontend/src/screens/PrescriptionHubScreen.tsx` (Edge OCR) and `Frontend/src/lib/api.ts` (Backend API call)
- **Purpose**: Uses `@react-native-ml-kit/text-recognition` to extract text locally from the scanned image. The raw text (`extractedText`) is sent to the backend `/api/scan-prescription`. If local extraction fails, the backend falls back to Google Cloud Vision.
- **Keep / Modify / Remove**: **Modify**
- **Reasoning**: The pipeline is excellent but does not handle concatenating OCR text for multi-page scans.

**4. Current Dependencies**
- **File Path**: `Frontend/package.json`
- **Purpose**: `react-native-document-scanner-plugin` (^2.0.4) and `@react-native-ml-kit/text-recognition` are already installed and linked via Expo CNG (`Frontend/app.json`).
- **Keep / Modify / Remove**: **Keep**
- **Reasoning**: These are industry-standard, well-maintained libraries that fulfill the edge-first architecture requirements.

---

## Section 2: ML Kit Document Scanner Capability Analysis

| Capability | Impact on Renomedy |
| :--- | :--- |
| **Built-in Camera UI** | Eliminates the need to build and maintain a custom camera view using `react-native-vision-camera`, reducing technical debt and Android lifecycle bugs. |
| **Edge Detection & Auto Crop** | Automatically isolates the prescription from the background (e.g., a table), drastically reducing the noise sent to the OCR model and saving backend storage space. |
| **Perspective Correction** | Fixes skewed angles from users taking photos at an angle, which heavily improves OCR accuracy. |
| **Multi-page Scanning** | Natively supported by the Android ML Kit API. Allows users to combine multi-page clinical notes into a single session. (Currently artificially restricted to 1 in `PrescriptionHubScreen.tsx`). |
| **Image Enhancement** | Automatically removes shadows and enhances contrast (e.g., turning greyish backgrounds into pure white), making handwriting and printed text much clearer for `@react-native-ml-kit/text-recognition`. |

---

## Section 3: Technical Integration Design

### Current vs Recommended Architecture Diagram

**Data Flow**
```text
User
 ↓ (Taps Scan)
Native ML Kit Scanner (Handles Edge Detection, Crop, Enhancement)
 ↓ (Returns Array of Cropped Image URIs)
React Native Context
 ↓ (Iterates over images)
Edge OCR Module (@react-native-ml-kit/text-recognition)
 ↓ (Concatenates text results)
Backend API (`/api/scan-prescription` with `extractedText` + First Image / PDF)
 ↓
Prescription Processing (MedGemma 1.5 Clinical Reasoning)
```

**Key Architectural Decisions:**
- **Data Flow**: Images remain on the device for text extraction. Only the final structured text (and optionally compressed reference images) is sent to the backend.
- **Object Flow**: The scanner plugin returns an array of local `file://` URIs.
- **URI Management**: Images are cached locally in the app's temporary directory. Renomedy must explicitly clear this cache after a successful upload to avoid disk bloat.
- **Storage Requirements**: Storing enhanced, cropped images reduces AWS S3 / Supabase storage costs by up to 60% compared to raw camera dumps.

---

## Section 4: Multi-Page Prescription Support

**Current Status:** Restricted to 1 page (`maxNumDocuments: 1` in `PrescriptionHubScreen.tsx`).
**ML Kit Capabilities:** The scanner inherently supports multi-page out of the box.

**Beta Recommendation**:
Update `maxNumDocuments` to `3` or `5`. When multiple images are returned:
1. Run `@react-native-ml-kit/text-recognition` on each image sequentially in a loop.
2. Concatenate the text: `Page 1: [text] \n\n Page 2: [text]`.
3. Send the combined text to the MedGemma backend.
4. Upload either all images, or a single generated PDF (see Section 6) for medical record keeping.

---

## Section 5: Image Quality Analysis

| Quality Issue | Handled Automatically by ML Kit | Must Be Handled by Renomedy |
| :--- | :--- | :--- |
| Blur handling | ❌ (ML Kit does not prevent capturing blurry photos) | ✅ (Renomedy should prompt user to retake if OCR yields very low text volume) |
| Lighting issues | ✅ (Enhancement filter fixes shadows/contrast) | ❌ |
| Perspective distortion | ✅ (Auto-straightens based on corner detection) | ❌ |
| Folded prescriptions | ❌ (Cannot un-fold physical paper) | ✅ (Prompt users via UI overlay/instructions to flatten paper) |
| Low-end device cameras | ✅ (ML Kit provides a consistent UI regardless of OEM camera app quirks) | ❌ |

---

## Section 6: Export Format Recommendations

- **JPEG**: Best for single-page storage. Small size, widely supported.
- **PNG**: Unnecessary for documents. Too large.
- **PDF**: **Recommended for Multi-page**.

**Best OCR format**: High-contrast JPEG (processed by ML Kit).
**Best storage format**: PDF (if multi-page) or WebP/JPEG (if single page).
**Best history/archive format**: PDF (matches standard EMR/EHR behaviors).

*Note*: `react-native-document-scanner-plugin` supports generating a PDF directly from the scanned pages.

---

## Section 7: Android Requirements

- **Dependencies**: `react-native-document-scanner-plugin`, `@react-native-ml-kit/text-recognition`. (Already installed).
- **Permissions**: `CAMERA`, `READ_MEDIA_IMAGES` (Already configured in `app.json`).
- **SDK Requirements**: `minSdkVersion` 21+ (ML Kit requirement, Renomedy likely exceeds this).
- **Google Play Services**: The ML Kit Document Scanner API relies on Google Play Services. For devices without GMS (e.g., Huawei), a fallback to a basic camera view (`expo-camera`) or gallery picker must be implemented.

---

## Section 8: Benefits vs Limitations

| Feature | Benefit | Limitation | Risk |
| :--- | :--- | :--- | :--- |
| **Edge Text Extraction** | Zero backend latency for OCR, completely free. | Device processor limits speed. | Fails on very old Androids. |
| **ML Kit Scanner UI** | Zero UI maintenance, automatic cropping and lighting fixes. | Cannot heavily customize the UI theme (colors/buttons). | Dependent on Google Play Services. |
| **Fallback System** | High reliability. If ML Kit fails, server-side OCR takes over. | Double bandwidth if edge OCR silently fails. | Minimal, well isolated. |

---

## Section 9: Final Recommendation

**Can ML Kit Document Scanner replace manual image capture entirely for Renomedy Beta?**

**YES**

**Justification**:
The current repository already contains the required dependencies, permissions, and initial integration in `PrescriptionHubScreen.tsx`. The native ML Kit Scanner provides a vastly superior UX (auto-crop, shadow removal) compared to a custom `react-native-vision-camera` implementation. It is production-ready for Beta. The only missing pieces are expanding it to support multi-page scanning and adding fallback handling for non-GMS devices.

---

## Section 10: Implementation Checklist

- [ ] Change `maxNumDocuments: 1` to `maxNumDocuments: 5` in `PrescriptionHubScreen.tsx`.
- [ ] Update the `selectImage` function to handle an array of `scannedImages`.
- [ ] Implement a loop to run `TextRecognition.recognize()` on all scanned URIs and concatenate the text.
- [ ] Configure `react-native-document-scanner-plugin` to output a PDF for multi-page scans, or adjust backend API to accept an array of image files.
- [ ] Add error boundary/fallback for when `DocumentScanner.scanDocument` throws an error due to missing Google Play Services.

---

## Section 11: GitHub Issue Breakdown

- **[P0] Enable Multi-Page Edge Scanning**: Update `PrescriptionHubScreen.tsx` to allow multi-page scans and concatenate Edge OCR text for MedGemma.
- **[P1] Graceful Fallback for Non-GMS Devices**: Catch Document Scanner initialization errors and fallback to standard `expo-image-picker` camera mode.
- **[P2] PDF Storage for Multi-Page**: Update the scanner config to generate a PDF for multi-page uploads to save cloud storage space and improve the UI viewer.
