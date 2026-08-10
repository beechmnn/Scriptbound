import type { GlyphProgress, PracticeMode } from '$lib/types';
import { adaptiveWordCandidates } from './adaptive-content';
import { needsAttention } from './scheduler';

export type GuidedLessonMode = Extract<PracticeMode, 'glyph' | 'word' | 'encode'>;

export type GuidedLessonStep = {
	mode: GuidedLessonMode;
	questions: number;
};

export type GuidedLessonHistory = {
	completedLessons: number;
	recentWords: string[];
};

export type GuidedLessonPlan = {
	steps: GuidedLessonStep[];
	wordTargets: string[];
	encodeTargets: string[];
	newGlyphLimit: number;
};

export const EMPTY_GUIDED_LESSON_HISTORY: GuidedLessonHistory = {
	completedLessons: 0,
	recentWords: [],
};

function selectLessonWords(available: string[], recent: string[], count: number) {
	return [...available]
		.sort((a, b) => {
			const aLastSeen = recent.lastIndexOf(a);
			const bLastSeen = recent.lastIndexOf(b);
			return aLastSeen - bLastSeen;
		})
		.slice(0, count);
}

export function createGuidedLesson(
	curriculum: string[],
	progress: Record<string, GlyphProgress>,
	words: string[],
	history: GuidedLessonHistory = EMPTY_GUIDED_LESSON_HISTORY,
): GuidedLessonPlan {
	const attempts = Object.values(progress).reduce((total, item) => total + item.attempts, 0);
	if (attempts === 0) {
		return {
			steps: [{ mode: 'glyph', questions: 6 }],
			wordTargets: [],
			encodeTargets: [],
			newGlyphLimit: 3,
		};
	}

	const introduced = new Set(curriculum.filter((letter) => progress[letter]?.introduced));
	const nextNew = curriculum.find((letter) => !introduced.has(letter));
	const due = curriculum.some((letter) => progress[letter] && needsAttention(progress[letter]));
	const steps: GuidedLessonStep[] = [{ mode: 'glyph', questions: due ? 5 : 4 }];

	const availableWords = adaptiveWordCandidates(words, introduced, nextNew);
	const lessonTargets =
		introduced.size >= 2 && availableWords.length >= 2
			? selectLessonWords(availableWords, history.recentWords, 6)
			: [];
	const wordTargets = lessonTargets.slice(0, 4);
	const encodeTargets = [
		...lessonTargets.slice(wordTargets.length, wordTargets.length + 2),
		...wordTargets,
	].slice(0, 2);
	const contextualSteps: GuidedLessonStep[] = [];
	if (wordTargets.length >= 2) {
		contextualSteps.push({ mode: 'word', questions: wordTargets.length });
		contextualSteps.push({ mode: 'encode', questions: encodeTargets.length });
	}
	if (history.completedLessons % 2 === 1) contextualSteps.reverse();
	steps.push(...contextualSteps);

	return {
		steps,
		wordTargets,
		encodeTargets,
		newGlyphLimit: contextualSteps.length === 0 ? Math.ceil(steps[0].questions / 2) : 1,
	};
}

export function nextGuidedLessonGlyph(
	curriculum: string[],
	introduced: Set<string>,
	introducedAtStart: Set<string>,
	newGlyphLimit: number,
) {
	const introducedDuringLesson = [...introduced].filter(
		(letter) => !introducedAtStart.has(letter),
	).length;
	if (introducedDuringLesson >= newGlyphLimit) return undefined;
	return curriculum.find((letter) => !introduced.has(letter));
}

export function lessonQuestionTotal(steps: GuidedLessonStep[]) {
	return steps.reduce((total, step) => total + step.questions, 0);
}
