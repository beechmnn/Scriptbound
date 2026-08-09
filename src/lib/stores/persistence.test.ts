import { describe, expect, it } from 'vitest';
import { readMigratedValue } from './persistence';

function memoryStorage(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial));
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		values,
	};
}

describe('persisted value migration', () => {
	it('prefers an existing current value', () => {
		const storage = memoryStorage({ current: 'new', legacy: 'old' });
		expect(readMigratedValue(storage, 'current', ['legacy'])).toBe('new');
		expect(storage.values.get('current')).toBe('new');
	});

	it('copies the first legacy value to the current key', () => {
		const storage = memoryStorage({ legacy: 'saved' });
		expect(readMigratedValue(storage, 'current', ['legacy'])).toBe('saved');
		expect(storage.values.get('current')).toBe('saved');
	});

	it('returns null when no saved value exists', () => {
		const storage = memoryStorage();
		expect(readMigratedValue(storage, 'current', ['legacy'])).toBeNull();
	});
});
