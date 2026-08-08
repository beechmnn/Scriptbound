<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { copy } from '$lib/i18n';
	import { locale } from '$lib/stores/locale';

	type InstallPromptEvent = Event & {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	};

	let t = $derived(copy[$locale].phase3);
	let online = $state(true);
	let offlineReady = $state(false);
	let installPrompt = $state<InstallPromptEvent | null>(null);
	let waitingWorker = $state<ServiceWorker | null>(null);

	async function install() {
		if (!installPrompt) return;
		await installPrompt.prompt();
		await installPrompt.userChoice;
		installPrompt = null;
	}

	function applyUpdate() {
		waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
	}

	onMount(() => {
		online = navigator.onLine;
		const updateOnline = () => (online = navigator.onLine);
		const capturePrompt = (event: Event) => {
			event.preventDefault();
			installPrompt = event as InstallPromptEvent;
		};
		window.addEventListener('online', updateOnline);
		window.addEventListener('offline', updateOnline);
		window.addEventListener('beforeinstallprompt', capturePrompt);

		if (!dev && 'serviceWorker' in navigator) {
			void navigator.serviceWorker.register('/sw.js').then((registration) => {
				offlineReady = true;
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
			window.removeEventListener('online', updateOnline);
			window.removeEventListener('offline', updateOnline);
			window.removeEventListener('beforeinstallprompt', capturePrompt);
			navigator.serviceWorker?.removeEventListener('controllerchange', reload);
		};
	});
</script>

{#if !online || offlineReady || installPrompt || waitingWorker}
	<div class="pwa-status" aria-live="polite">
		<span class:offline={!online}>{online ? t.readyOffline : t.offline}</span>
		{#if installPrompt}<button onclick={install}>{t.install}</button>{/if}
		{#if waitingWorker}<button onclick={applyUpdate}>{t.update}</button>{/if}
	</div>
{/if}

<style>
	.pwa-status {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
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
	span {
		padding: 0 0.45rem;
		color: #89ae91;
		font-size: 0.72rem;
	}
	span.offline {
		color: #d7a76c;
	}
	button {
		padding: 0.45rem 0.65rem;
		font-size: 0.75rem;
	}
</style>
