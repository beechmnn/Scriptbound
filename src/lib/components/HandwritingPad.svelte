<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { currentCourse } from '$lib/app';
	import {
		evaluateTraceMasks,
		imageAlphaMask,
		type TraceEvaluation,
	} from '$lib/learning/trace-evaluator';

	type Point = { x: number; y: number; pressure: number };
	type Stroke = Point[];

	let {
		reference,
		overlayOpacity = 0.45,
		guideStyle = 'crosshair',
		constrainInkToReference = false,
		autoEvaluate = false,
		showControls = true,
		disabled = false,
		evaluateVersion = 0,
		label,
		undoLabel,
		clearLabel,
		onChange,
		onEvaluate,
	}: {
		reference?: string;
		overlayOpacity?: number;
		guideStyle?: 'crosshair' | 'writing';
		constrainInkToReference?: boolean;
		autoEvaluate?: boolean;
		showControls?: boolean;
		disabled?: boolean;
		evaluateVersion?: number;
		label: string;
		undoLabel: string;
		clearLabel: string;
		onChange: CallableFunction;
		onEvaluate?: CallableFunction;
	} = $props();

	let canvas: HTMLCanvasElement;
	let strokes = $state<Stroke[]>([]);
	let drawing = false;
	let width = 1;
	let height = 1;
	let resizeObserver: ResizeObserver | undefined;
	let evaluatedVersion = 0;
	let constrainedCanvas: HTMLCanvasElement | undefined;
	let autoEvaluationTimer: ReturnType<typeof setTimeout> | undefined;
	let coverageCheckTimer: ReturnType<typeof setTimeout> | undefined;
	let autoEvaluationComplete = false;
	const AUTO_EVALUATE_IDLE_MS = 1250;
	const AUTO_EVALUATE_COVERAGE = 0.95;

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
		if (guideStyle === 'writing') {
			for (const [position, dashed] of [
				[0.26, false],
				[0.5, true],
				[0.74, false],
			] as const) {
				ctx.setLineDash(dashed ? [4, 5] : []);
				ctx.beginPath();
				ctx.moveTo(16, height * position);
				ctx.lineTo(width - 16, height * position);
				ctx.stroke();
			}
		} else {
			ctx.setLineDash([5, 7]);
			ctx.beginPath();
			ctx.moveTo(width / 2, 16);
			ctx.lineTo(width / 2, height - 16);
			ctx.moveTo(16, height / 2);
			ctx.lineTo(width - 16, height / 2);
			ctx.stroke();
		}
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

		if (constrainInkToReference && reference) {
			paintConstrainedInk(ctx, reference, styles.getPropertyValue('--ink').trim() || '#dfefed');
			return;
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

	function paintConstrainedInk(ctx: CanvasRenderingContext2D, glyph: string, ink: string) {
		constrainedCanvas ??= document.createElement('canvas');
		const targetWidth = Math.round(width);
		const targetHeight = Math.round(height);
		if (constrainedCanvas.width !== targetWidth) constrainedCanvas.width = targetWidth;
		if (constrainedCanvas.height !== targetHeight) constrainedCanvas.height = targetHeight;
		const revealContext = constrainedCanvas.getContext('2d');
		if (!revealContext) return;
		revealContext.globalCompositeOperation = 'source-over';
		revealContext.clearRect(0, 0, width, height);
		revealContext.strokeStyle = '#fff';
		revealContext.lineCap = 'round';
		revealContext.lineJoin = 'round';
		for (const stroke of strokes) {
			if (!stroke.length) continue;
			revealContext.lineWidth = 12;
			revealContext.beginPath();
			revealContext.moveTo(stroke[0].x * width, stroke[0].y * height);
			for (let index = 1; index < stroke.length; index++) {
				const point = stroke[index];
				revealContext.lineWidth = 10 + point.pressure * 4;
				revealContext.lineTo(point.x * width, point.y * height);
			}
			if (stroke.length === 1)
				revealContext.lineTo(stroke[0].x * width + 0.1, stroke[0].y * height + 0.1);
			revealContext.stroke();
		}
		revealContext.globalCompositeOperation = 'source-in';
		revealContext.fillStyle = ink;
		revealContext.textAlign = 'center';
		revealContext.textBaseline = 'middle';
		revealContext.font = `${Math.round(height * 0.68)}px ${currentCourse.fontFamily}`;
		revealContext.fillText(glyph, width / 2, height / 2);
		ctx.drawImage(constrainedCanvas, 0, 0, width, height);
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
		clearAutoEvaluationTimers();
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
		if (autoEvaluate && !coverageCheckTimer) {
			coverageCheckTimer = setTimeout(() => {
				coverageCheckTimer = undefined;
				const result = traceEvaluation();
				if (
					result &&
					result.coverage >= AUTO_EVALUATE_COVERAGE &&
					result.minimumComponentCoverage >= 0.8 &&
					result.minimumRegionCoverage >= 0.75
				)
					completeAutoEvaluation(result);
			}, 160);
		}
	}

	function endStroke(event: PointerEvent) {
		if (!drawing) return;
		drawing = false;
		if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
		if (autoEvaluate && !autoEvaluationComplete) {
			if (autoEvaluationTimer) clearTimeout(autoEvaluationTimer);
			autoEvaluationTimer = setTimeout(() => {
				autoEvaluationTimer = undefined;
				const result = traceEvaluation();
				if (result) completeAutoEvaluation(result);
			}, AUTO_EVALUATE_IDLE_MS);
		}
	}

	function clearAutoEvaluationTimers() {
		if (autoEvaluationTimer) clearTimeout(autoEvaluationTimer);
		if (coverageCheckTimer) clearTimeout(coverageCheckTimer);
		autoEvaluationTimer = undefined;
		coverageCheckTimer = undefined;
	}

	function completeAutoEvaluation(result: TraceEvaluation) {
		if (autoEvaluationComplete || disabled || !onEvaluate) return;
		autoEvaluationComplete = true;
		clearAutoEvaluationTimers();
		onEvaluate(result);
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

	function maskCanvas(paintMask: CallableFunction) {
		const mask = document.createElement('canvas');
		mask.width = Math.round(width);
		mask.height = Math.round(height);
		const ctx = mask.getContext('2d');
		if (!ctx) throw new Error('Canvas evaluation is unavailable.');
		paintMask(ctx);
		return imageAlphaMask(ctx.getImageData(0, 0, mask.width, mask.height).data);
	}

	function traceEvaluation(): TraceEvaluation | undefined {
		if (!reference || !strokes.length) return;
		const maskWidth = Math.round(width);
		const maskHeight = Math.round(height);
		const referenceMask = maskCanvas((ctx: CanvasRenderingContext2D) => {
			ctx.fillStyle = '#fff';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.font = `${Math.round(height * 0.68)}px ${currentCourse.fontFamily}`;
			ctx.fillText(reference, width / 2, height / 2);
		});
		const drawingMask = maskCanvas((ctx: CanvasRenderingContext2D) => {
			ctx.strokeStyle = '#fff';
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
				if (stroke.length === 1) ctx.lineTo(stroke[0].x * width + 0.1, stroke[0].y * height + 0.1);
				ctx.stroke();
			}
		});
		return evaluateTraceMasks(referenceMask, drawingMask, maskWidth, maskHeight);
	}

	function evaluate() {
		if (!onEvaluate) return;
		const result = traceEvaluation();
		if (result) onEvaluate(result);
	}

	$effect(() => {
		reference;
		overlayOpacity;
		guideStyle;
		constrainInkToReference;
		paint();
	});
	$effect(() => {
		if (evaluateVersion > evaluatedVersion) {
			evaluatedVersion = evaluateVersion;
			evaluate();
		}
	});

	onMount(() => {
		resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(canvas);
		void document.fonts.ready.then(paint);
	});
	onDestroy(() => {
		resizeObserver?.disconnect();
		clearAutoEvaluationTimers();
	});
</script>

<canvas
	bind:this={canvas}
	aria-label={label}
	onpointerdown={startStroke}
	onpointermove={continueStroke}
	onpointerup={endStroke}
	onpointercancel={endStroke}
></canvas>
{#if showControls}<div class="drawing-controls">
		<button type="button" disabled={disabled || !strokes.length} onclick={undo}>{undoLabel}</button>
		<button type="button" disabled={disabled || !strokes.length} onclick={clear}
			>{clearLabel}</button
		>
	</div>{/if}

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
