<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { copy } from '$lib/i18n';
	import { locale } from '$lib/stores/locale';
	import { currentCourse } from '$lib/app';
	import { readMigratedValue } from '$lib/stores/persistence';
	import {
		createProgressBackup,
		importProgressBackup,
		progress as progressStore,
	} from '$lib/stores/progress';

	const REMINDERS_KEY = `scriptbound:reminders:${currentCourse.id}:v1`;
	const LAST_REMINDER_KEY = `scriptbound:last-reminder:${currentCourse.id}:v1`;
	const LEGACY_REMINDERS_KEYS = ['necrofonticon-review-reminders'];
	const LEGACY_LAST_REMINDER_KEYS = ['necrofonticon-last-reminder'];
	let t = $derived(copy[$locale].phase3);
	let fileInput: HTMLInputElement;
	let message = $state('');
	let remindersEnabled = $state(false);
	let notificationSupported = $state(false);
	let reminderTimer: ReturnType<typeof setInterval> | undefined;

	function exportProgress() {
		const backup = createProgressBackup($progressStore);
		const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `scriptbound-${currentCourse.id}-progress-${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	async function importProgress(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const backup: unknown = JSON.parse(await file.text());
			if (!window.confirm(t.importConfirm)) return;
			importProgressBackup(backup);
			message = t.imported;
		} catch {
			message = t.invalidBackup;
		} finally {
			input.value = '';
		}
	}

	function dueCount() {
		const now = Date.now();
		return Object.values($progressStore).filter(
			(item) => item.nextReviewAt > 0 && item.nextReviewAt <= now,
		).length;
	}

	async function showReminder() {
		if (!remindersEnabled || Notification.permission !== 'granted') return;
		const count = dueCount();
		const today = new Date().toISOString().slice(0, 10);
		if (
			!count ||
			readMigratedValue(localStorage, LAST_REMINDER_KEY, LEGACY_LAST_REMINDER_KEYS) === today
		)
			return;
		const registration = await navigator.serviceWorker?.ready;
		await registration?.showNotification(copy[$locale].document.title, {
			body: t.reminderNotification(count),
			icon: '/icon.svg',
			tag: 'review-reminder',
		});
		localStorage.setItem(LAST_REMINDER_KEY, today);
	}

	async function toggleReminders() {
		if (remindersEnabled) {
			remindersEnabled = false;
			localStorage.setItem(REMINDERS_KEY, 'false');
			return;
		}
		const permission = await Notification.requestPermission();
		if (permission !== 'granted') {
			message = t.notificationsBlocked;
			return;
		}
		remindersEnabled = true;
		localStorage.setItem(REMINDERS_KEY, 'true');
		await showReminder();
	}

	onMount(() => {
		notificationSupported = 'Notification' in window && 'serviceWorker' in navigator;
		remindersEnabled =
			notificationSupported &&
			readMigratedValue(localStorage, REMINDERS_KEY, LEGACY_REMINDERS_KEYS) === 'true';
		void showReminder();
		reminderTimer = setInterval(() => void showReminder(), 60 * 60 * 1_000);
	});
	onDestroy(() => {
		if (reminderTimer) clearInterval(reminderTimer);
	});
</script>

<section class="phase-three-controls" aria-labelledby="data-controls-title">
	<div>
		<h2 id="data-controls-title">{t.dataTitle}</h2>
		<p>{t.dataHelp}</p>
		<div class="buttons">
			<button onclick={exportProgress}>{t.export}</button>
			<button onclick={() => fileInput.click()}>{t.import}</button>
			<input
				class="file-input"
				bind:this={fileInput}
				type="file"
				accept="application/json,.json"
				onchange={importProgress}
			/>
		</div>
	</div>
	<div>
		<h2>{t.remindersTitle}</h2>
		<p>{t.remindersHelp}</p>
		<button disabled={!notificationSupported} onclick={toggleReminders}>
			{remindersEnabled ? t.disableReminders : t.enableReminders}
		</button>
	</div>
</section>
{#if message}<p class="data-message" role="status">{message}</p>{/if}

<style>
	.phase-three-controls {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin: 2rem 0;
	}
	.phase-three-controls > div {
		padding: 1.25rem;
		border: 1px solid var(--line);
		border-radius: 0.45rem;
		background: var(--panel);
	}
	h2 {
		margin: 0;
		font:
			500 1.25rem/1.2 Georgia,
			serif;
	}
	p {
		color: var(--muted);
		font-size: 0.85rem;
		line-height: 1.5;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.file-input {
		display: none;
	}
	.data-message {
		padding: 0.8rem 1rem;
		border-left: 3px solid var(--accent);
		background: var(--panel);
	}
	button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}
	@media (max-width: 620px) {
		.phase-three-controls {
			grid-template-columns: 1fr;
		}
	}
</style>
