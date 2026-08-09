import { describe, expect, it } from 'vitest';
import { newGlyphProgress } from './scheduler';
import { createGuidedLesson, lessonQuestionTotal } from './guided-lesson';

const curriculum = ['e', 't', 'a', 'o'];

describe('guided lessons', () => {
	it('starts a new learner with a focused glyph lesson', () => {
		const lesson = createGuidedLesson(curriculum, {}, ['tea']);
		expect(lesson).toEqual({
			steps: [{ mode: 'glyph', questions: 6 }],
			wordTargets: [],
		});
	});

	it('adds contextual activities when the learner has enough glyphs', () => {
		const e = { ...newGlyphProgress('e'), introduced: true, attempts: 3 };
		const t = { ...newGlyphProgress('t'), introduced: true, attempts: 3 };
		const a = { ...newGlyphProgress('a'), introduced: true, attempts: 3 };
		const lesson = createGuidedLesson(curriculum, { e, t, a }, ['tea', 'tee']);

		expect(lesson.steps).toEqual([
			{ mode: 'glyph', questions: 4 },
			{ mode: 'word', questions: 2 },
			{ mode: 'encode', questions: 2 },
		]);
		expect(lesson.wordTargets).toEqual(['tea', 'tee']);
		expect(lessonQuestionTotal(lesson.steps)).toBe(8);
	});

	it('prioritizes a longer glyph block when attention is due', () => {
		const e = {
			...newGlyphProgress('e'),
			introduced: true,
			attempts: 3,
			stage: 'acquiring' as const,
			isolatedAttempts: 3,
		};
		const lesson = createGuidedLesson(curriculum, { e }, ['tea']);
		expect(lesson.steps).toEqual([{ mode: 'glyph', questions: 5 }]);
	});

	it('holds back Words until at least two distinct targets are available', () => {
		const e = { ...newGlyphProgress('e'), introduced: true, attempts: 3 };
		const t = { ...newGlyphProgress('t'), introduced: true, attempts: 3 };
		const lesson = createGuidedLesson(curriculum, { e, t }, ['tea']);

		expect(lesson.steps).not.toContainEqual(expect.objectContaining({ mode: 'word' }));
		expect(lesson.wordTargets).toEqual([]);
	});

	it('prefers words that were not used in recent lessons', () => {
		const progress = Object.fromEntries(
			curriculum.map((letter) => [
				letter,
				{ ...newGlyphProgress(letter), introduced: true, attempts: 3 },
			]),
		);
		const lesson = createGuidedLesson(curriculum, progress, ['tea', 'tee', 'toe', 'too'], {
			completedLessons: 2,
			recentWords: ['tea', 'tee'],
		});

		expect(lesson.wordTargets).toEqual(['toe', 'too']);
	});

	it('alternates the order of contextual activities between lessons', () => {
		const progress = Object.fromEntries(
			curriculum.map((letter) => [
				letter,
				{ ...newGlyphProgress(letter), introduced: true, attempts: 3 },
			]),
		);
		const lesson = createGuidedLesson(curriculum, progress, ['tea', 'tee'], {
			completedLessons: 1,
			recentWords: [],
		});

		expect(lesson.steps.map((step) => step.mode)).toEqual(['glyph', 'encode', 'word']);
	});
});
