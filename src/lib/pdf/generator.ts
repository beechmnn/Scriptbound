import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import { APP_NAME } from '$lib/app';
import {
	balancedPageGroups,
	drawCenteredText,
	drawPageBackground,
	drawRightText,
	drawRoundedRect,
	fitText,
	PAGE_SIZES,
	paperLabel,
	PDF_THEME,
	type PdfFonts,
} from './template';
import type { GeneratePdfOptions, PdfCourse, PdfDocumentCopy, PdfGlyph, PdfPaper } from './types';

const MARGIN_X = 32;

function assertPdfSafeFont(fontBytes: Uint8Array): void {
	const signature = Array.from(fontBytes.slice(0, 4))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
	const supportedSignatures = new Set(['00010000', '4f54544f', '74727565', '74797031']);
	if (!supportedSignatures.has(signature)) {
		throw new Error('The PDF font must be an uncompressed TTF or OTF file.');
	}
}

function drawHeaderLine(page: PDFPage, y: number): void {
	page.drawLine({
		start: { x: MARGIN_X, y },
		end: { x: page.getWidth() - MARGIN_X, y },
		thickness: 1.2,
		color: PDF_THEME.accent,
	});
}

function drawChartHeader(
	page: PDFPage,
	fonts: PdfFonts,
	course: PdfCourse,
	copy: PdfDocumentCopy,
	paper: PdfPaper,
	pageNumber: number,
	pageCount: number,
): number {
	const { width, height } = page.getSize();
	const top = height - 30;
	page.drawText(copy.referenceEyebrow, {
		x: MARGIN_X,
		y: top,
		font: fonts.bold,
		size: 8,
		color: PDF_THEME.accent,
	});
	const format =
		pageCount === 1
			? paperLabel(paper)
			: `${paperLabel(paper)}  /  ${String(pageNumber).padStart(2, '0')}`;
	drawRightText(page, format, fonts.regular, 8, width - MARGIN_X, top, PDF_THEME.muted);

	const title = copy.chartTitle(course.name);
	const titleY = top - 39;
	const titleSize = fitText(fonts.bold, title, 23, 15, width - 2 * MARGIN_X);
	page.drawText(title, {
		x: MARGIN_X,
		y: titleY,
		font: fonts.bold,
		size: titleSize,
		color: PDF_THEME.ink,
	});
	page.drawText(copy.chartSubtitle(course.glyphs.length), {
		x: MARGIN_X,
		y: titleY - 18,
		font: fonts.regular,
		size: 9.5,
		color: PDF_THEME.muted,
	});
	const ruleY = titleY - 32;
	drawHeaderLine(page, ruleY);
	return ruleY - 14;
}

function drawChartTile(
	page: PDFPage,
	fonts: PdfFonts,
	glyph: PdfGlyph,
	index: number,
	x: number,
	y: number,
	width: number,
	height: number,
): void {
	drawRoundedRect(page, {
		x,
		y,
		width,
		height,
		radius: 6,
		color: PDF_THEME.panel,
		borderColor: PDF_THEME.line,
		borderWidth: 0.65,
	});
	page.drawText(String(index + 1).padStart(2, '0'), {
		x: x + 8,
		y: y + height - 12,
		font: fonts.bold,
		size: 6.5,
		color: PDF_THEME.muted,
	});

	const glyphSize = Math.min(42, height * 0.48);
	drawCenteredText(
		page,
		glyph.glyph,
		fonts.glyph,
		glyphSize,
		x + width / 2,
		y + height * 0.48 - glyphSize * 0.27,
		PDF_THEME.ink,
	);

	const labelWidth = Math.max(42, fonts.bold.widthOfTextAtSize(glyph.label, 8) + 17);
	const labelHeight = 15;
	const labelX = x + (width - labelWidth) / 2;
	const labelY = y + 7;
	drawRoundedRect(page, {
		x: labelX,
		y: labelY,
		width: labelWidth,
		height: labelHeight,
		radius: 7.5,
		color: PDF_THEME.white,
		borderColor: PDF_THEME.line,
		borderWidth: 0.5,
	});
	drawCenteredText(page, glyph.label, fonts.bold, 8, x + width / 2, labelY + 4.5, PDF_THEME.accent);
}

