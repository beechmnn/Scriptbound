import type { AnswerPart } from '$lib/types';
export function normalizeAnswer(value: string): string {
	return value.toLowerCase().trim().replace(/\s+/g, ' ');
}
export function compareAnswer(answer: string, expected: string): AnswerPart[] {
	const actual = normalizeAnswer(answer),
		target = normalizeAnswer(expected);
	const rows = target.length + 1,
		columns = actual.length + 1;
	const distance = Array.from({ length: rows }, () => Array<number>(columns).fill(0));
	for (let row = 0; row < rows; row++) distance[row][0] = row;
	for (let column = 0; column < columns; column++) distance[0][column] = column;
	for (let row = 1; row < rows; row++)
		for (let column = 1; column < columns; column++) {
			const substitution =
				distance[row - 1][column - 1] + (target[row - 1] === actual[column - 1] ? 0 : 1);
			distance[row][column] = Math.min(
				substitution,
				distance[row - 1][column] + 1,
				distance[row][column - 1] + 1,
			);
		}
	const reversed: AnswerPart[] = [];
	let row = target.length,
		column = actual.length;
	while (row || column) {
		if (
			row &&
			column &&
			distance[row][column] ===
				distance[row - 1][column - 1] + (target[row - 1] === actual[column - 1] ? 0 : 1)
		) {
			const character = actual[column - 1],
				wanted = target[row - 1];
			reversed.push({
				character,
				expected: wanted,
				status: character === wanted ? 'correct' : 'wrong',
			});
			row--;
			column--;
		} else if (row && distance[row][column] === distance[row - 1][column] + 1) {
			reversed.push({ character: '', expected: target[row - 1], status: 'missing' });
			row--;
		} else {
			reversed.push({ character: actual[column - 1], expected: '', status: 'extra' });
			column--;
		}
	}
	return reversed.reverse();
}
export const isCorrect = (answer: string, expected: string) =>
	normalizeAnswer(answer) === normalizeAnswer(expected);
