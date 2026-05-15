import base64
import io
import json
import logging
import os
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any, Literal

import cv2
import jwt
import numpy as np
import pytesseract
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from groq import Groq
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field, ValidationError
from supabase import Client, create_client

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("renomedy-ocr")


class Settings(BaseModel):
    app_name: str = "Renomedy OCR Pipeline"
    app_env: str = os.getenv("APP_ENV", "development")
    supabase_url: str | None = os.getenv("SUPABASE_URL")
    supabase_service_role_key: str | None = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    supabase_storage_bucket: str = os.getenv("SUPABASE_STORAGE_BUCKET", "prescriptions")
    groq_api_key: str | None = os.getenv("GROQ_API_KEY")
    groq_model: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
    ocr_timeout_ms: int = int(os.getenv("OCR_TIMEOUT_MS", "30000"))
    tesseract_cmd: str | None = os.getenv("TESSERACT_CMD") or None
    clerk_jwt_public_key: str | None = os.getenv("CLERK_JWT_PUBLIC_KEY") or None
    fastapi_allowed_origins: list[str] = Field(
        default_factory=lambda: [
            origin.strip()
            for origin in os.getenv("FASTAPI_ALLOWED_ORIGINS", "*").split(",")
            if origin.strip()
        ]
        or ["*"]
    )


settings = Settings()

if settings.tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

_supabase_client: Client | None = None
_groq_client: Groq | None = None


class MedicineStructured(BaseModel):
    medicine_name: str = Field(min_length=1)
    dosage: str | None = None
    frequency: str | None = None
    timing: str | None = None
    duration: str | None = None
    instructions: str | None = None
    confidence_score: float = Field(default=0.5, ge=0, le=1)
    requires_manual_verification: bool = True


class StructuredPrescription(BaseModel):
    medicines: list[MedicineStructured] = Field(default_factory=list)


class PrescriptionCardSummary(BaseModel):
    total_medicines: int = 0
    confidence_score: float = Field(default=0, ge=0, le=1)


class PrescriptionCardMedicine(BaseModel):
    id: int
    medicine_name: str = ""
    generic_name: str = ""
    strength: str = ""
    form: str = ""
    dose: str = ""
    frequency: str = ""
    timing: str = ""
    duration: str = ""
    instructions: str = ""
    uses: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    quantity: str = ""
    confidence: Literal["high", "medium", "low"] = "low"


class PrescriptionCardPayload(BaseModel):
    status: Literal["success", "failed"] = "failed"
    ocr_quality: Literal["high", "medium", "low"] = "low"
    prescription_summary: PrescriptionCardSummary = Field(default_factory=PrescriptionCardSummary)
    medicines: list[PrescriptionCardMedicine] = Field(default_factory=list)
    important_notes: list[str] = Field(default_factory=list)
    raw_detected_text_summary: str = ""


class ParsePrescriptionRequest(BaseModel):
    ocr_text: str = Field(min_length=1)


class JsonProcessPrescriptionRequest(BaseModel):
    imageBase64: str = Field(min_length=1)
    mimeType: str | None = "image/jpeg"
    filename: str | None = None
    family_member_id: str | None = None
    doctor_name: str | None = None
    hospital_name: str | None = None
    prescription_date: str | None = None
    persist_to_supabase: bool = False


class AuthContext(BaseModel):
    clerk_user_id: str
    user_id: str
    verified: bool
    email: str | None = None
    phone: str | None = None
    full_name: str | None = None
    role: str = "caregiver"
    preferred_language: str = "en"


app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.fastapi_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def ok(data: Any, message: str = "OK", status_code: int = status.HTTP_200_OK) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": True,
            "message": message,
            "data": data,
        },
    )


def error_response(message: str, status_code: int, details: Any | None = None) -> JSONResponse:
    payload: dict[str, Any] = {"success": False, "message": message}
    if details is not None:
        payload["details"] = details
    return JSONResponse(status_code=status_code, content=payload)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    return error_response(str(exc.detail), exc.status_code)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled OCR pipeline error", exc_info=exc)
    return error_response("Internal prescription processing error", status.HTTP_500_INTERNAL_SERVER_ERROR)


def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase is not configured for the OCR pipeline",
            )
        _supabase_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _supabase_client


def get_groq() -> Groq:
    global _groq_client
    if _groq_client is None:
        if not settings.groq_api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="GROQ_API_KEY is missing",
            )
        _groq_client = Groq(api_key=settings.groq_api_key)
    return _groq_client


