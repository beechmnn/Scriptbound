export type Locale = 'en' | 'de';
export type Palette = 'gold' | 'petrol';
export type PracticeMode = 'glyph' | 'word' | 'encode' | 'handwriting';
export type PracticeSet = 'adaptive' | 'mistakes' | 'all';
export type LearningStage = 'unseen' | 'acquiring' | 'reviewing' | 'learned' | 'durable';
export type CourseGlyph = {
	id: string;
	glyph: string;
	answer: string;
	label: string;
};
export type CourseContent = {
	curriculum: readonly string[];
	words: readonly string[];
	sentences: readonly string[];
};
export type ScriptCourse = {
	id: string;
	name: string;
	fontFamily: string;
	fontFileName: string;
	fontUrl: string;
	pdfFontUrl: string;
	glyphs: readonly CourseGlyph[];
	content: Record<Locale, CourseContent>;
	legacyStorageKeys: {
		progress: readonly string[];
		reminders: readonly string[];
		lastReminder: readonly string[];
	};
};
export type GlyphProgress = {
	letter: string;
	introduced: boolean;
	attempts: number;
	correct: number;
	streak: number;
	mastery: number;
	averageTimeMs: number;
	lastPractisedAt: number;
	nextReviewAt: number;
	reviewLevel: number;
	stage: LearningStage;
	acquisitionCorrect: number;
	successfulReviews: number;
	lapses: number;
	isolatedAttempts: number;
	isolatedCorrect: number;
	contextualAttempts: number;
	contextualCorrect: number;
	encodingAttempts: number;
	encodingCorrect: number;
	handwritingAttempts: number;
	handwritingCorrect: number;
	handwritingAlmost: number;
	repetitionPriority: number;
	recentFirstAttempts: boolean[];
	correctResponseTimesMs: number[];
};
export type AnswerPart = {
	character: string;
	expected: string;
	status: 'correct' | 'wrong' | 'missing' | 'extra';
};