function drawChartFooter(
	page: PDFPage,
	fonts: PdfFonts,
	course: PdfCourse,
	copy: PdfDocumentCopy,
): void {
	const { width } = page.getSize();
	const footerTop = 35;
	page.drawLine({
		start: { x: MARGIN_X, y: footerTop },
		end: { x: width - MARGIN_X, y: footerTop },
		thickness: 0.5,
		color: PDF_THEME.line,
	});
	page.drawText(copy.chartFooter(course.name), {
		x: MARGIN_X,
		y: footerTop - 15,
		font: fonts.regular,
		size: 7.5,
		color: PDF_THEME.muted,
	});
	drawRightText(
		page,
		APP_NAME.toLowerCase(),
		fonts.regular,
		7.5,
		width - MARGIN_X,
		footerTop - 15,
		PDF_THEME.muted,
	);
}

function addChartPages(
	pdf: PDFDocument,
	fonts: PdfFonts,
	options: Omit<GeneratePdfOptions, 'kind' | 'fontBytes'>,
): void {
	const groups = balancedPageGroups(options.course.glyphs, 28);
	for (const [pageIndex, glyphs] of groups.entries()) {
		const page = pdf.addPage(PAGE_SIZES[options.paper]);
		drawPageBackground(page);
		const gridTop = drawChartHeader(
			page,
			fonts,
			options.course,
			options.copy,
			options.paper,
			pageIndex + 1,
			groups.length,
		);
		const { width } = page.getSize();
		const columns = 4;
		const rows = 7;
		const gapX = 8;
		const gapY = 8;
		const gridBottom = 47;
		const tileWidth = (width - 2 * MARGIN_X - (columns - 1) * gapX) / columns;
		const tileHeight = (gridTop - gridBottom - (rows - 1) * gapY) / rows;
		for (const [localIndex, glyph] of glyphs.entries()) {
			const row = Math.floor(localIndex / columns);
			const column = localIndex % columns;
			const x = MARGIN_X + column * (tileWidth + gapX);
			const y = gridTop - (row + 1) * tileHeight - row * gapY;
			const globalIndex = pageIndex * 28 + localIndex;
			drawChartTile(page, fonts, glyph, globalIndex, x, y, tileWidth, tileHeight);
		}
		drawChartFooter(page, fonts, options.course, options.copy);
	}
}

function drawTracingHeader(
	page: PDFPage,
	fonts: PdfFonts,
	course: PdfCourse,
	copy: PdfDocumentCopy,
	paper: PdfPaper,
	pageNumber: number,
): number {
	const { width, height } = page.getSize();
	const top = height - 28;
	page.drawText(copy.writingEyebrow, {
		x: MARGIN_X,
		y: top,
		font: fonts.bold,
		size: 8,
		color: PDF_THEME.accent,
	});
	drawRightText(
		page,
		`${paperLabel(paper)}  /  ${String(pageNumber).padStart(2, '0')}`,
		fonts.regular,
		8,
		width - MARGIN_X,
		top,
		PDF_THEME.muted,
	);
	const title = copy.tracingTitle(course.name);
	const titleY = top - 36;
	const titleSize = fitText(fonts.bold, title, 20, 14, width - 2 * MARGIN_X);
	page.drawText(title, {
		x: MARGIN_X,
		y: titleY,
		font: fonts.bold,
		size: titleSize,
		color: PDF_THEME.ink,
	});
	page.drawText(copy.tracingSubtitle, {
		x: MARGIN_X,
		y: titleY - 16,
		font: fonts.regular,
		size: 8.5,
		color: PDF_THEME.muted,
	});

	const fieldY = titleY - 39;
	page.drawText(copy.name.toUpperCase(), {
		x: MARGIN_X,
		y: fieldY,
		font: fonts.bold,
		size: 6.5,
		color: PDF_THEME.muted,
	});
	page.drawText(copy.date.toUpperCase(), {
		x: width * 0.59,
		y: fieldY,
		font: fonts.bold,
		size: 6.5,
		color: PDF_THEME.muted,
	});
	page.drawLine({
		start: { x: MARGIN_X + 30, y: fieldY - 1 },
		end: { x: width * 0.55, y: fieldY - 1 },
		thickness: 0.6,
		color: PDF_THEME.line,
	});
	page.drawLine({
		start: { x: width * 0.59 + 25, y: fieldY - 1 },
		end: { x: width - MARGIN_X, y: fieldY - 1 },
		thickness: 0.6,
		color: PDF_THEME.line,
	});
	const ruleY = fieldY - 17;
	drawHeaderLine(page, ruleY);
	return ruleY - 12;
}

