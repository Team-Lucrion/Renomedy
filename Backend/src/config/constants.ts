export const TRUST_DISCLAIMER = {
  noDiagnosis: "Renomedy explains prescriptions and adherence workflows; it does not diagnose conditions.",
  noDoctorReplacement: "Renomedy does not replace doctors, pharmacists, or emergency medical care.",
  verificationRequired:
    "Prescription OCR and shorthand interpretation must be human-verified before medication action."
};

export const VERIFICATION_STATUS = {
  unverified: "unverified",
  userVerified: "user_verified",
  pharmacistVerified: "pharmacist_verified",
  doctorVerified: "doctor_verified"
} as const;
