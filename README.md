# Necrofonticon Trainer

A client-only, statically deployable SvelteKit trainer for learning the Necrofonticon alphabet.

The interface and practice corpus are available in English and German. The selected language is stored locally, and adaptive glyph introduction follows a language-specific letter-frequency order while sharing the same glyph mastery record.

## Setup

```sh
npm install
npm run dev
```

Add a properly licensed `necrofonticon.woff2` to `static/fonts/`. It is deliberately excluded from this repository; without it, prompts remain hidden to prevent fallback Latin text from revealing answers.

Run `npm run format`, `npm run lint`, `npm test`, `npm run check`, and `npm run build` before
deployment. Use `npm run format:check` in CI when files should be checked without modifying them.
The generated static site is written to `build/`.

## Progressive web app

The production build registers `static/sw.js`, caches the application shell and visited assets, and can be installed from supported browsers. Test installation and offline behavior with `npm run build && npm run preview`; service workers are intentionally disabled during development.

Progress can be exported and imported from the Progress view. Review reminders are optional browser notifications checked while the app is open; no account, push server, or background tracking is used.

## Encoding practice

The Encode mode presents readable Latin text and accepts answers through a shuffled Necrofonticon soft keyboard. Each question shows the distinct letters needed for its prompt plus three distractors, rather than the full alphabet. The keyboard includes backspace and clear controls, with space added for sentence prompts. Latin labels can be revealed as a learning aid, and encoding accuracy is reported separately on the Progress view.

## Handwriting practice

Handwriting mode prompts with one Latin letter and records pointer, touch, or stylus strokes on a responsive canvas. The canonical glyph remains hidden until comparison, after which an adjustable overlay supports self-assessment as correct, almost correct, or incorrect. Handwriting evidence is stored separately from recognition mastery and included in progress exports.
