import type { GlyphProgress } from '$lib/types';

export const INSTALL_DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1_000;

export function isIosDevice(userAgent: string, platform: string, maxTouchPoints: number) {
	return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

export function hasSuccessfulPractice(progress: Record<string, GlyphProgress>) {
	return Object.values(progress).some(
		(item) => item.correct > 0 || item.encodingCorrect > 0 || item.handwritingCorrect > 0,
	);
}

export function buildStandaloneInstallUrl(currentUrl: string) {
	const url = new URL(currentUrl);
	url.searchParams.delete('embedded');
	url.searchParams.set('install', '1');
	if (!url.searchParams.has('source')) url.searchParams.set('source', 'itch');
	return url.toString();
}

export function installDismissalIsActive(value: string | null, now = Date.now()) {
	if (!value) return false;
	const dismissedAt = Number(value);
	return Number.isFinite(dismissedAt) && now - dismissedAt < INSTALL_DISMISS_DURATION_MS;
}

export function shouldOfferInstall({
	installed,
	framed,
	installIntent,
	hasPractised,
	installPromptAvailable,
	ios,
	dismissed,
}: {
	installed: boolean;
	framed: boolean;
	installIntent: boolean;
	hasPractised: boolean;
	installPromptAvailable: boolean;
	ios: boolean;
	dismissed: boolean;
}) {
	if (installed) return false;
	if (dismissed) return false;
	return framed || installIntent || (hasPractised && (installPromptAvailable || ios));
}
