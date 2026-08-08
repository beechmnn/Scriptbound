import { describe, expect, it, vi } from 'vitest';
import {
	answerInputDisabled,
	restoreAnswerInputFocus,
	shouldPreventSubmittedInput,
} from './practice-input';

describe('restoreAnswerInputFocus', () => {
	it('focuses and selects the typed Glyph answer field', () => {
		const focus = vi.fn();
		const select = vi.fn();

		restoreAnswerInputFocus({ focus, select }, 'glyph');

		expect(focus).toHaveBeenCalledOnce();
		expect(select).toHaveBeenCalledOnce();
		expect(focus.mock.invocationCallOrder[0]).toBeLessThan(select.mock.invocationCallOrder[0]);
	});

	it('focuses Words without selecting or scrolling', () => {
		const focus = vi.fn();
		const select = vi.fn();

		restoreAnswerInputFocus({ focus, select }, 'word');

		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
		expect(select).not.toHaveBeenCalled();
	});

	it('keeps a submitted typed Glyph input enabled so mobile keyboards stay open', () => {
		expect(answerInputDisabled('glyph', true)).toBe(false);
		expect(shouldPreventSubmittedInput('glyph', true)).toBe(true);
	});

	it('still disables submitted inputs in non-continuous text modes', () => {
		expect(answerInputDisabled('sentence', true)).toBe(true);
		expect(answerInputDisabled('glyph', false)).toBe(false);
	});
});
