import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { currentCourse } from '$lib/app';
import {
	betterGlyphTrialRecord,
	type GlyphTrialRecord,
	type GlyphTrialTierId,
} from '$lib/learning/glyph-trial';
import type { Locale } from '$lib/types';

const KEY = `scriptbound:glyph-trials:${currentCourse.id}:v1`;

export type GlyphTrialRecords = Partial<Record<`${Locale}:${GlyphTrialTierId}`, GlyphTrialRecord>>;

function loadRecords(): GlyphTrialRecords {
	if (!browser) return {};
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? '{}') as GlyphTrialRecords;
	} catch {
		return {};
	}
}

export const glyphTrialRecords = writable<GlyphTrialRecords>(loadRecords());

if (browser) {
	glyphTrialRecords.subscribe((records) => localStorage.setItem(KEY, JSON.stringify(records)));
}

export function glyphTrialRecordKey(locale: Locale, tierId: GlyphTrialTierId) {
	return `${locale}:${tierId}` as const;
}

export function saveGlyphTrialRecord(
	locale: Locale,
	tierId: GlyphTrialTierId,
	record: GlyphTrialRecord,
): boolean {
	const key = glyphTrialRecordKey(locale, tierId);
	let isPersonalBest = false;
	glyphTrialRecords.update((records) => {
		const best = betterGlyphTrialRecord(records[key], record);
		isPersonalBest = best === record;
		return isPersonalBest ? { ...records, [key]: record } : records;
	});
	return isPersonalBest;
}
