export const APP_NAME = 'Scriptbound';

const necrofonticonGlyphs = 'abcdefghijklmnopqrstuvwxyz'.split('').map((letter) => ({
	id: letter,
	glyph: letter,
	answer: letter,
	label: `${letter.toUpperCase()}  ${letter}`,
}));

export const currentCourse = {
	id: 'necrofonticon',
	name: 'Necrofonticon',
	fontFamily: 'Necrofonticon',
	fontFileName: 'necrofonticon.woff2',
	fontUrl: '/fonts/necrofonticon.woff2',
	pdfFontUrl: '/fonts/necrofonticon.ttf',
	glyphs: necrofonticonGlyphs,
} as const;
