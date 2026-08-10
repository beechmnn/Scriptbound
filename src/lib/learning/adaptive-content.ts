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

export function variedTextCandidates(candidates: string[], recent: string[]) {
	const distinct = [...new Set(candidates)];
	if (distinct.length <= 1) return distinct;

	const unseen = distinct.filter((candidate) => !recent.includes(candidate));
	if (unseen.length) return unseen;

	const cooldownSize = Math.min(distinct.length - 1, Math.max(1, Math.ceil(distinct.length * 0.6)));
	const coolingDown = new Set(recent.slice(-cooldownSize));
	const available = distinct.filter((candidate) => !coolingDown.has(candidate));
	return available.length ? available : distinct;
}

export function variedLessonTextCandidates(
	candidates: string[],
	recent: string[],
	seenThisLesson: string[],
) {
	const unseenThisLesson = candidates.filter((candidate) => !seenThisLesson.includes(candidate));
	return variedTextCandidates(unseenThisLesson.length ? unseenThisLesson : candidates, recent);
}

export function appendRecentText(recent: string[], text: string, limit = 500) {
	return [...recent, text].slice(-limit);
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