def ensure_text(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def parse_bool(value: str | bool | None, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def build_signed_image_url(storage_path: str) -> str | None:
    try:
        response = (
            get_supabase()
            .storage.from_(settings.supabase_storage_bucket)
            .create_signed_url(storage_path, 60 * 10)
        )
        if isinstance(response, dict):
            return response.get("signedURL") or response.get("signedUrl")
    except Exception as exc:
        logger.warning("Failed to create signed image URL", extra={"storage_path": storage_path, "error": str(exc)})
    return None


def cleanup_uploaded_file(storage_path: str) -> None:
    try:
        get_supabase().storage.from_(settings.supabase_storage_bucket).remove([storage_path])
    except Exception as exc:
        logger.warning("Failed to cleanup storage object", extra={"storage_path": storage_path, "error": str(exc)})


def decode_token_without_verification(token: str) -> dict[str, Any]:
    payload = jwt.decode(
        token,
        options={
            "verify_signature": False,
            "verify_exp": False,
            "verify_aud": False,
            "verify_nbf": False,
        },
    )
    exp = payload.get("exp")
    if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(tz=timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication token has expired")
    return payload


def decode_and_verify_token(token: str) -> tuple[dict[str, Any], bool]:
    public_key = settings.clerk_jwt_public_key
    normalized_key = public_key.replace("\\n", "\n") if public_key else None

    if normalized_key:
        try:
            payload = jwt.decode(
                token,
                normalized_key,
                algorithms=["RS256"],
                options={"verify_aud": False},
            )
            return payload, True
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Clerk session token: {exc}",
            ) from exc

    logger.warning("CLERK_JWT_PUBLIC_KEY is missing; using unsigned Clerk token decoding fallback")
    return decode_token_without_verification(token), False


def derive_full_name(payload: dict[str, Any]) -> str | None:
    explicit_name = ensure_text(payload.get("name"))
    if explicit_name:
        return explicit_name

    joined_name = " ".join(
        [part.strip() for part in [payload.get("given_name"), payload.get("family_name")] if isinstance(part, str) and part.strip()]
    )
    return joined_name or None


def ensure_current_user(payload: dict[str, Any], verified: bool) -> AuthContext:
    clerk_user_id = payload.get("sub")
    if not clerk_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authenticated Clerk user is missing")

    role = payload.get("public_metadata", {}).get("role") if isinstance(payload.get("public_metadata"), dict) else None
    preferred_language = payload.get("public_metadata", {}).get("preferred_language") if isinstance(payload.get("public_metadata"), dict) else None
    normalized_role = "self" if role == "self" else "caregiver"
    normalized_language = ensure_text(preferred_language) or ensure_text(payload.get("preferred_language")) or "en"

    response = (
        get_supabase()
        .table("users")
        .upsert(
            {
                "clerk_user_id": clerk_user_id,
                "email": ensure_text(payload.get("email")),
                "phone": ensure_text(payload.get("phone_number")),
                "full_name": derive_full_name(payload),
                "role": normalized_role,
                "preferred_language": normalized_language,
            },
            on_conflict="clerk_user_id",
        )
        .execute()
    )
    rows = response.data or []
    if not rows:
        selected = (
            get_supabase()
            .table("users")
            .select("id")
            .eq("clerk_user_id", clerk_user_id)
            .limit(1)
            .execute()
        )
        rows = selected.data or []

    if not rows:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to provision OCR user record")

    return AuthContext(
        clerk_user_id=clerk_user_id,
        user_id=rows[0]["id"],
        verified=verified,
        email=ensure_text(payload.get("email")),
        phone=ensure_text(payload.get("phone_number")),
        full_name=derive_full_name(payload),
        role=normalized_role,
        preferred_language=normalized_language,
    )


def get_auth_context(authorization: str | None) -> AuthContext | None:
    if not authorization:
        return None
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header must use Bearer token")

    token = authorization.replace("Bearer ", "", 1).strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token is missing")

    payload, verified = decode_and_verify_token(token)
    return ensure_current_user(payload, verified)


def get_accessible_family_member_ids(user_id: str, family_member_id: str | None = None) -> list[str]:
    memberships = (
        get_supabase()
        .table("family_group_memberships")
        .select("family_group_id")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    )
    group_ids = [row["family_group_id"] for row in memberships.data or []]
    if not group_ids:
        return []

    query = get_supabase().table("family_members").select("id").in_("family_group_id", group_ids).eq("is_archived", False)
    if family_member_id:
        query = query.eq("id", family_member_id)

    members = query.execute()
    return [row["id"] for row in members.data or []]


def load_prescription_image(image_bytes: bytes) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(image_bytes))
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported or corrupted prescription image") from exc

    image = ImageOps.exif_transpose(image)
    if image.mode != "RGB":
        image = image.convert("RGB")
    return image


def preprocess_image(image: Image.Image) -> tuple[dict[str, Image.Image], dict[str, Any]]:
    rgb_array = np.array(image)
    gray = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2GRAY)

    original_height, original_width = gray.shape[:2]
    longest_edge = max(original_height, original_width)
    resize_scale = 1.0

    if longest_edge < 1400:
        resize_scale = min(2.0, 1600 / float(longest_edge))
    elif longest_edge > 2400:
        resize_scale = 2400 / float(longest_edge)

    if resize_scale != 1.0:
        gray = cv2.resize(
            gray,
            None,
            fx=resize_scale,
            fy=resize_scale,
            interpolation=cv2.INTER_CUBIC if resize_scale > 1 else cv2.INTER_AREA,
        )

    denoised = cv2.fastNlMeansDenoising(gray, None, 18, 7, 21)
    thresholded = cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11,
    )
    otsu_threshold = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]

    variants = {
        "original": image,
        "grayscale": Image.fromarray(gray),
        "thresholded": Image.fromarray(thresholded),
        "otsu": Image.fromarray(otsu_threshold),
    }

    metadata = {
        "original_width": original_width,
        "original_height": original_height,
        "processed_width": int(gray.shape[1]),
        "processed_height": int(gray.shape[0]),
        "resize_scale": round(resize_scale, 3),
        "variants": list(variants.keys()),
    }
    return variants, metadata


def clean_ocr_text(raw_text: str) -> str:
    normalized = unicodedata.normalize("NFKC", raw_text or "")
    normalized = normalized.replace("\r", "\n").replace("\u200b", "")
    normalized = re.sub(r"[ \t]+", " ", normalized)

    cleaned_lines: list[str] = []
    for line in normalized.splitlines():
        candidate = re.sub(r"[^\w\s\-\+\./,%():]", " ", line)
        candidate = re.sub(r"\s+", " ", candidate).strip(" |")
        if candidate:
            cleaned_lines.append(candidate)

    return "\n".join(cleaned_lines).strip()


def score_ocr_text(cleaned_text: str) -> int:
    if not cleaned_text:
        return 0
    alnum_characters = len(re.findall(r"[A-Za-z0-9]", cleaned_text))
    medication_tokens = len(re.findall(r"\b(?:tab|tablet|cap|capsule|mg|ml|syrup|od|bd|hs|sos|ac|pc)\b", cleaned_text, flags=re.IGNORECASE))
    lines = cleaned_text.count("\n") + 1
    return alnum_characters + medication_tokens * 12 + lines * 3


