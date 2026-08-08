<script lang="ts">
	let { text, class: className = '' }: { text: string; class?: string } = $props();
</script>

<span class="glyph {className}" aria-hidden="true">{text}</span>

<style>
	.glyph {
		font-family: 'Necrofonticon', 'Arial Narrow', sans-serif;
		letter-spacing: 0.08em;
	}
	:global(.font-loaded) .glyph {
		visibility: visible;
	}
	:global(.font-pending) .glyph {
		visibility: hidden;
	}
</style>
