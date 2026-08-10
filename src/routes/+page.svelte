<script lang="ts">
	import AlphabetChart from '$lib/components/AlphabetChart.svelte';
	import Practice from '$lib/components/Practice.svelte';
	import ProgressDashboard from '$lib/components/ProgressDashboard.svelte';
	import PwaStatus from '$lib/components/PwaStatus.svelte';
	import TrialUnlockToast from '$lib/components/TrialUnlockToast.svelte';
	import { onMount } from 'svelte';
	import { copy, localeNames } from '$lib/i18n';
	import { locale, setLocale } from '$lib/stores/locale';
	import type { Locale, PracticeMode } from '$lib/types';
	import { currentCourse } from '$lib/app';
	import type { GlyphTrialTierId } from '$lib/learning/glyph-trial';
	let view = $state<'practice' | 'learn' | 'progress'>('practice'),
		fontReady = $state(false),
		practiceMistakes = $state(false),
		practiceTrial = $state(false),
		practiceTrialTier = $state<GlyphTrialTierId>('initiate'),
		practiceMode = $state<PracticeMode>('glyph'),
		practiceKey = $state(0);
	let t = $derived(copy[$locale]);
	onMount(async () => {
		try {
			fontReady = (await document.fonts.load(`16px ${currentCourse.fontFamily}`, 'abc')).length > 0;
		} catch {
			fontReady = false;
		}
		document.documentElement.classList.add(fontReady ? 'font-loaded' : 'font-pending');
	});
	function showPractice(mistakes = false, trialTier?: GlyphTrialTierId) {
		practiceMistakes = mistakes;
		practiceTrial = trialTier !== undefined;
		practiceMode = 'glyph';
		if (trialTier) practiceTrialTier = trialTier;
		practiceKey++;
		view = 'practice';
	}
	function showWords() {
		practiceMistakes = false;
		practiceTrial = false;
		practiceMode = 'word';
		practiceKey++;
		view = 'practice';
	}
</script>

<svelte:head
	><title>{t.document.title}</title><meta
		name="description"
		content={t.document.description}
	/></svelte:head
