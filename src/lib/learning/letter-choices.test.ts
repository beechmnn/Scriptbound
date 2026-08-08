import { describe, expect, it } from 'vitest';
import { createLetterChoices, LETTER_CHOICE_COUNT } from './letter-choices';

const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

describe('createLetterChoices', () => {
	it('returns the target and three unique distractors', () => {
		const choices = createLetterChoices('g', alphabet, () => 0.42);

		expect(choices).toHaveLength(LETTER_CHOICE_COUNT);
		expect(new Set(choices)).toHaveLength(LETTER_CHOICE_COUNT);
		expect(choices).toContain('g');
	});

	it('does not rely on the target being in the supplied alphabet', () => {
		const choices = createLetterChoices('z', ['a', 'b', 'c'], () => 0);

		expect(choices).toHaveLength(LETTER_CHOICE_COUNT);
		expect(choices).toContain('z');
	});
});
