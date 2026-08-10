import { describe, expect, it } from 'vitest';
import {
	adaptiveEncodingCandidates,
	adaptiveWordCandidates,
	appendRecentText,
	guidedIntroductionLetter,
	isGuidedIntroductionSuccessful,
	textLetters,
	variedLessonTextCandidates,
	variedTextCandidates,
} from './adaptive-content';

describe('adaptive contextual content', () => {
	it('uses only fully introduced words when they are available', () => {
		const words = ['tea', 'team', 'stone'];
		expect(adaptiveWordCandidates(words, new Set(['t', 'e', 'a']))).toEqual(['tea']);
	});

	it('allows words containing only the next new glyph', () => {
		const words = ['tea', 'team', 'stone'];
		expect(adaptiveWordCandidates(words, new Set(['t', 'e', 'a']), 'm')).toEqual(['tea', 'team']);
	});

	it('returns no adaptive word rather than exposing several new glyphs', () => {
		expect(adaptiveWordCandidates(['stone', 'glyph'], new Set(['t', 'e']), 'a')).toEqual([]);
	});

	it('prioritizes prompts that have never been shown', () => {
		expect(variedTextCandidates(['tea', 'team', 'toe'], ['tea', 'team'])).toEqual(['toe']);
	});

	it('keeps recently shown prompts on cooldown after the whole pool has appeared', () => {
		const candidates = ['tea', 'team', 'toe', 'too', 'tome'];
		expect(variedTextCandidates(candidates, ['tea', 'team', 'toe', 'too', 'tome'])).toEqual([
			'tea',
			'team',
		]);
	});

	it('keeps one candidate available for very small pools', () => {
		expect(variedTextCandidates(['tea'], ['tea'])).toEqual(['tea']);
		expect(variedTextCandidates(['tea', 'team'], ['tea', 'team'])).toEqual(['tea']);
	});

	it('prefers targets not yet shown in the current lesson in either activity order', () => {
		const recent = ['tea', 'tee', 'toe', 'too', 'tote'];

		expect(
			variedLessonTextCandidates(['tote', 'tea'], recent, ['tea', 'tee', 'toe', 'too']),
		).toEqual(['tote']);
		expect(
			variedLessonTextCandidates(['tea', 'tee', 'toe', 'too'], recent, ['tote', 'tea']),
		).toEqual(['tee', 'toe']);
	});

	it('returns to the shared cooldown after every lesson target has appeared', () => {
		expect(
			variedLessonTextCandidates(
				['tote', 'tea'],
				['tea', 'tee', 'toe', 'too', 'tote'],
				['tea', 'tee', 'toe', 'too', 'tote'],
			),
		).toEqual(['tea']);
	});

	it('bounds persisted prompt history', () => {
		expect(appendRecentText(['one', 'two'], 'three', 2)).toEqual(['two', 'three']);
	});

	it('allows encoding prompts with at most the next new glyph', () => {
		const candidates = adaptiveEncodingCandidates(
			['tea', 'team', 'stone'],
			new Set(['t', 'e', 'a']),
			'm',
		);
		expect(candidates).toEqual(['m', 'tea', 'team']);
		expect(candidates).not.toContain('stone');
	});

	it('returns distinct letters in reading order', () => {
		expect(textLetters('letter test')).toEqual(['l', 'e', 't', 'r', 's']);
	});

	it('identifies a single new glyph for the shared introduction view', () => {
		expect(guidedIntroductionLetter('team', new Set(['t', 'e', 'a']))).toBe('m');
		expect(guidedIntroductionLetter('tea', new Set(['t', 'e', 'a']))).toBeNull();
		expect(guidedIntroductionLetter('stone', new Set(['t', 'e']))).toBeNull();
	});

	it('requires a correct first attempt for a guided word introduction', () => {
		expect(isGuidedIntroductionSuccessful('word', true, true)).toBe(true);
		expect(isGuidedIntroductionSuccessful('word', true, false)).toBe(false);
		expect(isGuidedIntroductionSuccessful('word', false, true)).toBe(false);
	});

	it('accepts a successful encoding repetition after retrying', () => {
		expect(isGuidedIntroductionSuccessful('encode', true, false)).toBe(true);
		expect(isGuidedIntroductionSuccessful('encode', false, true)).toBe(false);
	});
});
