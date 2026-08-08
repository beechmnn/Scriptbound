<script lang="ts">
	import { compareAnswer } from '$lib/learning/answer-checker';
	import { copy } from '$lib/i18n';
	import { locale } from '$lib/stores/locale';
	let { answer, expected }: { answer: string; expected: string } = $props();
	let parts = $derived(compareAnswer(answer, expected));
	let t = $derived(copy[$locale].comparison);
</script>

<div class="comparison" aria-label={t.label}>
	{#each parts as part}<span class={part.status} title={t.statuses[part.status]}
			><b>{part.character || '∅'}</b><small
				>{part.status === 'correct' ? '✓' : part.expected ? `→ ${part.expected}` : t.extra}</small
			></span
		>{/each}
</div>

<style>
	.comparison {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 1rem;
	}
	span {
		display: grid;
		min-width: 2.1rem;
		place-items: center;
		border: 1px solid var(--line);
		border-radius: 0.45rem;
		padding: 0.3rem;
	}
	small {
		font-size: 0.68rem;
		color: var(--muted);
	}
	.correct {
		border-color: #688d73;
		background: #17281e;
	}
	.wrong,
	.missing,
	.extra {
		border-color: #a66d62;
		background: #321d1b;
	}
</style>
