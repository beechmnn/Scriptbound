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
	import { createEncodingKeys } from '$lib/learning/encoding-keys';
	import { scheduleAdaptiveFallback } from '$lib/learning/practice-set';
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
	import type { PracticeMode, PracticeSet } from '$lib/types';
	let { startWithMistakes = false }: { startWithMistakes?: boolean } = $props();
	const initialMistakes = untrack(() => startWithMistakes);
	const pick = <T,>(values: T[], previous?: T) => {
		const choices = values.length > 1 ? values.filter((v) => v !== previous) : values;
		return choices[Math.floor(Math.random() * choices.length)];
	};
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
	let handwritingHasInk = $state(false),
		drawingSubmitted = $state(false),
		handwritingAssessment = $state<'correct' | 'almost' | 'incorrect' | null>(null),
		overlayOpacity = $state(0.45);
	let answerInput = $state<HTMLInputElement>();
	let nextCountdown = $state(0),
		nextDelay = $state(2),
		nextPaused = $state(false),
		wordReturnScrollTop = $state<number | null>(null),
		nextTimer: ReturnType<typeof setInterval> | undefined,
		attentionFallbackTimer: ReturnType<typeof setTimeout> | undefined;
	let options = $derived<{ value: PracticeMode; label: string }[]>([
			{ value: 'glyph', label: t.modes.glyph },
			{ value: 'word', label: t.modes.word },
			{ value: 'encode', label: t.modes.encode },
		]),
		simplifiedResult = $derived(
			mode === 'word' || mode === 'encode' || (mode === 'glyph' && glyphAnswerMethod === 'buttons'),
		);
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
		const mayIntroduce = introduced.length < 4 || (acquiring < 4 && due <= 6);
		const nextNew = mayIntroduce
			? curriculum.find((letter) => !introduced.includes(letter))
			: undefined;
		const candidates = nextNew
			? [...repetitionPriorities, ...introduced, nextNew]
			: [...repetitionPriorities, ...introduced];
		return candidates.length ? [...new Set(candidates)] : [curriculum[0]];
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
		if (practiceSet === 'mistakes' && weak.length) {
			const filtered = source.filter((text) => weak.some((letter) => text.includes(letter)));
			if (filtered.length) return filtered;
		}
		if (practiceSet === 'adaptive') {
			const introduced = introducedLetters();
			if (mode === 'word') {
				const nextNew = curriculum.find((letter) => !introduced.has(letter));
				return adaptiveWordCandidates(source, introduced, nextNew);
			}
			if (mode === 'encode') {
				const nextNew = curriculum.find((letter) => !introduced.has(letter));
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
	function clearNextTimer() {
		if (nextTimer) clearInterval(nextTimer);
		nextTimer = undefined;
		nextCountdown = 0;
		nextPaused = false;
	}
	function reset(nextMode?: PracticeMode) {
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
		prepareTargetIntroduction();
		focusAnswer();
	});
	onDestroy(() => {
		clearNextTimer();
		if (attentionFallbackTimer) clearTimeout(attentionFallbackTimer);
	});
</script>

<div class="mode-tabs" role="group" aria-label={t.modeLabel}>
	{#each options as option}<button
			class:active={mode === option.value}
			onclick={() => reset(option.value)}>{option.label}</button
		>{/each}
</div>
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
<div
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
				aria-hidden={submitted ? undefined : 'true'}>{submitted ? (correct ? '✓' : '×') : '✓'}</span
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
							<div class="countdown-track"><i style:animation-duration={`${nextDelay}s`}></i></div>
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

<style>
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
	@media (max-width: 760px) {
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
	@media (prefers-reduced-motion: reduce) {
		.countdown-track i {
			animation: none;
		}
	}
</style>
