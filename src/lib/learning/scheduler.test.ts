import { describe, expect, it } from 'vitest';
import { DAY_MS, needsAttention, newGlyphProgress, scheduleAttempt } from './scheduler';

function acquire(letter = 'a', now = 1_000) {
	let item = newGlyphProgress(letter);
	for (let attempt = 0; attempt < 3; attempt++)
		item = scheduleAttempt(item, true, 2_000, now + attempt);
	return item;
}

describe('evidence-based review scheduler', () => {
	it('requires three recalls before scheduling the first delayed review', () => {
		let item = scheduleAttempt(newGlyphProgress('a'), true, 2_000, 1_000);
		expect(item.stage).toBe('acquiring');
		expect(item.acquisitionCorrect).toBe(1);
		expect(item.nextReviewAt).toBe(1_000);
		item = scheduleAttempt(item, true, 12_000, 1_001);
		item = scheduleAttempt(item, true, 2_000, 1_002);
		expect(item.stage).toBe('reviewing');
		expect(item.mastery).toBe(0.4);
		expect(item.nextReviewAt).toBe(1_002 + DAY_MS);
	});

	it('does not count an early or corrective answer as delayed retention', () => {
		const item = acquire();
		const early = scheduleAttempt(item, true, 2_000, item.nextReviewAt - 1);
		const corrective = scheduleAttempt(item, true, 2_000, item.nextReviewAt, {
			firstAttempt: false,
		});
		expect(early.successfulReviews).toBe(0);
		expect(corrective.successfulReviews).toBe(0);
	});

	it('marks a glyph learned after three due reviews on expanding intervals', () => {
		let item = acquire();
		item = scheduleAttempt(item, true, 2_000, item.nextReviewAt);
		expect(item.successfulReviews).toBe(1);
		expect(item.nextReviewAt).toBe(1_002 + 4 * DAY_MS);
		item = scheduleAttempt(item, true, 2_000, item.nextReviewAt);
		item = scheduleAttempt(item, true, 2_000, item.nextReviewAt);
		expect(item.stage).toBe('learned');
		expect(item.mastery).toBe(0.85);
	});

	it('reduces retention evidence without erasing history after a lapse', () => {
		let item = acquire();
		for (let review = 0; review < 3; review++)
			item = scheduleAttempt(item, true, 2_000, item.nextReviewAt);
		const result = scheduleAttempt(item, false, 1_000, item.nextReviewAt);
		expect(result.stage).toBe('reviewing');
		expect(result.successfulReviews).toBe(2);
		expect(result.lapses).toBe(1);
		expect(result.nextReviewAt).toBe(item.nextReviewAt);
	});

	it('tracks contextual transfer without promoting glyph mastery', () => {
		const result = scheduleAttempt(newGlyphProgress('a'), true, 4_000, 1_000, { mode: 'word' });
		expect(result.introduced).toBe(false);
		expect(result.stage).toBe('unseen');
		expect(result.mastery).toBe(0);
		expect(result.contextualCorrect).toBe(1);
	});

	it('tracks repetition priority separately from mastery', () => {
		const mistaken = scheduleAttempt(newGlyphProgress('a'), false, 4_000, 1_000, {
			mode: 'word',
			repetitionMistake: true,
		});
		expect(mistaken.repetitionPriority).toBe(1);
		expect(mistaken.mastery).toBe(0);
		expect(needsAttention(mistaken, 1_000)).toBe(true);

		const corrected = scheduleAttempt(mistaken, true, 4_000, 2_000, { mode: 'word' });
		expect(corrected.repetitionPriority).toBe(0);
		expect(needsAttention(corrected, 2_000)).toBe(false);
	});

	it('tracks encoding accuracy separately from other contextual practice', () => {
		const result = scheduleAttempt(newGlyphProgress('a'), true, 1_000, 0, {
			mode: 'encode',
		});
		expect(result.encodingAttempts).toBe(1);
		expect(result.encodingCorrect).toBe(1);
		expect(result.contextualAttempts).toBe(1);
		expect(result.isolatedAttempts).toBe(0);
	});

	it('marks isolated glyph practice as introduced', () => {
		const result = scheduleAttempt(newGlyphProgress('a'), true, 1_000, 0, { mode: 'glyph' });
		expect(result.introduced).toBe(true);
	});

	it('does not introduce a glyph after an incorrect isolated answer', () => {
		const result = scheduleAttempt(newGlyphProgress('a'), false, 1_000, 0, { mode: 'glyph' });
		expect(result.introduced).toBe(false);
	});

	it('identifies acquiring and overdue glyphs', () => {
		expect(
			needsAttention(
				{ ...newGlyphProgress('a'), attempts: 1, isolatedAttempts: 1, stage: 'acquiring' },
				10,
			),
		).toBe(true);
		expect(needsAttention({ ...acquire(), nextReviewAt: 5 }, 10)).toBe(true);
		expect(needsAttention(newGlyphProgress('a'), 10)).toBe(false);
	});
});
