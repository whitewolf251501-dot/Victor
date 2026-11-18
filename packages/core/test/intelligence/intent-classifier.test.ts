import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IntentClassifier } from '../../src/intelligence/intent-classifier';

describe('System 1: IntentClassifier Specification Suite', () => {
  describe('Memory Command Intent Recognition', () => {
    it('classifies "remember that" as memory remember action', () => {
      const intent = IntentClassifier.classify('remember that my favorite language is TypeScript');
      assert.equal(intent.type, 'memory_command');
      assert.equal(intent.memoryAction, 'remember');
      assert.equal(intent.params.content, 'my favorite language is TypeScript');
      assert.ok(intent.confidence >= 0.9);
    });

    it('classifies "note that" as memory remember action', () => {
      const intent = IntentClassifier.classify('note that the server port is 8080');
      assert.equal(intent.type, 'memory_command');
      assert.equal(intent.memoryAction, 'remember');
      assert.equal(intent.params.content, 'the server port is 8080');
    });

    it('classifies "forget about" as memory forget action', () => {
      const intent = IntentClassifier.classify('forget about my old phone number');
      assert.equal(intent.type, 'memory_command');
      assert.equal(intent.memoryAction, 'forget');
      assert.equal(intent.params.target, 'my old phone number');
    });

    it('classifies "recall" and "what do you remember about" as memory queries', () => {
      const intent1 = IntentClassifier.classify('recall my morning routine');
      assert.equal(intent1.type, 'memory_command');
      assert.equal(intent1.memoryAction, 'query');
      assert.equal(intent1.params.query, 'my morning routine');

      const intent2 = IntentClassifier.classify('what do you remember about Velmora architecture');
      assert.equal(intent2.type, 'memory_command');
      assert.equal(intent2.memoryAction, 'query');
      assert.equal(intent2.params.query, 'Velmora architecture');
    });

    it('classifies "correction:" and "update memory" as memory correction', () => {
      const intent = IntentClassifier.classify('correction: my timezone is Asia/Kolkata');
      assert.equal(intent.type, 'memory_command');
      assert.equal(intent.memoryAction, 'correct');
      assert.equal(intent.params.correction, 'my timezone is Asia/Kolkata');
    });
  });

  describe('Action Directive Intent Recognition', () => {
    it('classifies web search query with vic.web.search capability', () => {
      const intent = IntentClassifier.classify('search the web for Next.js 15 App Router documentation');
      assert.equal(intent.type, 'action');
      assert.equal(intent.capabilityId, 'vic.web.search');
      assert.equal(intent.actionName, 'search');
      assert.equal(intent.params.query, 'Next.js 15 App Router documentation');
      assert.ok(intent.confidence >= 0.85);
    });

    it('classifies command execution directive with vic.terminal.execute capability', () => {
      const intent = IntentClassifier.classify('execute command: git status -s');
      assert.equal(intent.type, 'action');
      assert.equal(intent.capabilityId, 'vic.terminal.execute');
      assert.equal(intent.actionName, 'execute');
      assert.equal(intent.params.command, 'git status -s');
    });

    it('classifies system wipe directive with vic.system.wipe_audit_log capability', () => {
      const intent = IntentClassifier.classify('wipe audit_log');
      assert.equal(intent.type, 'action');
      assert.equal(intent.capabilityId, 'vic.system.wipe_audit_log');
      assert.equal(intent.actionName, 'wipe');
      assert.equal(intent.params.target, 'audit_log');
    });

    it('classifies system reboot directive with vic.system.reboot capability', () => {
      const intent = IntentClassifier.classify('reboot the server');
      assert.equal(intent.type, 'action');
      assert.equal(intent.capabilityId, 'vic.system.reboot');
      assert.equal(intent.actionName, 'reboot');
      assert.equal(intent.params.target, 'system');
    });
  });

  describe('Informational Query & General Conversation', () => {
    it('classifies questions starting with what/why/how as queries', () => {
      const intent = IntentClassifier.classify('What is the current system architecture?');
      assert.equal(intent.type, 'query');
      assert.equal(intent.params.query, 'What is the current system architecture?');
    });

    it('classifies casual conversation without directives as conversation', () => {
      const intent = IntentClassifier.classify('Good morning Victor, let us begin our shift.');
      assert.equal(intent.type, 'conversation');
      assert.equal(intent.confidence, 0.7);
    });

    it('handles empty input gracefully', () => {
      const intent = IntentClassifier.classify('');
      assert.equal(intent.type, 'conversation');
      assert.equal(intent.rawText, '');
    });
  });
});
