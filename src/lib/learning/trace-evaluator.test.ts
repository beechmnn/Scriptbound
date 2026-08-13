import { describe, expect, it } from 'vitest';
import { evaluateTraceMasks } from './trace-evaluator';

function mask(width: number, height: number, points: [number, number][]) {
	const result = new Uint8Array(width * height);
	for (const [x, y] of points) result[y * width + x] = 1;
	return result;
}

describe('evaluateTraceMasks', () => {
	const width = 12;
	const height = 12;
	const referencePoints = Array.from(
		{ length: 8 },
		(_, index) => [6, index + 2] as [number, number],
	);

	it('accepts a stroke over the reference', () => {
		const result = evaluateTraceMasks(
			mask(width, height, referencePoints),
			mask(width, height, referencePoints),
			width,
			height,
			1,
		);
		expect(result.assessment).toBe('correct');
		expect(result.coverage).toBe(1);
		expect(result.precision).toBe(1);
	});

	it('rejects a stroke far outside the reference', () => {
		const outside = Array.from({ length: 8 }, (_, index) => [1, index + 2] as [number, number]);
		const result = evaluateTraceMasks(
			mask(width, height, referencePoints),
			mask(width, height, outside),
			width,
			height,
			1,
		);
		expect(result.assessment).toBe('incorrect');
		expect(result.precision).toBe(0);
	});

	it('does not accept a tiny mark that happens to be inside the glyph', () => {
		const result = evaluateTraceMasks(
			mask(width, height, referencePoints),
			mask(width, height, [[6, 5]]),
			width,
			height,
			1,
		);
		expect(result.assessment).not.toBe('correct');
		expect(result.coverage).toBeLessThan(0.62);
	});

	it('requires a detached detail even when the large component is covered', () => {
		const largeComponent = Array.from(
			{ length: 16 },
			(_, index) => [8, index + 5] as [number, number],
		);
		const detachedDetail: [number, number][] = [
			[20, 5],
			[20, 6],
		];
		const result = evaluateTraceMasks(
			mask(28, 28, [...largeComponent, ...detachedDetail]),
			mask(28, 28, largeComponent),
			28,
			28,
			1,
		);
		expect(result.coverage).toBeGreaterThan(0.8);
		expect(result.componentCount).toBe(2);
		expect(result.minimumComponentCoverage).toBe(0);
		expect(result.missingComponents).toBe(1);
		expect(result.assessment).not.toBe('correct');
	});

	it('accepts a glyph when both its main body and detached detail are traced', () => {
		const largeComponent = Array.from(
			{ length: 16 },
			(_, index) => [8, index + 5] as [number, number],
		);
		const detachedDetail: [number, number][] = [
			[20, 5],
			[20, 6],
		];
		const glyph = [...largeComponent, ...detachedDetail];
		const result = evaluateTraceMasks(mask(28, 28, glyph), mask(28, 28, glyph), 28, 28, 1);
		expect(result.minimumComponentCoverage).toBe(1);
		expect(result.missingComponents).toBe(0);
		expect(result.assessment).toBe('correct');
	});

	it('requires the crossbar of a connected T shape', () => {
		const crossbar = Array.from({ length: 21 }, (_, index) => [index + 4, 4] as [number, number]);
		const stem = Array.from({ length: 21 }, (_, index) => [14, index + 4] as [number, number]);
		const result = evaluateTraceMasks(
			mask(30, 30, [...crossbar, ...stem]),
			mask(30, 30, stem),
			30,
			30,
			1,
		);
		expect(result.componentCount).toBe(1);
		expect(result.coverage).toBeGreaterThan(0.5);
		expect(result.missingRegions).toBeGreaterThan(0);
		expect(result.assessment).not.toBe('correct');
	});

	it('accepts a connected T shape when its crossbar and stem are traced', () => {
		const crossbar = Array.from({ length: 21 }, (_, index) => [index + 4, 4] as [number, number]);
		const stem = Array.from({ length: 21 }, (_, index) => [14, index + 4] as [number, number]);
		const glyph = [...crossbar, ...stem];
		const result = evaluateTraceMasks(mask(30, 30, glyph), mask(30, 30, glyph), 30, 30, 1);
		expect(result.missingRegions).toBe(0);
		expect(result.minimumRegionCoverage).toBe(1);
		expect(result.assessment).toBe('correct');
	});
});
