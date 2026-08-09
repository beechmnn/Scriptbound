<script lang="ts">
	import GlyphText from './GlyphText.svelte';
	import GlyphKeyboard from './GlyphKeyboard.svelte';
	import HandwritingPad from './HandwritingPad.svelte';
	import AnswerComparison from './AnswerComparison.svelte';
	import GlyphIntroduction from './GlyphIntroduction.svelte';
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { alphabet, curricula, practiceContent } from '$lib/content';
	import { copy } from '$lib/i18n';
	import { locale } from '$lib/stores/locale';
	import { compareAnswer, isCorrect } from '$lib/learning/answer-checker';
	import {
		progress,
		recordAttempt,
		recordGuidedIntroduction,
		recordHandwritingAssessment,
	} from '$lib/stores/progress';
	import { needsAttention, newGlyphProgress } from '$lib/learning/scheduler';
	import { createLetterChoices } from '$lib/learning/letter-choices';
	import {
		formatGlyphTrialTime,
		GLYPH_TRIAL_LENGTH,
		GLYPH_TRIAL_MISTAKE_PENALTY_MS,
		GLYPH_TRIAL_TIERS,
		firstUncompletedUnlockedGlyphTrialTier,
		glyphTrialFinalTime,
		glyphTrialPool,
		isGlyphTrialTierUnlocked,
		type GlyphTrialTierId,
	} from '$lib/learning/glyph-trial';
	import { createEncodingKeys } from '$lib/learning/encoding-keys';
	import { scheduleAdaptiveFallback } from '$lib/learning/practice-set';
	import {
		createGuidedLesson,
		EMPTY_GUIDED_LESSON_HISTORY,
		lessonQuestionTotal,
		nextGuidedLessonGlyph,
		type GuidedLessonHistory,
		type GuidedLessonStep,
	} from '$lib/learning/guided-lesson';
	import {
		answerInputDisabled,
		restoreAnswerInputFocus,
		shouldPreventSubmittedInput,
	} from '$lib/learning/practice-input';
	import {
		adaptiveEncodingCandidates,
		adaptiveWordCandidates,
		adaptiveWordPoolExhausted,
		guidedIntroductionLetter,
		isGuidedIntroductionSuccessful,
	} from '$lib/learning/adaptive-content';
	import {
		glyphTrialRecordKey,
		glyphTrialRecords,
		saveGlyphTrialRecord,
	} from '$lib/stores/glyph-trials';
	import type { Locale, PracticeMode, PracticeSet } from '$lib/types';
	import { currentCourse } from '$lib/app';
	const GUIDED_LESSON_SEEN_KEY = `scriptbound:guided-lesson-seen:${currentCourse.id}:v1`;
	function readLessonStarted() {
		if (typeof localStorage === 'undefined') return false;
		try {
			return localStorage.getItem(GUIDED_LESSON_SEEN_KEY) !== null;
		} catch {
			return false;
		}
	}
	let {
		startWithMistakes = false,
		startWithTrial = false,
		startWithTrialTier = 'initiate',
		startWithMode = 'glyph',
	}: {
		startWithMistakes?: boolean;
		startWithTrial?: boolean;
		startWithTrialTier?: GlyphTrialTierId;
		startWithMode?: PracticeMode;
	} = $props();
	const initialMistakes = untrack(() => startWithMistakes);
	const initialTrial = untrack(() => startWithTrial);
	const initialTrialTier = untrack(() => startWithTrialTier);
	const initialMode = untrack(() => startWithMode);
	const pick = <T,>(values: T[], previous?: T) => {
		const choices = values.length > 1 ? values.filter((v) => v !== previous) : values;
		return choices[Math.floor(Math.random() * choices.length)];
	};
	const FIREWORK_PARTICLES = [
		{ x: 0, y: -82, delay: 0 },
		{ x: 42, y: -68, delay: 30 },
		{ x: 73, y: -38, delay: 60 },
		{ x: 82, y: 0, delay: 20 },
		{ x: 67, y: 45, delay: 50 },
		{ x: 38, y: 73, delay: 80 },
		{ x: 0, y: 84, delay: 40 },
		{ x: -43, y: 70, delay: 70 },
		{ x: -74, y: 39, delay: 100 },
		{ x: -84, y: 0, delay: 50 },
		{ x: -68, y: -45, delay: 80 },
		{ x: -38, y: -73, delay: 110 },
	] as const;
	let t = $derived(copy[$locale].practice),
		curriculum = $derived(curricula[$locale]),
		content = $derived(practiceContent[$locale]);
	let mode = $state<PracticeMode>('glyph'),
		practiceSet = $state<PracticeSet>(initialMistakes ? 'mistakes' : 'adaptive'),
		target = $state(curricula[$locale][0]),
		answer = $state(''),
		submitted = $state(false),
		correct = $state(false),
		revealed = $state(false),
		question = $state(1),
		score = $state(0),
		startedAt = $state(Date.now()),
		mistakeQueue = $state<string[]>([]),
		shownWordTargets = $state<string[]>([]),
		currentIsRetry = $state(false),
		wordAutoFocusEnabled = $state(false),
		noAdaptiveWord = $state(false),
		introducedGlyph = $state<string | null>(null),
		introductionPending = $state(false),
		glyphAnswerMethod = $state<'type' | 'buttons'>('type'),
		letterChoices = $state(createLetterChoices(curricula[$locale][0], alphabet)),
		encodingKeys = $state(createEncodingKeys(curricula[$locale][0], alphabet));
	let lessonStatus = $state<'inactive' | 'active' | 'transition' | 'complete'>('inactive'),
		lessonHasStarted = $state(readLessonStarted()),
		lessonPlan = $state<GuidedLessonStep[]>([]),
		lessonStepIndex = $state(0),
		lessonStepCompleted = $state(0),
		lessonCompletedQuestions = $state(0),
		lessonCorrectAtStart = $state(0),
		lessonIntroducedAtStart = $state<string[]>([]),
		lessonNewGlyphLimit = $state(1),
		lessonWordTargets = $state<string[]>([]),
		lessonWordsSeen = $state<string[]>([]),
		lessonHistory = $state<GuidedLessonHistory>(EMPTY_GUIDED_LESSON_HISTORY),
		lessonLocale = $state<Locale>('en');
	let trialVisible = $state(initialTrial),
		trialState = $state<'idle' | 'ready' | 'countdown' | 'running' | 'complete'>('idle'),
		selectedTrialTier = $state<GlyphTrialTierId>(initialTrialTier),
		trialLocale = $state<Locale>('en'),
		trialPool = $state<string[]>([]),
		trialTarget = $state(''),
		trialChoices = $state<string[]>([]),
		trialWrongChoices = $state<string[]>([]),
		trialCorrect = $state(0),
		trialMistakes = $state(0),
		trialCombo = $state(0),
		trialBestCombo = $state(0),
		trialStartedAt = $state(0),
		trialNow = $state(0),
		trialRawTime = $state(0),
		trialFinalTime = $state(0),
		trialIsPersonalBest = $state(false),
		trialPenaltyVisible = $state(false),
		trialCountdown = $state(3),
		trialComboPulse = $state(0),
		trialMilestone = $state<number | null>(null),
		trialPreviousBestTime = $state<number | null>(null),
		trialImprovementMs = $state(0);
	let handwritingHasInk = $state(false),
		drawingSubmitted = $state(false),
		handwritingAssessment = $state<'correct' | 'almost' | 'incorrect' | null>(null),
		overlayOpacity = $state(0.45);
	let answerInput = $state<HTMLInputElement>();
	let activeContentElement = $state<HTMLElement>();
	let nextCountdown = $state(0),
		nextDelay = $state(2),
		nextPaused = $state(false),
		wordReturnScrollTop = $state<number | null>(null),
		nextTimer: ReturnType<typeof setInterval> | undefined,
		trialTimer: ReturnType<typeof setInterval> | undefined,
		trialCountdownTimer: ReturnType<typeof setInterval> | undefined,
		trialComboEffectTimer: ReturnType<typeof setTimeout> | undefined,
		contentCenterFrame: number | undefined,
		attentionFallbackTimer: ReturnType<typeof setTimeout> | undefined;
	let options = $derived<{ value: PracticeMode; label: string }[]>([
			{ value: 'glyph', label: t.modes.glyph },
			{ value: 'word', label: t.modes.word },
			{ value: 'encode', label: t.modes.encode },
		]),
		simplifiedResult = $derived(
			mode === 'word' || mode === 'encode' || (mode === 'glyph' && glyphAnswerMethod === 'buttons'),
		),
		selectedTrialGlyphCount = $derived(
			GLYPH_TRIAL_TIERS.find((tier) => tier.id === selectedTrialTier)?.glyphCount ?? 6,
		),
		currentTrialRecord = $derived(
			$glyphTrialRecords[glyphTrialRecordKey($locale, selectedTrialTier)],
		),
		currentLessonStep = $derived(lessonPlan[lessonStepIndex]),
		lessonTotal = $derived(lessonQuestionTotal(lessonPlan));
	function weakLetters() {
		return alphabet.filter((letter) => $progress[letter] && needsAttention($progress[letter]));
	}
	function updateAttentionFallback() {
		const attentionCount = weakLetters().length;
		if (practiceSet !== 'mistakes' || attentionCount > 0) {
			if (attentionFallbackTimer) clearTimeout(attentionFallbackTimer);
			attentionFallbackTimer = undefined;
			return;
		}
		if (attentionFallbackTimer) return;
		attentionFallbackTimer = scheduleAdaptiveFallback(practiceSet, attentionCount, () => {
			attentionFallbackTimer = undefined;
			if (practiceSet === 'mistakes' && weakLetters().length === 0) practiceSet = 'adaptive';
		});
	}
	function averageMastery() {
		return (
			alphabet.reduce((sum, letter) => sum + ($progress[letter]?.mastery ?? 0), 0) / alphabet.length
		);
	}
	function introducedLetters() {
		return new Set(curriculum.filter((letter) => $progress[letter]?.introduced));
	}
	function adaptiveLetters() {
		const introduced = curriculum.filter((letter) => $progress[letter]?.introduced);
		const repetitionPriorities = curriculum.filter(
			(letter) => ($progress[letter]?.repetitionPriority ?? 0) > 0,
		);
		const acquiring = introduced.filter(
			(letter) => $progress[letter].stage === 'unseen' || $progress[letter].stage === 'acquiring',
		).length;
		const due = introduced.filter((letter) => needsAttention($progress[letter])).length;
		const lessonNewGlyphs = introduced.filter(
			(letter) => !lessonIntroducedAtStart.includes(letter),
		).length;
		const lessonAllowsIntroduction =
			lessonStatus !== 'active' || lessonNewGlyphs < lessonNewGlyphLimit;
		const mayIntroduce =
			lessonAllowsIntroduction && (introduced.length < 4 || (acquiring < 4 && due <= 6));
		const nextNew = mayIntroduce
			? curriculum.find((letter) => !introduced.includes(letter))
			: undefined;
		const candidates = nextNew
			? [...repetitionPriorities, ...introduced, nextNew]
			: [...repetitionPriorities, ...introduced];
		return candidates.length ? [...new Set(candidates)] : [curriculum[0]];
	}
	function nextContextGlyph(introduced: Set<string>) {
		if (
			lessonStatus === 'active' &&
			[...introduced].some((letter) => !lessonIntroducedAtStart.includes(letter))
		) {
			return undefined;
		}
		return curriculum.find((letter) => !introduced.has(letter));
	}
	function familiarity(text: string) {
		const letters = [...new Set(text.replace(/[^a-z]/g, '').split(''))];
		return (
			letters.reduce(
				(score, letter) =>
					score +
					($progress[letter]?.stage === 'durable'
						? 1
						: $progress[letter]?.stage === 'learned'
							? 0.9
							: $progress[letter]?.stage === 'reviewing'
								? 0.65
								: $progress[letter]?.stage === 'acquiring'
									? 0.25
									: 0),
				0,
			) / Math.max(1, letters.length)
		);
	}
	function repetitionNeed(text: string) {
		return [...new Set(text.replace(/[^a-z]/g, '').split(''))].reduce(
			(score, letter) => score + ($progress[letter]?.repetitionPriority ?? 0),
			0,
		);
	}
	function encodingReferenceWords() {
		const words: { letter: string; correct: boolean }[][] = [];
		let word: { letter: string; correct: boolean }[] = [];
		for (const part of compareAnswer(answer, target)) {
			if (!part.expected) continue;
			if (part.expected === ' ') {
				if (word.length) words.push(word);
				word = [];
			} else {
				word.push({ letter: part.expected, correct: part.status === 'correct' });
			}
		}
		if (word.length) words.push(word);
		return words;
	}
	function adaptiveTexts(source: string[], limit: number) {
		return [...source]
			.sort(
				(a, b) =>
					repetitionNeed(b) - repetitionNeed(a) ||
					familiarity(b) - familiarity(a) ||
					a.length - b.length,
			)
			.slice(0, limit);
	}
	function pool() {
		const weak = weakLetters();
		if (mode === 'glyph' || mode === 'handwriting')
			return practiceSet === 'mistakes'
				? weak.length
					? weak
					: adaptiveLetters()
				: practiceSet === 'all'
					? alphabet
					: adaptiveLetters();
		const source =
			mode === 'word'
				? content.words
				: averageMastery() < 0.55
					? content.words
					: [...content.words, ...content.sentences];
		if (mode === 'word' && lessonStatus === 'active' && lessonWordTargets.length) {
			return lessonWordTargets;
		}
		if (practiceSet === 'mistakes' && weak.length) {
			const filtered = source.filter((text) => weak.some((letter) => text.includes(letter)));
			if (filtered.length) return filtered;
		}
		if (practiceSet === 'adaptive') {
			const introduced = introducedLetters();
			if (mode === 'word') {
				const nextNew = nextContextGlyph(introduced);
				return adaptiveWordCandidates(source, introduced, nextNew);
			}
			if (mode === 'encode') {
				const nextNew = nextContextGlyph(introduced);
				return adaptiveTexts(
					adaptiveEncodingCandidates(source, introduced, nextNew),
					Math.max(4, Math.round(4 + averageMastery() * 12)),
				);
			}
			return adaptiveTexts(source, Math.max(2, Math.round(2 + averageMastery() * 4)));
		}
		return source;
	}
	function weightedTextPick(values: string[], previous?: string) {
		const choices = values.length > 1 ? values.filter((value) => value !== previous) : values;
		const weighted = choices.map((text) => ({
			text,
			weight: 1 + familiarity(text) * 3 + repetitionNeed(text) * 8,
		}));
		let cursor = Math.random() * weighted.reduce((sum, item) => sum + item.weight, 0);
		for (const item of weighted) {
			cursor -= item.weight;
			if (cursor <= 0) return item.text;
		}
		return weighted.at(-1)?.text ?? values[0];
	}
	function weightedGlyphPick(values: string[], previous?: string) {
		const choices = values.length > 1 ? values.filter((value) => value !== previous) : values;
		const weighted = choices.map((letter) => {
			const item = $progress[letter] ?? newGlyphProgress(letter);
			return {
				letter,
				weight: needsAttention(item)
					? 12
					: item.stage === 'unseen'
						? 4
						: item.stage === 'acquiring'
							? 6
							: item.stage === 'reviewing'
								? 1
								: 0.35,
			};
		});
		let cursor = Math.random() * weighted.reduce((sum, item) => sum + item.weight, 0);
		for (const item of weighted) {
			cursor -= item.weight;
			if (cursor <= 0) return item.letter;
		}
		return weighted.at(-1)?.letter ?? curriculum[0];
	}
	function chooseTarget(previous?: string) {
		if (mode === 'glyph' && lessonStatus === 'active') {
			const nextNew = nextGuidedLessonGlyph(
				curriculum,
				introducedLetters(),
				new Set(lessonIntroducedAtStart),
				lessonNewGlyphLimit,
			);
			if (nextNew) return nextNew;
		}
		const values = pool();
		if (mode === 'word') {
			noAdaptiveWord =
				practiceSet === 'adaptive' && adaptiveWordPoolExhausted(values, shownWordTargets);
			if (noAdaptiveWord) return previous ?? target;
			const fresh = values.filter((value) => !shownWordTargets.includes(value));
			const available = fresh.length ? fresh : values;
			const nextTarget =
				practiceSet === 'adaptive'
					? weightedTextPick(available, previous)
					: pick(available, previous);
			if (!shownWordTargets.includes(nextTarget)) {
				shownWordTargets = [...shownWordTargets, nextTarget];
			}
			if (lessonStatus === 'active' && !lessonWordsSeen.includes(nextTarget)) {
				lessonWordsSeen = [...lessonWordsSeen, nextTarget];
			}
			return nextTarget;
		}
		noAdaptiveWord = false;
		if (mode === 'encode' && practiceSet !== 'all') return weightedTextPick(values, previous);
		return (mode === 'glyph' || mode === 'handwriting') && practiceSet !== 'all'
			? weightedGlyphPick(values, previous)
			: pick(values, previous);
	}
	function prepareTargetIntroduction() {
		introducedGlyph = null;
		introductionPending = false;
		if (noAdaptiveWord) return;
		if ((mode !== 'glyph' && mode !== 'word' && mode !== 'encode') || practiceSet !== 'adaptive')
			return;
		introducedGlyph = guidedIntroductionLetter(target, introducedLetters());
		if (!introducedGlyph) return;
		introductionPending = true;
	}
	function beginGuidedPractice() {
		introductionPending = false;
		startedAt = Date.now();
		if (mode === 'word') {
			wordAutoFocusEnabled = true;
			focusAnswer();
		} else if (mode === 'glyph') focusAnswer();
	}
	async function focusAnswer() {
		await tick();
		if (
			mode !== 'encode' &&
			mode !== 'handwriting' &&
			(mode !== 'word' || wordAutoFocusEnabled) &&
			(mode !== 'glyph' || glyphAnswerMethod === 'type')
		) {
			if (answerInput) restoreAnswerInputFocus(answerInput, mode === 'word' ? 'word' : 'glyph');
		}
	}
	async function centerActiveContent() {
		await tick();
		if (contentCenterFrame) cancelAnimationFrame(contentCenterFrame);
		contentCenterFrame = requestAnimationFrame(() => {
			contentCenterFrame = undefined;
			activeContentElement?.scrollIntoView({
				behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
				block: 'center',
				inline: 'nearest',
			});
		});
	}
	function clearNextTimer() {
		if (nextTimer) clearInterval(nextTimer);
		nextTimer = undefined;
		nextCountdown = 0;
		nextPaused = false;
	}
	function clearTrialTimer() {
		if (trialTimer) clearInterval(trialTimer);
		trialTimer = undefined;
		if (trialCountdownTimer) clearInterval(trialCountdownTimer);
		trialCountdownTimer = undefined;
		if (trialComboEffectTimer) clearTimeout(trialComboEffectTimer);
		trialComboEffectTimer = undefined;
	}
	function exitTrial() {
		clearTrialTimer();
		trialState = 'idle';
		trialPenaltyVisible = false;
		focusAnswer();
	}
	function showTrial() {
		leaveLesson();
		clearNextTimer();
		trialVisible = true;
		if (trialState !== 'idle') exitTrial();
		void centerActiveContent();
	}
	function returnToPractice() {
		exitTrial();
		trialVisible = false;
		void centerActiveContent();
	}
	function lessonStepLabel(step: GuidedLessonStep) {
		return t.lesson.steps[step.mode](step.questions);
	}
	function lessonHistoryKey(value: Locale) {
		return `scriptbound:guided-lesson-history:${currentCourse.id}:${value}:v1`;
	}
	function loadLessonHistory(value: Locale): GuidedLessonHistory {
		try {
			const saved = JSON.parse(localStorage.getItem(lessonHistoryKey(value)) ?? 'null');
			if (
				saved &&
				Number.isInteger(saved.completedLessons) &&
				Array.isArray(saved.recentWords) &&
				saved.recentWords.every((word: unknown) => typeof word === 'string')
			) {
				return {
					completedLessons: Math.max(0, saved.completedLessons),
					recentWords: saved.recentWords.slice(-24),
				};
			}
		} catch {
			// Begin with an empty history when browser storage is unavailable or invalid.
		}
		return { ...EMPTY_GUIDED_LESSON_HISTORY };
	}
	function saveLessonHistory(completed: boolean) {
		const nextHistory = {
			completedLessons: lessonHistory.completedLessons + (completed ? 1 : 0),
			recentWords: [...lessonHistory.recentWords, ...lessonWordsSeen].slice(-24),
		};
		lessonHistory = nextHistory;
		lessonWordsSeen = [];
		try {
			localStorage.setItem(lessonHistoryKey(lessonLocale), JSON.stringify(nextHistory));
		} catch {
			// The current lesson remains usable without persistent browser storage.
		}
	}
	function prepareLessonIntroduction() {
		const nextNew = curriculum.find((letter) => !$progress[letter]?.introduced);
		if (!nextNew) return;
		target = nextNew;
		prepareTargetIntroduction();
		letterChoices = createLetterChoices(target, alphabet);
		encodingKeys = createEncodingKeys(target, alphabet);
		focusAnswer();
	}
	function markLessonStarted() {
		lessonHasStarted = true;
		try {
			localStorage.setItem(GUIDED_LESSON_SEEN_KEY, '1');
		} catch {
			// The lesson can still start when browser storage is unavailable.
		}
	}
	function startLesson() {
		clearNextTimer();
		markLessonStarted();
		lessonLocale = $locale;
		lessonHistory = loadLessonHistory(lessonLocale);
		const nextLesson = createGuidedLesson(curriculum, $progress, content.words, lessonHistory);
		lessonPlan = nextLesson.steps;
		lessonWordTargets = nextLesson.wordTargets;
		lessonNewGlyphLimit = nextLesson.newGlyphLimit;
		lessonStepIndex = 0;
		lessonStepCompleted = 0;
		lessonCompletedQuestions = 0;
		lessonCorrectAtStart = score;
		lessonIntroducedAtStart = curriculum.filter((letter) => $progress[letter]?.introduced);
		lessonWordsSeen = [];
		lessonStatus = 'active';
		practiceSet = 'adaptive';
		reset(lessonPlan[0]?.mode ?? 'glyph');
		prepareLessonIntroduction();
		void centerActiveContent();
	}
	function continueLesson() {
		const nextStep = lessonPlan[lessonStepIndex + 1];
		if (!nextStep) return;
		lessonStepIndex++;
		lessonStepCompleted = 0;
		lessonStatus = 'active';
		reset(nextStep.mode);
		void centerActiveContent();
	}
	function leaveLesson() {
		if (lessonStatus === 'inactive') return;
		clearNextTimer();
		if (lessonWordsSeen.length) saveLessonHistory(false);
		lessonStatus = 'inactive';
		lessonPlan = [];
		lessonWordTargets = [];
		lessonStepIndex = 0;
		lessonStepCompleted = 0;
	}
	function chooseFreeMode(nextMode: PracticeMode) {
		leaveLesson();
		reset(nextMode);
		void centerActiveContent();
	}
	function returnToFreePractice() {
		leaveLesson();
		reset(mode);
		void centerActiveContent();
	}
	function completeLessonQuestion() {
		if (lessonStatus !== 'active' || !currentLessonStep) return false;
		lessonStepCompleted++;
		lessonCompletedQuestions++;
		if (lessonStepCompleted < currentLessonStep.questions) return false;
		clearNextTimer();
		if (lessonStepIndex < lessonPlan.length - 1) lessonStatus = 'transition';
		else {
			lessonStatus = 'complete';
			saveLessonHistory(true);
		}
		void centerActiveContent();
		return true;
	}
	function trialTierUnlocked(tierId: GlyphTrialTierId) {
		return isGlyphTrialTierUnlocked(curriculum, $progress, tierId);
	}
	function trialTierRemaining(tierId: GlyphTrialTierId) {
		return glyphTrialPool(curriculum, tierId).filter((letter) => !$progress[letter]?.introduced)
			.length;
	}
	function lessonTrialOffer() {
		const completedTiers = new Set(
			GLYPH_TRIAL_TIERS.filter(
				(tier) => $glyphTrialRecords[glyphTrialRecordKey(lessonLocale, tier.id)],
			).map((tier) => tier.id),
		);
		return firstUncompletedUnlockedGlyphTrialTier(curriculum, $progress, completedTiers);
	}
	function startLessonTrial(tierId: GlyphTrialTierId) {
		selectedTrialTier = tierId;
		showTrial();
		prepareTrial();
	}
	function nextTrialPrompt(previous?: string) {
		trialTarget = pick(trialPool, previous);
		trialChoices = createLetterChoices(trialTarget, trialPool);
		trialWrongChoices = [];
		trialPenaltyVisible = false;
	}
	function prepareTrial() {
		if (!trialTierUnlocked(selectedTrialTier)) return;
		clearNextTimer();
		clearTrialTimer();
		trialPenaltyVisible = false;
		trialState = 'ready';
		void centerActiveContent();
	}
	function beginTrialCountdown() {
		if (!trialTierUnlocked(selectedTrialTier)) return;
		clearTrialTimer();
		trialCountdown = 3;
		trialState = 'countdown';
		trialCountdownTimer = setInterval(() => {
			if (trialCountdown <= 1) startTrial();
			else trialCountdown--;
		}, 1_000);
	}
	function startTrial() {
		if (!trialTierUnlocked(selectedTrialTier)) return;
		clearNextTimer();
		clearTrialTimer();
		trialLocale = $locale;
		trialPool = glyphTrialPool(curriculum, selectedTrialTier);
		trialCorrect = 0;
		trialMistakes = 0;
		trialCombo = 0;
		trialBestCombo = 0;
		trialComboPulse = 0;
		trialMilestone = null;
		trialRawTime = 0;
		trialFinalTime = 0;
		trialIsPersonalBest = false;
		trialPreviousBestTime =
			$glyphTrialRecords[glyphTrialRecordKey(trialLocale, selectedTrialTier)]?.finalTimeMs ?? null;
		trialImprovementMs = 0;
		trialState = 'running';
		nextTrialPrompt();
		trialStartedAt = Date.now();
		trialNow = trialStartedAt;
		trialTimer = setInterval(() => (trialNow = Date.now()), 100);
	}
	function completeTrial() {
		trialRawTime = Date.now() - trialStartedAt;
		trialFinalTime = glyphTrialFinalTime(trialRawTime, trialMistakes);
		trialNow = Date.now();
		clearTrialTimer();
		trialIsPersonalBest = saveGlyphTrialRecord(trialLocale, selectedTrialTier, {
			finalTimeMs: trialFinalTime,
			rawTimeMs: trialRawTime,
			mistakes: trialMistakes,
			bestCombo: trialBestCombo,
			completedAt: Date.now(),
		});
		trialImprovementMs =
			trialIsPersonalBest && trialPreviousBestTime !== null
				? Math.max(0, trialPreviousBestTime - trialFinalTime)
				: 0;
		trialState = 'complete';
	}
	function submitTrialLetter(letter: string) {
		if (trialState !== 'running' || trialWrongChoices.includes(letter)) return;
		if (letter !== trialTarget) {
			trialMistakes++;
			trialCombo = 0;
			trialMilestone = null;
			if (trialComboEffectTimer) clearTimeout(trialComboEffectTimer);
			trialWrongChoices = [...trialWrongChoices, letter];
			trialPenaltyVisible = true;
			trialNow = Date.now();
			return;
		}
		trialCorrect++;
		trialCombo++;
		trialComboPulse++;
		trialBestCombo = Math.max(trialBestCombo, trialCombo);
		if ([5, 10, 15].includes(trialCombo)) {
			trialMilestone = trialCombo;
			if (trialComboEffectTimer) clearTimeout(trialComboEffectTimer);
			trialComboEffectTimer = setTimeout(() => {
				trialMilestone = null;
				trialComboEffectTimer = undefined;
			}, 700);
		}
		if (trialCorrect >= GLYPH_TRIAL_LENGTH) completeTrial();
		else nextTrialPrompt(trialTarget);
	}
	function handleTrialKeydown(event: KeyboardEvent) {
		if (trialState !== 'running' || event.metaKey || event.ctrlKey || event.altKey) return;
		const letter = event.key.toLowerCase();
		if (!trialChoices.includes(letter)) return;
		event.preventDefault();
		submitTrialLetter(letter);
	}
	function reset(nextMode?: PracticeMode) {
		if (trialState !== 'idle') exitTrial();
		trialVisible = false;
		clearNextTimer();
		if (nextMode === 'word') wordAutoFocusEnabled = false;
		if (nextMode && nextMode !== mode) {
			if (nextMode === 'word') shownWordTargets = [];
			mode = nextMode;
			mistakeQueue = [];
		}
		updateAttentionFallback();
		target = chooseTarget(target);
		prepareTargetIntroduction();
		answer = '';
		submitted = false;
		revealed = false;
		handwritingHasInk = false;
		drawingSubmitted = false;
		handwritingAssessment = null;
		currentIsRetry = false;
		startedAt = Date.now();
		letterChoices = createLetterChoices(target, alphabet);
		encodingKeys = createEncodingKeys(target, alphabet);
		focusAnswer();
	}
	function scheduleNext(delay: number) {
		clearNextTimer();
		nextDelay = delay;
		nextCountdown = delay;
		nextTimer = setInterval(() => {
			if (nextPaused) return;
			nextCountdown -= 0.5;
			if (nextCountdown <= 0) next();
		}, 500);
	}
	function toggleNextPause() {
		nextPaused = !nextPaused;
	}
	function submit(forcedCorrect?: boolean) {
		if (!answer.trim() || submitted) return;
		if (mode === 'word') wordReturnScrollTop = window.scrollY;
		correct = forcedCorrect ?? isCorrect(answer, target);
		submitted = true;
		if (mode === 'word') answerInput?.focus({ preventScroll: true });
		if (correct) score++;
		else if (!mistakeQueue.includes(target)) mistakeQueue = [...mistakeQueue, target];
		recordAttempt(target, answer, Date.now() - startedAt, {
			mode,
			firstAttempt: !currentIsRetry,
			forceIncorrect: forcedCorrect === false,
		});
		if (introducedGlyph && (mode === 'word' || mode === 'encode')) {
			const introductionMode = mode === 'word' ? 'word' : 'encode';
			recordGuidedIntroduction(
				introducedGlyph,
				isGuidedIntroductionSuccessful(introductionMode, correct, !currentIsRetry && !revealed),
			);
		}
		updateAttentionFallback();
		if (mode === 'word') wordAutoFocusEnabled = true;
		scheduleNext(correct ? 1.5 : mode === 'word' || mode === 'encode' ? 6 : 3);
	}
	function handleAnswerInput(event: Event) {
		answer = (event.currentTarget as HTMLInputElement).value;
		if (event instanceof InputEvent && event.isComposing) return;
		if (mode === 'glyph' && answer.length === 1) submit();
		else if (mode === 'word' && answer.length >= target.length) submit();
	}
	function preventSubmittedAnswerInput(event: InputEvent) {
		if (shouldPreventSubmittedInput(mode, submitted)) event.preventDefault();
	}
	function submitLetter(letter: string) {
		answer = letter;
		submit();
	}
	function appendEncodingCharacter(character: string) {
		if (submitted || answer.length >= Math.min(target.length, 160)) return;
		answer += character;
		if (answer.length >= target.length) submit();
	}
	function appendGlyph(letter: string) {
		appendEncodingCharacter(letter);
	}
	function appendSpace() {
		if (answer && !answer.endsWith(' ')) appendEncodingCharacter(' ');
	}
	function backspaceGlyph() {
		if (!submitted) answer = answer.slice(0, -1);
	}
	function clearGlyphs() {
		if (!submitted) answer = '';
	}
	function submitDrawing() {
		if (!handwritingHasInk || drawingSubmitted) return;
		drawingSubmitted = true;
	}
	function assessHandwriting(value: 'correct' | 'almost' | 'incorrect') {
		if (!drawingSubmitted || handwritingAssessment) return;
		handwritingAssessment = value;
		submitted = true;
		correct = value === 'correct';
		if (correct) score++;
		else if (!mistakeQueue.includes(target)) mistakeQueue = [...mistakeQueue, target];
		recordHandwritingAssessment(target, value);
		scheduleNext(value === 'correct' ? 1.5 : 3);
	}
	function changeGlyphAnswerMethod(value: 'type' | 'buttons') {
		glyphAnswerMethod = value;
		answer = '';
		focusAnswer();
	}
	function reveal() {
		revealed = true;
		answer = target;
		submit(false);
	}
	async function restoreWordScrollPosition() {
		if (mode !== 'word' || wordReturnScrollTop === null) return;
		const scrollTop = wordReturnScrollTop;
		await tick();
		requestAnimationFrame(() => {
			if (mode !== 'word') return;
			window.scrollTo({ top: scrollTop, left: window.scrollX });
			requestAnimationFrame(() => {
				if (mode === 'word') window.scrollTo({ top: scrollTop, left: window.scrollX });
			});
		});
	}
	function next() {
		clearNextTimer();
		question++;
		if (completeLessonQuestion()) return;
		const retry = question % 4 === 0 ? mistakeQueue[0] : undefined;
		if (retry && retry !== target) {
			mistakeQueue = mistakeQueue.slice(1);
			answer = '';
			submitted = false;
			revealed = false;
			handwritingHasInk = false;
			drawingSubmitted = false;
			handwritingAssessment = null;
			currentIsRetry = true;
			target = retry;
			prepareTargetIntroduction();
			startedAt = Date.now();
			letterChoices = createLetterChoices(target, alphabet);
			encodingKeys = createEncodingKeys(target, alphabet);
			focusAnswer();
		} else reset();
		void restoreWordScrollPosition();
	}
	function changeSet(value: PracticeSet) {
		practiceSet = value;
		reset();
	}
	if (initialMistakes) {
		updateAttentionFallback();
		const weak = weakLetters();
		const initialTarget = weightedGlyphPick(weak.length ? weak : adaptiveLetters());
		target = initialTarget;
		letterChoices = createLetterChoices(initialTarget, alphabet);
		encodingKeys = createEncodingKeys(initialTarget, alphabet);
	}
	onMount(() => {
		if (window.matchMedia('(max-width: 620px)').matches) glyphAnswerMethod = 'buttons';
		window.addEventListener('keydown', handleTrialKeydown);
		if (initialMode !== 'glyph' && !initialTrial) reset(initialMode);
		else {
			prepareTargetIntroduction();
			focusAnswer();
		}
	});
	onDestroy(() => {
		clearNextTimer();
		clearTrialTimer();
		if (typeof window !== 'undefined') window.removeEventListener('keydown', handleTrialKeydown);
		if (contentCenterFrame) cancelAnimationFrame(contentCenterFrame);
		if (attentionFallbackTimer) clearTimeout(attentionFallbackTimer);
	});
