import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROMPT_VERSION,
  VICTOR_PERSONALITY,
  buildSystemPrompt,
  getVictorSystemPrompt,
} from '../../src/personality';

describe('System 1: Personality & Prompt Versioning Specification Suite', () => {
  it('exposes semantically versioned personality configuration', () => {
    assert.equal(typeof PROMPT_VERSION, 'string');
    assert.ok(PROMPT_VERSION.length > 0);
    assert.equal(VICTOR_PERSONALITY.version, PROMPT_VERSION);
    assert.equal(VICTOR_PERSONALITY.name, 'Victor Noctis');
    assert.equal(VICTOR_PERSONALITY.codename, 'VIC');
    assert.ok(VICTOR_PERSONALITY.languages.includes('English'));
    assert.ok(VICTOR_PERSONALITY.languages.includes('Hinglish'));
    assert.ok(VICTOR_PERSONALITY.languages.includes('Gujarati'));
  });

  it('embeds mandatory strict invariants in system prompt', () => {
    const prompt = buildSystemPrompt({ ownerName: 'Shlok' });

    assert.ok(prompt.includes('Strict Invariants (Non-Negotiable)'));
    assert.ok(prompt.includes('No Fake Sentience'));
    assert.ok(prompt.includes('No Yes-Man Behavior'));
    assert.ok(prompt.includes('No Unverified Claims'));
    assert.ok(prompt.includes('No Mock Actions'));
    assert.ok(prompt.includes('Authority Adherence'));
  });

  it('embeds input containment and prompt injection boundaries', () => {
    const prompt = buildSystemPrompt({ ownerName: 'Shlok' });

    assert.ok(prompt.includes('Security & Input Containment'));
    assert.ok(prompt.includes('untrusted data'));
    assert.ok(prompt.includes('jailbreak'));
  });

  it('properly injects dynamic contextual sections', () => {
    const prompt = buildSystemPrompt({
      ownerName: 'Shlok Patel',
      memories: '• User prefers Next.js with TypeScript strict mode.',
      deviceType: 'android',
    });

    assert.ok(prompt.includes('Shlok Patel'));
    assert.ok(prompt.includes('Current Device: ANDROID'));
    assert.ok(prompt.includes('User prefers Next.js with TypeScript strict mode.'));
  });

  it('appends custom operational context via getVictorSystemPrompt', () => {
    const custom = getVictorSystemPrompt('Tactical alert: High latency detected.');
    assert.ok(custom.includes('## Operational Context'));
    assert.ok(custom.includes('Tactical alert: High latency detected.'));
  });
});
