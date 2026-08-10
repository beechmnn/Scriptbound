# Scriptbound

A client-only, statically deployable SvelteKit app for learning the scripts of other worlds. Necrofonticon is the first available course.

The interface and practice corpus are available in English and German. The selected language is stored locally, and adaptive glyph introduction follows a language-specific letter-frequency order while sharing the same glyph mastery record.

## Script courses

Each script is a self-contained course registered in `src/lib/app.ts`. A course owns its glyph mapping, web and PDF font metadata, legacy storage migrations, and localized teaching packs. Each teaching pack contains its own curriculum order, words, and sentences, so a script can carry a distinct theme as well as a distinct alphabet.

Necrofonticon currently lives in `src/lib/courses/necrofonticon.ts`; its English and German corpora remain intentionally occult and Lovecraftian. To introduce another script, add its course module and font files, register it in `src/lib/app.ts`, declare its web font in `static/fonts.css`, and add its font assets to the service-worker shell in `static/sw.js`. Progress, trials, lesson history, reminders, backups, and generated PDF filenames are already namespaced by course ID.

Until a second complete course ships, `currentCourse` resolves to the registry default and the interface displays that course as a passive identity below the Scriptbound brand. A future course picker can replace that compatibility lookup with a persisted active course selection without moving teaching content again.

## Setup

```sh
npm install
npm run dev
```

The Necrofonticon course uses `static/fonts/necrofonticon.woff2`. If a course font is unavailable, its prompts remain hidden so fallback Latin text cannot reveal answers.

Run `npm run format`, `npm run lint`, `npm test`, `npm run check`, and `npm run build` before
deployment. Use `npm run format:check` in CI when files should be checked without modifying them.
The generated static site is written to `build/`.

## Progressive web app

The production build registers `static/sw.js`, caches the application shell and visited assets, and can be installed from supported browsers. Test installation and offline behavior with `npm run build && npm run preview`; service workers are intentionally disabled during development.

Progress can be exported and imported from the Progress view. Review reminders are optional browser notifications checked while the app is open; no account, push server, or background tracking is used.

## Encoding practice

The Encode mode presents readable Latin text and accepts answers through a shuffled Necrofonticon soft keyboard. Each question shows the distinct letters needed for its prompt plus three distractors, rather than the full alphabet. The keyboard includes backspace and clear controls, with space added for sentence prompts. Latin labels can be revealed as a learning aid, and encoding accuracy is reported separately on the Progress view.

## Printable course materials

The Alphabet view generates glyph charts and tracing workbooks entirely in the browser. Shared page sizes, colors, spacing, typography, headers, footers, and layout helpers live in `src/lib/pdf/template.ts`; `src/lib/pdf/generator.ts` applies that template to course data.

To keep future character sets consistent, define their ordered `glyphs` mapping and PDF-safe `pdfFontUrl` in the course metadata. The web font can remain WOFF2, while the PDF companion should be TTF or OTF with the same glyph mapping. The generator automatically paginates larger character sets and balances tracing rows without changing the visual template.
