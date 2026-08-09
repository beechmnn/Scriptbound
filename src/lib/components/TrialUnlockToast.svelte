<script lang="ts">
	import { onMount } from 'svelte';
	import { curricula, practiceContent } from '$lib/content';
	import { copy } from '$lib/i18n';
	import { adaptiveWordCandidates } from '$lib/learning/adaptive-content';
	import { unlockedGlyphTrialTiers, type GlyphTrialTierId } from '$lib/learning/glyph-trial';
	import { locale } from '$lib/stores/locale';
	import { progress } from '$lib/stores/progress';
	import type { GlyphProgress, Locale } from '$lib/types';

	type UnlockToast =
		| { kind: 'trial'; tiers: GlyphTrialTierId[] }
		| { kind: 'words'; count: number };

	let {
		onOpenTrial,
		onOpenWords,
	}: {
		// The base ESLint rule mistakes this callback type parameter for a runtime variable.
		// eslint-disable-next-line no-unused-vars
		onOpenTrial: (tier: GlyphTrialTierId) => void;
		onOpenWords: () => void;
	} = $props();

	let activeToast = $state<UnlockToast | null>(null);
	let pendingToasts: UnlockToast[] = [];
	let timer: ReturnType<typeof setTimeout> | undefined;
	let trialCopy = $derived(copy[$locale].trialUnlockToast);
	let wordCopy = $derived(copy[$locale].wordUnlockToast);
	let tierLabels = $derived(
		activeToast?.kind === 'trial'
			? activeToast.tiers.map((tier) => copy[$locale].practice.trial.tiers[tier])
			: [],
	);

	function present(toast: UnlockToast) {
		activeToast = toast;
		timer = setTimeout(dismiss, 5_000);
	}

	function dismiss() {
		if (timer) clearTimeout(timer);
		timer = undefined;
		activeToast = null;
		const next = pendingToasts.shift();
		if (next) present(next);
	}

	function enqueue(toast: UnlockToast) {
		if (activeToast) pendingToasts = [...pendingToasts, toast];
		else present(toast);
	}

	function activateToast() {
		const toast = activeToast;
		if (!toast) return;
		dismiss();
		if (toast.kind === 'trial') {
			const tier = toast.tiers.at(-1);
			if (tier) onOpenTrial(tier);
		} else onOpenWords();
	}

	onMount(() => {
		let currentLocale: Locale = 'en';
		let currentProgress: Record<string, GlyphProgress> = {};
		let previousTiers = new Set<GlyphTrialTierId>();
		let previousWords = new Set<string>();
		let progressReady = false;

		const availableWords = () => {
			const curriculum = curricula[currentLocale];
			const introduced = new Set(
				curriculum.filter((letter) => currentProgress[letter]?.introduced),
			);
			const nextNew = curriculum.find((letter) => !introduced.has(letter));
			return new Set(
				adaptiveWordCandidates(practiceContent[currentLocale].words, introduced, nextNew),
			);
		};
		const syncPrevious = () => {
			previousTiers = new Set(unlockedGlyphTrialTiers(curricula[currentLocale], currentProgress));
			previousWords = availableWords();
		};
		const unsubscribeLocale = locale.subscribe((value) => {
			currentLocale = value;
			syncPrevious();
		});
		const unsubscribeProgress = progress.subscribe((value) => {
			currentProgress = value;
			const unlocked = unlockedGlyphTrialTiers(curricula[currentLocale], value);
			const words = availableWords();
			if (progressReady) {
				const newTiers = unlocked.filter((tier) => !previousTiers.has(tier));
				const newWordCount = [...words].filter((word) => !previousWords.has(word)).length;
				if (newTiers.length) enqueue({ kind: 'trial', tiers: newTiers });
				if (newWordCount) enqueue({ kind: 'words', count: newWordCount });
			}
			previousTiers = new Set(unlocked);
			previousWords = words;
			progressReady = true;
		});

		return () => {
			unsubscribeLocale();
			unsubscribeProgress();
			if (timer) clearTimeout(timer);
		};
	});
</script>

{#if activeToast}
	<aside class="trial-unlock-toast" role="status" aria-live="polite">
		<button type="button" class="toast-action" onclick={activateToast}>
			<span class="toast-copy">
				{#if activeToast.kind === 'trial'}
					<strong>{trialCopy.title(activeToast.tiers.length)}</strong>
					<span>{trialCopy.body(tierLabels)}</span>
				{:else}
					<strong>{wordCopy.title(activeToast.count)}</strong>
					<span>{wordCopy.body(activeToast.count)}</span>
				{/if}
			</span>
			<span class="toast-arrow" aria-hidden="true">→</span>
		</button>
		<button
			type="button"
			class="toast-dismiss"
			aria-label={activeToast.kind === 'trial' ? trialCopy.dismiss : wordCopy.dismiss}
			onclick={dismiss}>×</button
		>
	</aside>
{/if}

<style>
	.trial-unlock-toast {
		position: fixed;
		bottom: 1.25rem;
		left: 50%;
		z-index: 20;
		display: flex;
		width: min(34rem, calc(100vw - 2rem));
		align-items: start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1rem 1rem 1.2rem;
		border: 1px solid var(--accent);
		border-left-width: 4px;
		border-radius: 0.55rem;
		background: var(--panel);
		box-shadow: 0 16px 50px #000b;
		transform: translateX(-50%);
		animation: toast-in 180ms ease-out;
	}
	.toast-action {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-width: 0;
		padding: 0;
		border: 0;
		color: inherit;
		background: transparent;
		text-align: left;
	}
	.toast-copy {
		display: grid;
		gap: 0.25rem;
	}
	.toast-copy strong {
		color: var(--accent);
	}
	.toast-copy > span {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.toast-arrow {
		color: var(--accent);
		font-size: 1.4rem;
	}
	.toast-dismiss {
		padding: 0.1rem 0.4rem;
		border: 0;
		color: var(--muted);
		background: transparent;
		font-size: 1.35rem;
		line-height: 1;
	}
	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translate(-50%, 0.75rem);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.trial-unlock-toast {
			animation: none;
		}
	}
</style>
