export function textLetters(text: string) {
	return [...new Set(text.replace(/[^a-z]/g, '').split(''))];
}

function unintroducedLetters(text: string, introduced: Set<string>) {
	return textLetters(text).filter((letter) => !introduced.has(letter));
}

export function guidedIntroductionLetter(text: string, introduced: Set<string>) {
	const unintroduced = unintroducedLetters(text, introduced);
	return unintroduced.length === 1 ? unintroduced[0] : null;
}

export function adaptiveWordCandidates(
	source: string[],
	introduced: Set<string>,
	nextNew?: string,
) {
	const introducedOnly = source.filter(
		(text) => unintroducedLetters(text, introduced).length === 0,
	);
	const introductions = nextNew
		? source.filter((text) => {
				const unintroduced = unintroducedLetters(text, introduced);
				return unintroduced.length === 1 && unintroduced[0] === nextNew;
			})
		: [];
	return [...introducedOnly, ...introductions];
}

export function adaptiveWordPoolExhausted(candidates: string[], shown: string[]) {
	return candidates.length === 0 || candidates.every((candidate) => shown.includes(candidate));
}

export function adaptiveEncodingCandidates(
	source: string[],
	introduced: Set<string>,
	nextNew?: string,
) {
	const candidates = source.filter((text) => {
		const unintroduced = unintroducedLetters(text, introduced);
		return unintroduced.length === 0 || (unintroduced.length === 1 && unintroduced[0] === nextNew);
	});
	return nextNew ? [...new Set([nextNew, ...candidates])] : candidates;
}

export function isGuidedIntroductionSuccessful(
	mode: 'word' | 'encode',
	correct: boolean,
	firstAttempt: boolean,
) {
	return correct && (mode === 'encode' || firstAttempt);
}
