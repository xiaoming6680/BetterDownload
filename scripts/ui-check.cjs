// Requires Playwright. NBD_BROWSER_CHANNEL=msedge uses an installed Edge.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const version = require('../plugin/manifest.json').version;
(async () => {
    const browser = await chromium.launch({ headless: true, ...(process.env.NBD_BROWSER_CHANNEL ? { channel: process.env.NBD_BROWSER_CHANNEL } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width: 1080, height: 800 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('http://nbd.test/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#18191b;color:#e6e6e4"></body></html>' }));
        await page.goto('http://nbd.test/');
        await page.evaluate(version => {
            window.mock = { files: {}, calls: [], saved: null, listener: null, removed: 0 };
            window.sdk = { Storage: { downloadDir: 'D:\\CloudMusic' }, Bridge: {
                appendRegisterCall: (name, ns, cb) => { if (name !== 'addid3done' || ns !== 'storage') throw Error('wrong hook'); mock.listener = cb; },
                removeRegisterCall: (name, ns, cb) => { if (mock.listener === cb) mock.listener = null; mock.removed++; }
            } };
            const loader = Object.assign(() => {}, { c: { sdk: { exports: sdk } }, m: {} });
            window.webpackJsonp = []; webpackJsonp.push = chunk => Object.values(chunk[1])[0]({}, {}, loader);
            window.plugin = { pluginPath: 'C:/BetterNCM/plugins_runtime/ncm-better-download', manifest: { version }, getConfig: (_, v) => v, setConfig: (_, v) => { mock.saved = v; }, onConfig: cb => { window.configCallback = cb; }, onLoad: cb => { window.loadCallback = cb; } };
            window.betterncm = {
                fs: { exists: async p => p.endsWith('worker.exe') || p.endsWith('TagLibSharp.dll') || p.startsWith('D:\\') || p in mock.files,
                    mkdir: async () => true, readFileText: async p => mock.files[p] || '{}', writeFileText: async (p, s) => { mock.files[p] = s; return true; } },
                app: { getDataPath: async () => 'C:/BetterNCM', exec: async (...args) => { mock.calls.push(args); return true; } },
                ncm: { openUrl: url => mock.calls.push(url) }
            };
            window.betterncm_native = { fs: { writeFileText: (p, s) => { mock.files[p] = s; } } };
            window.control = () => JSON.parse(Object.entries(mock.files).find(([p]) => p.endsWith('control.json'))[1]);
            window.publish = activity => {
                const [file] = Object.entries(mock.files).find(([p]) => p.endsWith('control.json'));
                mock.files[file.replace('control.json', 'status.json')] = JSON.stringify({ session: control().session, heartbeat: Date.now(), state: activity.state === 'success' ? 'ready' : 'converting', message: '已就绪', converted: activity.state === 'success' ? 1 : 0, failed: 0, acknowledged: activity.state === 'success' ? [activity.id] : [], activity });
            };
        }, version);
        for (const file of ['download-hook.js', 'progress-card.js', 'main.js']) await page.addScriptTag({ path: path.resolve('plugin', file) });
        await page.evaluate(() => { document.body.appendChild(configCallback()); loadCallback(); });
        await page.waitForFunction(() => !!mock.listener && mock.calls.length > 0);
        assert.equal(await page.locator('.nbd-settings input').count(), 0);
        assert.equal(await page.locator('.nbd-settings button').count(), 1);
        assert.deepEqual(await page.evaluate(() => mock.calls[0]), ['"C:/BetterNCM/ncm-better-download/runtime-' + version + '/worker.exe"', false, false]);
        assert.equal(await page.evaluate(() => control().jobs.length), 0);
        await page.evaluate(() => { mock.listener('failed', 0, 'VipSongsDownload/failed.ncm'); mock.listener('ordinary', 1, 'ordinary.mp3'); });
        assert.equal(await page.evaluate(() => control().jobs.length), 0);
        await page.evaluate(() => mock.listener('task-1', 1, 'VipSongsDownload/歌手/夜间来信.ncm'));
        await page.waitForFunction(() => control().jobs.length === 1);
        const job = await page.evaluate(() => control().jobs[0]);
        assert.equal(job.target, 'D:\\CloudMusic\\VipSongsDownload\\unlock\\歌手\\夜间来信.ncm');
        await page.evaluate(job => publish({ id: job.id, state: 'converting', path: job.source, percent: 42 }), job);
        await page.waitForFunction(() => document.querySelector('#nbd-progress-card').shadowRoot.querySelector('.percent').textContent === '42%');
        const card = page.locator('#nbd-progress-card');
        fs.mkdirSync('build', { recursive: true });
        await page.waitForTimeout(400);
        assert.equal(Math.round((await card.boundingBox()).width), 270);
        await card.screenshot({ path: 'build/progress-converting.png' });
        // An idle progress card disappears completely, with no handle to reopen it.
        await page.waitForFunction(() => document.querySelector('#nbd-progress-card').style.display === 'none', null, { timeout: 9000 });
        await page.evaluate(job => publish({ id: job.id, state: 'converting', path: job.source, percent: 73 }), job);
        await page.waitForTimeout(350);
        assert.equal(await card.isVisible(), false);
        assert.equal(await page.getByRole('button', { name: '展开转换进度' }).count(), 0);
        await page.evaluate(job => publish({ id: job.id, state: 'success', path: job.source, output: job.target.replace(/\.ncm$/, '.flac'), percent: 100 }), job);
        const open = page.getByRole('button', { name: '打开文件夹' });
        await open.waitFor({ state: 'visible' });
        await page.waitForTimeout(400);
        assert.ok((await open.boundingBox()).width < 95);
        assert.ok((await card.boundingBox()).height < 135);
        assert.match(await card.locator('.card').evaluate(el => getComputedStyle(el).backdropFilter), /blur\(28px\)/);
        assert.equal(await card.locator('.label').textContent(), 'BetterDownload');
        await page.evaluate(() => { document.body.style.background = 'radial-gradient(ellipse at 100% 65%, #548198, transparent 43%), radial-gradient(ellipse at 65% 100%, #524b72, transparent 48%), #181c26'; document.body.style.minHeight = '100vh'; });
        await card.screenshot({ path: 'build/progress-card-preview.png' });
        await page.screenshot({ path: 'build/progress-complete.png' });
        await page.emulateMedia({ contrast: 'more' });
        assert.equal(await card.locator('.card').evaluate(el => getComputedStyle(el).backdropFilter), 'none');
        await page.emulateMedia({ contrast: 'no-preference' });
        // Keyboard focus should keep the action usable before it is activated.
        await open.focus();
        await page.waitForTimeout(6500);
        assert.equal(await card.isVisible(), true);
        await open.click();
        assert.deepEqual(await page.evaluate(() => mock.calls.at(-1)), ['"D:\\CloudMusic\\VipSongsDownload\\unlock\\歌手"', false, true]);
        assert.equal(await page.evaluate(() => !!document.querySelector('#nbd-progress-card').shadowRoot.activeElement), false);
        await page.mouse.move(10, 10);
        await page.waitForFunction(() => document.querySelector('#nbd-progress-card').style.display === 'none', null, { timeout: 9000 });
        await page.mouse.move(1075, 690);
        assert.equal(await card.isVisible(), false);
        // A native folder window can suppress mouseleave; blur must also release hover.
        await page.evaluate(job => publish({ id: job.id + '-blur', state: 'success', path: job.source, output: job.target.replace(/\.ncm$/, '.flac'), percent: 100 }), job);
        await open.waitFor({ state: 'visible' });
        await open.hover();
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await page.waitForFunction(() => document.querySelector('#nbd-progress-card').style.display === 'none', null, { timeout: 9000 });
        await page.getByRole('button', { name: '关闭插件', exact: true }).click();
        assert.equal(await page.evaluate(() => mock.saved), false);
        assert.equal(await page.evaluate(() => control().enabled), false);
        assert.equal(await page.evaluate(() => mock.listener), null);
        await page.getByRole('button', { name: '启用插件', exact: true }).click();
        assert.equal(await page.evaluate(() => !!mock.listener), true);
        assert.equal(await page.evaluate(() => control().enabled), true);
        await page.screenshot({ path: 'build/settings-preview.png' });
        await page.setViewportSize({ width: 420, height: 800 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: 'build/settings-preview-narrow.png' });
        await page.evaluate(() => window.__ncmBetterDownload.dispose());
        assert.equal(await card.count(), 0);
        assert.equal(await page.evaluate(() => mock.listener), null);
        assert.deepEqual(errors, []);
        console.log('UI passed: native completion event, fixed output, one toggle, 270px card, small folder link, idle disappearance, hover/focus, cleanup, narrow layout.');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
