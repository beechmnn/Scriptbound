<script lang="ts">
	import GlyphText from './GlyphText.svelte';

	let {
		letter,
		eyebrow,
		title,
		body,
		continueLabel,
		onContinue,
	}: {
		letter: string;
		eyebrow: string;
		title: string;
		body: string;
		continueLabel: string;
		onContinue: () => void;
	} = $props();
</script>

<section class="glyph-introduction" aria-live="polite">
	<span>{eyebrow}</span>
	<h2>{title}</h2>
	<div class="mapping"><strong>{letter.toUpperCase()}</strong><GlyphText text={letter} /></div>
	<p>{body}</p>
	<button type="button" onclick={onContinue}>{continueLabel}</button>
</section>

<style>
	.glyph-introduction {
		display: grid;
		justify-items: center;
		gap: 0.8rem;
		padding: 2rem 1rem 1rem;
		text-align: center;
	}
	.glyph-introduction > span {
		color: var(--accent);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	h2,
	p {
		margin: 0;
	}
	p {
		color: var(--muted);
	}
	.mapping {
		display: flex;
		align-items: center;
		gap: 1.2rem;
		font-size: clamp(3rem, 10vw, 5.5rem);
	}
	.mapping strong {
		font-family: Georgia, serif;
		font-size: 0.7em;
	}
</style>
