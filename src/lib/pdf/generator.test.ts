import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { currentCourse } from '$lib/app';
import { copy } from '$lib/i18n';
import { generateCoursePdf } from './generator';
import { balancedPageGroups, PAGE_SIZES } from './template';
import type { PdfKind, PdfPaper } from './types';

const fontPath = new URL('../../../static/fonts/necrofonticon.ttf', import.meta.url);

describe('course PDF generator', () => {
	it.each([
		['chart', 'a4', 1],
		['chart', 'letter', 1],
		['tracing', 'a4', 5],
		['tracing', 'letter', 5],
	] satisfies [PdfKind, PdfPaper, number][])(
		'generates a valid %s %s PDF',
		async (kind, paper, pageCount) => {
			const fontBytes = new Uint8Array(await readFile(fontPath));
			const bytes = await generateCoursePdf({
				kind,
				paper,
				course: currentCourse,
				copy: copy.en.alphabetChart.pdf.document,
				fontBytes,
			});
			const pdf = await PDFDocument.load(bytes);
			expect(bytes.byteLength).toBeGreaterThan(5_000);
			expect(pdf.getPageCount()).toBe(pageCount);
			expect(pdf.getPage(0).getSize()).toEqual({
				width: PAGE_SIZES[paper][0],
				height: PAGE_SIZES[paper][1],
			});
		},
	);

	it('balances future character sets without exceeding the row limit', () => {
		const groups = balancedPageGroups(
			Array.from({ length: 26 }, (_, index) => index),
			6,
		);
		expect(groups.map(({ length }) => length)).toEqual([6, 5, 5, 5, 5]);
		expect(groups.flat()).toHaveLength(26);
	});

	it('rejects compressed web fonts that PDF viewers cannot embed safely', async () => {
		const webFont = new Uint8Array(
			await readFile(new URL('../../../static/fonts/necrofonticon.woff2', import.meta.url)),
		);
		await expect(
			generateCoursePdf({
				kind: 'chart',
				paper: 'a4',
				course: currentCourse,
				copy: copy.en.alphabetChart.pdf.document,
				fontBytes: webFont,
			}),
		).rejects.toThrow('uncompressed TTF or OTF');
	});
});