DOSAGE_PATTERN = re.compile(r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|gm|ml|iu|units?)\b", flags=re.IGNORECASE)
FREQUENCY_PATTERN = re.compile(
    r"\b(?:od|bd|tds|tid|qid|hs|sos|stat|qam|qpm|q\d+h|\d-\d-\d|\d/\d/\d)\b",
    flags=re.IGNORECASE,
)
TIMING_PATTERN = re.compile(
    r"\b(?:ac|pc|before food|after food|before breakfast|after breakfast|morning|afternoon|evening|night|bedtime)\b",
    flags=re.IGNORECASE,
)
DURATION_PATTERN = re.compile(r"\b(?:x\s*)?\d+\s*(?:day|days|week|weeks|month|months)\b", flags=re.IGNORECASE)
MEDICATION_FORM_PATTERN = re.compile(
    r"\b(?:tab(?:let)?|cap(?:sule)?|syp|syrup|inj|injection|drop|drops|cream|ointment|gel|lotion|spray)\b",
    flags=re.IGNORECASE,
)
HEADER_PATTERN = re.compile(
    r"^(?:dr|doctor|patient|name|age|sex|date|address|phone|mobile|hospital|clinic|diagnosis|complaint|advice|rx)\b",
    flags=re.IGNORECASE,
)


def infer_field(pattern: re.Pattern[str], line: str) -> str | None:
    match = pattern.search(line)
    return match.group(0).strip() if match else None


FREQUENCY_NORMALIZATION = {
    "od": "Once daily",
    "bd": "Twice daily",
    "tds": "Three times daily",
    "tid": "Three times daily",
    "qid": "Four times daily",
    "sos": "As needed",
    "hs": "Bedtime",
}

TIMING_NORMALIZATION = {
    "ac": "Before food",
    "pc": "After food",
}


