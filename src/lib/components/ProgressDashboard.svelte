<script lang="ts">
	import GlyphText from './GlyphText.svelte';
	import PhaseThreeControls from './PhaseThreeControls.svelte';
	import { currentCourse } from '$lib/app';
	import { copy } from '$lib/i18n';
	import { locale } from '$lib/stores/locale';
	import { introduceAllGlyphs, progress as progressStore } from '$lib/stores/progress';
	import { resetLearningData } from '$lib/stores/learning-data';
	import { needsAttention, newGlyphProgress } from '$lib/learning/scheduler';
	import type { GlyphProgress } from '$lib/types';
	const alphabet = currentCourse.glyphs.map(({ answer }) => answer);
	let { onPracticeMistakes }: { onPracticeMistakes: () => void } = $props();
	let t = $derived(copy[$locale].progress);
	let attempts = $derived(
		Object.values($progressStore).reduce((sum, item) => sum + item.attempts, 0),
	);
	let correct = $derived(
		Object.values($progressStore).reduce((sum, item) => sum + item.correct, 0),
	);
	let attention = $derived(
		Object.values($progressStore).filter((item) => needsAttention(item)).length,
	);
	let encodingAttempts = $derived(
		Object.values($progressStore).reduce((sum, item) => sum + item.encodingAttempts, 0),
	);
	let encodingCorrect = $derived(
		Object.values($progressStore).reduce((sum, item) => sum + item.encodingCorrect, 0),
	);
	let hasProgress = $derived(Object.keys($progressStore).length > 0);
	let allIntroduced = $derived(alphabet.every((letter) => $progressStore[letter]?.introduced));
	function confirmReset() {
		if (window.confirm(t.confirmReset)) resetLearningData();
	}
	function reviewText(timestamp: number) {
		if (!timestamp) return t.notScheduled;
		if (timestamp <= Date.now()) return t.dueNow;
		const days = Math.max(1, Math.ceil((timestamp - Date.now()) / 86_400_000));
		return t.inDays(days);
	}
	function detailText(item: GlyphProgress) {
		const details = [];
		if (item.isolatedAttempts) {
			details.push(t.isolated(item.isolatedCorrect, item.isolatedAttempts));
			details.push(t.reviews(item.successfulReviews));
			details.push(reviewText(item.nextReviewAt));
		}
		return details.join(' · ') || t.notPractised;
	}
</script>

<div class="stats">
	<article><b>{attempts}</b><span>{t.stats.attempts}</span></article>
	<article><b>{correct}</b><span>{t.stats.correct}</span></article>
	<article>
		<b>{attempts ? Math.round((correct / attempts) * 100) : 0}%</b><span>{t.stats.accuracy}</span>
	</article>
	<article><b>{attention}</b><span>{t.stats.attention}</span></article>
	<article>
		<b>{encodingAttempts ? Math.round((encodingCorrect / encodingAttempts) * 100) : 0}%</b><span
			>{t.stats.encoding}</span
		>
	</article>
</div>
<div class="progress-actions">
	<p class="privacy">{t.privacy}</p>
	<div>
		{#if attention}<button onclick={onPracticeMistakes}>{t.practiceMistakes}</button>{/if}<button
			disabled={allIntroduced}
			onclick={() => introduceAllGlyphs(alphabet)}>{t.introduceAll}</button
		><button class="danger" disabled={!hasProgress} onclick={confirmReset}>{t.reset}</button>
	</div>
</div>
<PhaseThreeControls />
<div class="glyph-progress">
	{#each alphabet as letter}
		{@const item = $progressStore[letter] ?? newGlyphProgress(letter)}
		<article class:due={needsAttention(item)}>
			<div class="glyph"><GlyphText text={letter} /><strong>{letter.toUpperCase()}</strong></div>
			<div class="details">
				<div>
					<span>{copy[$locale].stages[item.stage]}</span><span
						>{Math.round(item.mastery * 100)}%</span
					>
				</div>
				<progress max="1" value={item.mastery}></progress><small>{detailText(item)}</small>
			</div>
		</article>
	{/each}
</div>

<style>
	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		margin-top: 3rem;
	}
	.stats article {
		border: 1px solid var(--line);
		background: var(--panel);
		padding: 1.5rem;
		display: grid;
		gap: 0.4rem;
	}
	.stats b {
		font:
			500 2.7rem/1 Georgia,
			serif;
		color: var(--accent);
	}
	.stats span,
	.privacy {
		color: var(--muted);
	}
	.progress-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin: 1.5rem 0;
	}
	.progress-actions > div {
		display: flex;
		gap: 0.5rem;
	}
	.danger {
		color: #e3a097;
		border-color: #74463f;
		background: #2c1917;
	}
	.progress-actions button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}
	.glyph-progress {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.65rem;
	}
	.glyph-progress article {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid var(--line);
		background: var(--panel);
		border-radius: 0.45rem;
	}
	.glyph-progress article.due {
		border-left: 3px solid #b7894d;
	}
	.glyph {
		display: grid;
		place-items: center;
		min-width: 50px;
		font-size: 2rem;
	}
	.glyph strong {
		font: 600 0.65rem/1 system-ui;
		color: var(--muted);
	}
	.details {
		flex: 1;
		min-width: 0;
	}
	.details > div {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
	}
	.details small {
		color: var(--muted);
	}
	progress {
		width: 100%;
		height: 6px;
		accent-color: var(--accent);
	}
	@media (max-width: 700px) {
		.stats,
		.glyph-progress {
			grid-template-columns: 1fr 1fr;
		}
		.progress-actions {
			align-items: stretch;
			flex-direction: column;
		}
		.progress-actions > div {
			flex-wrap: wrap;
		}
	}
	@media (max-width: 440px) {
		.stats,
		.glyph-progress {
			grid-template-columns: 1fr;
		}
	}
</style>
