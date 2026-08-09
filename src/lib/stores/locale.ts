import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { Locale } from '$lib/types';
import { readMigratedValue } from './persistence';

const KEY = 'scriptbound:locale:v1';
const LEGACY_KEYS = ['necrofonticon-locale-v1'];
const isLocale = (value: string | null): value is Locale => value === 'en' || value === 'de';

export function resolveLocale(saved: string | null, browserLanguage: string): Locale {
	if (isLocale(saved)) return saved;
	return browserLanguage.toLowerCase().startsWith('de') ? 'de' : 'en';
}

function initialLocale(): Locale {
	if (!browser) return 'en';
	return resolveLocale(readMigratedValue(localStorage, KEY, LEGACY_KEYS), navigator.language);
}

export const locale = writable<Locale>(initialLocale());
if (browser)
	locale.subscribe((value) => {
		localStorage.setItem(KEY, value);
		document.documentElement.lang = value;
	});

export function setLocale(value: Locale) {
	locale.set(value);
}
