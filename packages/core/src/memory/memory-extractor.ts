import type { MemoryCategory, MemoryImportance, MemoryProvenance } from '@victor/shared';
import { SecretSanitizer } from '../vte/secret-sanitizer';

export interface MemoryCandidate {
  content: string;
  category: MemoryCategory;
  importance: MemoryImportance;
  confidence: number;
  provenance: MemoryProvenance;
}

interface ExtractionRule {
  pattern: RegExp;
  category: MemoryCategory;
  importance: MemoryImportance;
  confidence: number;
  provenance: MemoryProvenance;
  extractor: (match: RegExpExecArray) => string;
}

const SENSITIVE_PATTERNS = [
  /\b(?:password|passwd|pwd)\b/i,
  /\bapi[_-]?key\b/i,
  /\bsecret\s*(?:token|key)?\b/i,
  /\bbearer\s+[a-z0-9_\-\.]{10,}/i,
  /\bsk-[a-z0-9]{15,}/i,
  /\bAIza[0-9A-Za-z-_]{30,}/i,
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b(?:\d{4}[-\s]?){3}\d{4}\b/, // Credit Card
];

function containsSensitiveData(text: string): boolean {
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

const EXTRACTION_RULES: ExtractionRule[] = [
  // 1. Facts
  {
    // "my name is John", "my name's Shlok"
    pattern: /\bmy name(?:'s|\s+is)\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'fact',
    importance: 'high',
    confidence: 0.95,
    provenance: 'user_stated',
    extractor: (m) => `Owner's name is ${m[1].trim()}`,
  },
  {
    // "i am a software engineer", "i'm a pilot"
    pattern: /\bi(?:'m|\s+am)\s+(?:an?)\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'fact',
    importance: 'medium',
    confidence: 0.8,
    provenance: 'inferred',
    extractor: (m) => `Owner is a ${m[1].trim()}`,
  },
  {
    // "i live in Mumbai"
    pattern: /\bi\s+live\s+in\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'fact',
    importance: 'high',
    confidence: 0.88,
    provenance: 'inferred',
    extractor: (m) => `Owner lives in ${m[1].trim()}`,
  },

  // 2. Preferences
  {
    // "I prefer dark mode and minimal UI"
    pattern: /\bi\s+prefer\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'preference',
    importance: 'medium',
    confidence: 0.85,
    provenance: 'inferred',
    extractor: (m) => `Prefers ${m[1].trim()}`,
  },
  {
    // "I like clean HUD interfaces"
    pattern: /\bi\s+like\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'preference',
    importance: 'medium',
    confidence: 0.75,
    provenance: 'inferred',
    extractor: (m) => `Likes ${m[1].trim()}`,
  },
  {
    // "My favorite color is pitch black"
    pattern: /\bmy\s+favorite\s+([a-z\s]+?)\s+is\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'preference',
    importance: 'medium',
    confidence: 0.85,
    provenance: 'user_stated',
    extractor: (m) => `Favorite ${m[1].trim()} is ${m[2].trim()}`,
  },

  // 3. Goals
  {
    // "my goal is to build an autonomous companion"
    pattern: /\bmy\s+goal\s+is(?:\s+to)?\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'goal',
    importance: 'medium',
    confidence: 0.85,
    provenance: 'user_stated',
    extractor: (m) => `Goal: ${m[1].trim()}`,
  },
  {
    // "I want to launch the product by next week"
    pattern: /\bi\s+want\s+to\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'goal',
    importance: 'medium',
    confidence: 0.75,
    provenance: 'inferred',
    extractor: (m) => `Wants to ${m[1].trim()}`,
  },

  // 4. Decisions
  {
    // "I decided to use Next.js 15" / "I decided that we should..."
    pattern: /\bi(?:\s+have|'ve)?\s+decided(?:\s+to|\s+that)?\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'decision',
    importance: 'high',
    confidence: 0.9,
    provenance: 'user_stated',
    extractor: (m) => `Decided to ${m[1].trim()}`,
  },

  // 5. Instructions & Direct User Statements
  {
    // "remind me to inspect the server"
    pattern: /\bremind\s+me(?:\s+to)?\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'instruction',
    importance: 'high',
    confidence: 0.95,
    provenance: 'user_stated',
    extractor: (m) => `Reminder: ${m[1].trim()}`,
  },
  {
    // "remember that I prefer dark mode" / "remember to backup the db"
    pattern: /\bremember\s+(?:that\s+|to\s+)?(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'instruction',
    importance: 'high',
    confidence: 0.95,
    provenance: 'user_stated',
    extractor: (m) => m[1].trim(),
  },

  // 6. Projects
  {
    // "I am working on Victor Noctis" / "I'm working on project X"
    pattern: /\bi(?:'m|\s+am)\s+working\s+on\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'project',
    importance: 'medium',
    confidence: 0.85,
    provenance: 'inferred',
    extractor: (m) => `Working on ${m[1].trim()}`,
  },
];

/**
 * Extracts candidate memories from a user message and assistant response turn.
 * Sensitive credentials (passwords, auth tokens, secret keys) are strictly rejected.
 * Only returns candidates with confidence > 0.7.
 */
export function extractMemoriesFromMessage(
  message: string,
  _response?: string
): MemoryCandidate[] {
  if (!message || typeof message !== 'string') {
    return [];
  }

  const trimmed = message.trim();
  if (trimmed.length < 5) {
    return [];
  }

  // Reject auto-extraction if the source message contains explicit sensitive credentials
  if (containsSensitiveData(trimmed)) {
    return [];
  }

  const candidates: MemoryCandidate[] = [];
  const seenContent = new Set<string>();

  for (const rule of EXTRACTION_RULES) {
    const match = rule.pattern.exec(trimmed);
    if (match) {
      const extractedContent = rule.extractor(match).trim();
      const cleaned = extractedContent.replace(/[.,;:!?]+$/, '').trim();

      // Check extracted content for sensitive data
      if (containsSensitiveData(cleaned)) {
        continue;
      }

      if (cleaned.length >= 3 && rule.confidence > 0.7) {
        const lowerKey = `${rule.category}:${cleaned.toLowerCase()}`;
        if (!seenContent.has(lowerKey)) {
          seenContent.add(lowerKey);
          candidates.push({
            content: cleaned,
            category: rule.category,
            importance: rule.importance,
            confidence: rule.confidence,
            provenance: rule.provenance,
          });
        }
      }
    }
  }

  return candidates;
}
