export type PdfKind = 'chart' | 'tracing';
export type PdfPaper = 'a4' | 'letter';

export interface PdfGlyph {
	id: string;
	glyph: string;
	label: string;
}

export interface PdfCourse {
	id: string;
	name: string;
	glyphs: readonly PdfGlyph[];
}

export interface PdfDocumentCopy {
	referenceEyebrow: string;
	writingEyebrow: string;
	chartTitle: (courseName: string) => string;
	chartSubtitle: (count: number) => string;
	chartFooter: (courseName: string) => string;
	tracingTitle: (courseName: string) => string;
	tracingSubtitle: string;
	name: string;
	date: string;
	tracingFooter: string;
}

export interface GeneratePdfOptions {
	kind: PdfKind;
	paper: PdfPaper;
	course: PdfCourse;
	copy: PdfDocumentCopy;
	fontBytes: Uint8Array;
}
