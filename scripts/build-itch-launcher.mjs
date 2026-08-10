import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = new URL('../', import.meta.url);
const templateUrl = new URL('itch/launcher/index.template.html', projectRoot);
const outputDirectoryUrl = new URL('itch/dist/', projectRoot);
const outputUrl = new URL('index.html', outputDirectoryUrl);
const urlArgumentIndex = process.argv.indexOf('--url');
const suppliedUrl =
	(urlArgumentIndex >= 0 ? process.argv[urlArgumentIndex + 1] : undefined) ??
	process.env.SCRIPTBOUND_PUBLIC_URL;

if (!suppliedUrl) {
	throw new Error('Pass the canonical deployment URL with --url or set SCRIPTBOUND_PUBLIC_URL.');
}

const publicUrl = new URL(suppliedUrl);
if (publicUrl.protocol !== 'https:') throw new Error('The public Scriptbound URL must use HTTPS.');
publicUrl.hash = '';

const template = await readFile(templateUrl, 'utf8');
const output = template.replace('__SCRIPTBOUND_PUBLIC_URL_JSON__', JSON.stringify(publicUrl.href));
if (output === template) throw new Error('The launcher template placeholder is missing.');

await mkdir(outputDirectoryUrl, { recursive: true });
await writeFile(outputUrl, output);
console.log(`Built ${fileURLToPath(outputUrl)} for ${publicUrl.href}`);
