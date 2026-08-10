<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { copy } from '$lib/i18n';
	import { locale } from '$lib/stores/locale';
	import { progress } from '$lib/stores/progress';
	import {
		buildStandaloneInstallUrl,
		hasSuccessfulPractice,
		installDismissalIsActive,
		isIosDevice,
		shouldOfferInstall,
	} from '$lib/pwa/install';

	type InstallPromptEvent = Event & {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	};
	type NavigatorWithStandalone = Navigator & { standalone?: boolean };

	const INSTALL_DISMISS_KEY = 'scriptbound:install-dismissed:v1';

	let t = $derived(copy[$locale].phase3);
	let online = $state(true);
	let offlineReady = $state(false);
	let installPrompt = $state<InstallPromptEvent | null>(null);
	let waitingWorker = $state<ServiceWorker | null>(null);
	let installed = $state(false);
	let framed = $state(false);
	let ios = $state(false);
	let installIntent = $state(false);
	let dismissed = $state(false);
	let showIosInstructions = $state(false);
	let standaloneInstallUrl = $state('');
	let hasPractised = $derived(hasSuccessfulPractice($progress));
	let showInstallCard = $derived(
		shouldOfferInstall({
			installed,
			framed,
			installIntent,
			hasPractised,
			installPromptAvailable: installPrompt !== null,
			ios,
			dismissed,
		}),
	);

	async function install() {
		if (!installPrompt) return;
		await installPrompt.prompt();
		const choice = await installPrompt.userChoice;
		installPrompt = null;
		if (choice.outcome === 'accepted') installed = true;
	}

	function dismissInstall() {
		dismissed = true;
		localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
	}

	function applyUpdate() {
		waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
	}

	onMount(() => {
		online = navigator.onLine;
		framed = window.self !== window.top;
		ios = isIosDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
		installIntent = new URL(window.location.href).searchParams.get('install') === '1';
		standaloneInstallUrl = buildStandaloneInstallUrl(window.location.href);
		dismissed =
			installDismissalIsActive(localStorage.getItem(INSTALL_DISMISS_KEY)) &&
			!framed &&
			!installIntent;

		const displayMode = window.matchMedia('(display-mode: standalone)');
		const updateInstalled = () => {
			installed = displayMode.matches || (navigator as NavigatorWithStandalone).standalone === true;
		};
		const updateOnline = () => (online = navigator.onLine);
		const capturePrompt = (event: Event) => {
			event.preventDefault();
			installPrompt = event as InstallPromptEvent;
		};
		const markInstalled = () => (installed = true);
		updateInstalled();
		window.addEventListener('online', updateOnline);
		window.addEventListener('offline', updateOnline);
		window.addEventListener('beforeinstallprompt', capturePrompt);
		window.addEventListener('appinstalled', markInstalled);
		displayMode.addEventListener('change', updateInstalled);

		let offlineReadyTimer: ReturnType<typeof setTimeout> | undefined;
		if (!dev && 'serviceWorker' in navigator) {
			void navigator.serviceWorker.register('/sw.js').then((registration) => {
				offlineReady = true;
				offlineReadyTimer = setTimeout(() => (offlineReady = false), 4_000);
				waitingWorker = registration.waiting;
				registration.addEventListener('updatefound', () => {
					const worker = registration.installing;
					worker?.addEventListener('statechange', () => {
						if (worker.state === 'installed' && navigator.serviceWorker.controller) {
							waitingWorker = worker;
						}
					});
				});
			});
		}

		const reload = () => window.location.reload();
		navigator.serviceWorker?.addEventListener('controllerchange', reload);
		return () => {
			if (offlineReadyTimer) clearTimeout(offlineReadyTimer);
			window.removeEventListener('online', updateOnline);
			window.removeEventListener('offline', updateOnline);
			window.removeEventListener('beforeinstallprompt', capturePrompt);
			window.removeEventListener('appinstalled', markInstalled);
			displayMode.removeEventListener('change', updateInstalled);
			navigator.serviceWorker?.removeEventListener('controllerchange', reload);
		};
	});
