<script lang="ts">
	import GlyphText from './GlyphText.svelte';
	import { copy } from '$lib/i18n';
	import { locale } from '$lib/stores/locale';

	let {
		keys,
		disabled = false,
		allowSpace = false,
		onLetter,
		onBackspace,
		onClear,
		onSpace,
	}: {
		keys: string[];
		disabled?: boolean;
		allowSpace?: boolean;
		onLetter: CallableFunction;
		onBackspace: () => void;
		onClear: () => void;
		onSpace: () => void;
	} = $props();
	let labels = $derived(copy[$locale].practice.keyboard);
</script>

<div class="glyph-keyboard" aria-label={labels.label}>
	{#each keys as letter, index}
		<button
			type="button"
			{disabled}
			aria-label={labels.key(index + 1)}
			onclick={() => onLetter(letter)}
		>
			<GlyphText text={letter} />
		</button>
	{/each}
</div>
<div class:with-space={allowSpace} class="keyboard-controls">
	<button type="button" {disabled} onclick={onClear}>{labels.clear}</button>
	{#if allowSpace}<button type="button" {disabled} onclick={onSpace}>{labels.space}</button>{/if}
	<button type="button" {disabled} onclick={onBackspace}>{labels.backspace}</button>
</div>

<style>
	.glyph-keyboard {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0.35rem;
		margin-top: 1rem;
	}
	.glyph-keyboard button {
		display: grid;
		min-width: 0;
		min-height: 3.3rem;
		place-items: center;
		padding: 0.35rem;
		font-size: 1.55rem;
	}
	.keyboard-controls {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	.keyboard-controls.with-space {
		grid-template-columns: 1fr 1.5fr 1fr;
	}
	@media (max-width: 620px) {
		.glyph-keyboard {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
		.glyph-keyboard button {
			min-height: 3rem;
			font-size: 1.35rem;
		}
	}
</style>
