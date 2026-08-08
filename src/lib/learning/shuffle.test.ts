import { describe, expect, it } from 'vitest';
import { shuffled } from './shuffle';

describe('shuffled', () => {
	it('returns every item exactly once without mutating the source', () => {
		const source = ['a', 'b', 'c', 'd'];
		const result = shuffled(source, () => 0);
		expect(result).toEqual(['b', 'c', 'd', 'a']);
		expect(source).toEqual(['a', 'b', 'c', 'd']);
	});
});
