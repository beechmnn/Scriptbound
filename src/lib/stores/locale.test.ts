import { describe, expect, it } from 'vitest';
import { resolveLocale } from './locale';

describe('locale preference', () => {
	it('uses the browser language when there is no saved selection', () => {
		expect(resolveLocale(null, 'de-DE')).toBe('de');
		expect(resolveLocale(null, 'en-GB')).toBe('en');
		expect(resolveLocale(null, 'fr-FR')).toBe('en');
	});

	it('restores a saved selection instead of the browser default', () => {
		expect(resolveLocale('de', 'en-US')).toBe('de');
		expect(resolveLocale('en', 'de-DE')).toBe('en');
	});

	it('ignores an invalid saved value', () => {
		expect(resolveLocale('invalid', 'de-AT')).toBe('de');
	});
});