</script>

{#if lessonStatus === 'inactive'}
	<section class="lesson-launcher" aria-labelledby="guided-lesson-title">
		<div>
			<p class="eyebrow">{t.lesson.eyebrow}</p>
			<h2 id="guided-lesson-title">
				{lessonHasStarted ? t.lesson.title : t.lesson.startTitle}
			</h2>
			<p>{t.lesson.body}</p>
		</div>
		<button type="button" onclick={startLesson}>{t.lesson.start}</button>
	</section>
	<p class="free-practice-label">{t.lesson.freePractice}</p>
	<div class="mode-tabs" role="group" aria-label={t.modeLabel}>
		{#each options as option}<button
				class:active={!trialVisible && mode === option.value}
				onclick={() => chooseFreeMode(option.value)}>{option.label}</button
			>{/each}
		<button class:active={trialVisible} onclick={showTrial}>{t.trial.tab}</button>
	</div>
{:else}
	<section class="lesson-progress" aria-label={t.lesson.progressLabel}>
		<div>
			<p class="eyebrow">{t.lesson.eyebrow}</p>
			<strong>{t.lesson.progress(lessonCompletedQuestions, lessonTotal)}</strong>
		</div>
		<ol>
			{#each lessonPlan as step, index}
				<li class:current={index === lessonStepIndex} class:complete={index < lessonStepIndex}>
					<span>{index < lessonStepIndex ? '✓' : index + 1}</span>{lessonStepLabel(step)}
				</li>
			{/each}
		</ol>
		<button type="button" class="secondary" onclick={leaveLesson}>{t.lesson.leave}</button>
	</section>
{/if}
{#if !trialVisible && lessonStatus === 'inactive'}
	<div class="practice-settings">
		<label for="practice-set">{t.questionSet}</label><select
			id="practice-set"
			value={practiceSet}
			onchange={(event) => changeSet(event.currentTarget.value as PracticeSet)}
			><option value="adaptive">{t.sets.adaptive}</option><option value="all">{t.sets.all}</option
			></select
		>{#if practiceSet !== 'adaptive' || mode === 'glyph' || mode === 'encode'}<span
				>{practiceSet === 'adaptive'
					? (mode === 'encode' ? t.introducedEncoding : t.introduced)(
							curriculum.filter((letter) => $progress[letter]?.introduced).length,
						)
					: practiceSet === 'mistakes'
						? t.attention(weakLetters().length)
						: t.noFilter}</span
			>{/if}
	</div>
{/if}
{#if trialVisible && trialState === 'idle'}
	<section
		bind:this={activeContentElement}
		class="trial-launcher"
		aria-labelledby="glyph-trial-title"
	>
		<div>
			<p class="eyebrow">{t.trial.eyebrow}</p>
			<h2 id="glyph-trial-title">{t.trial.title}</h2>
			<p>{t.trial.body}</p>
		</div>
		<div class="trial-launcher-controls">
			<label for="trial-tier">{t.trial.tier}</label>
			<select id="trial-tier" bind:value={selectedTrialTier}>
				{#each GLYPH_TRIAL_TIERS as tier}
					<option value={tier.id}>{t.trial.tiers[tier.id]}</option>
				{/each}
			</select>
			<small class:locked={!trialTierUnlocked(selectedTrialTier)}>
				{#if trialTierUnlocked(selectedTrialTier)}
					{currentTrialRecord
						? t.trial.best(formatGlyphTrialTime(currentTrialRecord.finalTimeMs))
						: t.trial.noBest}
				{:else}
					{t.trial.locked(trialTierRemaining(selectedTrialTier), selectedTrialGlyphCount)}
				{/if}
			</small>
			<button type="button" disabled={!trialTierUnlocked(selectedTrialTier)} onclick={prepareTrial}>
				{t.trial.open}
			</button>
		</div>
	</section>
{/if}
{#if trialVisible}
	{#if trialState !== 'idle'}
		<section
			bind:this={activeContentElement}
			class="practice-card trial-card"
			class:combo-building={trialState === 'running' && trialCombo >= 3}
			class:combo-strong={trialState === 'running' && trialCombo >= 7}
			class:combo-peak={trialState === 'running' && trialCombo >= 12}
			class:combo-milestone-active={Boolean(trialMilestone)}
			class:personal-best={trialState === 'complete' && trialIsPersonalBest}
			aria-labelledby="active-glyph-trial-title"
		>
			{#if trialState === 'ready'}
				<div class="trial-meta" aria-hidden="true">
					<span>{t.trial.progress(0, GLYPH_TRIAL_LENGTH)}</span>
					<strong>{formatGlyphTrialTime(0)}</strong>
					<span>{t.trial.mistakes(0)}</span>
				</div>
				<div class="trial-heading">
					<div>
						<p class="eyebrow">{t.trial.tiers[selectedTrialTier]}</p>
						<h2 id="active-glyph-trial-title">{t.trial.title}</h2>
					</div>
					<strong class="trial-combo">{t.trial.combo(0)}</strong>
				</div>
				<div class="trial-ready-prompt" aria-hidden="true"><span></span></div>
				<div class="trial-choice-placeholders" aria-hidden="true">
					<span></span><span></span><span></span><span></span>
				</div>
				<p class="trial-ready-copy">{t.trial.ready}</p>
				<div class="trial-ready-actions">
					<button type="button" class="secondary" onclick={returnToPractice}>{t.trial.exit}</button>
					<button type="button" onclick={beginTrialCountdown}>{t.trial.start}</button>
				</div>
			{:else if trialState === 'countdown'}
				<div class="trial-heading">
					<div>
						<p class="eyebrow">{t.trial.tiers[selectedTrialTier]}</p>
						<h2 id="active-glyph-trial-title">{t.trial.title}</h2>
					</div>
				</div>
				<div class="trial-countdown" role="timer" aria-live="assertive">
					<span>{t.trial.countdown}</span>
					<strong>{trialCountdown}</strong>
				</div>
				<div class="trial-ready-actions">
					<button type="button" class="secondary" onclick={returnToPractice}>{t.trial.exit}</button>
				</div>
			{:else if trialState === 'running'}
				<div class="trial-meta" aria-live="polite">
					<span>{t.trial.progress(trialCorrect, GLYPH_TRIAL_LENGTH)}</span>
					<strong
						>{formatGlyphTrialTime(
							trialNow - trialStartedAt + trialMistakes * GLYPH_TRIAL_MISTAKE_PENALTY_MS,
						)}</strong
					>
					<span>{t.trial.mistakes(trialMistakes)}</span>
				</div>
				<div class="trial-heading">
					<div>
						<p class="eyebrow">{t.trial.tiers[selectedTrialTier]}</p>
						<h2 id="active-glyph-trial-title">{t.trial.title}</h2>
					</div>
					{#key trialComboPulse}
						<strong class:combo-active={trialCombo >= 2} class="trial-combo"
							>{t.trial.combo(trialCombo)}</strong
						>
					{/key}
				</div>
				{#if trialMilestone}
					<div class="trial-combo-milestone" role="status">
						{t.trial.comboMilestone(trialMilestone)}
					</div>
				{/if}
				<div class="trial-prompt"><GlyphText text={trialTarget} /></div>
				<div class="trial-choices" aria-label={t.trial.choices}>
					{#each trialChoices as letter}
						<button
							type="button"
							disabled={trialWrongChoices.includes(letter)}
							class:incorrect={trialWrongChoices.includes(letter)}
							onclick={() => submitTrialLetter(letter)}>{letter.toUpperCase()}</button
						>
					{/each}
				</div>
				<div class="trial-running-footer">
					<span class:visible={trialPenaltyVisible} class="trial-penalty" role="status">
						{t.trial.penalty}
					</span>
					<button type="button" class="secondary" onclick={returnToPractice}>{t.trial.exit}</button>
				</div>
			{:else}
				<div class="trial-results" role="status">
					{#if trialIsPersonalBest && trialPreviousBestTime !== null}
						<div class="personal-best-fireworks" aria-hidden="true">
							{#each [0, 1, 2] as burst}
								<div class:second={burst === 1} class:third={burst === 2} class="firework-burst">
									{#each FIREWORK_PARTICLES as particle}
										<i
											style={`--firework-x: ${particle.x}px; --firework-y: ${particle.y}px; --firework-delay: ${particle.delay}ms;`}
										></i>
									{/each}
								</div>
							{/each}
						</div>
					{/if}
					<p class="eyebrow">{t.trial.complete}</p>
					<h2 id="active-glyph-trial-title">
						{trialIsPersonalBest ? t.trial.newBest : t.trial.finalTime}
					</h2>
					<strong class="trial-final-time">{formatGlyphTrialTime(trialFinalTime)}</strong>
					{#if trialIsPersonalBest}
						<strong class="personal-best-badge">
							{trialPreviousBestTime === null
								? t.trial.firstRecord
								: t.trial.faster(
										trialImprovementMs < 100
											? t.trial.lessThanTenth
											: formatGlyphTrialTime(trialImprovementMs),
									)}
						</strong>
					{/if}
					<div class="trial-result-details">
						<span>{t.trial.rawTime(formatGlyphTrialTime(trialRawTime))}</span>
						<span>{t.trial.mistakes(trialMistakes)}</span>
						<span>{t.trial.bestCombo(trialBestCombo)}</span>
					</div>
					<div class="actions">
						<button type="button" class="secondary" onclick={returnToPractice}
							>{t.trial.exit}</button
						>
						<button type="button" onclick={prepareTrial}>{t.trial.retry}</button>
					</div>
				</div>
			{/if}
		</section>
	{/if}
{:else if lessonStatus === 'transition' && currentLessonStep}
	<section
		bind:this={activeContentElement}
		class="lesson-boundary practice-card"
		aria-live="polite"
	>
		<p class="eyebrow">{t.lesson.stepComplete}</p>
		<h2>{t.lesson.completedStep(t.modes[currentLessonStep.mode])}</h2>
		{#if lessonPlan[lessonStepIndex + 1]}
			<p>{t.lesson.nextStep(t.modes[lessonPlan[lessonStepIndex + 1].mode])}</p>
			<div class="actions">
				<button type="button" class="secondary" onclick={returnToFreePractice}
					>{t.lesson.stop}</button
				>
				<button type="button" onclick={continueLesson}>{t.lesson.continue}</button>
			</div>
		{/if}
	</section>
{:else if lessonStatus === 'complete'}
	{@const offeredTrialTier = lessonTrialOffer()}
	<section
		bind:this={activeContentElement}
		class="lesson-boundary lesson-complete practice-card"
		aria-live="polite"
	>
		<p class="eyebrow">{t.lesson.completeEyebrow}</p>
		<h2>{t.lesson.completeTitle}</h2>
		<p>{t.lesson.completeBody(score - lessonCorrectAtStart, lessonCompletedQuestions)}</p>
		{#if offeredTrialTier}
			<p class="lesson-trial-offer">
				{t.lesson.trialOffer(t.trial.tiers[offeredTrialTier])}
			</p>
		{/if}
		<div class="actions">
			<button type="button" class="secondary" onclick={returnToFreePractice}
				>{t.lesson.freePractice}</button
			>
			<button type="button" class:secondary={Boolean(offeredTrialTier)} onclick={startLesson}
				>{t.lesson.another}</button
			>
			{#if offeredTrialTier}
				<button type="button" onclick={() => startLessonTrial(offeredTrialTier)}
					>{t.lesson.trialCta(t.trial.tiers[offeredTrialTier])}</button
				>
			{/if}
		</div>
	</section>
{:else}
	<div
		bind:this={activeContentElement}
		class="practice-card"
		class:word-mode={mode === 'word'}
		class:simplified-result={simplifiedResult && submitted}
		class:success={simplifiedResult && submitted && correct}
		class:error={simplifiedResult && submitted && !correct}
	>
		<div class:simplified-result-meta={simplifiedResult} class="session-meta">
			<span>{t.question(question)}</span>
			{#if simplifiedResult}<span
					class:visible={submitted}
					class:success={submitted && correct}
					class:error={submitted && !correct}
					class="result-icon"
					role={submitted ? 'status' : undefined}
					aria-label={submitted
						? correct
							? t.correct
							: revealed
								? t.revealed
								: t.notQuite
						: undefined}
					aria-hidden={submitted ? undefined : 'true'}
					>{submitted ? (correct ? '✓' : '×') : '✓'}</span
				>{/if}
			<span>{t.score(score)}</span>
		</div>
		<p class="instruction">{t.instructions[mode]}</p>
		<div
			class="practice-stage"
			class:glyph-stage={mode === 'glyph'}
			class:encode-stage={mode === 'encode'}
		>
			{#if noAdaptiveWord}
				<section class="empty-practice" role="status">
					<h2>{t.noAdaptiveWord.title}</h2>
					<p>{t.noAdaptiveWord.body}</p>
				</section>
			{:else if introductionPending && introducedGlyph}
				<GlyphIntroduction
					letter={introducedGlyph}
					eyebrow={t.glyphIntroduction.eyebrow}
					title={t.glyphIntroduction.title(introducedGlyph)}
					body={t.glyphIntroduction.body}
					continueLabel={t.glyphIntroduction.continue[mode as 'glyph' | 'word' | 'encode']}
					onContinue={beginGuidedPractice}
				/>
			{:else}
				{#if mode === 'encode' || mode === 'handwriting'}
					<div class="latin-prompt">
						<span>{mode === 'handwriting' ? target.toUpperCase() : target}</span>
						{#if mode === 'encode' && submitted && !correct}<div
								class="encoding-feedback-overlay error"
								role="status"
								aria-label={t.expected(target)}
							>
								<div class="encoding-reference">
									{#each encodingReferenceWords() as word}<span
											class="encoding-reference-word"
											aria-hidden="true"
										>
											{#each word as character}<span
													class:correct={character.correct}
													class:incorrect={!character.correct}
													class="encoding-reference-character"
													><b>{character.letter.toUpperCase()}</b><GlyphText
														text={character.letter}
													/></span
												>{/each}
										</span>{/each}
								</div>
							</div>{/if}
					</div>
				{:else}
					<div class:long={mode !== 'glyph'} class="prompt">
						<GlyphText text={target} />
						{#if mode === 'word' && submitted && !correct}<div
								class="encoding-feedback-overlay error"
								role="status"
								aria-label={t.expected(target)}
							>
								<div class="encoding-reference">
									{#each encodingReferenceWords() as word}<span
											class="encoding-reference-word"
											aria-hidden="true"
										>
											{#each word as character}<span
													class:correct={character.correct}
													class:incorrect={!character.correct}
													class="encoding-reference-character"
													><b>{character.letter.toUpperCase()}</b><GlyphText
														text={character.letter}
													/></span
												>{/each}
										</span>{/each}
								</div>
							</div>{/if}
					</div>
				{/if}
				<form
					onsubmit={(event) => {
						event.preventDefault();
						submitted ? next() : submit();
					}}
				>
					{#if mode === 'handwriting'}
						{#key question}<HandwritingPad
								reference={drawingSubmitted ? target : undefined}
								{overlayOpacity}
								disabled={drawingSubmitted}
								label={t.handwriting.canvas}
								undoLabel={t.handwriting.undo}
								clearLabel={t.handwriting.clear}
								onChange={(hasInk: boolean) => (handwritingHasInk = hasInk)}
							/>{/key}
						{#if drawingSubmitted}
							<label class="overlay-control">
								<span>{t.handwriting.overlay}</span>
								<input type="range" min="0.1" max="0.9" step="0.05" bind:value={overlayOpacity} />
							</label>
						{/if}
						{#if drawingSubmitted && !handwritingAssessment}
							<fieldset class="self-assessment">
								<legend>{t.handwriting.assess}</legend>
								<div>
									<button type="button" onclick={() => assessHandwriting('incorrect')}
										>{t.handwriting.incorrect}</button
									>
									<button type="button" onclick={() => assessHandwriting('almost')}
										>{t.handwriting.almost}</button
									>
									<button type="button" onclick={() => assessHandwriting('correct')}
										>{t.handwriting.correct}</button
									>
								</div>
							</fieldset>
						{/if}
						{#if handwritingAssessment}
							<div
								class:success={handwritingAssessment === 'correct'}
								class:error={handwritingAssessment !== 'correct'}
								class="feedback"
								role="status"
							>
								<strong>{t.handwriting.results[handwritingAssessment]}</strong>
							</div>
							<div class="next-indicator" aria-live="polite">
								<span>{t.next(nextCountdown)}</span>
								<div class="countdown-track">
									<i style:animation-duration={`${nextDelay}s`}></i>
								</div>
							</div>
						{/if}
						<div class="actions">
							{#if !drawingSubmitted}<button
									type="button"
									disabled={!handwritingHasInk}
									onclick={submitDrawing}>{t.handwriting.submit}</button
								>
							{:else if handwritingAssessment}<button type="button" onclick={next}
									>{t.nextButton}</button
								>
							{/if}
						</div>
					{:else}
						{#if mode === 'glyph'}<fieldset class="answer-method">
								<legend>{t.answerMethod.label}</legend>
								<div class="answer-method-options">
									<button
										type="button"
										disabled={submitted}
										class:active={glyphAnswerMethod === 'type'}
										aria-pressed={glyphAnswerMethod === 'type'}
										onclick={() => changeGlyphAnswerMethod('type')}>{t.answerMethod.type}</button
									><button
										type="button"
										disabled={submitted}
										class:active={glyphAnswerMethod === 'buttons'}
										aria-pressed={glyphAnswerMethod === 'buttons'}
										onclick={() => changeGlyphAnswerMethod('buttons')}
										>{t.answerMethod.buttons}</button
									>
								</div>
							</fieldset>{/if}
						{#if mode === 'encode'}
							<span class="answer-label" id="encoded-answer-label">{t.answer}</span>
							<div
								class="encoded-answer"
								role="textbox"
								aria-label={`${t.answer}. ${t.encodedAnswer(answer.length)}`}
							>
								{#if answer}<GlyphText text={answer} />{:else}<span aria-hidden="true">—</span>{/if}
							</div>
							{#key question}<GlyphKeyboard
									keys={encodingKeys}
									disabled={submitted}
									allowSpace={target.includes(' ')}
									onLetter={appendGlyph}
									onBackspace={backspaceGlyph}
									onClear={clearGlyphs}
									onSpace={appendSpace}
								/>{/key}
						{:else if mode !== 'glyph' || glyphAnswerMethod === 'type'}<label for="answer"
								>{t.answer}</label
							><input
								id="answer"
								bind:this={answerInput}
								bind:value={answer}
								oninput={handleAnswerInput}
								onbeforeinput={preventSubmittedAnswerInput}
								maxlength={mode === 'glyph' ? 1 : undefined}
								disabled={answerInputDisabled(mode, submitted)}
								aria-disabled={submitted}
								autocomplete="off"
								autocapitalize="none"
								spellcheck="false"
							/>
						{:else}<div class="letter-choices" aria-label={t.answerMethod.letters}>
								{#each letterChoices as letter}<button
										type="button"
										disabled={submitted}
										class:selected={answer === letter}
										class:correct-answer={submitted && letter === target}
										class:incorrect-answer={submitted && !correct && letter === answer}
										onclick={() => submitLetter(letter)}>{letter.toUpperCase()}</button
									>{/each}
							</div>{/if}
						{#if submitted && (correct || mode !== 'encode') && !simplifiedResult}<div
								class:success={correct}
								class:error={!correct}
								class="feedback"
								role="status"
							>
								<div class="feedback-heading">
									<span class="feedback-icon" aria-hidden="true">{correct ? '✓' : '×'}</span>
									<strong>{correct ? t.correct : revealed ? t.revealed : t.notQuite}</strong>
								</div>
								{#if !correct}<span>{t.expected(target)}</span>{#if !revealed}<AnswerComparison
											{answer}
											expected={target}
										/>{/if}{/if}
							</div>{/if}
						{#if submitted || simplifiedResult}<div
								class:simplified-countdown={simplifiedResult}
								class="next-indicator"
								aria-live={submitted ? 'polite' : undefined}
							>
								{#if submitted}<div class="countdown-heading">
										<span>{t.next(nextCountdown)}</span>
										{#if !correct}<button
												type="button"
												class="secondary countdown-toggle"
												onclick={toggleNextPause}>{nextPaused ? t.resume : t.pause}</button
											>{/if}
									</div>
									<div class="countdown-track">
										<i class:paused={nextPaused} style:animation-duration={`${nextDelay}s`}></i>
									</div>{/if}
							</div>{/if}
						<div class="actions">
							{#if !submitted}<button type="button" class="secondary" onclick={reveal}
									>{t.reveal}</button
								>{/if}{#if submitted || mode !== 'glyph' || glyphAnswerMethod === 'type'}<button
									type="submit">{submitted ? t.nextButton : t.check}</button
								>{/if}
						</div>
					{/if}
				</form>
			{/if}
		</div>
	</div>
{/if}

<style>
	.lesson-launcher {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		margin: 2rem 0 0;
		padding: 1.25rem;
		border: 1px solid var(--accent);
		border-left-width: 4px;
		border-radius: 0.55rem;
		background: linear-gradient(135deg, var(--panel), var(--card-end));
	}
	.lesson-launcher > div {
		display: grid;
		gap: 0.35rem;
	}
	.lesson-launcher h2,
	.lesson-launcher p,
	.lesson-progress p,
	.lesson-boundary h2,
	.lesson-boundary p {
		margin: 0;
	}
	.lesson-launcher > div > p:last-child,
	.lesson-boundary > p:not(.eyebrow) {
		color: var(--muted);
	}
	.lesson-launcher > button {
		flex: 0 0 auto;
	}
	.free-practice-label {
		margin: 1.5rem 0 -1.35rem;
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.lesson-progress {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 1.25rem;
		margin: 2rem 0 1rem;
		padding: 1rem 1.2rem;
		border: 1px solid var(--line);
		border-radius: 0.55rem;
		background: var(--panel);
	}
	.lesson-progress > div {
		display: grid;
		gap: 0.2rem;
	}
	.lesson-progress strong {
		font-size: 0.85rem;
	}
	.lesson-progress ol {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.lesson-progress li {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--muted);
		font-size: 0.78rem;
	}
	.lesson-progress li span {
		display: grid;
		width: 1.55rem;
		height: 1.55rem;
		place-items: center;
		border: 1px solid var(--line);
		border-radius: 50%;
		font-size: 0.7rem;
	}
	.lesson-progress li.current {
		color: var(--ink);
		font-weight: 700;
	}
	.lesson-progress li.current span,
	.lesson-progress li.complete span {
		color: var(--active-ink);
		border-color: var(--accent);
		background: var(--accent);
	}
	.lesson-boundary {
		display: grid;
		min-height: 28rem;
		place-content: center;
		justify-items: center;
		gap: 0.8rem;
		text-align: center;
	}
	.lesson-boundary .actions {
		justify-content: center;
	}
	.lesson-complete h2 {
		color: var(--accent);
		font:
			500 clamp(2.2rem, 7vw, 4rem) / 1.05 Georgia,
			serif;
	}
	.trial-launcher {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(220px, 0.8fr);
		gap: 1.5rem;
		margin-bottom: 1rem;
		padding: 1.25rem;
		border: 1px solid var(--line);
		border-left: 3px solid var(--accent);
		border-radius: 0.45rem;
		background: var(--panel);
	}
	.trial-launcher h2,
	.trial-launcher p,
	.trial-heading h2,
	.trial-heading p,
	.trial-results h2,
	.trial-results p {
		margin: 0;
	}
	.trial-launcher > div:first-child {
		display: grid;
		align-content: center;
		gap: 0.45rem;
	}
	.trial-launcher > div:first-child > p:last-child {
		max-width: 48rem;
		color: var(--muted);
	}
	.trial-launcher-controls {
		display: grid;
		gap: 0.45rem;
	}
	.trial-launcher-controls label,
	.trial-launcher-controls small {
		color: var(--muted);
		font-size: 0.8rem;
	}
	.trial-launcher-controls small.locked {
		color: #efa095;
		font-weight: 650;
	}
	.trial-launcher-controls select {
		width: 100%;
		padding: 0.65rem;
		border: 1px solid var(--line);
		border-radius: 0.4rem;
		color: var(--ink);
		background: var(--field);
	}
	.trial-launcher-controls button {
		margin-top: 0.25rem;
	}
	.trial-launcher-controls button:disabled {
		cursor: not-allowed;
		filter: grayscale(0.75);
		opacity: 0.38;
	}
	.trial-card {
		position: relative;
		min-height: 34rem;
		overflow: hidden;
		transition:
			border-color 180ms ease,
			box-shadow 180ms ease;
	}
	.trial-card::before {
		position: absolute;
		inset: 0;
		z-index: 1;
		background: radial-gradient(
			circle at center,
			color-mix(in srgb, var(--accent) 26%, transparent),
			transparent 62%
		);
		opacity: 0;
		pointer-events: none;
		content: '';
	}
	.trial-card.combo-building {
		border-color: color-mix(in srgb, var(--accent) 70%, var(--line));
		box-shadow:
			inset 0 0 55px color-mix(in srgb, var(--accent) 10%, transparent),
			0 30px 80px #0008;
	}
	.trial-card.combo-strong {
		box-shadow:
			inset 0 0 85px color-mix(in srgb, var(--accent) 17%, transparent),
			0 0 38px color-mix(in srgb, var(--accent) 20%, transparent),
			0 30px 80px #0008;
	}
	.trial-card.combo-peak {
		border-color: var(--accent);
		box-shadow:
			inset 0 0 115px color-mix(in srgb, var(--accent) 24%, transparent),
			0 0 52px color-mix(in srgb, var(--accent) 28%, transparent),
			0 30px 80px #0008;
	}
	.trial-card.combo-milestone-active {
		animation: combo-screen-shake 320ms ease-out;
	}
	.trial-card.combo-milestone-active::before {
		animation: combo-screen-pulse 520ms ease-out;
	}
	.trial-card.personal-best {
		border-color: var(--accent);
		animation: personal-best-card 700ms ease-out;
	}
	.trial-meta {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
		color: var(--muted);
		font-size: 0.8rem;
	}
	.trial-meta strong {
		color: var(--accent);
		font:
			500 1.8rem/1 Georgia,
			serif;
	}
	.trial-meta > :last-child {
		text-align: right;
	}
	.trial-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1.5rem;
	}
	.trial-combo {
		color: var(--accent);
		font-size: 1.1rem;
	}
	.trial-combo.combo-active {
		animation: combo-pop 180ms ease-out;
	}
	.trial-combo-milestone {
		position: absolute;
		top: 5.5rem;
		left: 50%;
		z-index: 2;
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--accent);
		border-radius: 999px;
		color: var(--active-ink);
		background: var(--accent);
		box-shadow: 0 0 28px color-mix(in srgb, var(--accent) 40%, transparent);
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		pointer-events: none;
		animation: milestone-in 700ms ease-out forwards;
	}
	.trial-prompt {
		display: grid;
		min-height: 12rem;
		place-items: center;
		font-size: clamp(5rem, 16vw, 9rem);
		transition:
			transform 160ms ease,
			filter 160ms ease;
	}
	.trial-card.combo-building .trial-prompt {
		filter: drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 35%, transparent));
		transform: scale(1.015);
	}
	.trial-card.combo-strong .trial-prompt {
		filter: drop-shadow(0 0 13px color-mix(in srgb, var(--accent) 52%, transparent));
		transform: scale(1.035);
	}
	.trial-card.combo-peak .trial-prompt {
		filter: drop-shadow(0 0 19px color-mix(in srgb, var(--accent) 68%, transparent));
		transform: scale(1.055);
	}
	.trial-ready-prompt {
		display: grid;
		min-height: 12rem;
		place-items: center;
	}
	.trial-ready-prompt span {
		display: block;
		width: clamp(4.5rem, 14vw, 7rem);
		aspect-ratio: 1;
		border: 1px dashed var(--line);
		border-radius: 0.55rem;
		background: var(--field);
	}
	.trial-ready-copy {
		margin: 0;
		color: var(--muted);
		text-align: center;
	}
	.trial-choice-placeholders {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
		max-width: 38rem;
		margin: 0 auto;
	}
	.trial-choice-placeholders span {
		min-height: 4rem;
		border: 1px dashed var(--line);
		border-radius: 0.4rem;
		background: var(--field);
	}
	.trial-ready-actions {
		display: flex;
		justify-content: center;
		gap: 0.7rem;
		margin-top: 1.25rem;
	}
	.trial-countdown {
		display: grid;
		min-height: 22rem;
		place-content: center;
		justify-items: center;
		gap: 0.4rem;
	}
	.trial-countdown span {
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.trial-countdown strong {
		color: var(--accent);
		font:
			500 clamp(6rem, 20vw, 10rem) / 1 Georgia,
			serif;
	}
	.trial-choices {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
		max-width: 38rem;
		margin: 0 auto;
	}
	.trial-choices button {
		min-width: 0;
		min-height: 4rem;
		font-size: 1.1rem;
		font-weight: 700;
		transition:
			border-color 140ms ease,
			box-shadow 140ms ease;
	}
	.trial-card.combo-strong .trial-choices button {
		box-shadow: inset 0 0 18px color-mix(in srgb, var(--accent) 7%, transparent);
	}
	.trial-card.combo-peak .trial-choices button {
		border-color: color-mix(in srgb, var(--accent) 68%, var(--line));
		box-shadow:
			inset 0 0 24px color-mix(in srgb, var(--accent) 12%, transparent),
			0 0 12px color-mix(in srgb, var(--accent) 9%, transparent);
	}
	.trial-choices button.incorrect {
		color: #fff1ef;
		border-color: #efa095;
		background: #8f3f36;
		opacity: 0.7;
	}
	.trial-running-footer {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		margin-top: 1.25rem;
	}
	.trial-running-footer button {
		grid-column: 2;
	}
	.trial-penalty {
		grid-column: 1;
		visibility: hidden;
		color: #efa095;
		font-weight: 700;
	}
	.trial-penalty.visible {
		visibility: visible;
	}
	.trial-results {
		position: relative;
		display: grid;
		min-height: 29rem;
		place-content: center;
		justify-items: center;
		gap: 0.8rem;
		text-align: center;
	}
	.trial-results > :not(.personal-best-fireworks) {
		position: relative;
		z-index: 2;
	}
	.personal-best-fireworks {
		position: absolute;
		inset: 0;
		z-index: 1;
		overflow: hidden;
		pointer-events: none;
	}
	.firework-burst {
		position: absolute;
		top: 34%;
		left: 24%;
	}
	.firework-burst.second {
		top: 42%;
		left: 76%;
	}
	.firework-burst.third {
		top: 24%;
		left: 50%;
	}
	.firework-burst::before {
		position: absolute;
		width: 1rem;
		height: 1rem;
		border: 2px solid var(--accent);
		border-radius: 50%;
		box-shadow: 0 0 24px var(--accent);
		transform: translate(-50%, -50%) scale(0);
		animation: firework-bloom 520ms ease-out forwards;
		content: '';
	}
	.firework-burst.second::before {
		animation-delay: 220ms;
	}
	.firework-burst.third::before {
		animation-delay: 440ms;
	}
	.firework-burst i {
		position: absolute;
		top: -2px;
		left: -2px;
		display: block;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 9px var(--accent);
		opacity: 0;
		animation: firework-particle 900ms cubic-bezier(0.16, 0.72, 0.34, 1) forwards;
		animation-delay: var(--firework-delay);
	}
	.firework-burst i:nth-child(3n) {
		background: var(--ink);
	}
	.firework-burst.second i {
		animation-delay: calc(var(--firework-delay) + 220ms);
	}
	.firework-burst.third i {
		animation-delay: calc(var(--firework-delay) + 440ms);
	}
	.trial-final-time {
		color: var(--accent);
		font:
			500 clamp(4rem, 12vw, 7rem) / 1 Georgia,
			serif;
	}
	.personal-best-badge {
		padding: 0.45rem 0.8rem;
		border: 1px solid var(--accent);
		border-radius: 999px;
		color: var(--accent);
		font-size: 0.8rem;
		letter-spacing: 0.04em;
		animation: best-badge-in 500ms 120ms ease-out both;
	}
	.trial-result-details {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.4rem 1.2rem;
		color: var(--muted);
	}
	.practice-settings {
		display: grid;
		grid-template-columns: auto minmax(180px, 1fr) auto;
		align-items: center;
		gap: 0.7rem;
		margin-bottom: 1rem;
		color: var(--muted);
		font-size: 0.8rem;
	}
	.practice-settings label {
		margin: 0;
	}
	.practice-settings select {
		color: var(--ink);
		background: var(--field);
		border: 1px solid var(--line);
		border-radius: 0.4rem;
		padding: 0.65rem;
	}
	.practice-card.word-mode {
		overflow-anchor: none;
	}
	.practice-stage {
		min-height: 23rem;
	}
	.practice-stage.glyph-stage {
		min-height: 31rem;
	}
	.practice-stage.encode-stage {
		min-height: 34rem;
	}
	.empty-practice {
		display: grid;
		justify-items: center;
		gap: 0.75rem;
		padding: 3rem 1rem;
		text-align: center;
	}
	.empty-practice h2,
	.empty-practice p {
		margin: 0;
	}
	.empty-practice p {
		color: var(--muted);
	}
	.practice-card.simplified-result {
		border-color: #78b888;
		background: linear-gradient(145deg, #28553a, #132d20);
		box-shadow:
			0 0 0 2px #9bd3a733,
			0 30px 80px #0008;
	}
	.practice-card.simplified-result.error {
		border-color: #d07a6c;
		background: linear-gradient(145deg, #65342f, #351b19);
		box-shadow:
			0 0 0 2px #efa09533,
			0 30px 80px #0008;
	}
	.session-meta.simplified-result-meta {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
	}
	.session-meta.simplified-result-meta > :last-child {
		text-align: right;
	}
	.result-icon {
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		place-items: center;
		visibility: hidden;
		border: 2px solid currentcolor;
		border-radius: 50%;
		font-size: 1.8rem;
		font-weight: 800;
		line-height: 1;
	}
	.result-icon.visible {
		visibility: visible;
	}
	.result-icon.success {
		color: #c8f1d0;
	}
	.result-icon.error {
		color: #ffd0ca;
	}
	.practice-card.word-mode .prompt {
		position: relative;
		height: 180px;
		overflow: hidden;
	}
	.latin-prompt {
		position: relative;
		display: grid;
		min-height: 140px;
		place-items: center;
		padding: 1rem;
		font:
			500 clamp(2rem, 7vw, 4rem) / 1.15 Georgia,
			serif;
		text-align: center;
	}
	.encoding-feedback-overlay {
		position: absolute;
		inset: 0;
		z-index: 1;
		align-content: center;
		margin: 0;
		overflow: auto;
		text-align: left;
	}
	.encoding-feedback-overlay.error {
		background: linear-gradient(90deg, #3a1e1c, var(--feedback) 72%);
	}
	.encoding-feedback-overlay .encoding-reference {
		margin-top: 0;
		padding: 0.25rem 0 0;
		border: 0;
		background: transparent;
	}
	.encoded-answer {
		min-height: 4rem;
		padding: 0.8rem 1rem;
		border: 1px solid var(--line);
		border-radius: 0.4rem;
		background: var(--field);
		font-size: clamp(1.8rem, 5vw, 3rem);
		text-align: center;
	}
	.answer-label {
		display: block;
		margin-bottom: 0.45rem;
		color: var(--muted);
		font-size: 0.8rem;
	}
	.encoded-answer > span {
		color: var(--muted);
	}
	.encoding-reference {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.75rem 1.25rem;
		margin-top: 1rem;
		padding: 0.75rem;
		border: 1px solid var(--line);
		border-radius: 0.45rem;
		background: var(--field);
	}
	.encoding-reference-word {
		display: flex;
		gap: 0.2rem;
	}
	.encoding-reference-character {
		display: grid;
		grid-template-rows: auto 1fr;
		min-width: 1.7rem;
		place-items: center;
		border: 1px solid;
		border-radius: 0.35rem;
		padding: 0.25rem 0.2rem;
		font-size: 1.65rem;
		line-height: 1;
	}
	.encoding-reference-character b {
		color: inherit;
		font: 600 0.7rem/1 system-ui;
	}
	.encoding-reference-character.correct {
		color: #9bd3a7;
		border-color: #688d73;
		background: #193124;
	}
	.encoding-reference-character.incorrect {
		color: #efa095;
		border-color: #a66d62;
		background: #321d1b;
	}
	.overlay-control {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 1rem;
		margin: 1rem 0;
	}
	.overlay-control input {
		width: 100%;
		padding: 0;
		accent-color: var(--accent);
	}
	.self-assessment {
		margin: 1rem 0 0;
		padding: 1rem;
		border: 1px solid var(--line);
		border-radius: 0.45rem;
	}
	.self-assessment legend {
		padding: 0 0.4rem;
		color: var(--muted);
		font-size: 0.8rem;
	}
	.self-assessment > div {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}
	.answer-method {
		border: 0;
		padding: 0;
		margin: 0 0 1rem;
	}
	.answer-method legend {
		color: var(--muted);
		font-size: 0.8rem;
		margin-bottom: 0.45rem;
	}
	.answer-method-options {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}
	.answer-method-options button.active {
		color: var(--active-ink);
		background: var(--accent);
		border-color: var(--accent);
	}
	.letter-choices {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		max-width: 24rem;
		margin: auto;
	}
	.letter-choices button {
		min-width: 0;
		min-height: 3.5rem;
		padding: 0.75rem;
		font-weight: 700;
	}
	.letter-choices button.selected {
		color: var(--active-ink);
		background: var(--accent);
		border-color: var(--accent);
	}
	.letter-choices button.correct-answer {
		position: relative;
		color: #07130b;
		background: #78b888;
		border-color: #9bd3a7;
		box-shadow: 0 0 0 2px #9bd3a733;
	}
	.letter-choices button.correct-answer::after {
		position: absolute;
		right: 1rem;
		content: '✓';
		font-size: 1.1rem;
	}
	.letter-choices button.incorrect-answer {
		color: #fff1ef;
		background: #8f3f36;
		border-color: #efa095;
		box-shadow: 0 0 0 2px #efa09533;
	}
	.next-indicator {
		margin-top: 0.75rem;
		color: var(--muted);
		font-size: 0.75rem;
	}
	.next-indicator.simplified-countdown {
		min-height: 2.75rem;
	}
	.countdown-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.countdown-toggle {
		padding: 0.35rem 0.6rem;
		font-size: 0.72rem;
	}
	.countdown-track {
		height: 3px;
		margin-top: 0.4rem;
		overflow: hidden;
		background: var(--line);
		border-radius: 2px;
	}
	.countdown-track i {
		display: block;
		width: 100%;
		height: 100%;
		background: var(--accent);
		transform-origin: left;
		animation: countdown 2s linear forwards;
	}
	.countdown-track i.paused {
		animation-play-state: paused;
	}
	@keyframes countdown {
		to {
			transform: scaleX(0);
		}
	}
	@keyframes combo-pop {
		50% {
			transform: scale(1.18);
			text-shadow: 0 0 16px var(--accent);
		}
	}
	@keyframes combo-screen-shake {
		20% {
			transform: translateX(-4px) rotate(-0.15deg);
		}
		40% {
			transform: translateX(4px) rotate(0.15deg);
		}
		60% {
			transform: translateX(-2px);
		}
		80% {
			transform: translateX(2px);
		}
	}
	@keyframes combo-screen-pulse {
		0% {
			opacity: 0.8;
			transform: scale(0.85);
		}
		100% {
			opacity: 0;
			transform: scale(1.15);
		}
	}
	@keyframes milestone-in {
		0% {
			opacity: 0;
			transform: translate(-50%, 0.5rem) scale(0.9);
		}
		25%,
		70% {
			opacity: 1;
			transform: translate(-50%, 0) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -0.35rem) scale(1);
		}
	}
	@keyframes personal-best-card {
		0% {
			box-shadow:
				inset 0 0 100px color-mix(in srgb, var(--accent) 24%, transparent),
				0 0 55px color-mix(in srgb, var(--accent) 35%, transparent);
		}
	}
	@keyframes firework-bloom {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0);
		}
		35% {
			opacity: 0.85;
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(4.5);
		}
	}
	@keyframes firework-particle {
		0% {
			opacity: 0;
			transform: translate(0, 0) scale(0.4);
		}
		18%,
		58% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(var(--firework-x), var(--firework-y)) scale(0.15);
		}
	}
	@keyframes best-badge-in {
		from {
			opacity: 0;
			transform: translateY(0.35rem) scale(0.94);
		}
	}
	@media (max-width: 760px) {
		.lesson-progress {
			grid-template-columns: 1fr auto;
		}
		.lesson-progress ol {
			grid-column: 1 / -1;
			grid-row: 2;
			justify-content: start;
			flex-wrap: wrap;
		}
		.trial-launcher {
			grid-template-columns: 1fr;
		}
		.mode-tabs {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.mode-tabs button {
			min-width: 0;
			width: 100%;
		}
		.practice-settings {
			grid-template-columns: 1fr;
		}
		.practice-settings span {
			margin-bottom: 0.5rem;
		}
		.self-assessment > div {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 520px) {
		.lesson-launcher {
			align-items: stretch;
			flex-direction: column;
		}
		.lesson-progress li {
			font-size: 0;
		}
		.lesson-progress li span {
			font-size: 0.7rem;
		}
		.trial-choices,
		.trial-choice-placeholders {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.trial-meta {
			gap: 0.5rem;
		}
		.trial-heading {
			align-items: start;
			flex-direction: column;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.trial-card,
		.trial-card.combo-milestone-active,
		.trial-combo,
		.trial-combo-milestone,
		.personal-best-badge {
			transition: none;
			animation: none;
		}
		.personal-best-fireworks {
			display: none;
		}
		.trial-combo-milestone {
			opacity: 1;
			transform: translateX(-50%);
		}
		.trial-card::before {
			display: none;
		}
		.trial-card .trial-prompt {
			transition: none;
			transform: none;
		}
		.countdown-track i {
			animation: none;
		}
	}
</style>
