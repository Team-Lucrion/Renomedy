type ExcludedMedicineRule = {
  category: string;
  label: string;
  terms: string[];
};

const EXCLUDED_MEDICINE_RULES: ExcludedMedicineRule[] = [
  { category: "insulin", label: "Insulin or injectable diabetes medicine", terms: ["insulin", "huminsulin", "mixtard", "lantus", "novorapid", "apidra", "toujeo", "tresiba", "basalog"] },
  { category: "methotrexate", label: "Methotrexate", terms: ["methotrexate", "mexate", "folitrax", "metoject"] },
  { category: "anticoagulant", label: "Anticoagulant or blood thinner", terms: ["warfarin", "acenocoumarol", "acitrom", "apixaban", "eliquis", "rivaroxaban", "xarelto", "dabigatran", "pradaxa", "heparin", "enoxaparin", "clexane"] },
  { category: "psychiatric", label: "Psychiatric medicine", terms: ["sertraline", "escitalopram", "fluoxetine", "paroxetine", "venlafaxine", "duloxetine", "amitriptyline", "mirtazapine", "lithium", "risperidone", "olanzapine", "quetiapine", "clozapine", "aripiprazole", "haloperidol", "clonazepam", "alprazolam", "lorazepam", "diazepam", "zolfresh", "zolpidem"] },
  { category: "epilepsy", label: "Epilepsy or seizure medicine", terms: ["levetiracetam", "keppra", "valproate", "valparin", "divalproex", "carbamazepine", "tegretol", "oxcarbazepine", "oxetol", "phenytoin", "eptoin", "lamotrigine", "topiramate", "lacosamide", "pregabalin", "gabapentin"] }
];

export type ExcludedMedicineSignal = {
  category: string;
  label: string;
  matchedTerm: string;
};

function normalizeSafetyText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9.\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectExcludedMedicine(input: Record<string, unknown> | string): ExcludedMedicineSignal | null {
  const parts =
    typeof input === "string"
      ? [input]
      : [input.medicine_name, input.brand_name, input.generic_name, input.instructions];
  const haystack = ` ${normalizeSafetyText(parts.filter(Boolean).join(" "))} `;

  for (const rule of EXCLUDED_MEDICINE_RULES) {
    const matchedTerm = rule.terms.find((term) => haystack.includes(` ${normalizeSafetyText(term)} `));
    if (matchedTerm) {
      return { category: rule.category, label: rule.label, matchedTerm };
    }
  }

  return null;
}
