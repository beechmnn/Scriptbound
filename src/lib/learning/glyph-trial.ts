import type { GlyphProgress } from '$lib/types';

export const GLYPH_TRIAL_LENGTH = 20;
export const GLYPH_TRIAL_MISTAKE_PENALTY_MS = 2_000;

export const GLYPH_TRIAL_TIERS = [
	{ id: 'initiate', glyphCount: 6 },
	{ id: 'scribe', glyphCount: 12 },
	{ id: 'scholar', glyphCount: 18 },
	{ id: 'master', glyphCount: 26 },
] as const;

export type GlyphTrialTierId = (typeof GLYPH_TRIAL_TIERS)[number]['id'];

export type GlyphTrialRecord = {
	finalTimeMs: number;
	rawTimeMs: number;
	mistakes: number;
	bestCombo: number;
	completedAt: number;
};

export function glyphTrialPool(curriculum: string[], tierId: GlyphTrialTierId): string[] {
	const tier = GLYPH_TRIAL_TIERS.find((candidate) => candidate.id === tierId);
	if (!tier) return [];
	return curriculum.slice(0, tier.glyphCount);
}

export function isGlyphTrialTierUnlocked(
	curriculum: string[],
	progress: Record<string, GlyphProgress>,
	tierId: GlyphTrialTierId,
): boolean {
	const pool = glyphTrialPool(curriculum, tierId);
	return pool.length > 0 && pool.every((letter) => progress[letter]?.introduced);
}

export function unlockedGlyphTrialTiers(
	curriculum: string[],
	progress: Record<string, GlyphProgress>,
): GlyphTrialTierId[] {
	return GLYPH_TRIAL_TIERS.filter((tier) =>
		isGlyphTrialTierUnlocked(curriculum, progress, tier.id),
	).map((tier) => tier.id);
}

export function glyphTrialFinalTime(rawTimeMs: number, mistakes: number): number {
	return Math.max(0, rawTimeMs) + Math.max(0, mistakes) * GLYPH_TRIAL_MISTAKE_PENALTY_MS;
}

export function betterGlyphTrialRecord(
	previous: GlyphTrialRecord | undefined,
	next: GlyphTrialRecord,
): GlyphTrialRecord {
	return !previous || next.finalTimeMs < previous.finalTimeMs ? next : previous;
}

export function formatGlyphTrialTime(milliseconds: number): string {
	return `${(Math.max(0, milliseconds) / 1_000).toFixed(1)}s`;
}
