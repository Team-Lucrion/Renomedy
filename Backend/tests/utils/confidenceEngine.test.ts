import { computeConfidence } from '../../src/utils/confidenceEngine';
import test from 'node:test';
import assert from 'node:assert';
import * as intelligence from '../../src/utils/medicineIntelligence';
import * as trust from '../../src/utils/medicineTrust';

// Mocking dependencies for testing various scenarios

test('confidenceEngine - Exact Match Auto Accept', () => {
    // High AI and OCR signals
    const res = computeConfidence({
        medicineName: 'Dolo 650',
        dosage: '650mg',
        strength: '650mg',
        frequency: 'twice a day',
        ocrConfidence: 0.95,
        medGemmaConfidence: 0.98
    });

    assert.ok(res.confidenceScore >= 0.95, `Expected score >= 0.95, got ${res.confidenceScore}`);
    assert.strictEqual(res.level, 'Auto Accept');
    assert.strictEqual(res.matchType, 'exact');
    assert.strictEqual(res.isUnknown, false);
    assert.strictEqual(res.validationFailures.length, 0);
});

test('confidenceEngine - Correction Review', () => {
    // Test fuzzy/correction logic with slight typos
    const res = computeConfidence({
        medicineName: 'Dolooo',
        dosage: '650mg',
        strength: '650mg',
        frequency: 'twice a day',
        ocrConfidence: 0.8,
        medGemmaConfidence: 0.9
    });

    assert.ok(res.confidenceScore < 0.95, `Expected score < 0.95, got ${res.confidenceScore}`);
    assert.ok(res.confidenceScore > 0, `Expected score > 0, got ${res.confidenceScore}`);
    // This could be review or manual verification depending on the mock/actual data,
    // but definitely not an exact match.
});

test('confidenceEngine - Unknown Medicine', () => {
    const res = computeConfidence({
        medicineName: 'asdfqwertyxyz',
        dosage: '10mg',
        ocrConfidence: 0.9,
        medGemmaConfidence: 0.9
    });

    assert.strictEqual(res.isUnknown, true);
    assert.ok(res.validationFailures.includes('Unknown medicine'));
    assert.ok(res.confidenceScore < 0.9);
});

test('confidenceEngine - Missing Dosage', () => {
    const res = computeConfidence({
        medicineName: 'Dolo 650',
        frequency: 'twice a day',
        ocrConfidence: 0.95,
        medGemmaConfidence: 0.95
    });

    assert.ok(res.validationFailures.includes('Missing dosage'));
    assert.ok(res.confidenceScore < 0.95);
});

test('confidenceEngine - Impossible Frequency', () => {
    const res = computeConfidence({
        medicineName: 'Dolo 650',
        dosage: '650mg',
        frequency: '15 times a day',
        ocrConfidence: 0.95,
        medGemmaConfidence: 0.95
    });

    assert.ok(res.validationFailures.includes('Impossible frequency'));
    assert.ok(res.confidenceScore < 0.90); // Should be severely penalized
});

test('confidenceEngine - Ambiguous OCR', () => {
    const res = computeConfidence({
        medicineName: 'Dolo 650',
        dosage: '650mg',
        frequency: 'twice a day',
        ocrConfidence: 0.2, // very low
        medGemmaConfidence: 0.9
    });

    assert.ok(res.validationFailures.includes('Ambiguous OCR'));
});

test('confidenceEngine - Duplicate Medicines', () => {
    const existing = [{
        medicine_name: 'Dolo',
        generic_name: 'Paracetamol',
        dosage: '650mg'
    }];

    // Simulating evaluateMedicineRelationships behavior
    // Without full mock, we'll verify it doesn't crash
    const res = computeConfidence({
        medicineName: 'Dolo 650',
        dosage: '650mg',
        ocrConfidence: 0.9,
        medGemmaConfidence: 0.9
    }, existing);

    assert.ok(res.confidenceScore > 0);
});