</script>

{#if showInstallCard}
	<aside class="install-card" aria-labelledby="install-title">
		<div class="install-copy">
			<p>{t.installEyebrow}</p>
			<h2 id="install-title">{framed ? t.framedTitle : t.installTitle}</h2>
			<span>{framed ? t.framedBody : t.installBody}</span>
		</div>
		<div class="install-actions">
			{#if framed}
				<a class="primary" href={standaloneInstallUrl} target="_blank" rel="noopener noreferrer"
					>{t.openInstallable}</a
				>
			{:else if installPrompt}
				<button class="primary" onclick={install}>{t.install}</button>
			{:else if ios}
				<button class="primary" onclick={() => (showIosInstructions = !showIosInstructions)}
					>{t.installIos}</button
				>
			{:else}
				<span class="manual-install">{t.manualInstall}</span>
			{/if}
			<button class="secondary" onclick={dismissInstall}>{t.notNow}</button>
		</div>
		{#if showIosInstructions}
			<div class="ios-instructions" aria-live="polite">
				<strong>{t.iosTitle}</strong>
				<ol>
					{#each t.iosSteps as step}<li>{step}</li>{/each}
				</ol>
			</div>
		{/if}
	</aside>
{/if}

{#if !online || offlineReady || waitingWorker}
	<div class="pwa-status" aria-live="polite">
		<span class:offline={!online}>{online ? t.readyOffline : t.offline}</span>
		{#if waitingWorker}<button onclick={applyUpdate}>{t.update}</button>{/if}
	</div>
{/if}

<style>
	.install-card {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1rem 2rem;
		align-items: center;
		margin-bottom: 2.5rem;
		padding: 1.2rem 1.35rem;
		border: 1px solid var(--accent);
		border-radius: 0.8rem;
		background: linear-gradient(135deg, var(--panel), var(--card-end));
		box-shadow: 0 18px 45px #0005;
	}
	.install-copy p {
		margin: 0 0 0.35rem;
		color: var(--accent);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	.install-copy h2 {
		margin: 0 0 0.35rem;
		font-size: 1.35rem;
	}
	.install-copy span,
	.manual-install {
		color: var(--muted);
		font-size: 0.9rem;
		line-height: 1.5;
	}
	.install-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.55rem;
	}
	.install-actions .primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		border: 1px solid var(--accent);
		border-radius: 0.4rem;
		padding: 0.65rem 0.9rem;
		color: var(--active-ink);
		background: var(--accent);
		font: inherit;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
	}
	.install-actions .secondary {
		min-height: 44px;
	}
	.ios-instructions {
		grid-column: 1 / -1;
		padding-top: 1rem;
		border-top: 1px solid var(--line);
	}
	.ios-instructions ol {
		margin: 0.65rem 0 0;
		padding-left: 1.3rem;
		color: var(--muted);
		line-height: 1.7;
	}
	.pwa-status {
		position: fixed;
		right: 1rem;
		bottom: max(1rem, env(safe-area-inset-bottom));
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem;
		border: 1px solid var(--line);
		border-radius: 0.5rem;
		background: #171513f2;
		box-shadow: 0 10px 30px #0008;
	}
	.pwa-status span {
		padding: 0 0.45rem;
		color: #89ae91;
		font-size: 0.72rem;
	}
	.pwa-status span.offline {
		color: #d7a76c;
	}
	.pwa-status button {
		padding: 0.45rem 0.65rem;
		font-size: 0.75rem;
	}
	@media (max-width: 620px) {
		.install-card {
			grid-template-columns: 1fr;
			margin: -0.75rem 0 2rem;
			padding: 1.15rem;
		}
		.install-actions {
			justify-content: stretch;
		}
		.install-actions > :global(*) {
			flex: 1 1 auto;
		}
		.manual-install {
			flex-basis: 100%;
		}
	}
</style>
