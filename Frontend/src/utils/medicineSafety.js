const EXCLUDED_MEDICINE_RULES = [
  {
    category: 'insulin',
    label: 'Insulin or injectable diabetes medicine',
    terms: ['insulin', 'huminsulin', 'mixtard', 'lantus', 'novorapid', 'apidra', 'toujeo', 'tresiba', 'basalog'],
  },
  {
    category: 'methotrexate',
    label: 'Methotrexate',
    terms: ['methotrexate', 'mexate', 'folitrax', 'metoject'],
  },
  {
    category: 'anticoagulant',
    label: 'Anticoagulant or blood thinner',
    terms: ['warfarin', 'acenocoumarol', 'acitrom', 'apixaban', 'eliquis', 'rivaroxaban', 'xarelto', 'dabigatran', 'pradaxa', 'heparin', 'enoxaparin', 'clexane'],
  },
  {
    category: 'psychiatric',
    label: 'Psychiatric medicine',
    terms: ['sertraline', 'escitalopram', 'fluoxetine', 'paroxetine', 'venlafaxine', 'duloxetine', 'amitriptyline', 'mirtazapine', 'lithium', 'risperidone', 'olanzapine', 'quetiapine', 'clozapine', 'aripiprazole', 'haloperidol', 'clonazepam', 'alprazolam', 'lorazepam', 'diazepam', 'zolfresh', 'zolpidem'],
  },
  {
    category: 'epilepsy',
    label: 'Epilepsy or seizure medicine',
    terms: ['levetiracetam', 'keppra', 'valproate', 'valparin', 'divalproex', 'carbamazepine', 'tegretol', 'oxcarbazepine', 'oxetol', 'phenytoin', 'eptoin', 'lamotrigine', 'topiramate', 'lacosamide', 'pregabalin', 'gabapentin'],
  },
];

function normalizeSafetyText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9.\/]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function detectExcludedMedicine(input) {
  const parts = typeof input === 'string'
    ? [input]
    : [input?.medicineName, input?.brandName, input?.genericName, input?.instructions];
  const haystack = ` ${normalizeSafetyText(parts.filter(Boolean).join(' '))} `;

  for (const rule of EXCLUDED_MEDICINE_RULES) {
    const matchedTerm = rule.terms.find((term) => haystack.includes(` ${normalizeSafetyText(term)} `));
    if (matchedTerm) {
      return {
        category: rule.category,
        label: rule.label,
        matchedTerm,
      };
    }
  }

  return null;
}

function hasDecimalDosage(...values) {
  const haystack = normalizeSafetyText(values.filter(Boolean).join(' '));
  return /\b\d+\.\d+\b/.test(haystack) || /\b\d+\s*\/\s*\d+\b/.test(haystack) || /[¼½¾⅓⅔]/.test(haystack);
}

function parsePositiveInteger(value) {
  const match = String(value || '').match(/\b\d+\b/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

module.exports = {
  EXCLUDED_MEDICINE_RULES,
  detectExcludedMedicine,
  hasDecimalDosage,
  parsePositiveInteger,
};
