import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { Palette } from '$lib/types';

const KEY = 'necrofonticon-palette-v1';
const isPalette = (value: string | null): value is Palette =>
	value === 'gold' || value === 'petrol';

function initialPalette(): Palette {
	if (!browser) return 'petrol';
	const saved = localStorage.getItem(KEY);
	return isPalette(saved) ? saved : 'petrol';
}

export const palette = writable<Palette>(initialPalette());
if (browser)
	palette.subscribe((value) => {
		localStorage.setItem(KEY, value);
		document.documentElement.dataset.palette = value;
	});

export function setPalette(value: Palette) {
	palette.set(value);
}
