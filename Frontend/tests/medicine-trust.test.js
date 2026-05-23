const assert = require('assert');
const {
  evaluateMedicineRelationships,
  getMedicineTrustProfile,
} = require('../src/utils/medicineTrust');
const { searchIndianMedicines } = require('../src/data/indianMedicines');

const telmaProfile = getMedicineTrustProfile({ medicineName: 'Telma 40' });
assert.deepStrictEqual(telmaProfile.molecules, ['telmisartan']);
assert.strictEqual(telmaProfile.refillCriticality, 'high');
assert.strictEqual(telmaProfile.familyDisplayName, 'Telma 40');
assert.strictEqual(telmaProfile.parsedStrength, '40 mg');

const panResult = searchIndianMedicines('Pan 40', 1)[0];
assert.strictEqual(panResult.brandName, 'Pan');
assert.strictEqual(panResult.genericName, 'Pantoprazole');
assert.strictEqual(panResult.selectedStrength, '40 mg');

const doloResult = searchIndianMedicines('Dolo 650', 1)[0];
assert.strictEqual(doloResult.brandName, 'Dolo');
assert.strictEqual(doloResult.genericName, 'Paracetamol');
assert.strictEqual(doloResult.selectedStrength, '650 mg');

const cetirizineMisspelling = searchIndianMedicines('Citrezene', 1)[0];
assert.strictEqual(cetirizineMisspelling.genericName, 'Cetirizine');

const thyronormResult = searchIndianMedicines('Thyronorm 50', 1)[0];
assert.strictEqual(thyronormResult.selectedStrength, '50 mcg');

const sameMoleculeDifferentBrand = evaluateMedicineRelationships(
  { medicineName: 'Tazloc', strength: '40 mg' },
  [{ scheduleId: 'active-1', medicineName: 'Telma', strength: '40 mg' }],
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
assert.strictEqual(formulationVariant[0].type, 'formulation_variant');

const catalogResult = searchIndianMedicines('Januvia', 1)[0];
assert.strictEqual(catalogResult.genericName, 'Sitagliptin');
assert.strictEqual(catalogResult.trustMetadata.refillCriticality, 'high');

console.log('medicine trust tests passed');
