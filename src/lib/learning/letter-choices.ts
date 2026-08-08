export const LETTER_CHOICE_COUNT = 4;

export function createLetterChoices(
	target: string,
	letters: string[],
	random: () => number = Math.random,
) {
	const distractors = [...new Set(letters)].filter((letter) => letter !== target);
	for (let index = distractors.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(random() * (index + 1));
		[distractors[index], distractors[swapIndex]] = [distractors[swapIndex], distractors[index]];
	}
	const choices = [target, ...distractors.slice(0, LETTER_CHOICE_COUNT - 1)];
	for (let index = choices.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(random() * (index + 1));
		[choices[index], choices[swapIndex]] = [choices[swapIndex], choices[index]];
	}
	return choices;
}
