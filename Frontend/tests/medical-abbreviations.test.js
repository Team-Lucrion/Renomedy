const assert = require('assert');
const {
  translateMedicalAbbreviation,
  translateMedicalText,
} = require('../src/utils/medicalAbbreviations');

const knownCases = [
  ['OD', 'Once daily'],
  ['BD', 'Twice daily'],
  ['TDS', 'Three times daily'],
  ['QID', 'Four times daily'],
  ['SOS', 'As needed'],
  ['AC', 'Before food'],
  ['PC', 'After food'],
  ['HS', 'At bedtime'],
  ['Stat', 'Immediately'],
  ['QOD', 'Every other day'],
  ['QW', 'Once a week'],
  ['BW', 'Twice a week'],
];

for (const [input, expected] of knownCases) {
  const result = translateMedicalAbbreviation(input);
  assert.strictEqual(result.isKnown, true, `${input} should be known`);
  assert.strictEqual(result.displayText, expected);
}

const phrase = translateMedicalText('OD PC');
assert.strictEqual(phrase.displayText, 'Once daily After food');
assert.deepStrictEqual(
  phrase.knownTranslations.map((item) => item.abbreviation),
  ['OD', 'PC'],
);

const unknown = translateMedicalText('XYZ');
assert.deepStrictEqual(unknown.unknownAbbreviations, ['XYZ']);
assert.strictEqual(unknown.displayText, 'XYZ');

console.log('medical-abbreviations.test.js PASS');
