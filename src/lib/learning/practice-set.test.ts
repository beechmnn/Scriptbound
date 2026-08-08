import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ATTENTION_FALLBACK_MS, scheduleAdaptiveFallback } from './practice-set';

describe('scheduleAdaptiveFallback', () => {
	afterEach(() => vi.useRealTimers());

	it('waits before falling back when needs attention becomes empty', () => {
		vi.useFakeTimers();
		const onFallback = vi.fn();
		scheduleAdaptiveFallback('mistakes', 0, onFallback);

		vi.advanceTimersByTime(EMPTY_ATTENTION_FALLBACK_MS - 1);
		expect(onFallback).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(onFallback).toHaveBeenCalledOnce();
	});

	it('does not schedule a fallback for a nonempty or different question set', () => {
		expect(scheduleAdaptiveFallback('mistakes', 1, vi.fn())).toBeUndefined();
		expect(scheduleAdaptiveFallback('adaptive', 0, vi.fn())).toBeUndefined();
		expect(scheduleAdaptiveFallback('all', 0, vi.fn())).toBeUndefined();
	});
});
