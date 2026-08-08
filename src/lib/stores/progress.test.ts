import { get } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';
import {
	createProgressBackup,
	importProgressBackup,
	introduceGlyph,
	progress,
	recordAttempt,
	recordGuidedIntroduction,
	recordHandwritingAssessment,
	resetProgress,
	restoreProgressBackup,
} from './progress';

describe('progress recording', () => {
	afterEach(resetProgress);

	it('scores a contextual typo only against the affected expected glyph', () => {
		recordAttempt('cat', 'cab', 1_000, { mode: 'word' });
		const saved = get(progress);
		expect(saved.c.contextualCorrect).toBe(1);
		expect(saved.a.contextualCorrect).toBe(1);
		expect(saved.t.contextualCorrect).toBe(0);
		expect(saved.t.contextualAttempts).toBe(1);
		expect(saved.b).toBeUndefined();
		expect(saved.c.stage).toBe('unseen');
	});

	it('introduces a glyph only after the correct Latin character is selected', () => {
		recordAttempt('a', 'b', 1_000, { mode: 'glyph' });
		expect(get(progress).a.introduced).toBe(false);

		recordAttempt('a', 'a', 1_000, { mode: 'glyph' });
		expect(get(progress).a.introduced).toBe(true);
	});

	it('requires every occurrence of a repeated letter to be right', () => {
		recordAttempt('omen', 'open', 1_000, { mode: 'word' });
		const saved = get(progress);
		expect(saved.o.contextualCorrect).toBe(1);
		expect(saved.m.contextualCorrect).toBe(0);
		expect(saved.e.contextualCorrect).toBe(1);
		expect(saved.n.contextualCorrect).toBe(1);
	});

	it('round-trips a versioned progress backup', () => {
		recordAttempt('a', 'a', 1_000, { mode: 'glyph' });
		const backup = createProgressBackup(get(progress));
		resetProgress();
		importProgressBackup(backup);
		expect(get(progress).a.isolatedCorrect).toBe(1);
	});

	it('records an explicit introduction without promoting mastery', () => {
		introduceGlyph('a');
		const saved = get(progress).a;
		expect(saved.introduced).toBe(true);
		expect(saved.isolatedAttempts).toBe(0);
		expect(saved.stage).toBe('unseen');
	});

	it('introduces a guided glyph only after a successful repetition', () => {
		recordGuidedIntroduction('a', false);
		expect(get(progress).a).toBeUndefined();

		recordGuidedIntroduction('a', true);
		const saved = get(progress).a;
		expect(saved.introduced).toBe(true);
		expect(saved.isolatedAttempts).toBe(0);
		expect(saved.stage).toBe('unseen');
	});

	it('infers introductions from isolated attempts in legacy backups', () => {
		const restored = restoreProgressBackup({
			version: 1,
			progress: {
				a: { isolatedAttempts: 1 },
				b: { contextualAttempts: 1 },
			},
		});
		expect(restored.a.introduced).toBe(true);
		expect(restored.b.introduced).toBe(false);
	});

	it('rejects unsupported or malformed backups', () => {
		expect(() => restoreProgressBackup({ version: 2, progress: {} })).toThrow();
		expect(() => restoreProgressBackup({ version: 1, progress: { answer: {} } })).toThrow();
	});

	it('tracks handwriting self-assessment without changing recognition mastery', () => {
		recordHandwritingAssessment('a', 'almost');
		const saved = get(progress).a;
		expect(saved.handwritingAttempts).toBe(1);
		expect(saved.handwritingAlmost).toBe(1);
		expect(saved.mastery).toBe(0);
	});
});
