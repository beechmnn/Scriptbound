export type TraceAssessment = 'correct' | 'almost' | 'incorrect';

export type TraceEvaluation = {
	assessment: TraceAssessment;
	coverage: number;
	precision: number;
	componentCoverage: number;
	minimumComponentCoverage: number;
	componentCount: number;
	missingComponents: number;
	regionCoverage: number;
	minimumRegionCoverage: number;
	regionCount: number;
	missingRegions: number;
};

function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
	const horizontal = new Uint8Array(mask.length);
	const output = new Uint8Array(mask.length);
	for (let y = 0; y < height; y++) {
		let count = 0;
		for (let x = -radius; x < width + radius; x++) {
			const added = x + radius;
			const removed = x - radius - 1;
			if (added < width && mask[y * width + added]) count++;
			if (removed >= 0 && mask[y * width + removed]) count--;
			if (x >= 0 && x < width && count > 0) horizontal[y * width + x] = 1;
		}
	}
	for (let x = 0; x < width; x++) {
		let count = 0;
		for (let y = -radius; y < height + radius; y++) {
			const added = y + radius;
			const removed = y - radius - 1;
			if (added < height && horizontal[added * width + x]) count++;
			if (removed >= 0 && horizontal[removed * width + x]) count--;
			if (y >= 0 && y < height && count > 0) output[y * width + x] = 1;
		}
	}
	return output;
}

export function imageAlphaMask(data: Uint8ClampedArray): Uint8Array {
	const mask = new Uint8Array(data.length / 4);
	for (let index = 0; index < mask.length; index++) mask[index] = data[index * 4 + 3] > 24 ? 1 : 0;
	return mask;
}

function measureComponents(
	reference: Uint8Array,
	drawingReach: Uint8Array,
	width: number,
	height: number,
	referencePixels: number,
) {
	const visited = new Uint8Array(reference.length);
	const queue = new Int32Array(reference.length);
	const components: { pixels: number; covered: number }[] = [];
	for (let start = 0; start < reference.length; start++) {
		if (!reference[start] || visited[start]) continue;
		let head = 0;
		let tail = 0;
		let pixels = 0;
		let covered = 0;
		visited[start] = 1;
		queue[tail++] = start;
		while (head < tail) {
			const index = queue[head++];
			const x = index % width;
			const y = Math.floor(index / width);
			pixels++;
			if (drawingReach[index]) covered++;
			for (let offsetY = -1; offsetY <= 1; offsetY++) {
				for (let offsetX = -1; offsetX <= 1; offsetX++) {
					if ((!offsetX && !offsetY) || x + offsetX < 0 || x + offsetX >= width) continue;
					if (y + offsetY < 0 || y + offsetY >= height) continue;
					const neighbor = index + offsetY * width + offsetX;
					if (!reference[neighbor] || visited[neighbor]) continue;
					visited[neighbor] = 1;
					queue[tail++] = neighbor;
				}
			}
		}
		components.push({ pixels, covered });
	}
	const minimumMeaningfulPixels = Math.max(2, Math.round(referencePixels * 0.0005));
	const meaningful = components.filter(({ pixels }) => pixels >= minimumMeaningfulPixels);
	const measured = meaningful.length ? meaningful : components;
	const coverages = measured.map(({ pixels, covered }) => covered / pixels);
	return {
		componentCoverage: coverages.length
			? coverages.reduce((total, coverage) => total + coverage, 0) / coverages.length
			: 0,
		minimumComponentCoverage: coverages.length ? Math.min(...coverages) : 0,
		componentCount: coverages.length,
		missingComponents: coverages.filter((coverage) => coverage < 0.55).length,
	};
}

function measureRegions(
	reference: Uint8Array,
	drawingReach: Uint8Array,
	width: number,
	height: number,
	referencePixels: number,
) {
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;
	for (let index = 0; index < reference.length; index++) {
		if (!reference[index]) continue;
		const x = index % width;
		const y = Math.floor(index / width);
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minY = Math.min(minY, y);
		maxY = Math.max(maxY, y);
	}
	if (maxX < minX || maxY < minY) {
		return { regionCoverage: 0, minimumRegionCoverage: 0, regionCount: 0, missingRegions: 0 };
	}
	const gridSize = 4;
	const regions = Array.from({ length: gridSize * gridSize }, () => ({ pixels: 0, covered: 0 }));
	const boxWidth = maxX - minX + 1;
	const boxHeight = maxY - minY + 1;
	for (let index = 0; index < reference.length; index++) {
		if (!reference[index]) continue;
		const x = index % width;
		const y = Math.floor(index / width);
		const column = Math.min(gridSize - 1, Math.floor(((x - minX) * gridSize) / boxWidth));
		const row = Math.min(gridSize - 1, Math.floor(((y - minY) * gridSize) / boxHeight));
		const region = regions[row * gridSize + column];
		region.pixels++;
		if (drawingReach[index]) region.covered++;
	}
	const minimumMeaningfulPixels = Math.max(3, Math.round(referencePixels * 0.02));
	const coverages = regions
		.filter(({ pixels }) => pixels >= minimumMeaningfulPixels)
		.map(({ pixels, covered }) => covered / pixels);
	return {
		regionCoverage: coverages.length
			? coverages.reduce((total, coverage) => total + coverage, 0) / coverages.length
			: 0,
		minimumRegionCoverage: coverages.length ? Math.min(...coverages) : 0,
		regionCount: coverages.length,
		missingRegions: coverages.filter((coverage) => coverage < 0.45).length,
	};
}

export function evaluateTraceMasks(
	reference: Uint8Array,
	drawing: Uint8Array,
	width: number,
	height: number,
	tolerance = Math.max(6, Math.round(Math.min(width, height) * 0.035)),
): TraceEvaluation {
	if (reference.length !== drawing.length || reference.length !== width * height) {
		throw new Error('Trace masks must have matching dimensions.');
	}
	const allowedDrawingArea = dilate(reference, width, height, tolerance);
	const drawingReach = dilate(drawing, width, height, tolerance);
	let referencePixels = 0;
	let coveredReferencePixels = 0;
	let drawingPixels = 0;
	let containedDrawingPixels = 0;
	for (let index = 0; index < reference.length; index++) {
		if (reference[index]) {
			referencePixels++;
			if (drawingReach[index]) coveredReferencePixels++;
		}
		if (drawing[index]) {
			drawingPixels++;
			if (allowedDrawingArea[index]) containedDrawingPixels++;
		}
	}
	const coverage = referencePixels ? coveredReferencePixels / referencePixels : 0;
	const precision = drawingPixels ? containedDrawingPixels / drawingPixels : 0;
	const componentMetrics = measureComponents(
		reference,
		drawingReach,
		width,
		height,
		referencePixels,
	);
	const regionMetrics = measureRegions(reference, drawingReach, width, height, referencePixels);
	const assessment: TraceAssessment =
		coverage >= 0.62 &&
		precision >= 0.78 &&
		componentMetrics.missingComponents === 0 &&
		regionMetrics.missingRegions === 0
			? 'correct'
			: coverage >= 0.38 && precision >= 0.55
				? 'almost'
				: 'incorrect';
	return { assessment, coverage, precision, ...componentMetrics, ...regionMetrics };
}
