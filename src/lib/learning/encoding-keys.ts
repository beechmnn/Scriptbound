export const ENCODING_DISTRACTOR_COUNT = 3;

export function createEncodingKeys(
	target: string,
	letters: string[],
	random: () => number = Math.random,
) {
	const required = [...new Set(target.toLowerCase().match(/[a-z]/g) ?? [])];
	const distractors = [...new Set(letters)].filter((letter) => !required.includes(letter));
	shuffle(distractors, random);

	return shuffle([...required, ...distractors.slice(0, ENCODING_DISTRACTOR_COUNT)], random);
}

function shuffle<T>(values: T[], random: () => number) {
	for (let index = values.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(random() * (index + 1));
		[values[index], values[swapIndex]] = [values[swapIndex], values[index]];
	}
	return values;
}