function drawModelCell(
	page: PDFPage,
	fonts: PdfFonts,
	glyph: PdfGlyph,
	index: number,
	x: number,
	y: number,
	width: number,
	height: number,
): void {
	drawRoundedRect(page, {
		x,
		y,
		width,
		height,
		radius: 6,
		color: PDF_THEME.panel,
		borderColor: PDF_THEME.line,
		borderWidth: 0.7,
	});
	page.drawText(String(index + 1).padStart(2, '0'), {
		x: x + 7,
		y: y + height - 11,
		font: fonts.bold,
		size: 6,
		color: PDF_THEME.muted,
	});
	const glyphSize = Math.min(46, height * 0.5);
	drawCenteredText(
		page,
		glyph.glyph,
		fonts.glyph,
		glyphSize,
		x + width / 2,
		y + height * 0.45 - glyphSize * 0.22,
		PDF_THEME.ink,
	);
	const labelWidth = Math.max(38, fonts.bold.widthOfTextAtSize(glyph.label, 7.5) + 14);
	const labelHeight = 14;
	const labelX = x + (width - labelWidth) / 2;
	const labelY = y + 7;
	drawRoundedRect(page, {
		x: labelX,
		y: labelY,
		width: labelWidth,
		height: labelHeight,
		radius: 7,
		color: PDF_THEME.white,
		borderColor: PDF_THEME.line,
		borderWidth: 0.45,
	});
	drawCenteredText(
		page,
		glyph.label,
		fonts.bold,
		7.5,
		x + width / 2,
		labelY + 4.1,
		PDF_THEME.accent,
	);
}

function drawTracingCell(
	page: PDFPage,
	font: PDFFont,
	glyph: string,
	x: number,
	y: number,
	width: number,
	height: number,
): void {
	drawRoundedRect(page, {
		x,
		y,
		width,
		height,
		radius: 5,
		color: PDF_THEME.white,
		borderColor: PDF_THEME.line,
		borderWidth: 0.65,
	});
	const inset = 5;
	for (const guide of [
		{ y: y + height * 0.73, thickness: 0.45, dashArray: undefined },
		{ y: y + height * 0.49, thickness: 0.45, dashArray: [2, 2] },
		{ y: y + height * 0.25, thickness: 0.7, dashArray: undefined },
	]) {
		page.drawLine({
			start: { x: x + inset, y: guide.y },
			end: { x: x + width - inset, y: guide.y },
			thickness: guide.thickness,
			color: PDF_THEME.hint,
			dashArray: guide.dashArray,
		});
	}
	const glyphSize = Math.min(42, height * 0.48, width * 0.68);
	drawCenteredText(
		page,
		glyph,
		font,
		glyphSize,
		x + width / 2,
		y + height * 0.45 - glyphSize * 0.22,
		PDF_THEME.hint,
	);
}

