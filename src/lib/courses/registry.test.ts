import { describe, expect, it } from 'vitest';
import { courses, DEFAULT_COURSE_ID } from '$lib/app';

describe('course registry', () => {
	it('uses a registered course as the default', () => {
		expect(courses[DEFAULT_COURSE_ID].id).toBe(DEFAULT_COURSE_ID);
	});

	it('keeps each localized teaching pack with its course', () => {
		for (const [id, course] of Object.entries(courses)) {
			const alphabet = course.glyphs.map(({ answer }) => answer);
			expect(course.id).toBe(id);
			expect(new Set(alphabet).size).toBe(alphabet.length);

			for (const locale of ['en', 'de'] as const) {
				const content = course.content[locale];
				expect(new Set(content.curriculum)).toEqual(new Set(alphabet));
				expect(content.words.length).toBeGreaterThan(0);
				expect(content.sentences.length).toBeGreaterThan(0);
			}
		}
	});
});
