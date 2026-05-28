const assert = require('assert');
const { commonIndianMedicines, searchIndianMedicines, suggestOcrMedicineCorrections } = require('../src/data/indianMedicines');
const { detectExcludedMedicine, hasDecimalDosage, parsePositiveInteger } = require('../src/utils/medicineSafety');

assert(commonIndianMedicines.length >= 200, 'offline Indian medicine catalog should have at least 200 entries');
assert(searchIndianMedicines('telma').some((medicine) => medicine.brandName.startsWith('Telma')), 'search should match brand names');
assert.strictEqual(searchIndianMedicines('Telma 40', 1)[0].brandName, 'Telma 40 Tablet', 'exact brand and strength should rank highest');
assert(searchIndianMedicines('metformin').some((medicine) => medicine.genericName.includes('Metformin')), 'search should match generic names');
assert.strictEqual(searchIndianMedicines('telma', 20).some((medicine) => /Montelmax/i.test(medicine.brandName)), false, 'token matching should avoid substring false positives');
assert.strictEqual(searchIndianMedicines('Teima', 20).some((medicine) => /Montelmax/i.test(medicine.brandName)), false, 'ordinary search should not use broad OCR mistake candidates');
assert.strictEqual(suggestOcrMedicineCorrections('Teima', 3)[0].genericName, 'Telmisartan', 'OCR correction should use catalog OCR candidates');

assert.strictEqual(detectExcludedMedicine('Lantus insulin').category, 'insulin');
assert.strictEqual(detectExcludedMedicine({ medicineName: 'Folitrax 7.5', genericName: 'Methotrexate' }).category, 'methotrexate');
assert.strictEqual(detectExcludedMedicine('Telma 40'), null);

assert.strictEqual(hasDecimalDosage('0.5 tablet'), true);
assert.strictEqual(hasDecimalDosage('1/2 tablet'), true);
assert.strictEqual(hasDecimalDosage('1 tablet'), false);
assert.strictEqual(parsePositiveInteger('30 tablets'), 30);

console.log('medicine-safety tests passed');