def normalize_spaces(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def normalize_frequency(value: str | None) -> str:
    normalized = normalize_spaces(value)
    if not normalized:
        return ""

    key = normalized.lower()
    return FREQUENCY_NORMALIZATION.get(key, normalized)


def normalize_timing(value: str | None) -> str:
    normalized = normalize_spaces(value)
    if not normalized:
        return ""

    key = normalized.lower()
    return TIMING_NORMALIZATION.get(key, normalized)


def confidence_score_to_label(score: float) -> Literal["high", "medium", "low"]:
    if score >= 0.8:
        return "high"
    if score >= 0.55:
        return "medium"
    return "low"


def assess_ocr_quality(cleaned_text: str) -> Literal["high", "medium", "low"]:
    score = score_ocr_text(cleaned_text)
    if score >= 180:
        return "high"
    if score >= 60:
        return "medium"
    return "low"


def normalize_medicine_name_candidate(line: str) -> str | None:
    candidate = re.sub(r"^\s*(?:rx|r\/x)?\s*", "", line, flags=re.IGNORECASE)
    candidate = re.sub(r"^\s*\d+[\).\-\s]+", "", candidate)
    candidate = MEDICATION_FORM_PATTERN.sub(" ", candidate, count=1)

    split_indexes = [
        match.start()
        for pattern in (DOSAGE_PATTERN, FREQUENCY_PATTERN, TIMING_PATTERN, DURATION_PATTERN)
        for match in [pattern.search(candidate)]
        if match
    ]
    if split_indexes:
        candidate = candidate[: min(split_indexes)]

    candidate = re.sub(r"[^A-Za-z0-9\-/+ ]", " ", candidate)
    candidate = re.sub(r"\s+", " ", candidate).strip(" -/,.")

    if len(candidate) < 3:
        return None

    words = candidate.split()
    if len(words) > 5:
        candidate = " ".join(words[:5])

    return candidate.strip()


def looks_like_medicine_line(line: str) -> bool:
    normalized = line.strip()
    if len(normalized) < 4:
        return False

    lower = normalized.lower()
    has_medicine_signal = bool(
        DOSAGE_PATTERN.search(normalized)
        or FREQUENCY_PATTERN.search(normalized)
        or TIMING_PATTERN.search(normalized)
        or DURATION_PATTERN.search(normalized)
        or MEDICATION_FORM_PATTERN.search(normalized)
        or re.match(r"^\s*\d+[\).\-\s]+[A-Za-z]", normalized)
    )

    if HEADER_PATTERN.search(lower) and not has_medicine_signal:
        return False

    if re.search(r"\b(?:bp|temp|pulse|weight|height|diagnosis|follow up|review)\b", lower) and not has_medicine_signal:
        return False

    return has_medicine_signal


def extract_medicines_heuristically(cleaned_text: str) -> StructuredPrescription:
    medicines: list[MedicineStructured] = []
    seen: set[str] = set()

    for raw_line in cleaned_text.splitlines():
        line = raw_line.strip(" -*")
        if not looks_like_medicine_line(line):
            continue

        medicine_name = normalize_medicine_name_candidate(line)
        if not medicine_name:
            continue

        dedupe_key = re.sub(r"[^a-z0-9]+", "", medicine_name.lower())
        if not dedupe_key or dedupe_key in seen:
            continue

        seen.add(dedupe_key)
        has_dosage = bool(DOSAGE_PATTERN.search(line))
        has_frequency = bool(FREQUENCY_PATTERN.search(line))
        has_duration = bool(DURATION_PATTERN.search(line))
        has_timing = bool(TIMING_PATTERN.search(line))
        has_form = bool(MEDICATION_FORM_PATTERN.search(line))
        confidence = 0.46
        if has_dosage:
            confidence += 0.14
        if has_frequency:
            confidence += 0.12
        if has_timing:
            confidence += 0.08
        if has_duration:
            confidence += 0.06
        if has_form:
            confidence += 0.05

        medicines.append(
            MedicineStructured(
                medicine_name=medicine_name,
                dosage=infer_field(DOSAGE_PATTERN, line),
                frequency=infer_field(FREQUENCY_PATTERN, line),
                timing=infer_field(TIMING_PATTERN, line),
                duration=infer_field(DURATION_PATTERN, line),
                instructions=line,
                confidence_score=min(round(confidence, 2), 0.9),
                requires_manual_verification=True,
            )
        )

    return StructuredPrescription(medicines=medicines[:12])


def structured_to_card_payload(
    structured: StructuredPrescription,
    *,
    cleaned_text: str,
    ocr_quality: Literal["high", "medium", "low"],
    important_notes: list[str] | None = None,
    status: Literal["success", "failed"] | None = None,
) -> PrescriptionCardPayload:
    medicines = [
        PrescriptionCardMedicine(
            id=index + 1,
            medicine_name=normalize_spaces(medicine.medicine_name),
            generic_name="",
            strength=normalize_spaces(medicine.dosage),
            form="tablet",
            dose="",
            frequency=normalize_frequency(medicine.frequency),
            timing=normalize_timing(medicine.timing),
            duration=normalize_spaces(medicine.duration),
            instructions=normalize_spaces(medicine.instructions),
            uses=[],
            warnings=[],
            quantity="",
            confidence=confidence_score_to_label(medicine.confidence_score),
        )
        for index, medicine in enumerate(structured.medicines)
        if normalize_spaces(medicine.medicine_name)
    ]

    average_confidence = (
        round(sum(medicine.confidence_score for medicine in structured.medicines) / len(structured.medicines), 2)
        if structured.medicines
        else 0
    )

    summary_text = cleaned_text[:500].strip()
    if len(cleaned_text) > 500:
        summary_text = f"{summary_text}..."

    if not summary_text:
        summary_text = "OCR text was unclear"

    return PrescriptionCardPayload(
        status=status or ("success" if medicines else "failed"),
        ocr_quality=ocr_quality,
        prescription_summary=PrescriptionCardSummary(
            total_medicines=len(medicines),
            confidence_score=average_confidence,
        ),
        medicines=medicines,
        important_notes=important_notes or ([] if medicines else ["No medicines could be confidently extracted"]),
        raw_detected_text_summary=summary_text,
    )


def card_payload_to_structured(payload: PrescriptionCardPayload) -> StructuredPrescription:
    medicines = [
        MedicineStructured(
            medicine_name=normalize_spaces(medicine.medicine_name),
            dosage=normalize_spaces(medicine.strength or medicine.dose) or None,
            frequency=normalize_frequency(medicine.frequency) or None,
            timing=normalize_timing(medicine.timing) or None,
            duration=normalize_spaces(medicine.duration) or None,
            instructions=normalize_spaces(medicine.instructions) or None,
            confidence_score={
                "high": 0.9,
                "medium": 0.65,
                "low": 0.4,
            }.get(medicine.confidence, 0.4),
            requires_manual_verification=medicine.confidence != "high",
        )
        for medicine in payload.medicines
        if normalize_spaces(medicine.medicine_name)
    ]

    return StructuredPrescription(medicines=medicines)


def extract_ocr_text(image_bytes: bytes) -> tuple[str, str, dict[str, Any]]:
    image = load_prescription_image(image_bytes)
    variants, preprocess_metadata = preprocess_image(image)
    attempts: list[dict[str, Any]] = []
    best_raw = ""
    best_cleaned = ""
    best_score = -1

    for variant_name, variant in variants.items():
        for psm in ("6", "4", "11"):
            config = f"--oem 3 --psm {psm}"
            try:
                raw_text = pytesseract.image_to_string(variant, config=config, timeout=max(settings.ocr_timeout_ms // 1000, 5))
            except pytesseract.TesseractNotFoundError as exc:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Tesseract OCR is not installed or not available on PATH. Set TESSERACT_CMD if needed.",
                ) from exc
            except RuntimeError as exc:
                logger.warning("Tesseract runtime warning", extra={"variant": variant_name, "config": config, "error": str(exc)})
                continue

            cleaned_text = clean_ocr_text(raw_text)
            score = score_ocr_text(cleaned_text)
            attempts.append(
                {
                    "variant": variant_name,
                    "config": config,
                    "raw_length": len(raw_text),
                    "cleaned_length": len(cleaned_text),
                    "score": score,
                }
            )

            if score > best_score:
                best_raw = raw_text
                best_cleaned = cleaned_text
                best_score = score

    if not best_cleaned:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="We could not read any text from this prescription. Try a clearer image or better lighting.",
        )

    preprocess_metadata["ocr_attempts"] = attempts
    return best_raw.strip(), best_cleaned, preprocess_metadata


def extract_json_payload(raw_content: str) -> dict[str, Any]:
    try:
        payload = json.loads(raw_content)
        if isinstance(payload, dict):
            return payload
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", raw_content, flags=re.DOTALL)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Groq returned a malformed response that was not valid JSON",
        )

    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Groq returned malformed JSON for prescription parsing",
        ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Groq returned an unexpected JSON payload",
        )
    return payload


