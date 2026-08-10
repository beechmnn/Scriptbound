import { necrofonticonCourse } from '$lib/courses/necrofonticon';
import type { ScriptCourse } from '$lib/types';

export const APP_NAME = 'Scriptbound';

export const courses = {
	necrofonticon: necrofonticonCourse,
} as const satisfies Record<string, ScriptCourse>;

export type CourseId = keyof typeof courses;
export const DEFAULT_COURSE_ID: CourseId = 'necrofonticon';

// Compatibility bridge while only one course is available. The course picker will
// replace this lookup with a persisted active course ID when a second course ships.
export const currentCourse = courses[DEFAULT_COURSE_ID];
