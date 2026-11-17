import type { MemoryCategory, MemoryImportance } from '@victor/shared';

export interface MemoryCandidate {
  content: string;
  category: MemoryCategory;
  importance: MemoryImportance;
  confidence: number;
}

interface ExtractionRule {
  pattern: RegExp;
  category: MemoryCategory;
  importance: MemoryImportance;
  confidence: number;
  extractor: (match: RegExpExecArray) => string;
}

const EXTRACTION_RULES: ExtractionRule[] = [
  // 1. Facts
  {
    // "my name is John", "my name's Shlok"
    pattern: /\bmy name(?:'s|\s+is)\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'fact',
    importance: 'high',
    confidence: 0.95,
    extractor: (m) => `Owner's name is ${m[1].trim()}`,
  },
  {
    // "i am a software engineer", "i'm a pilot"
    pattern: /\bi(?:'m|\s+am)\s+(?:an?)\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'fact',
    importance: 'medium',
    confidence: 0.8,
    extractor: (m) => `Owner is a ${m[1].trim()}`,
  },
  {
    // "i live in Mumbai"
    pattern: /\bi\s+live\s+in\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'fact',
    importance: 'high',
    confidence: 0.88,
    extractor: (m) => `Owner lives in ${m[1].trim()}`,
  },

  // 2. Preferences
  {
    // "I prefer dark mode and minimal UI"
    pattern: /\bi\s+prefer\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'preference',
    importance: 'medium',
    confidence: 0.85,
    extractor: (m) => `Prefers ${m[1].trim()}`,
  },
  {
    // "I like clean HUD interfaces"
    pattern: /\bi\s+like\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'preference',
    importance: 'medium',
    confidence: 0.75,
    extractor: (m) => `Likes ${m[1].trim()}`,
  },
  {
    // "My favorite color is pitch black"
    pattern: /\bmy\s+favorite\s+([a-z\s]+?)\s+is\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'preference',
    importance: 'medium',
    confidence: 0.85,
    extractor: (m) => `Favorite ${m[1].trim()} is ${m[2].trim()}`,
  },

  // 3. Goals
  {
    // "my goal is to build an autonomous companion"
    pattern: /\bmy\s+goal\s+is(?:\s+to)?\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'goal',
    importance: 'medium',
    confidence: 0.85,
    extractor: (m) => `Goal: ${m[1].trim()}`,
  },
  {
    // "I want to launch the product by next week"
    pattern: /\bi\s+want\s+to\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'goal',
    importance: 'medium',
    confidence: 0.75,
    extractor: (m) => `Wants to ${m[1].trim()}`,
  },

  // 4. Decisions
  {
    // "I decided to use Next.js 15" / "I decided that we should..."
    pattern: /\bi(?:\s+have|'ve)?\s+decided(?:\s+to|\s+that)?\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'decision',
    importance: 'high',
    confidence: 0.9,
    extractor: (m) => `Decided to ${m[1].trim()}`,
  },

  // 5. Instructions
  {
    // "remind me to inspect the server"
    pattern: /\bremind\s+me(?:\s+to)?\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'instruction',
    importance: 'high',
    confidence: 0.95,
    extractor: (m) => `Reminder: ${m[1].trim()}`,
  },
  {
    // "remember that I prefer dark mode" / "remember to backup the db"
    pattern: /\bremember\s+(?:that\s+|to\s+)?(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'instruction',
    importance: 'high',
    confidence: 0.95,
    extractor: (m) => m[1].trim(),
  },

  // 6. Projects
  {
    // "I am working on Victor Noctis" / "I'm working on project X"
    pattern: /\bi(?:'m|\s+am)\s+working\s+on\s+(.+?)(?:[.!?]+(?:\s+|$)|$)/i,
    category: 'project',
    importance: 'medium',
    confidence: 0.85,
    extractor: (m) => `Working on ${m[1].trim()}`,
  },
];

/**
 * Extracts candidate memories from a user message and assistant response turn.
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

  const candidates: MemoryCandidate[] = [];
  const seenContent = new Set<string>();

  for (const rule of EXTRACTION_RULES) {
    const match = rule.pattern.exec(trimmed);
    if (match) {
      const extractedContent = rule.extractor(match).trim();
      const cleaned = extractedContent.replace(/[.,;:!?]+$/, '').trim();

      if (cleaned.length >= 3 && rule.confidence > 0.7) {
        const lowerKey = `${rule.category}:${cleaned.toLowerCase()}`;
        if (!seenContent.has(lowerKey)) {
          seenContent.add(lowerKey);
          candidates.push({
            content: cleaned,
            category: rule.category,
            importance: rule.importance,
            confidence: rule.confidence,
          });
        }
      }
    }
  }

  return candidates;
}