def parse_with_groq(cleaned_text: str, ocr_quality: Literal["high", "medium", "low"]) -> tuple[PrescriptionCardPayload, str]:
    groq = get_groq()
    schema = {
        "name": "renomedy_prescription_cards",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["success", "failed"]},
                "ocr_quality": {"type": "string", "enum": ["high", "medium", "low"]},
                "prescription_summary": {
                    "type": "object",
                    "properties": {
                        "total_medicines": {"type": "integer"},
                        "confidence_score": {"type": "number"},
                    },
                    "required": ["total_medicines", "confidence_score"],
                    "additionalProperties": False,
                },
                "medicines": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "integer"},
                            "medicine_name": {"type": "string"},
                            "generic_name": {"type": "string"},
                            "strength": {"type": "string"},
                            "form": {"type": "string"},
                            "dose": {"type": "string"},
                            "frequency": {"type": "string"},
                            "timing": {"type": "string"},
                            "duration": {"type": "string"},
                            "instructions": {"type": "string"},
                            "uses": {"type": "array", "items": {"type": "string"}},
                            "warnings": {"type": "array", "items": {"type": "string"}},
                            "quantity": {"type": "string"},
                            "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                        },
                        "required": [
                            "id",
                            "medicine_name",
                            "generic_name",
                            "strength",
                            "form",
                            "dose",
                            "frequency",
                            "timing",
                            "duration",
                            "instructions",
                            "uses",
                            "warnings",
                            "quantity",
                            "confidence",
                        ],
                        "additionalProperties": False,
                    },
                },
                "important_notes": {"type": "array", "items": {"type": "string"}},
                "raw_detected_text_summary": {"type": "string"},
            },
            "required": ["status", "ocr_quality", "prescription_summary", "medicines", "important_notes", "raw_detected_text_summary"],
            "additionalProperties": False,
        },
    }

    messages = [
        {
            "role": "system",
            "content": (
                "You are Renomedy AI, an intelligent prescription parsing engine for Indian medical prescriptions. "
                "A prescription image has already been OCR scanned. Parse the OCR text, identify medicines only, clean noisy OCR, "
                "convert abbreviations into simple English, and return valid JSON only for mobile medicine cards. "
                "Ignore clinic timings, addresses, phone numbers, unrelated header/footer text, advertisements, and OCR garbage. "
                "Never hallucinate medicines. Only extract actual medicines and medicine-specific instructions. "
                "Do not copy the full prescription line into one field. Keep instructions short and medicine-specific. "
                "Do not include diagnosis text, complaints, test advice, signatures, or follow-up notes inside medicine fields. "
                "If uncertain, mark confidence as low. "
                "OD means Once daily. BD means Twice daily. TDS means Three times daily. QID means Four times daily. "
                "SOS means As needed. HS means Bedtime. AC means Before food. PC means After food."
            ),
        },
        {
            "role": "user",
            "content": (
                "Return this exact JSON structure with mobile-card fields filled only from the OCR text. "
                f"Use ocr_quality '{ocr_quality}'. If no medicines are found, return failed status and an empty medicines array.\n\n"
                "OCR TEXT:\n"
                f"{cleaned_text}"
            ),
        },
    ]

    request_kwargs: dict[str, Any] = {
        "model": settings.groq_model,
        "messages": messages,
        "temperature": 0,
    }

    if settings.groq_model.startswith("openai/"):
        request_kwargs["response_format"] = {"type": "json_schema", "json_schema": schema}

    try:
        response = groq.chat.completions.create(**request_kwargs)
        raw_content = response.choices[0].message.content or "{\"medicines\":[]}"
    except Exception as exc:
        if "response_format" in request_kwargs:
            logger.warning("Groq structured output failed; retrying with prompt-only JSON mode", extra={"error": str(exc)})
            fallback_response = groq.chat.completions.create(
                model=settings.groq_model,
                messages=messages,
                temperature=0,
            )
            raw_content = fallback_response.choices[0].message.content or "{\"medicines\":[]}"
        else:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Groq parsing request failed: {exc}",
            ) from exc

    logger.info("Groq raw response received", extra={"response_preview": raw_content[:1200]})
    payload = extract_json_payload(raw_content)

    try:
        structured = PrescriptionCardPayload.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Groq returned JSON but it did not match the prescription schema",
        ) from exc

    return structured, raw_content


def run_medicine_extraction(cleaned_text: str) -> tuple[StructuredPrescription, PrescriptionCardPayload, str | None, dict[str, Any]]:
    ocr_quality = assess_ocr_quality(cleaned_text)
    heuristic_structured = extract_medicines_heuristically(cleaned_text)
    heuristic_card = structured_to_card_payload(
        heuristic_structured,
        cleaned_text=cleaned_text,
        ocr_quality=ocr_quality,
        important_notes=["Medicines were extracted using OCR heuristics because AI parsing was uncertain."],
    )

    try:
        card_payload, raw_model_response = parse_with_groq(cleaned_text, ocr_quality)
    except HTTPException as exc:
        logger.warning("Groq parsing failed; evaluating heuristic fallback", extra={"detail": str(exc.detail)})
        if heuristic_structured.medicines:
            return (
                heuristic_structured,
                heuristic_card,
                None,
                {
                    "ai_provider": "heuristic",
                    "ai_model": None,
                    "parser": "heuristic_fallback",
                    "fallback_reason": str(exc.detail),
                    "heuristic_candidate_count": len(heuristic_structured.medicines),
                    "card_data": heuristic_card.model_dump(),
                },
            )

        failed_card = PrescriptionCardPayload(
            status="failed",
            ocr_quality=ocr_quality,
            prescription_summary=PrescriptionCardSummary(total_medicines=0, confidence_score=0),
            medicines=[],
            important_notes=["No medicines could be confidently extracted"],
            raw_detected_text_summary="OCR text was unclear",
        )
        return (
            StructuredPrescription(),
            failed_card,
            None,
            {
                "ai_provider": None,
                "ai_model": None,
                "parser": "failed",
                "error": str(exc.detail),
                "heuristic_candidate_count": 0,
                "card_data": failed_card.model_dump(),
            },
        )

    structured = card_payload_to_structured(card_payload)

    if structured.medicines:
        return (
            structured,
            card_payload,
            raw_model_response,
            {
                "ai_provider": "groq",
                "ai_model": settings.groq_model,
                "parser": "groq",
                "heuristic_candidate_count": len(heuristic_structured.medicines),
                "card_data": card_payload.model_dump(),
            },
        )

    if heuristic_structured.medicines:
        return (
            heuristic_structured,
            heuristic_card,
            raw_model_response,
            {
                "ai_provider": "heuristic",
                "ai_model": None,
                "parser": "heuristic_fallback",
                "fallback_reason": "Groq returned zero medicines",
                "heuristic_candidate_count": len(heuristic_structured.medicines),
                "card_data": heuristic_card.model_dump(),
            },
        )

    failed_card = card_payload.model_copy(update={
        "status": "failed",
        "important_notes": ["No medicines could be confidently extracted"],
        "raw_detected_text_summary": "OCR text was unclear" if not cleaned_text.strip() else card_payload.raw_detected_text_summary,
    })
    return (
        structured,
        failed_card,
        raw_model_response,
        {
            "ai_provider": "groq",
            "ai_model": settings.groq_model,
            "parser": "groq",
            "error": "No medicines were extracted automatically",
            "heuristic_candidate_count": 0,
            "card_data": failed_card.model_dump(),
        },
    )


