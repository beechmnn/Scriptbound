import { browser } from '$app/environment';
import { currentCourse } from '$lib/app';
import type { Locale } from '$lib/types';
import { resetGlyphTrialRecords } from './glyph-trials';
import { resetProgress } from './progress';

const locales: Locale[] = ['en', 'de'];

export function learningDataKeys() {
	return [
		`scriptbound:progress:${currentCourse.id}:v1`,
		`scriptbound:glyph-trials:${currentCourse.id}:v1`,
		`scriptbound:guided-lesson-seen:${currentCourse.id}:v1`,
		...locales.map(
			(locale) => `scriptbound:guided-lesson-history:${currentCourse.id}:${locale}:v1`,
		),
		`scriptbound:last-reminder:${currentCourse.id}:v1`,
		'necrofonticon-progress-v1',
		'necrofonticon-last-reminder',
	];
}

export function resetLearningData(storage: Pick<Storage, 'removeItem'> | null = null) {
	resetProgress();
	resetGlyphTrialRecords();

	const target = storage ?? (browser ? localStorage : null);
	if (!target) return;
	for (const key of learningDataKeys()) target.removeItem(key);
}
