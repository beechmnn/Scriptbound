import { describe, expect, it } from 'vitest';
import { compareAnswer, isCorrect, normalizeAnswer } from './answer-checker';
describe('answer checking', () => {
	it('normalizes case and whitespace', () =>
		expect(normalizeAnswer('  The   VOID ')).toBe('the void'));
	it('accepts normalized answers', () => expect(isCorrect('THE  VOID', 'the void')).toBe(true));
	it('labels differences', () => {
		expect(compareAnswer('cab', 'cat')[2].status).toBe('wrong');
		expect(compareAnswer('ca', 'cat')[2].status).toBe('missing');
		expect(compareAnswer('cats', 'cat')[3].status).toBe('extra');
	});
	it('aligns insertions and omissions without shifting later characters', () => {
		expect(compareAnswer('ct', 'cat').map((part) => part.status)).toEqual([
			'correct',
			'missing',
			'correct',
		]);
		expect(compareAnswer('caat', 'cat').map((part) => part.status)).toEqual([
			'correct',
			'extra',
			'correct',
			'correct',
		]);
	});
});