def build_legacy_payload(
    raw_text: str,
    cleaned_text: str,
    structured: StructuredPrescription,
    raw_model_response: str,
    provider_metadata: dict[str, Any],
) -> dict[str, Any]:
    card_data = provider_metadata.get("card_data") if isinstance(provider_metadata.get("card_data"), dict) else {}
    card_medicines = card_data.get("medicines") if isinstance(card_data, dict) else None
    medications = [
        {
            "medicineName": medicine.medicine_name,
            "genericName": (card_medicines[index].get("generic_name", "") if isinstance(card_medicines, list) and index < len(card_medicines) else ""),
            "strength": (card_medicines[index].get("strength", "") if isinstance(card_medicines, list) and index < len(card_medicines) else medicine.dosage),
            "form": (card_medicines[index].get("form", "") if isinstance(card_medicines, list) and index < len(card_medicines) else ""),
            "dose": (card_medicines[index].get("dose", "") if isinstance(card_medicines, list) and index < len(card_medicines) else ""),
            "dosage": medicine.dosage,
            "frequency": medicine.frequency,
            "timing": medicine.timing,
            "duration": medicine.duration,
            "instructions": medicine.instructions,
            "uses": (card_medicines[index].get("uses", []) if isinstance(card_medicines, list) and index < len(card_medicines) else []),
            "warnings": (card_medicines[index].get("warnings", []) if isinstance(card_medicines, list) and index < len(card_medicines) else []),
            "quantity": (card_medicines[index].get("quantity", "") if isinstance(card_medicines, list) and index < len(card_medicines) else ""),
            "confidence": (card_medicines[index].get("confidence", "low") if isinstance(card_medicines, list) and index < len(card_medicines) else "low"),
            "shorthandDetected": [],
            "shorthandExplanation": medicine.instructions,
            "confidenceScore": medicine.confidence_score,
            "requiresManualVerification": medicine.requires_manual_verification,
        }
        for index, medicine in enumerate(structured.medicines)
    ]
    return {
        "rawText": raw_text,
        "cleanedText": cleaned_text,
        "parseStatus": "parsed" if medications else "failed",
        "medications": medications,
        "aiProvider": provider_metadata.get("ai_provider"),
        "aiModel": provider_metadata.get("ai_model"),
        "rawModelResponse": raw_model_response,
        "providerMetadata": provider_metadata,
    }


def persist_pipeline_result(
    *,
    auth_context: AuthContext,
    family_member_id: str,
    doctor_name: str | None,
    hospital_name: str | None,
    prescription_date: str | None,
    filename: str,
    mime_type: str,
    image_bytes: bytes,
    raw_text: str,
    cleaned_text: str,
    structured: StructuredPrescription,
    raw_model_response: str | None,
    provider_metadata: dict[str, Any],
    parse_completed: bool,
) -> dict[str, Any]:
    accessible_family_member_ids = get_accessible_family_member_ids(auth_context.user_id, family_member_id)
    if family_member_id not in accessible_family_member_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Family member is not accessible")

    safe_filename = re.sub(r"\s+", "-", filename or "prescription.jpg")
    storage_path = f"{auth_context.clerk_user_id}/{datetime.now(tz=timezone.utc).strftime('%Y%m%d%H%M%S')}-{safe_filename}"

    logger.info(
        "Uploading prescription image to Supabase",
        extra={
            "storage_path": storage_path,
            "mime_type": mime_type,
            "bytes": len(image_bytes),
            "family_member_id": family_member_id,
            "auth_verified": auth_context.verified,
        },
    )

    try:
        get_supabase().storage.from_(settings.supabase_storage_bucket).upload(
            storage_path,
            image_bytes,
            file_options={"content-type": mime_type},
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to upload prescription image: {exc}") from exc

    prescription_response = (
        get_supabase()
        .table("prescriptions")
        .insert(
            {
                "family_member_id": family_member_id,
                "uploaded_by_user_id": auth_context.user_id,
                "doctor_name": doctor_name,
                "hospital_name": hospital_name,
                "prescription_date": prescription_date,
                "image_url": storage_path,
                "raw_ocr_text": raw_text,
                "cleaned_ocr_text": cleaned_text,
                "parse_status": "parsed" if parse_completed and structured.medicines else ("failed" if parse_completed else "pending"),
                "verification_status": "unverified",
                "ocr_provider": "tesseract",
                "ocr_provider_metadata": provider_metadata,
                "ocr_confidence_score": (
                    round(sum(medicine.confidence_score for medicine in structured.medicines) / len(structured.medicines), 4)
                    if structured.medicines
                    else None
                ),
                "parsed_medicine_json": provider_metadata.get("card_data") if parse_completed else None,
                "ai_provider": provider_metadata.get("ai_provider") if parse_completed else None,
                "ai_model": provider_metadata.get("ai_model") if parse_completed else None,
                "ai_raw_response": raw_model_response if parse_completed else None,
            }
        )
        .execute()
    )

    prescription_rows = prescription_response.data or []
    if not prescription_rows:
        cleanup_uploaded_file(storage_path)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create prescription record")

    prescription_id = prescription_rows[0]["id"]

    try:
        get_supabase().table("prescription_uploads").insert(
            {
                "prescription_id": prescription_id,
                "storage_bucket": settings.supabase_storage_bucket,
                "storage_path": storage_path,
                "mime_type": mime_type,
                "file_size_bytes": len(image_bytes),
                "processing_status": (
                    "ocr_processed"
                    if (not parse_completed or structured.medicines)
                    else "ocr_failed"
                ),
                "last_error": (
                    None
                    if (not parse_completed or structured.medicines)
                    else "No medicines were extracted from the prescription"
                ),
                "last_processed_at": datetime.now(tz=timezone.utc).isoformat(),
            }
        ).execute()
    except Exception as exc:
        get_supabase().table("prescriptions").delete().eq("id", prescription_id).execute()
        cleanup_uploaded_file(storage_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store prescription upload metadata: {exc}",
        ) from exc

    try:
        if structured.medicines:
            get_supabase().table("prescription_medications").insert(
                [
                    {
                        "prescription_id": prescription_id,
                        "medicine_name": medicine.medicine_name,
                        "generic_name": (
                            provider_metadata.get("card_data", {}).get("medicines", [])[index].get("generic_name")
                            if isinstance(provider_metadata.get("card_data"), dict)
                            and isinstance(provider_metadata.get("card_data", {}).get("medicines"), list)
                            and index < len(provider_metadata.get("card_data", {}).get("medicines"))
                            else None
                        ),
                        "dosage": medicine.dosage,
                        "frequency": medicine.frequency,
                        "timing": medicine.timing,
                        "duration": medicine.duration,
                        "instructions": medicine.instructions,
                        "shorthand_detected": [],
                        "shorthand_explanation": medicine.instructions,
                        "confidence_score": medicine.confidence_score,
                        "requires_manual_verification": medicine.requires_manual_verification,
                    }
                    for index, medicine in enumerate(structured.medicines)
                ]
            ).execute()
    except Exception as exc:
        get_supabase().table("prescription_uploads").update(
            {
                "processing_status": "ocr_failed",
                "last_error": f"Medication storage failed: {exc}",
                "last_processed_at": datetime.now(tz=timezone.utc).isoformat(),
            }
        ).eq("prescription_id", prescription_id).execute()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to store parsed medications") from exc

    return {
        "prescription_id": prescription_id,
        "storage_path": storage_path,
        "storage_bucket": settings.supabase_storage_bucket,
        "image_url": build_signed_image_url(storage_path),
    }


async def load_upload_payload(
    request: Request,
    file: UploadFile | None,
    family_member_id: str | None,
    doctor_name: str | None,
    hospital_name: str | None,
    prescription_date: str | None,
    persist_to_supabase: str | None,
) -> dict[str, Any]:
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("application/json"):
        body = JsonProcessPrescriptionRequest.model_validate(await request.json())
        try:
            image_bytes = base64.b64decode(body.imageBase64)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="imageBase64 is not valid base64") from exc

        return {
            "image_bytes": image_bytes,
            "filename": body.filename or "prescription.jpg",
            "mime_type": body.mimeType or "image/jpeg",
            "family_member_id": body.family_member_id,
            "doctor_name": ensure_text(body.doctor_name),
            "hospital_name": ensure_text(body.hospital_name),
            "prescription_date": ensure_text(body.prescription_date),
            "persist_to_supabase": body.persist_to_supabase,
        }

    if not file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prescription image file is required")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded prescription image is empty")

    return {
        "image_bytes": image_bytes,
        "filename": file.filename or "prescription.jpg",
        "mime_type": file.content_type or "application/octet-stream",
        "family_member_id": ensure_text(family_member_id),
        "doctor_name": ensure_text(doctor_name),
        "hospital_name": ensure_text(hospital_name),
        "prescription_date": ensure_text(prescription_date),
        "persist_to_supabase": parse_bool(persist_to_supabase, default=bool(family_member_id)),
    }


