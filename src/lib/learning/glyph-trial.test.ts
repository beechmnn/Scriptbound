import { describe, expect, it } from 'vitest';
import type { GlyphProgress } from '$lib/types';
import { newGlyphProgress } from './scheduler';
import {
	betterGlyphTrialRecord,
	firstUncompletedUnlockedGlyphTrialTier,
	formatGlyphTrialTime,
	glyphTrialFinalTime,
	glyphTrialPool,
	isGlyphTrialTierUnlocked,
	nextUnlockedGlyphTrialTier,
	type GlyphTrialRecord,
	unlockedGlyphTrialTiers,
} from './glyph-trial';

const curriculum = 'etaoinshrdlucmfwygpbvqxjkz'.split('');

function introducedProgress(letters: string[]): Record<string, GlyphProgress> {
	return Object.fromEntries(
		letters.map((letter) => [letter, { ...newGlyphProgress(letter), introduced: true }]),
	);
}

function record(finalTimeMs: number): GlyphTrialRecord {
	return {
		finalTimeMs,
		rawTimeMs: finalTimeMs,
		mistakes: 0,
		bestCombo: 20,
		completedAt: 1,
	};
}

describe('glyph fluency trials', () => {
	it('uses a fixed curriculum prefix for each tier', () => {
		expect(glyphTrialPool(curriculum, 'initiate')).toEqual(curriculum.slice(0, 6));
		expect(glyphTrialPool(curriculum, 'master')).toEqual(curriculum);
	});

	it('unlocks a tier only after every glyph in its pool was introduced', () => {
		expect(
			isGlyphTrialTierUnlocked(curriculum, introducedProgress(curriculum.slice(0, 5)), 'initiate'),
		).toBe(false);
		expect(
			isGlyphTrialTierUnlocked(curriculum, introducedProgress(curriculum.slice(0, 6)), 'initiate'),
		).toBe(true);
	});

	it('reports every tier unlocked by the current progress', () => {
		expect(
			unlockedGlyphTrialTiers(curriculum, introducedProgress(curriculum.slice(0, 17))),
		).toEqual(['initiate', 'scribe']);
	});

	it('finds the next higher unlocked tier', () => {
		const progress = introducedProgress(curriculum.slice(0, 18));
		expect(nextUnlockedGlyphTrialTier(curriculum, progress, 'initiate')).toBe('scribe');
		expect(nextUnlockedGlyphTrialTier(curriculum, progress, 'scribe')).toBe('scholar');
		expect(nextUnlockedGlyphTrialTier(curriculum, progress, 'scholar')).toBeUndefined();
	});

	it('offers the first unlocked tier that has not been completed', () => {
		const progress = introducedProgress(curriculum.slice(0, 12));
		expect(firstUncompletedUnlockedGlyphTrialTier(curriculum, progress, new Set())).toBe(
			'initiate',
		);
		expect(
			firstUncompletedUnlockedGlyphTrialTier(curriculum, progress, new Set(['initiate'])),
		).toBe('scribe');
		expect(
			firstUncompletedUnlockedGlyphTrialTier(curriculum, progress, new Set(['initiate', 'scribe'])),
		).toBeUndefined();
	});

	it('adds two seconds for every mistake', () => {
		expect(glyphTrialFinalTime(12_345, 3)).toBe(18_345);
		expect(formatGlyphTrialTime(18_345)).toBe('18.3s');
	});

	it('keeps the faster personal record', () => {
		const fast = record(18_000);
		const slow = record(22_000);
		expect(betterGlyphTrialRecord(undefined, slow)).toBe(slow);
		expect(betterGlyphTrialRecord(slow, fast)).toBe(fast);
		expect(betterGlyphTrialRecord(fast, slow)).toBe(fast);
	});
});
