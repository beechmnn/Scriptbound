import { describe, expect, it } from 'vitest';
import { newGlyphProgress } from '$lib/learning/scheduler';
import {
	buildStandaloneInstallUrl,
	hasSuccessfulPractice,
	installDismissalIsActive,
	isIosDevice,
	shouldOfferInstall,
} from './install';

describe('PWA installation helpers', () => {
	it('detects iPhones and touch-capable iPads reporting as Macs', () => {
		expect(isIosDevice('Mozilla/5.0 (iPhone)', 'iPhone', 5)).toBe(true);
		expect(isIosDevice('Mozilla/5.0 (Macintosh)', 'MacIntel', 5)).toBe(true);
		expect(isIosDevice('Mozilla/5.0 (Macintosh)', 'MacIntel', 0)).toBe(false);
	});

	it('builds a top-level installation URL without the embed marker', () => {
		expect(buildStandaloneInstallUrl('https://scriptbound.example/?embedded=1&source=itch')).toBe(
			'https://scriptbound.example/?source=itch&install=1',
		);
	});

	it('recognizes successful typed and handwriting practice', () => {
		const untouched = newGlyphProgress('a');
		expect(hasSuccessfulPractice({ a: untouched })).toBe(false);
		expect(hasSuccessfulPractice({ a: { ...untouched, correct: 1 } })).toBe(true);
		expect(hasSuccessfulPractice({ a: { ...untouched, handwritingCorrect: 1 } })).toBe(true);
	});

	it('expires a deferred installation offer after seven days', () => {
		const now = Date.UTC(2026, 7, 10);
		expect(installDismissalIsActive(String(now - 6 * 24 * 60 * 60 * 1_000), now)).toBe(true);
		expect(installDismissalIsActive(String(now - 8 * 24 * 60 * 60 * 1_000), now)).toBe(false);
	});

	it('offers installation after practice or immediately when arriving from itch', () => {
		expect(
			shouldOfferInstall({
				installed: false,
				framed: false,
				installIntent: false,
				hasPractised: true,
				installPromptAvailable: true,
				ios: false,
				dismissed: false,
			}),
		).toBe(true);
		expect(
			shouldOfferInstall({
				installed: false,
				framed: true,
				installIntent: false,
				hasPractised: false,
				installPromptAvailable: false,
				ios: false,
				dismissed: false,
			}),
		).toBe(true);
	});

	it('hides an offer after it is dismissed, including inside itch', () => {
		expect(
			shouldOfferInstall({
				installed: false,
				framed: true,
				installIntent: false,
				hasPractised: false,
				installPromptAvailable: false,
				ios: false,
				dismissed: true,
			}),
		).toBe(false);
	});
});
