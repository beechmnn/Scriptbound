import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { GlyphProgress, PracticeMode } from '$lib/types';
import { newGlyphProgress, prioritizeRepetition, scheduleAttempt } from '$lib/learning/scheduler';
import { compareAnswer, normalizeAnswer } from '$lib/learning/answer-checker';
import { currentCourse } from '$lib/app';
import { readMigratedValue } from './persistence';

const KEY = `scriptbound:progress:${currentCourse.id}:v1`;
const LEGACY_KEYS = ['necrofonticon-progress-v1'];
export type ProgressBackup = {
	version: 2;
	course: typeof currentCourse.id;
	exportedAt: string;
	progress: Record<string, GlyphProgress>;
};
function migrateItem(letter: string, item: Partial<GlyphProgress>): GlyphProgress {
	const fresh = newGlyphProgress(letter),
		attempts = item.attempts ?? 0,
		oldMastery = item.mastery ?? 0;
	const inferredStage =
		item.stage ?? (attempts === 0 ? 'unseen' : oldMastery >= 0.55 ? 'reviewing' : 'acquiring');
	const acquisitionCorrect =
		item.acquisitionCorrect ?? (inferredStage === 'reviewing' ? 3 : Math.min(2, item.streak ?? 0));
	const successfulReviews =
		item.successfulReviews ?? (oldMastery >= 0.85 ? 2 : oldMastery >= 0.55 ? 1 : 0);
	const migratedMastery = item.stage
		? oldMastery
		: inferredStage === 'reviewing'
			? 0.4 + successfulReviews * 0.15
			: inferredStage === 'acquiring'
				? acquisitionCorrect * 0.13
				: 0;
	return {
		...fresh,
		...item,
		letter,
		introduced: item.introduced ?? (item.isolatedAttempts ?? attempts) > 0,
		stage: inferredStage,
		acquisitionCorrect,
		successfulReviews,
		mastery: migratedMastery,
		isolatedAttempts: item.isolatedAttempts ?? attempts,
		isolatedCorrect: item.isolatedCorrect ?? item.correct ?? 0,
		recentFirstAttempts: Array.isArray(item.recentFirstAttempts)
			? item.recentFirstAttempts.slice(-10)
			: [],
		correctResponseTimesMs: Array.isArray(item.correctResponseTimesMs)
			? item.correctResponseTimesMs.slice(-10)
			: [],
	};
}
function migrate(saved: Record<string, Partial<GlyphProgress>>): Record<string, GlyphProgress> {
	return Object.fromEntries(
		Object.entries(saved).map(([letter, item]) => [letter, migrateItem(letter, item)]),
	);
}
function loadSaved(): Record<string, GlyphProgress> {
	if (!browser) return {};
	try {
		return migrate(JSON.parse(readMigratedValue(localStorage, KEY, LEGACY_KEYS) ?? '{}'));
	} catch {
		return {};
	}
}
const initial: Record<string, GlyphProgress> = loadSaved();
export const progress = writable(initial);
if (browser) progress.subscribe((value) => localStorage.setItem(KEY, JSON.stringify(value)));
export function resetProgress() {
	progress.set({});
}
export function introduceGlyph(letter: string) {
	if (!/^[a-z]$/.test(letter)) return;
	progress.update((all) => {
		const old = all[letter] ?? newGlyphProgress(letter);
		if (old.introduced) return all;
		return { ...all, [letter]: { ...old, introduced: true } };
	});
}
export function recordGuidedIntroduction(letter: string, successful: boolean) {
	if (successful) introduceGlyph(letter);
}
export function createProgressBackup(value: Record<string, GlyphProgress>): ProgressBackup {
	return {
		version: 2,
		course: currentCourse.id,
		exportedAt: new Date().toISOString(),
		progress: value,
	};
}
export function restoreProgressBackup(value: unknown): Record<string, GlyphProgress> {
	if (!value || typeof value !== 'object') throw new Error('Invalid progress backup');
	const backup = value as { version?: unknown; course?: unknown; progress?: unknown };
	const isLegacy = backup.version === 1;
	const isCurrent = backup.version === 2 && backup.course === currentCourse.id;
	if ((!isLegacy && !isCurrent) || !backup.progress || typeof backup.progress !== 'object') {
		throw new Error('Unsupported progress backup');
	}
	const saved = backup.progress as Record<string, Partial<GlyphProgress>>;
	if (
		Object.entries(saved).some(
			([letter, item]) => !/^[a-z]$/.test(letter) || !item || typeof item !== 'object',
		)
	) {
		throw new Error('Invalid progress records');
	}
	return migrate(saved);
}
export function importProgressBackup(value: unknown) {
	progress.set(restoreProgressBackup(value));
}
export function recordHandwritingAssessment(
	letter: string,
	assessment: 'correct' | 'almost' | 'incorrect',
) {
	if (!/^[a-z]$/.test(letter)) return;
	progress.update((all) => {
		const old = all[letter] ?? newGlyphProgress(letter);
		return {
			...all,
			[letter]: {
				...old,
				handwritingAttempts: old.handwritingAttempts + 1,
				handwritingCorrect: old.handwritingCorrect + (assessment === 'correct' ? 1 : 0),
				handwritingAlmost: old.handwritingAlmost + (assessment === 'almost' ? 1 : 0),
			},
		};
	});
}
export function recordAttempt(
	expected: string,
	answer: string,
	elapsedMs: number,
	options: { mode?: PracticeMode; firstAttempt?: boolean; forceIncorrect?: boolean } = {},
) {
	const target = normalizeAnswer(expected),
		parts = compareAnswer(answer, target);
	const outcomes = new Map<string, boolean[]>();
	const repetitionMistakes = new Set<string>();
	for (const part of parts) {
		const isMistake = options.forceIncorrect || part.status !== 'correct';
		if (isMistake && /[a-z]/.test(part.expected)) repetitionMistakes.add(part.expected);
		if (isMistake && /[a-z]/.test(part.character)) repetitionMistakes.add(part.character);
		if (!/[a-z]/.test(part.expected)) continue;
		const values = outcomes.get(part.expected) ?? [];
		values.push(!options.forceIncorrect && part.status === 'correct');
		outcomes.set(part.expected, values);
	}
	progress.update((all) => {
		const next = { ...all };
		for (const [letter, results] of outcomes) {
			const old = all[letter] ?? newGlyphProgress(letter);
			next[letter] = scheduleAttempt(old, results.every(Boolean), elapsedMs, Date.now(), {
				...options,
				repetitionMistake: repetitionMistakes.has(letter),
			});
		}
		for (const letter of repetitionMistakes) {
			if (outcomes.has(letter)) continue;
			next[letter] = prioritizeRepetition(all[letter] ?? newGlyphProgress(letter));
		}
		return next;
	});
}
