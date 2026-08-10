# itch.io launcher

The itch launcher is intentionally separate from the main SvelteKit build. It embeds the canonical
Cloudflare deployment, while Scriptbound offers a prominent link that opens the same app as a
top-level, installable PWA.

Build the single HTML file with the permanent public URL:

```sh
npm run build:itch -- --url https://your-worker.your-subdomain.workers.dev/
```

Upload `itch/dist/index.html` to itch.io as an HTML project. Enable **Mobile Friendly** and use
**Click to launch in fullscreen**. The launcher only needs to be uploaded again if the canonical URL
changes; normal application updates are deployed to Cloudflare only.

The Cloudflare response must permit framing. Do not add `X-Frame-Options: DENY` or a Content Security
Policy whose `frame-ancestors` directive excludes itch.io.
