<script lang="ts">
	import GlyphText from './GlyphText.svelte';
	import AlphabetDownloads from './AlphabetDownloads.svelte';
	import { alphabet } from '$lib/content';
	import { copy } from '$lib/i18n';
	import { locale } from '$lib/stores/locale';
	let reveal = $state(true),
		selected = $state<string | null>(null);
	let t = $derived(copy[$locale].alphabetChart);
</script>

<div class="toolbar">
	<button class="secondary" onclick={() => (reveal = !reveal)}>{reveal ? t.hide : t.reveal}</button>
</div>
<div class="alphabet">
	{#each alphabet as letter}<button
			class:selected={selected === letter}
			class="tile"
			onclick={() => (selected = selected === letter ? null : letter)}
			aria-label={t.selectLetter(letter)}
			><GlyphText text={letter} /><small class:hidden={!reveal}>{letter.toUpperCase()}</small
			></button
		>{/each}
</div>
{#if selected}<p class="selected-glyph">
		<GlyphText text={selected} /><span>{selected.toUpperCase()}</span>
	</p>{/if}
<AlphabetDownloads />

<style>
	.toolbar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 1rem;
	}
	.alphabet {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(74px, 1fr));
		gap: 0.65rem;
	}
	.tile {
		min-height: 90px;
		display: grid;
		place-items: center;
		align-content: center;
		gap: 0.5rem;
		font-size: 2rem;
	}
	.tile small {
		font: 600 0.75rem/1 system-ui;
		color: var(--muted);
	}
	.tile small.hidden {
		visibility: hidden;
	}
	.tile.selected {
		outline: 2px solid var(--accent);
	}
	.selected-glyph {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2rem;
		font-size: clamp(4rem, 12vw, 8rem);
	}
	.selected-glyph span {
		font: 700 1.5rem/1 system-ui;
		color: var(--accent);
	}
</style>
