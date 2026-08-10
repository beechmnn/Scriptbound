import { rgb, type Color, type PDFFont, type PDFPage } from 'pdf-lib';
import type { PdfPaper } from './types';

export const PAGE_SIZES: Record<PdfPaper, [number, number]> = {
	a4: [595.276, 841.89],
	letter: [612, 792],
};

export const PDF_THEME = {
	paper: hex('#F2EFE7'),
	ink: hex('#13282A'),
	muted: hex('#607477'),
	accent: hex('#168D87'),
	line: hex('#AFC4C1'),
	panel: hex('#E7EEEB'),
	hint: hex('#C3D0CD'),
	white: hex('#FFFFFF'),
} as const;

export interface PdfFonts {
	regular: PDFFont;
	bold: PDFFont;
	glyph: PDFFont;
}

function hex(value: string): Color {
	const normalized = value.replace('#', '');
	return rgb(
		parseInt(normalized.slice(0, 2), 16) / 255,
		parseInt(normalized.slice(2, 4), 16) / 255,
		parseInt(normalized.slice(4, 6), 16) / 255,
	);
}

export function paperLabel(paper: PdfPaper): string {
	return paper === 'a4' ? 'A4' : 'US LETTER';
}

export function drawPageBackground(page: PDFPage): void {
	const { width, height } = page.getSize();
	page.drawRectangle({ x: 0, y: 0, width, height, color: PDF_THEME.paper });
}

export function drawRoundedRect(
	page: PDFPage,
	options: {
		x: number;
		y: number;
		width: number;
		height: number;
		radius: number;
		color: Color;
		borderColor?: Color;
		borderWidth?: number;
	},
): void {
	const { x, y, width, height, radius, color, borderColor, borderWidth = 0 } = options;
	const r = Math.min(radius, width / 2, height / 2);
	const k = r * 0.5522847498;
	const path = [
		`M ${r} 0`,
		`L ${width - r} 0`,
		`C ${width - r + k} 0 ${width} ${r - k} ${width} ${r}`,
		`L ${width} ${height - r}`,
		`C ${width} ${height - r + k} ${width - r + k} ${height} ${width - r} ${height}`,
		`L ${r} ${height}`,
		`C ${r - k} ${height} 0 ${height - r + k} 0 ${height - r}`,
		`L 0 ${r}`,
		`C 0 ${r - k} ${r - k} 0 ${r} 0`,
		'Z',
	].join(' ');
	page.drawSvgPath(path, {
		x,
		y: y + height,
		color,
		borderColor,
		borderWidth,
	});
}

export function drawCenteredText(
	page: PDFPage,
	text: string,
	font: PDFFont,
	size: number,
	centerX: number,
	y: number,
	color: Color,
): void {
	page.drawText(text, {
		x: centerX - font.widthOfTextAtSize(text, size) / 2,
		y,
		font,
		size,
		color,
	});
}

export function drawRightText(
	page: PDFPage,
	text: string,
	font: PDFFont,
	size: number,
	rightX: number,
	y: number,
	color: Color,
): void {
	page.drawText(text, {
		x: rightX - font.widthOfTextAtSize(text, size),
		y,
		font,
		size,
		color,
	});
}

export function fitText(
	font: PDFFont,
	text: string,
	preferred: number,
	minimum: number,
	width: number,
): number {
	let size = preferred;
	while (size > minimum && font.widthOfTextAtSize(text, size) > width) size -= 0.5;
	return size;
}

export function balancedPageGroups<T>(items: readonly T[], maximumRows = 6): T[][] {
	if (items.length === 0) return [];
	const pageCount = Math.ceil(items.length / maximumRows);
	const baseSize = Math.floor(items.length / pageCount);
	const largerGroups = items.length % pageCount;
	const groups: T[][] = [];
	let offset = 0;
	for (let page = 0; page < pageCount; page++) {
		const size = baseSize + (page < largerGroups ? 1 : 0);
		groups.push(items.slice(offset, offset + size));
		offset += size;
	}
	return groups;
}
