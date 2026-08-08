const CACHE = 'necrofonticon-v3';
const SHELL = [
	'/',
	'/manifest.webmanifest',
	'/icon.svg',
	'/fonts.css',
	'/fonts/necrofonticon.woff2',
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then(async (cache) => {
			const pending = [...SHELL];
			const visited = new Set();
			while (pending.length) {
				const url = pending.shift();
				if (!url || visited.has(url)) continue;
				visited.add(url);
				try {
					const response = await fetch(url);
					if (!response.ok) continue;
					await cache.put(url, response.clone());
					const type = response.headers.get('content-type') ?? '';
					if (
						type.includes('text/html') ||
						type.includes('javascript') ||
						type.includes('text/css')
					) {
						const source = await response.text();
						const references = source.matchAll(
							/(?:src=|href=|from\s*|import\s*)?["']([^"']+\.(?:js|css|woff2|json))["']/g,
						);
						for (const match of references) {
							const asset = new URL(match[1], new URL(url, self.location.origin));
							if (asset.origin === self.location.origin) pending.push(asset.pathname);
						}
					}
				} catch {
					/* Optional user-provided assets may not exist. */
				}
			}
		}),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		Promise.all([
			caches
				.keys()
				.then((keys) =>
					Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
				),
			self.clients.claim(),
		]),
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin)
		return;
	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					const copy = response.clone();
					void caches.open(CACHE).then((cache) => cache.put('/', copy));
					return response;
				})
				.catch(() => caches.match('/')),
		);
		return;
	}
	event.respondWith(
		caches.match(event.request).then(
			(cached) =>
				cached ||
				fetch(event.request).then((response) => {
					if (response.ok) {
						const copy = response.clone();
						void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
					}
					return response;
				}),
		),
	);
});

self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			const existing = clients[0];
			return existing ? existing.focus() : self.clients.openWindow('/');
		}),
	);
});
