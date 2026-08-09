import { describe, expect, it, vi } from 'vitest';
import { currentCourse } from '$lib/app';
import { learningDataKeys, resetLearningData } from './learning-data';

describe('learning data reset', () => {
	it('clears every persisted learning metric without clearing preferences', () => {
		const removeItem = vi.fn();
		resetLearningData({ removeItem });

		expect(removeItem.mock.calls.map(([key]) => key)).toEqual(learningDataKeys());
		expect(learningDataKeys()).toContain(
			`scriptbound:guided-lesson-history:${currentCourse.id}:en:v1`,
		);
		expect(learningDataKeys()).toContain(
			`scriptbound:guided-lesson-history:${currentCourse.id}:de:v1`,
		);
		expect(learningDataKeys().some((key) => key.includes('locale'))).toBe(false);
		expect(learningDataKeys().some((key) => key.includes('palette'))).toBe(false);
		expect(learningDataKeys().some((key) => key.includes('reminders:'))).toBe(false);
	});
});