function drawTracingFooter(
	page: PDFPage,
	fonts: PdfFonts,
	copy: PdfDocumentCopy,
	pageNumber: number,
	pageCount: number,
): void {
	const { width } = page.getSize();
	const footerTop = 30;
	page.drawLine({
		start: { x: MARGIN_X, y: footerTop },
		end: { x: width - MARGIN_X, y: footerTop },
		thickness: 0.5,
		color: PDF_THEME.line,
	});
	page.drawText(copy.tracingFooter, {
		x: MARGIN_X,
		y: footerTop - 13,
		font: fonts.regular,
		size: 7,
		color: PDF_THEME.muted,
	});
	drawRightText(
		page,
		`${pageNumber} / ${pageCount}`,
		fonts.regular,
		7,
		width - MARGIN_X,
		footerTop - 13,
		PDF_THEME.muted,
	);
}

function addTracingPages(
	pdf: PDFDocument,
	fonts: PdfFonts,
	options: Omit<GeneratePdfOptions, 'kind' | 'fontBytes'>,
): void {
	const groups = balancedPageGroups(options.course.glyphs, 6);
	let globalIndex = 0;
	for (const [pageIndex, glyphs] of groups.entries()) {
		const page = pdf.addPage(PAGE_SIZES[options.paper]);
		drawPageBackground(page);
		const gridTop = drawTracingHeader(
			page,
			fonts,
			options.course,
			options.copy,
			options.paper,
			pageIndex + 1,
		);
		const { width } = page.getSize();
		const gridBottom = 48;
		const rowGap = 9;
		const rowHeight = (gridTop - gridBottom - (glyphs.length - 1) * rowGap) / glyphs.length;
		const modelWidth = 72;
		const modelGap = 9;
		const traceGap = 5;
		const traceCount = 6;
		const traceWidth =
			(width - 2 * MARGIN_X - modelWidth - modelGap - (traceCount - 1) * traceGap) / traceCount;

		for (const [row, glyph] of glyphs.entries()) {
			const y = gridTop - (row + 1) * rowHeight - row * rowGap;
			drawModelCell(page, fonts, glyph, globalIndex, MARGIN_X, y, modelWidth, rowHeight);
			const traceStart = MARGIN_X + modelWidth + modelGap;
			for (let column = 0; column < traceCount; column++) {
				const x = traceStart + column * (traceWidth + traceGap);
				drawTracingCell(page, fonts.glyph, glyph.glyph, x, y, traceWidth, rowHeight);
			}
			globalIndex++;
		}
		drawTracingFooter(page, fonts, options.copy, pageIndex + 1, groups.length);
	}
}

export async function generateCoursePdf(options: GeneratePdfOptions): Promise<Uint8Array> {
	if (options.course.glyphs.length === 0)
		throw new Error('A PDF course must contain at least one glyph.');
	assertPdfSafeFont(options.fontBytes);
	const pdf = await PDFDocument.create();
	pdf.registerFontkit(fontkit);
	const fonts: PdfFonts = {
		regular: await pdf.embedFont(StandardFonts.Helvetica),
		bold: await pdf.embedFont(StandardFonts.HelveticaBold),
		glyph: await pdf.embedFont(options.fontBytes),
	};

	const title =
		options.kind === 'chart'
			? options.copy.chartTitle(options.course.name)
			: options.copy.tracingTitle(options.course.name);
	pdf.setTitle(`${APP_NAME} - ${title}`);
	pdf.setAuthor(APP_NAME);
	pdf.setCreator(APP_NAME);
	pdf.setProducer(APP_NAME);
	pdf.setSubject(`${options.course.name} glyph learning material`);

	const sharedOptions = { paper: options.paper, course: options.course, copy: options.copy };
	if (options.kind === 'chart') addChartPages(pdf, fonts, sharedOptions);
	else addTracingPages(pdf, fonts, sharedOptions);

	return pdf.save();
}
