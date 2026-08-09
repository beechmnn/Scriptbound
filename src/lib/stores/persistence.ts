type StorageReader = Pick<Storage, 'getItem' | 'setItem'>;

export function readMigratedValue(
	storage: StorageReader,
	key: string,
	legacyKeys: readonly string[],
): string | null {
	const current = storage.getItem(key);
	if (current !== null) return current;

	for (const legacyKey of legacyKeys) {
		const legacy = storage.getItem(legacyKey);
		if (legacy === null) continue;
		storage.setItem(key, legacy);
		return legacy;
	}

	return null;
}
