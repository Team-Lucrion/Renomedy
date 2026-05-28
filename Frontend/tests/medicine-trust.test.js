const assert = require('assert');
const {
  evaluateMedicineRelationships,
  getMedicineTrustProfile,
} = require('../src/utils/medicineTrust');
const { searchIndianMedicines, suggestOcrMedicineCorrections } = require('../src/data/indianMedicines');

const telmaProfile = getMedicineTrustProfile({ medicineName: 'Telma 40' });
assert.deepStrictEqual(telmaProfile.molecules, ['telmisartan']);
assert.strictEqual(telmaProfile.refillCriticality, 'high');
assert.strictEqual(telmaProfile.familyDisplayName, 'Telma 40');
assert.strictEqual(telmaProfile.parsedStrength, '40 mg');

const panResult = searchIndianMedicines('Pan 40', 1)[0];
assert.strictEqual(panResult.brandName, 'PAN 40 Tablet');
assert.strictEqual(panResult.genericName, 'Pantoprazole');
assert.strictEqual(panResult.selectedStrength, '40mg');

const doloResult = searchIndianMedicines('Dolo 650', 1)[0];
assert.strictEqual(doloResult.brandName, 'Dolo 650 Tablet');
assert.strictEqual(doloResult.genericName, 'Paracetamol');
assert.strictEqual(doloResult.selectedStrength, '650mg');

const telmaOcrMisspelling = suggestOcrMedicineCorrections('Teima', 1)[0];
assert.strictEqual(telmaOcrMisspelling.genericName, 'Telmisartan');

const thyronormResult = searchIndianMedicines('Thyronorm 50', 1)[0];
assert.strictEqual(thyronormResult.brandName.startsWith('Thyronorm'), true);

const sameMoleculeDifferentBrand = evaluateMedicineRelationships(
  { medicineName: 'Telma 40 Tablet', strength: '40mg' },
  [{ scheduleId: 'active-1', medicineName: 'Telma 40 Tablet', strength: '40mg' }],
);
assert.strictEqual(sameMoleculeDifferentBrand[0].type, 'duplicate_state');

const brandToGenericOverlap = evaluateMedicineRelationships(
  { medicineName: 'Pan 40' },
  [{ scheduleId: 'active-pan', medicineName: 'Pantoprazole', strength: '40 mg' }],
);
assert.strictEqual(brandToGenericOverlap[0].type, 'duplicate_state');

const comboOverlap = evaluateMedicineRelationships(
  { medicineName: 'Telma-AM', genericName: 'Telmisartan + Amlodipine', strength: '40/5 mg' },
  [{ scheduleId: 'active-2', medicineName: 'Telma', genericName: 'Telmisartan', strength: '40 mg' }],
);
assert.strictEqual(comboOverlap[0].type, 'combo_overlap');

const formulationVariant = evaluateMedicineRelationships(
  { medicineName: 'Glycomet SR', genericName: 'Metformin', strength: '500 mg' },
  [{ scheduleId: 'active-3', medicineName: 'Glycomet', genericName: 'Metformin', strength: '500 mg' }],
);
assert.strictEqual(formulationVariant[0].type, 'same_molecule');

const catalogResult = searchIndianMedicines('Januvia', 1)[0];
assert.strictEqual(catalogResult, undefined);
const supportedDiabetesResult = searchIndianMedicines('Glycomet', 1)[0];
assert.strictEqual(supportedDiabetesResult.genericName, 'Metformin');
assert.strictEqual(supportedDiabetesResult.supportMode, 'full_support');
assert.strictEqual(supportedDiabetesResult.trustMetadata.refillCriticality, 'high');

console.log('medicine trust tests passed');
