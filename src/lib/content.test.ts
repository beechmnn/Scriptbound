import { afterEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { currentCourse } from './app';
import { locale, setLocale } from './stores/locale';

const alphabet = currentCourse.glyphs.map(({ answer }) => answer);
const curricula = {
	en: currentCourse.content.en.curriculum,
	de: currentCourse.content.de.curriculum,
};
const practiceContent = currentCourse.content;

describe('Necrofonticon localized curricula and content', () => {
	afterEach(() => setLocale('en'));

	it('provides a complete frequency-prioritized alphabet for each language', () => {
		for (const order of Object.values(curricula)) {
			expect(order).toHaveLength(26);
			expect(new Set(order)).toEqual(new Set(alphabet));
		}
		expect(curricula.en.slice(0, 6).join('')).toBe('etaoin');
		expect(curricula.de.slice(0, 6).join('')).toBe('enisra');
	});

	it('keeps words and sentences in separate locale-specific collections', () => {
		expect(practiceContent.en.sentences).toContain('the old ones awaken');
		expect(practiceContent.de.sentences).toContain('die alten wesen erwachen');
		expect(practiceContent.de.sentences).not.toContain('the old ones awaken');
		for (const localized of Object.values(practiceContent)) {
			expect(
				[...localized.words, ...localized.sentences].every((text) => /^[a-z ]+$/.test(text)),
			).toBe(true);
		}
	});

	it('provides broad, varied word pools with complete letter coverage', () => {
		for (const [language, { words }] of Object.entries(practiceContent)) {
			const maximumLength = language === 'de' ? 11 : 10;
			expect(words.length).toBeGreaterThanOrEqual(160);
			expect(new Set(words).size).toBe(words.length);
			expect(words.every((word) => /^[a-z]+$/.test(word))).toBe(true);
			expect(words.every((word) => word.length >= 2 && word.length <= maximumLength)).toBe(true);
			expect(new Set(words.map((word) => word.length)).size).toBeGreaterThanOrEqual(6);
			for (const letter of alphabet) {
				const occurrences = words.reduce(
					(count, word) => count + [...word].filter((character) => character === letter).length,
					0,
				);
				expect(occurrences, `${language} coverage for ${letter}`).toBeGreaterThanOrEqual(3);
			}
		}
	});

	it('unlocks a varied word pool throughout the frequent-letter curriculum', () => {
		for (const language of ['en', 'de'] as const) {
			const order = curricula[language];
			const words = practiceContent[language].words;
			let previousAvailable = new Set<string>();

			for (let glyphCount = 1; glyphCount <= 12; glyphCount++) {
				const introduced = new Set(order.slice(0, glyphCount));
				const available = new Set(
					words.filter((word) => [...word].every((letter) => introduced.has(letter))),
				);
				const newlyAvailable = [...available].filter((word) => !previousAvailable.has(word));

				if (glyphCount === 3)
					expect(available.size, `${language} early pool`).toBeGreaterThanOrEqual(2);
				if (glyphCount >= 3) {
					expect(
						newlyAvailable.length,
						`${language} glyph ${order[glyphCount - 1]}`,
					).toBeGreaterThanOrEqual(2);
				}
				previousAvailable = available;
			}
		}
	});

	it('provides varied sentence pools with plenty of short prompts', () => {
		for (const { sentences } of Object.values(practiceContent)) {
			const wordCounts = sentences.map((sentence) => sentence.split(' ').length);
			expect(sentences.length).toBeGreaterThanOrEqual(30);
			expect(new Set(sentences).size).toBe(sentences.length);
			expect(wordCounts.filter((count) => count <= 4).length).toBeGreaterThanOrEqual(15);
			expect(new Set(wordCounts).size).toBeGreaterThanOrEqual(5);
		}
	});

	it('includes the translated dreamer and eternal-order passage', () => {
		expect(practiceContent.de.words).toContain('traeumer');
		expect(practiceContent.en.words).toContain('dreamer');
		expect(practiceContent.de.sentences).toContain('aus der tiefe tausend sterne');
		expect(practiceContent.en.sentences).toContain('from the depths a thousand stars');
		expect(practiceContent.de.sentences).toContain('es ist nicht tot was ewig liegt');
		expect(practiceContent.en.sentences).toContain('it is not dead which lies eternally');
		expect(practiceContent.de.sentences.every((sentence) => sentence.length <= 50)).toBe(true);
		expect(practiceContent.en.sentences.every((sentence) => sentence.length <= 50)).toBe(true);
	});

	it('switches the application locale', () => {
		setLocale('de');
		expect(get(locale)).toBe('de');
		setLocale('en');
		expect(get(locale)).toBe('en');
	});
});
