type AnswerInput = Pick<HTMLInputElement, 'focus' | 'select'>;

export function answerInputDisabled(mode: string, submitted: boolean) {
	return submitted && mode !== 'word' && mode !== 'glyph';
}

export function shouldPreventSubmittedInput(mode: string, submitted: boolean) {
	return submitted && (mode === 'word' || mode === 'glyph');
}

export function restoreAnswerInputFocus(input: AnswerInput, mode: 'glyph' | 'word') {
	if (mode === 'word') {
		input.focus({ preventScroll: true });
		return;
	}
	input.focus();
	input.select();
}
