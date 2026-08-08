import { describe, expect, it } from 'vitest';
import { createEncodingKeys, ENCODING_DISTRACTOR_COUNT } from './encoding-keys';

const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

describe('createEncodingKeys', () => {
	it('includes every required letter and three unique distractors', () => {
		const keys = createEncodingKeys('eerie', alphabet, () => 0.42);

		expect(keys).toHaveLength(3 + ENCODING_DISTRACTOR_COUNT);
		expect(new Set(keys)).toHaveLength(keys.length);
		expect(keys).toEqual(expect.arrayContaining(['e', 'r', 'i']));
	});

	it('ignores spaces and repeated letters in sentence prompts', () => {
		const keys = createEncodingKeys('the gate', alphabet, () => 0);

		expect(keys).toHaveLength(5 + ENCODING_DISTRACTOR_COUNT);
		expect(keys).toEqual(expect.arrayContaining(['t', 'h', 'e', 'g', 'a']));
	});
});
