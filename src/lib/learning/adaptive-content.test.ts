import { describe, expect, it } from 'vitest';
import {
	adaptiveEncodingCandidates,
	adaptiveWordCandidates,
	adaptiveWordPoolExhausted,
	guidedIntroductionLetter,
	isGuidedIntroductionSuccessful,
	textLetters,
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

	it('exhausts adaptive words after every candidate has been shown', () => {
		expect(adaptiveWordPoolExhausted(['tea'], ['tea'])).toBe(true);
		expect(adaptiveWordPoolExhausted(['tea', 'team'], ['tea'])).toBe(false);
		expect(adaptiveWordPoolExhausted(['tea', 'team'], ['team', 'tea'])).toBe(true);
		expect(adaptiveWordPoolExhausted(['tea'], [])).toBe(false);
		expect(adaptiveWordPoolExhausted([], ['tea'])).toBe(true);
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
