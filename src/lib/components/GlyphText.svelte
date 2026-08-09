<script lang="ts">
	import { currentCourse } from '$lib/app';

	let { text, class: className = '' }: { text: string; class?: string } = $props();
</script>

<span
	class="glyph {className}"
	style={`--course-font: '${currentCourse.fontFamily}'`}
	aria-hidden="true">{text}</span
>

<style>
	.glyph {
		font-family: var(--course-font), 'Arial Narrow', sans-serif;
		letter-spacing: 0.08em;
	}
	:global(.font-loaded) .glyph {
		visibility: visible;
	}
	:global(.font-pending) .glyph {
		visibility: hidden;
	}
</style>
