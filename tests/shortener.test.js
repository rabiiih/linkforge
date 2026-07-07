const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateCode, isValidUrl, isValidCode, ALPHABET } = require('../src/shortener');

test('generateCode returns the requested length', () => {
  assert.equal(generateCode(7).length, 7);
  assert.equal(generateCode(10).length, 10);
});

test('generateCode only uses unambiguous alphabet characters', () => {
  for (let i = 0; i < 200; i++) {
    const code = generateCode();
    for (const ch of code) {
      assert.ok(ALPHABET.includes(ch), `unexpected char: ${ch}`);
    }
  }
});

test('generateCode produces unique values (collision sanity check)', () => {
  const seen = new Set(Array.from({ length: 1000 }, () => generateCode()));
  assert.equal(seen.size, 1000);
});

test('generateCode rejects invalid lengths', () => {
  assert.throws(() => generateCode(2), RangeError);
  assert.throws(() => generateCode(100), RangeError);
  assert.throws(() => generateCode(7.5), RangeError);
});

test('isValidUrl accepts http and https', () => {
  assert.ok(isValidUrl('https://example.com'));
  assert.ok(isValidUrl('http://example.com/path?q=1#frag'));
});

test('isValidUrl rejects dangerous or malformed input', () => {
  assert.equal(isValidUrl('javascript:alert(1)'), false); // XSS via redirect
  assert.equal(isValidUrl('file:///etc/passwd'), false);
  assert.equal(isValidUrl('ftp://example.com'), false);
  assert.equal(isValidUrl('not a url'), false);
  assert.equal(isValidUrl(''), false);
  assert.equal(isValidUrl(null), false);
  assert.equal(isValidUrl('https://' + 'a'.repeat(3000)), false); // too long
});

test('isValidCode matches generated codes and rejects junk', () => {
  assert.ok(isValidCode(generateCode()));
  assert.equal(isValidCode('has spaces'), false);
  assert.equal(isValidCode('ab'), false); // too short
  assert.equal(isValidCode('semi;colon'), false);
  assert.equal(isValidCode('../../etc'), false); // path traversal attempt
});
