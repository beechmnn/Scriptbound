<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { currentCourse } from '$lib/app';

	type Point = { x: number; y: number; pressure: number };
	type Stroke = Point[];

	let {
		reference,
		overlayOpacity = 0.45,
		disabled = false,
		label,
		undoLabel,
		clearLabel,
		onChange,
	}: {
		reference?: string;
		overlayOpacity?: number;
		disabled?: boolean;
		label: string;
		undoLabel: string;
		clearLabel: string;
		onChange: CallableFunction;
	} = $props();

	let canvas: HTMLCanvasElement;
	let strokes = $state<Stroke[]>([]);
	let drawing = false;
	let width = 1;
	let height = 1;
	let resizeObserver: ResizeObserver | undefined;

	function context() {
		return canvas?.getContext('2d');
	}

	function paint() {
		const ctx = context();
		if (!ctx) return;
		ctx.clearRect(0, 0, width, height);
		const styles = getComputedStyle(canvas);
		ctx.save();
		ctx.strokeStyle = styles.getPropertyValue('--line').trim() || '#285057';
		ctx.lineWidth = 1;
		ctx.setLineDash([5, 7]);
		ctx.beginPath();
		ctx.moveTo(width / 2, 16);
		ctx.lineTo(width / 2, height - 16);
		ctx.moveTo(16, height / 2);
		ctx.lineTo(width - 16, height / 2);
		ctx.stroke();
		ctx.restore();

		if (reference) {
			ctx.save();
			ctx.globalAlpha = overlayOpacity;
			ctx.fillStyle = styles.getPropertyValue('--accent').trim() || '#40b5ae';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.font = `${Math.round(height * 0.68)}px ${currentCourse.fontFamily}`;
			ctx.fillText(reference, width / 2, height / 2);
			ctx.restore();
		}

		ctx.strokeStyle = styles.getPropertyValue('--ink').trim() || '#dfefed';
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		for (const stroke of strokes) {
			if (!stroke.length) continue;
			ctx.beginPath();
			ctx.moveTo(stroke[0].x * width, stroke[0].y * height);
			for (let index = 1; index < stroke.length; index++) {
				const point = stroke[index];
				ctx.lineWidth = 4 + point.pressure * 4;
				ctx.lineTo(point.x * width, point.y * height);
			}
			if (stroke.length === 1) {
				ctx.lineTo(stroke[0].x * width + 0.1, stroke[0].y * height + 0.1);
			}
			ctx.stroke();
		}
	}

	function resize() {
		const rect = canvas.getBoundingClientRect();
		const ratio = window.devicePixelRatio || 1;
		width = Math.max(1, rect.width);
		height = Math.max(1, rect.height);
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(height * ratio);
		context()?.setTransform(ratio, 0, 0, ratio, 0, 0);
		paint();
	}

	function point(event: PointerEvent): Point {
		const rect = canvas.getBoundingClientRect();
		return {
			x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
			y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
			pressure: event.pressure || 0.5,
		};
	}

	function startStroke(event: PointerEvent) {
		if (disabled) return;
		event.preventDefault();
		canvas.setPointerCapture(event.pointerId);
		strokes = [...strokes, [point(event)]];
		drawing = true;
		onChange(true);
		paint();
	}

	function continueStroke(event: PointerEvent) {
		if (!drawing || disabled) return;
		event.preventDefault();
		const next = [...strokes];
		next[next.length - 1] = [...next[next.length - 1], point(event)];
		strokes = next;
		paint();
	}

	function endStroke(event: PointerEvent) {
		if (!drawing) return;
		drawing = false;
		if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
	}

	function undo() {
		strokes = strokes.slice(0, -1);
		onChange(strokes.length > 0);
		paint();
	}

	function clear() {
		strokes = [];
		onChange(false);
		paint();
	}

	$effect(() => {
		reference;
		overlayOpacity;
		paint();
	});

	onMount(() => {
		resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(canvas);
		void document.fonts.ready.then(paint);
	});
	onDestroy(() => resizeObserver?.disconnect());
</script>

<canvas
	bind:this={canvas}
	aria-label={label}
	onpointerdown={startStroke}
	onpointermove={continueStroke}
	onpointerup={endStroke}
	onpointercancel={endStroke}
></canvas>
<div class="drawing-controls">
	<button type="button" disabled={disabled || !strokes.length} onclick={undo}>{undoLabel}</button>
	<button type="button" disabled={disabled || !strokes.length} onclick={clear}>{clearLabel}</button>
</div>

<style>
	canvas {
		display: block;
		width: 100%;
		height: clamp(250px, 48vw, 390px);
		border: 1px solid var(--line);
		border-radius: 0.5rem;
		background: var(--field);
		touch-action: none;
		cursor: crosshair;
	}
	canvas:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.drawing-controls {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}
</style>