def build_process_response(
    *,
    raw_text: str,
    cleaned_text: str,
    preprocess_metadata: dict[str, Any],
    structured: StructuredPrescription | None = None,
    raw_model_response: str | None = None,
    parse_metadata: dict[str, Any] | None = None,
    persisted: dict[str, Any] | None = None,
) -> dict[str, Any]:
    structured = structured or StructuredPrescription()
    parse_metadata = parse_metadata or {}
    card_data = parse_metadata.get("card_data")
    if not isinstance(card_data, dict):
        card_data = structured_to_card_payload(
            structured,
            cleaned_text=cleaned_text,
            ocr_quality=assess_ocr_quality(cleaned_text),
        ).model_dump()
    provider_metadata = {
        "ocr_provider": "tesseract",
        "ai_provider": parse_metadata.get("ai_provider"),
        "ai_model": parse_metadata.get("ai_model"),
        "parser": parse_metadata.get("parser"),
        "fallback_reason": parse_metadata.get("fallback_reason"),
        "error": parse_metadata.get("error"),
        "heuristic_candidate_count": parse_metadata.get("heuristic_candidate_count"),
        "card_data": card_data,
        "preprocess": preprocess_metadata,
    }

    response_data = {
        "raw_text": raw_text,
        "cleaned_text": cleaned_text,
        "parse_status": "parsed" if structured.medicines else "failed",
        "ocr_provider": "tesseract",
        "ai_provider": parse_metadata.get("ai_provider"),
        "ai_model": parse_metadata.get("ai_model"),
        "structured_data": card_data,
        "groq_raw_response": raw_model_response,
        "provider_metadata": provider_metadata,
        "legacy": build_legacy_payload(
            raw_text,
            cleaned_text,
            structured,
            raw_model_response or "{\"medicines\":[]}",
            provider_metadata,
        ),
    }

    if persisted:
        response_data.update(persisted)

    return response_data


@app.get("/")
def root() -> JSONResponse:
    return ok({"message": "Renomedy OCR + AI pipeline running"}, "Renomedy OCR backend ready")


@app.get("/health")
def health() -> JSONResponse:
    return ok(
        {
            "status": "ok",
            "service": settings.app_name,
            "environment": settings.app_env,
            "groq_model": settings.groq_model,
        },
        "Health check passed",
    )


