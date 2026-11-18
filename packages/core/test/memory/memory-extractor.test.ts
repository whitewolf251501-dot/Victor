import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractMemoriesFromMessage } from '../../src/memory/memory-extractor';

describe('System 2: MemoryExtractor Specification Suite', () => {
  it('extracts user-stated facts and sets provenance to user_stated', () => {
    const candidates = extractMemoriesFromMessage('My name is Shlok Patel.');
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].category, 'fact');
    assert.equal(candidates[0].content, "Owner's name is Shlok Patel");
    assert.equal(candidates[0].provenance, 'user_stated');
    assert.ok(candidates[0].confidence >= 0.9);
  });

  it('extracts inferred preferences and sets provenance to inferred', () => {
    const candidates = extractMemoriesFromMessage('I prefer dark mode and high-contrast terminal themes.');
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].category, 'preference');
    assert.equal(candidates[0].content, 'Prefers dark mode and high-contrast terminal themes');
    assert.equal(candidates[0].provenance, 'inferred');
    assert.ok(candidates[0].confidence >= 0.75);
  });

  it('extracts direct instructions with high confidence', () => {
    const candidates = extractMemoriesFromMessage('Remember that the staging server domain is stage.victor.internal.');
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].category, 'instruction');
    assert.equal(candidates[0].provenance, 'user_stated');
    assert.ok(candidates[0].confidence >= 0.9);
  });

  it('strictly rejects extraction of sensitive credentials and API keys', () => {
    // Attempting to inject passwords or secret tokens into memory
    const candidates1 = extractMemoriesFromMessage('Remember that my password is SuperSecretPassword123!');
    assert.equal(candidates1.length, 0);

    const candidates2 = extractMemoriesFromMessage('My API_KEY is AIzaSyD3xAmPlEkEy1234567890abcdefghij');
    assert.equal(candidates2.length, 0);

    const candidates3 = extractMemoriesFromMessage('Remember that my secret token is Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token');
    assert.equal(candidates3.length, 0);

    const candidates4 = extractMemoriesFromMessage('Remember that my SSN is 123-45-6789');
    assert.equal(candidates4.length, 0);
  });

  it('ignores conversational noise and short messages', () => {
    assert.equal(extractMemoriesFromMessage('hi').length, 0);
    assert.equal(extractMemoriesFromMessage('ok thanks!').length, 0);
    assert.equal(extractMemoriesFromMessage('').length, 0);
  });
});
