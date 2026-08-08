import type { PracticeSet } from '$lib/types';

export const EMPTY_ATTENTION_FALLBACK_MS = 2_000;

export function scheduleAdaptiveFallback(
	practiceSet: PracticeSet,
	attentionCount: number,
	onFallback: () => void,
) {
	if (practiceSet !== 'mistakes' || attentionCount > 0) return;
	return setTimeout(onFallback, EMPTY_ATTENTION_FALLBACK_MS);
}