@app.post("/upload-prescription")
async def upload_prescription(
    request: Request,
    file: UploadFile | None = File(default=None),
    family_member_id: str | None = Form(default=None),
    doctor_name: str | None = Form(default=None),
    hospital_name: str | None = Form(default=None),
    prescription_date: str | None = Form(default=None),
    persist_to_supabase: str | None = Form(default=None),
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    payload = await load_upload_payload(
        request,
        file,
        family_member_id,
        doctor_name,
        hospital_name,
        prescription_date,
        persist_to_supabase,
    )

    logger.info(
        "Prescription upload received for OCR text extraction",
        extra={
            "upload_filename": payload["filename"],
            "mime_type": payload["mime_type"],
            "bytes": len(payload["image_bytes"]),
        },
    )

    raw_text, cleaned_text, preprocess_metadata = extract_ocr_text(payload["image_bytes"])
    logger.info("OCR text extracted", extra={"raw_text_preview": raw_text[:1200], "cleaned_text_preview": cleaned_text[:1200]})

    persisted = None
    if payload["persist_to_supabase"]:
        auth_context = get_auth_context(authorization)
        if not auth_context:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication is required to save uploads")
        if not payload["family_member_id"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="family_member_id is required when persisting uploads")

        persisted = persist_pipeline_result(
            auth_context=auth_context,
            family_member_id=payload["family_member_id"],
            doctor_name=payload["doctor_name"],
            hospital_name=payload["hospital_name"],
            prescription_date=payload["prescription_date"],
            filename=payload["filename"],
            mime_type=payload["mime_type"],
            image_bytes=payload["image_bytes"],
            raw_text=raw_text,
            cleaned_text=cleaned_text,
            structured=StructuredPrescription(),
            raw_model_response=None,
            provider_metadata={
                "ocr_provider": "tesseract",
                "ai_provider": None,
                "preprocess": preprocess_metadata,
            },
            parse_completed=False,
        )

    return ok(
        {
            "raw_text": raw_text,
            "cleaned_text": cleaned_text,
            "ocr_provider": "tesseract",
            "preprocess": preprocess_metadata,
            **(persisted or {}),
        },
        "Prescription OCR complete",
    )


@app.post("/parse-prescription")
async def parse_prescription(body: ParsePrescriptionRequest) -> JSONResponse:
    cleaned_text = clean_ocr_text(body.ocr_text)
    if not cleaned_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="OCR text is empty after cleanup. Please retry with a clearer prescription image.",
        )

    logger.info("Parsing cleaned OCR text with Groq", extra={"cleaned_text_preview": cleaned_text[:1200]})
    structured, card_payload, raw_model_response, parse_metadata = run_medicine_extraction(cleaned_text)
    logger.info(
        "Structured prescription parsed",
        extra={"medicine_count": len(structured.medicines), "parser": parse_metadata.get("parser")},
    )

    return ok(
        {
            "cleaned_text": cleaned_text,
            "structured_data": card_payload.model_dump(),
            "parse_status": "parsed" if structured.medicines else "failed",
            "ai_provider": parse_metadata.get("ai_provider"),
            "ai_model": parse_metadata.get("ai_model"),
            "groq_raw_response": raw_model_response,
            "provider_metadata": parse_metadata,
        },
        "Prescription text parsed",
    )


@app.post("/process-prescription")
async def process_prescription(
    request: Request,
    file: UploadFile | None = File(default=None),
    family_member_id: str | None = Form(default=None),
    doctor_name: str | None = Form(default=None),
    hospital_name: str | None = Form(default=None),
    prescription_date: str | None = Form(default=None),
    persist_to_supabase: str | None = Form(default=None),
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    payload = await load_upload_payload(
        request,
        file,
        family_member_id,
        doctor_name,
        hospital_name,
        prescription_date,
        persist_to_supabase,
    )

    logger.info(
        "Processing prescription end-to-end",
        extra={
            "upload_filename": payload["filename"],
            "mime_type": payload["mime_type"],
            "bytes": len(payload["image_bytes"]),
            "persist_to_supabase": payload["persist_to_supabase"],
            "family_member_id": payload["family_member_id"],
        },
    )

    raw_text, cleaned_text, preprocess_metadata = extract_ocr_text(payload["image_bytes"])
    logger.info("OCR extracted text ready for Groq", extra={"cleaned_text_preview": cleaned_text[:1200]})

    if not cleaned_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No readable text could be extracted from the prescription image",
        )

    structured, _card_payload, raw_model_response, parse_metadata = run_medicine_extraction(cleaned_text)
    logger.info(
        "Prescription parsing finished",
        extra={
            "medicine_count": len(structured.medicines),
            "parser": parse_metadata.get("parser"),
            "structured_preview": structured.model_dump(),
        },
    )

    persisted = None
    if payload["persist_to_supabase"]:
        auth_context = get_auth_context(authorization)
        if not auth_context:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication is required to save prescriptions")
        if not payload["family_member_id"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="family_member_id is required when persisting prescriptions")

        persisted = persist_pipeline_result(
            auth_context=auth_context,
            family_member_id=payload["family_member_id"],
            doctor_name=payload["doctor_name"],
            hospital_name=payload["hospital_name"],
            prescription_date=payload["prescription_date"],
            filename=payload["filename"],
            mime_type=payload["mime_type"],
            image_bytes=payload["image_bytes"],
            raw_text=raw_text,
            cleaned_text=cleaned_text,
            structured=structured,
            raw_model_response=raw_model_response,
            provider_metadata={
                "ocr_provider": "tesseract",
                "ai_provider": parse_metadata.get("ai_provider"),
                "ai_model": parse_metadata.get("ai_model"),
                "parser": parse_metadata.get("parser"),
                "fallback_reason": parse_metadata.get("fallback_reason"),
                "error": parse_metadata.get("error"),
                "heuristic_candidate_count": parse_metadata.get("heuristic_candidate_count"),
                "card_data": parse_metadata.get("card_data"),
                "preprocess": preprocess_metadata,
            },
            parse_completed=True,
        )

    response_data = build_process_response(
        raw_text=raw_text,
        cleaned_text=cleaned_text,
        preprocess_metadata=preprocess_metadata,
        structured=structured,
        raw_model_response=raw_model_response,
        parse_metadata=parse_metadata,
        persisted=persisted,
    )
    return ok(response_data, "Prescription processed")