>
<header>
	<div class="brand-lockup">
		<a
			class="brand"
			href="/"
			onclick={(e) => {
				e.preventDefault();
				showPractice();
			}}>SCRIPT<span>BOUND</span></a
		>
		<a
			class="course-name"
			href={currentCourse.sourceUrl}
			target="_blank"
			rel="noreferrer"
			aria-label={t.courseSource(currentCourse.name)}
		>
			<span>{currentCourse.name}</span>
			<svg viewBox="0 0 16 16" aria-hidden="true">
				<path d="M6 3h7v7M13 3 5.5 10.5M11 9v4H3V5h4" />
			</svg>
		</a>
	</div>
	<div class="header-actions">
		<nav aria-label={t.nav.label}>
			<button class:current={view === 'practice'} onclick={() => showPractice()}
				>{t.nav.practice}</button
			><button class:current={view === 'learn'} onclick={() => (view = 'learn')}
				>{t.nav.alphabet}</button
			><button class:current={view === 'progress'} onclick={() => (view = 'progress')}
				>{t.nav.progress}</button
			>
		</nav>
		<label class="language-preference preference"
			><span>{t.language}</span><select
				value={$locale}
				onchange={(event) => setLocale(event.currentTarget.value as Locale)}
				>{#each Object.entries(localeNames) as [value, name]}<option {value}>{name}</option
					>{/each}</select
			></label
		>
	</div>
</header>
<main>
	{#if !fontReady}<aside class="font-notice">
			<strong>{t.font.title}</strong><span
				>{t.font.bodyStart} <code>{currentCourse.fontFileName}</code> {t.font.bodyEnd}</span
			>
		</aside>{/if}
	<PwaStatus />
	{#if view === 'practice'}<section>
			<p class="eyebrow">{t.practicePage.eyebrow}</p>
			<h1>{t.practicePage.title}</h1>
			<p class="lede">{t.practicePage.lede}</p>
			{#key `${practiceKey}-${$locale}`}<Practice
					startWithMistakes={practiceMistakes}
					startWithTrial={practiceTrial}
					startWithTrialTier={practiceTrialTier}
					startWithMode={practiceMode}
				/>{/key}
		</section>
	{:else if view === 'learn'}<section>
			<p class="eyebrow">{t.alphabetPage.eyebrow}</p>
			<h1>{t.alphabetPage.title}</h1>
			<p class="lede">{t.alphabetPage.lede}</p>
			<AlphabetChart />
		</section>
	{:else}<section>
			<p class="eyebrow">{t.progressPage.eyebrow}</p>
			<h1>{t.progressPage.title}</h1>
			<p class="lede">{t.progressPage.lede}</p>
			<ProgressDashboard onPracticeMistakes={() => showPractice(true)} />
		</section>{/if}
</main>
<footer>
	<span>{t.footer}</span>
	<span aria-hidden="true">·</span>
	<a href={currentCourse.sourceUrl} target="_blank" rel="noreferrer">{t.fontSource}</a>
</footer>
<TrialUnlockToast onOpenTrial={(tier) => showPractice(false, tier)} onOpenWords={showWords} />

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(:root) {
		--ink: #dfefed;
		--muted: #8ea9a7;
		--bg: #071315;
		--panel: #0d2225;
		--line: #285057;
		--accent: #40b5ae;
		--active-ink: #041314;
		--button: #123034;
		--field: #061012;
		--page-glow: #123c40;
		--card-start: #10292c;
		--card-end: #09191b;
		--feedback: #0a1b1d;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
		color: var(--ink);
		background: var(--bg);
	}
	:global(body) {
		margin: 0;
		min-width: 320px;
		background: radial-gradient(circle at 50% -20%, var(--page-glow) 0, transparent 42%), var(--bg);
	}
	:global(button),
	:global(input) {
		font: inherit;
	}
	:global(button) {
		border: 1px solid var(--line);
		border-radius: 0.4rem;
		color: var(--ink);
		background: var(--button);
		padding: 0.7rem 1rem;
		cursor: pointer;
	}
	:global(button:focus-visible) {
		border-color: var(--accent);
	}
	@media (hover: hover) {
		:global(button:hover) {
			border-color: var(--accent);
		}
	}
	:global(button.secondary) {
		background: transparent;
		color: var(--muted);
	}
	:global(.mode-tabs) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 2rem 0 1rem;
	}
	:global(.mode-tabs button.active) {
		color: var(--active-ink);
		background: var(--accent);
		border-color: var(--accent);
	}
	:global(.practice-card) {
		background: linear-gradient(145deg, var(--card-start), var(--card-end));
		border: 1px solid var(--line);
		padding: clamp(1.25rem, 4vw, 2.5rem);
		border-radius: 0.8rem;
		box-shadow: 0 30px 80px #0008;
	}
	:global(.session-meta) {
		display: flex;
		justify-content: space-between;
		color: var(--muted);
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	:global(.instruction) {
		text-align: center;
		color: var(--muted);
		margin: 2rem 0 0.5rem;
	}
	:global(.prompt) {
		display: grid;
		min-height: 180px;
		place-items: center;
		font-size: clamp(6rem, 18vw, 10rem);
	}
	:global(.prompt.long) {
		font-size: clamp(2rem, 7vw, 4rem);
		text-align: center;
	}
	:global(form) {
		max-width: 620px;
		margin: auto;
	}
	:global(label) {
		display: block;
		color: var(--muted);
		font-size: 0.8rem;
		margin-bottom: 0.45rem;
	}
	:global(input) {
		width: 100%;
		color: var(--ink);
		background: var(--field);
		border: 1px solid var(--line);
		border-radius: 0.4rem;
		padding: 0.9rem 1rem;
		font-size: 1.1rem;
	}
	:global(input:focus) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	:global(.actions) {
		display: flex;
		justify-content: flex-end;
		gap: 0.7rem;
		margin-top: 1rem;
	}
	:global(.feedback) {
		border: 1px solid;
		border-left-width: 5px;
		border-radius: 0.5rem;
		margin-top: 1rem;
		padding: 1rem;
		display: grid;
		gap: 0.5rem;
		background: var(--feedback);
	}
	:global(.feedback.success) {
		border-color: #78b888;
		background: linear-gradient(90deg, #193124, var(--feedback) 72%);
	}
	:global(.feedback.error) {
		border-color: #d07a6c;
		background: linear-gradient(90deg, #3a1e1c, var(--feedback) 72%);
	}
	:global(.feedback-heading) {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		font-size: 1.05rem;
	}
	:global(.feedback-icon) {
		display: grid;
		width: 1.75rem;
		height: 1.75rem;
		flex: 0 0 1.75rem;
		place-items: center;
		border: 1px solid currentcolor;
		border-radius: 50%;
		font-size: 1.2rem;
		font-weight: 800;
		line-height: 1;
	}
	:global(.feedback.success .feedback-heading) {
		color: #9bd3a7;
	}
	:global(.feedback.error .feedback-heading) {
		color: #efa095;
	}
	header {
		max-width: 1100px;
		margin: auto;
		min-height: 76px;
		padding: 0 1.25rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--line);
	}
	.brand {
		color: var(--ink);
		text-decoration: none;
		font-weight: 800;
		letter-spacing: 0.13em;
	}
	.brand-lockup {
		display: grid;
		gap: 0.22rem;
	}
	.brand span {
		color: var(--accent);
	}
	.course-name {
		display: inline-flex;
		width: fit-content;
		align-items: center;
		gap: 0.35rem;
		color: var(--muted);
		font-size: 0.66rem;
		font-weight: 650;
		letter-spacing: 0.16em;
		text-decoration: none;
		text-transform: uppercase;
	}
	.course-name svg {
		width: 0.8rem;
		height: 0.8rem;
		fill: none;
		stroke: currentcolor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.5;
	}
	.course-name:hover {
		color: var(--ink);
	}
	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}
	.language-preference {
		display: flex;
	}
	nav {
		display: flex;
		gap: 0.25rem;
	}
	nav button {
		border: 0;
		background: transparent;
		color: var(--muted);
	}
	nav button.current {
		color: var(--ink);
	}
	.preference {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
	}
	.preference span {
		font-size: 0.72rem;
	}
	.preference select {
		color: var(--ink);
		background: var(--button);
		border: 1px solid var(--line);
		border-radius: 0.4rem;
		padding: 0.45rem;
	}
	main {
		max-width: 900px;
		min-height: calc(100vh - 136px);
		margin: auto;
		padding: clamp(3rem, 8vw, 6rem) 1.25rem;
	}
	h1 {
		font:
			500 clamp(2.8rem, 8vw, 5.5rem) / 0.95 Georgia,
			serif;
		margin: 0.2rem 0 1rem;
		letter-spacing: -0.04em;
	}
	.eyebrow {
		color: var(--accent);
		letter-spacing: 0.2em;
		font-size: 0.72rem;
		font-weight: 700;
	}
	.lede {
		color: var(--muted);
		max-width: 620px;
		font-size: 1.1rem;
		line-height: 1.6;
	}
	.font-notice {
		display: flex;
		gap: 0.35rem;
		flex-direction: column;
		padding: 1rem;
		border: 1px solid #715c37;
		background: #261f14;
		margin-bottom: 2rem;
		border-radius: 0.4rem;
		font-size: 0.85rem;
	}
	.font-notice span {
		color: var(--muted);
	}
	footer {
		max-width: 1100px;
		margin: auto;
		padding: 1.25rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		color: var(--muted);
		border-top: 1px solid var(--line);
		font-size: 0.75rem;
	}
	footer a {
		color: inherit;
		text-underline-offset: 0.2em;
	}
	footer a:hover {
		color: var(--ink);
	}
	@media (max-width: 720px) {
		header {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: center;
			gap: 0.8rem;
			padding-top: 1rem;
			padding-bottom: 0.75rem;
		}
		.header-actions {
			display: contents;
		}
		nav {
			grid-column: 1 / -1;
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			min-width: 0;
			overflow: auto;
		}
		nav button {
			min-height: 44px;
			padding: 0.6rem 0.45rem;
		}
		.language-preference {
			grid-column: 2;
			grid-row: 1;
		}
		.language-preference span {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
		}
		.language-preference select {
			min-height: 44px;
		}
		main {
			padding-top: 2.75rem;
		}
	}
	@media (prefers-reduced-motion: no-preference) {
		:global(button) {
			transition:
				border-color 0.15s,
				background 0.15s;
		}
		:global(.feedback.success) {
			animation: feedback-success 0.35s ease-out;
		}
		:global(.feedback.error) {
			animation: feedback-error 0.3s ease-out;
		}
	}
	@keyframes feedback-success {
		0% {
			opacity: 0;
			transform: scale(0.98);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}
	@keyframes feedback-error {
		0%,
		100% {
			transform: translateX(0);
		}
		35% {
			transform: translateX(-4px);
		}
		70% {
			transform: translateX(4px);
		}
	}
</style>
