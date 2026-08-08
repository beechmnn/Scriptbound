import type { GlyphProgress, LearningStage, PracticeMode } from '$lib/types';

export const DAY_MS = 86_400_000;
export const REVIEW_DAYS = [1, 3, 7, 14, 30, 60] as const;
export const ACQUISITION_RECALLS = 3;
export const LEARNED_REVIEWS = 3;
export const DURABLE_REVIEWS = 5;

export type AttemptOptions = { mode?: PracticeMode; firstAttempt?: boolean };

export function newGlyphProgress(letter: string): GlyphProgress {
	return {
		letter,
		introduced: false,
		attempts: 0,
		correct: 0,
		streak: 0,
		mastery: 0,
		averageTimeMs: 0,
		lastPractisedAt: 0,
		nextReviewAt: 0,
		reviewLevel: 0,
		stage: 'unseen',
		acquisitionCorrect: 0,
		successfulReviews: 0,
		lapses: 0,
		isolatedAttempts: 0,
		isolatedCorrect: 0,
		contextualAttempts: 0,
		contextualCorrect: 0,
		encodingAttempts: 0,
		encodingCorrect: 0,
		handwritingAttempts: 0,
		handwritingCorrect: 0,
		handwritingAlmost: 0,
		recentFirstAttempts: [],
		correctResponseTimesMs: [],
	};
}

function stageForReviews(reviews: number): LearningStage {
	return reviews >= DURABLE_REVIEWS
		? 'durable'
		: reviews >= LEARNED_REVIEWS
			? 'learned'
			: 'reviewing';
}

function masteryFor(stage: LearningStage, acquisitionCorrect: number, reviews: number): number {
	if (stage === 'unseen') return 0;
	if (stage === 'acquiring') return Math.min(0.39, acquisitionCorrect * 0.13);
	if (stage === 'reviewing') return Math.min(0.84, 0.4 + reviews * 0.15);
	if (stage === 'learned')
		return Math.min(0.94, 0.85 + Math.max(0, reviews - LEARNED_REVIEWS) * 0.05);
	return 1;
}

export function scheduleAttempt(
	previous: GlyphProgress,
	correct: boolean,
	elapsedMs: number,
	now = Date.now(),
	options: AttemptOptions = {},
): GlyphProgress {
	const mode = options.mode ?? 'glyph',
		firstAttempt = options.firstAttempt ?? true;
	const attempts = previous.attempts + 1;
	const contextual = mode !== 'glyph',
		encoding = mode === 'encode';
	const base = {
		...previous,
		introduced: previous.introduced || (!contextual && correct),
		attempts,
		correct: previous.correct + (correct ? 1 : 0),
		streak: correct ? previous.streak + 1 : 0,
		lastPractisedAt: now,
		contextualAttempts: previous.contextualAttempts + (contextual ? 1 : 0),
		contextualCorrect: previous.contextualCorrect + (contextual && correct ? 1 : 0),
		encodingAttempts: previous.encodingAttempts + (encoding ? 1 : 0),
		encodingCorrect: previous.encodingCorrect + (encoding && correct ? 1 : 0),
		isolatedAttempts: previous.isolatedAttempts + (contextual ? 0 : 1),
		isolatedCorrect: previous.isolatedCorrect + (!contextual && correct ? 1 : 0),
	};

	// Context can demonstrate transfer, but it must not promote isolated glyph mastery.
	if (contextual) return base;

	const averageTimeMs = Math.round(
		(previous.averageTimeMs * previous.isolatedAttempts + elapsedMs) /
			(previous.isolatedAttempts + 1),
	);
	const recentFirstAttempts = firstAttempt
		? [...previous.recentFirstAttempts, correct].slice(-10)
		: previous.recentFirstAttempts;
	const correctResponseTimesMs =
		correct && firstAttempt
			? [...previous.correctResponseTimesMs, elapsedMs].slice(-10)
			: previous.correctResponseTimesMs;
	if (!correct) {
		const wasRetained =
			previous.stage === 'reviewing' ||
			previous.stage === 'learned' ||
			previous.stage === 'durable';
		const successfulReviews = wasRetained
			? Math.max(0, previous.successfulReviews - 1)
			: previous.successfulReviews;
		const stage = wasRetained
			? stageForReviews(successfulReviews)
			: previous.stage === 'unseen'
				? 'acquiring'
				: previous.stage;
		return {
			...base,
			averageTimeMs,
			recentFirstAttempts,
			correctResponseTimesMs,
			stage,
			successfulReviews,
			lapses: previous.lapses + (wasRetained ? 1 : 0),
			mastery: masteryFor(stage, previous.acquisitionCorrect, successfulReviews),
			reviewLevel: Math.max(0, previous.reviewLevel - 1),
			nextReviewAt: now,
		};
	}

	if (previous.stage === 'unseen' || previous.stage === 'acquiring') {
		const acquisitionCorrect = Math.min(ACQUISITION_RECALLS, previous.acquisitionCorrect + 1);
		const acquired = acquisitionCorrect >= ACQUISITION_RECALLS;
		const stage: LearningStage = acquired ? 'reviewing' : 'acquiring';
		return {
			...base,
			averageTimeMs,
			recentFirstAttempts,
			correctResponseTimesMs,
			acquisitionCorrect,
			stage,
			mastery: masteryFor(stage, acquisitionCorrect, previous.successfulReviews),
			reviewLevel: 0,
			nextReviewAt: acquired ? now + REVIEW_DAYS[0] * DAY_MS : now,
		};
	}

	// An early or corrective success is useful practice, but only a first-attempt due recall advances retention evidence.
	if (!firstAttempt || now < previous.nextReviewAt) {
		return { ...base, averageTimeMs, recentFirstAttempts, correctResponseTimesMs };
	}
	const successfulReviews = previous.successfulReviews + 1;
	const stage = stageForReviews(successfulReviews);
	const reviewLevel = Math.min(successfulReviews, REVIEW_DAYS.length - 1);
	return {
		...base,
		averageTimeMs,
		recentFirstAttempts,
		correctResponseTimesMs,
		successfulReviews,
		stage,
		reviewLevel,
		mastery: masteryFor(stage, previous.acquisitionCorrect, successfulReviews),
		nextReviewAt: now + REVIEW_DAYS[reviewLevel] * DAY_MS,
	};
}

export function needsAttention(item: GlyphProgress, now = Date.now()): boolean {
	return (
		item.isolatedAttempts > 0 &&
		(item.stage === 'acquiring' || (item.nextReviewAt > 0 && item.nextReviewAt <= now))
	);
}
