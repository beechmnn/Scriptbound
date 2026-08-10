<script lang="ts">
	import { currentCourse } from '$lib/app';
	import { copy } from '$lib/i18n';
	import type { PdfKind, PdfPaper } from '$lib/pdf/types';
	import { locale } from '$lib/stores/locale';

	let activeDownload = $state<string | null>(null);
	let error = $state('');
	let t = $derived(copy[$locale].alphabetChart.pdf);

	function showPreviewLoading(preview: Window | null) {
		if (!preview) return;
		preview.opener = null;
		preview.document.title = t.generating;
		preview.document.body.style.cssText =
			'margin:0;min-height:100vh;display:grid;place-items:center;background:#f2efe7;color:#13282a;font:16px system-ui,sans-serif';
		const status = preview.document.createElement('p');
		status.textContent = t.generating;
		preview.document.body.replaceChildren(status);
	}

	async function openPdf(kind: PdfKind, paper: PdfPaper) {
		const downloadId = `${kind}-${paper}`;
		const preview = window.open('', '_blank');
		showPreviewLoading(preview);
		activeDownload = downloadId;
		error = '';
		try {
			const [{ generateCoursePdf }, fontResponse] = await Promise.all([
				import('$lib/pdf/generator'),
				fetch(currentCourse.pdfFontUrl),
			]);
			if (!fontResponse.ok) throw new Error(`Course font request failed: ${fontResponse.status}`);
			const bytes = await generateCoursePdf({
				kind,
				paper,
				course: currentCourse,
				copy: t.document,
				fontBytes: new Uint8Array(await fontResponse.arrayBuffer()),
			});
			const data = bytes.buffer.slice(
				bytes.byteOffset,
				bytes.byteOffset + bytes.byteLength,
			) as ArrayBuffer;
			const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
			if (preview && !preview.closed) preview.location.replace(url);
			else window.location.assign(url);
			setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
		} catch (cause) {
			console.error('PDF generation failed', cause);
			if (preview && !preview.closed) preview.close();
			error = t.failed;
		} finally {
			activeDownload = null;
		}
	}
</script>

<section class="downloads" aria-labelledby="pdf-downloads-title">
	<div class="downloads-intro">
		<p class="eyebrow">{t.eyebrow}</p>
		<h2 id="pdf-downloads-title">{t.title}</h2>
		<p>{t.body}</p>
	</div>
	<div class="download-options">
		<article>
			<div>
				<h3>{t.chartTitle}</h3>
				<p>{t.chartBody}</p>
			</div>
			<div class="download-actions">
				<button disabled={activeDownload !== null} onclick={() => openPdf('chart', 'a4')}
					>{activeDownload === 'chart-a4' ? t.generating : t.a4}</button
				>
				<button
					class="secondary"
					disabled={activeDownload !== null}
					onclick={() => openPdf('chart', 'letter')}
					>{activeDownload === 'chart-letter' ? t.generating : t.letter}</button
				>
			</div>
		</article>
		<article>
			<div>
				<h3>{t.tracingTitle}</h3>
				<p>{t.tracingBody}</p>
			</div>
			<div class="download-actions">
				<button disabled={activeDownload !== null} onclick={() => openPdf('tracing', 'a4')}
					>{activeDownload === 'tracing-a4' ? t.generating : t.a4}</button
				>
				<button
					class="secondary"
					disabled={activeDownload !== null}
					onclick={() => openPdf('tracing', 'letter')}
					>{activeDownload === 'tracing-letter' ? t.generating : t.letter}</button
				>
			</div>
		</article>
	</div>
	{#if error}<p class="download-error" role="alert">{error}</p>{/if}
</section>

<style>
	.downloads {
		margin-top: 3rem;
		padding-top: 2rem;
		border-top: 1px solid var(--line);
	}
	.downloads-intro {
		max-width: 620px;
	}
	.downloads-intro h2 {
		margin: 0.3rem 0 0.65rem;
		font:
			500 clamp(2rem, 6vw, 3.5rem) / 1 Georgia,
			serif;
		letter-spacing: -0.035em;
	}
	.downloads-intro > p:last-child,
	article p {
		color: var(--muted);
		line-height: 1.55;
	}
	.download-options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.8rem;
		margin-top: 1.5rem;
	}
	article {
		display: flex;
		min-height: 190px;
		flex-direction: column;
		justify-content: space-between;
		gap: 1.2rem;
		padding: 1.25rem;
		border: 1px solid var(--line);
		border-radius: 0.65rem;
		background: linear-gradient(145deg, var(--card-start), var(--card-end));
	}
	h3 {
		margin: 0;
		font-size: 1.1rem;
	}
	article p {
		margin-bottom: 0;
		font-size: 0.9rem;
	}
	.download-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.download-actions button {
		flex: 1 1 110px;
	}
	button:disabled {
		cursor: wait;
		opacity: 0.65;
	}
	.download-error {
		margin: 1rem 0 0;
		color: #efa095;
	}
</style>
