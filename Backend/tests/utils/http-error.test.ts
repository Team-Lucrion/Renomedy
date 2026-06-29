import test from 'node:test';
import assert from 'node:assert';
import { HttpError } from '../../src/utils/http-error';

test('HttpError - Instantiation with statusCode, message, and details', () => {
    const error = new HttpError(404, 'Not Found', { resource: 'User' });

    assert.strictEqual(error.statusCode, 404);
    assert.strictEqual(error.message, 'Not Found');
    assert.deepStrictEqual(error.details, { resource: 'User' });
    assert.ok(error instanceof Error);
    assert.ok(error instanceof HttpError);
});

test('HttpError - Instantiation with statusCode and message only', () => {
    const error = new HttpError(500, 'Internal Server Error');

    assert.strictEqual(error.statusCode, 500);
    assert.strictEqual(error.message, 'Internal Server Error');
    assert.strictEqual(error.details, undefined);
    assert.ok(error instanceof Error);
    assert.ok(error instanceof HttpError);
});
