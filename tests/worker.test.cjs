const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, spawn } = require('node:child_process');
const { fixture, u32 } = require('./ncm-fixture.cjs');
const worker = path.resolve('plugin/worker.exe');
const audio = ext => fs.readFileSync(path.join(__dirname, 'fixtures/tone.' + ext));
const cover = fs.readFileSync(path.join(__dirname, 'fixtures/cover.png'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function setup(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nbd-测试 空格-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const input = path.join(root, 'VipSongsDownload'), output = path.join(input, 'unlock'), state = path.join(root, 'state');
    fs.mkdirSync(input);
    const config = { state, jobs: [], enabled: true, session: 'test', heartbeat: Date.now() };
    const control = path.join(root, 'control.json');
    const save = () => fs.writeFileSync(control, JSON.stringify(config)); save();
    const run = () => spawnSync(worker, ['--once', control], { encoding: 'utf8', timeout: 30000, windowsHide: true });
    const job = (name, bytes) => {
        const source = path.join(input, name), target = path.join(output, name);
        fs.mkdirSync(path.dirname(source), { recursive: true }); fs.writeFileSync(source, bytes);
        config.jobs.push({ id: 'job-' + (config.jobs.length + 1), source, target }); save();
        return { source, target };
    };
    const copy = () => { for (const name of ['worker.exe', 'TagLibSharp.dll']) fs.copyFileSync(path.resolve('plugin', name), path.join(root, name)); return path.join(root, 'worker.exe'); };
    const status = () => JSON.parse(fs.readFileSync(path.join(root, 'status.json')));
    return { root, input, output, state, config, control, save, run, job, copy, status };
}
// Compare encoded audio frames independently of TagLib; tags may move/change size.
function frames(bytes, ext) {
    if (ext === 'flac') {
        assert.equal(bytes.subarray(0, 4).toString(), 'fLaC');
        let p = 4, last = false;
        while (!last) { last = !!(bytes[p] & 128); p += 4 + bytes.readUIntBE(p + 1, 3); }
        return bytes.subarray(p);
    }
    let start = 0, end = bytes.length;
    if (bytes.subarray(0, 3).toString() === 'ID3') start = 10 + ((bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9]);
    if (bytes.subarray(end - 128, end - 125).toString() === 'TAG') end -= 128;
    return bytes.subarray(start, end);
}
for (const ext of ['flac', 'mp3']) test(ext + ': native job preserves audio frames, embeds cover/title/album/artist, no sidecars, receipt reuse', t => {
    const s = setup(t), original = audio(ext), encoded = fixture(original);
    const job = s.job('歌手/歌曲.ncm', encoded);
    assert.equal(s.run().status, 0, JSON.stringify(s.status()));
    const output = job.target.replace(/\.ncm$/, '.' + ext), converted = fs.readFileSync(output);
    assert.deepEqual(frames(converted, ext), frames(original, ext));
    assert.ok(converted.includes(cover));
    for (const title of ['合成测试', '测试专辑', '测试歌手']) assert.ok(converted.includes(Buffer.from(title, 'utf8')) || converted.includes(Buffer.from(title, 'utf16le')), title);
    assert.deepEqual(fs.readFileSync(job.source), encoded);
    assert.deepEqual(fs.readdirSync(path.dirname(output)), ['歌曲.' + ext]);
    assert.equal(s.status().activity.state, 'success');
    assert.equal(s.status().activity.percent, 100);
    assert.deepEqual(s.status().acknowledged, ['job-1']);
    assert.equal(s.run().status, 0); assert.equal(fs.readdirSync(path.dirname(output)).length, 1);
    fs.unlinkSync(output); assert.equal(s.run().status, 0); assert.ok(fs.existsSync(output));
});
test('no metadata/cover, filename conflicts and changed source preserve existing files', t => {
    const s = setup(t), job = s.job('歌曲.ncm', fixture(audio('mp3'), { metadata: false, cover: Buffer.alloc(0) }));
    fs.mkdirSync(s.output); const existing = path.join(s.output, '歌曲.mp3'); fs.writeFileSync(existing, 'keep');
    assert.equal(s.run().status, 0); assert.equal(fs.readFileSync(existing, 'utf8'), 'keep');
    assert.deepEqual(frames(fs.readFileSync(path.join(s.output, '歌曲 (2).mp3')), 'mp3'), frames(audio('mp3'), 'mp3'));
    fs.writeFileSync(job.source, fixture(audio('mp3')));
    assert.equal(s.run().status, 0); assert.ok(fs.existsSync(path.join(s.output, '歌曲 (3).mp3')));
});
test('malformed/truncated containers, oversized key and unknown audio fail without leftovers', t => {
    const s = setup(t);
    s.job('bad.ncm', Buffer.from('wrong file'));
    s.job('truncated.ncm', fixture(audio('flac')).subarray(0, 38));
    s.job('oversized.ncm', Buffer.concat([Buffer.from('CTENFDAM'), Buffer.alloc(2), u32(0xffffffff)]));
    s.job('unknown.ncm', fixture(Buffer.from('OggS123')));
    assert.equal(s.run().status, 1);
    assert.equal(s.status().failed, 4);
    assert.ok(!fs.existsSync(s.output) || fs.readdirSync(s.output).length === 0);
});
test('only queued files are processed; pre-existing directory contents are never scanned', t => {
    const s = setup(t); fs.writeFileSync(path.join(s.input, 'unrequested.ncm'), fixture(audio('flac')));
    assert.equal(s.run().status, 0); assert.ok(!fs.existsSync(s.output));
});
test('output outside VipSongsDownload/unlock is rejected', t => {
    const s = setup(t); s.job('song.ncm', fixture(audio('flac')));
    s.config.jobs[0].target = path.join(s.root, 'outside.ncm'); s.save();
    assert.equal(s.run().status, 1); assert.ok(!fs.existsSync(path.join(s.root, 'outside.flac')));
});
test('Windows source lock, cancellation cleanup and changed-source protection', t => {
    const s = setup(t), job = s.job('locked.ncm', fixture(audio('flac'))); fs.mkdirSync(s.output); s.copy();
    const harness = path.join(s.root, 'checks.exe');
    const compiler = path.join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
    const build = spawnSync(compiler, ['/nologo', '/target:exe', '/out:' + harness, '/reference:' + worker, path.resolve('tests/WorkerUnit.cs')], { encoding: 'utf8', windowsHide: true });
    assert.equal(build.status, 0, build.stdout + build.stderr);
    const run = spawnSync(harness, [job.source, job.target], { encoding: 'utf8', windowsHide: true });
    assert.equal(run.status, 0, run.stdout + run.stderr);
});
test('expired heartbeat prevents a queued background conversion', t => {
    const s = setup(t); s.job('song.ncm', fixture(audio('flac'))); s.config.heartbeat = Date.now() - 60000; s.save();
    const run = spawnSync(s.copy(), [], { timeout: 5000, windowsHide: true });
    assert.equal(run.status, 0); assert.ok(!fs.existsSync(s.output));
});
test('warm worker processes an event promptly and exits when disabled', { timeout: 12000 }, async t => {
    const s = setup(t), child = spawn(s.copy(), [], { windowsHide: true, stdio: 'ignore' });
    const exited = new Promise(resolve => child.once('exit', resolve));
    t.after(async () => { if (child.exitCode === null) { child.kill(); await exited; } });
    const readyDeadline = Date.now() + 4000;
    while (!fs.existsSync(path.join(s.root, 'status.json')) && Date.now() < readyDeadline) await sleep(30);
    assert.equal(s.status().state, 'ready');
    const start = Date.now(); s.job('new.ncm', fixture(audio('flac')));
    const output = path.join(s.output, 'new.flac');
    while (!fs.existsSync(output) && Date.now() - start < 3500) await sleep(30);
    assert.ok(fs.existsSync(output), 'should not wait for directory scanning or a fixed stability delay');
    assert.deepEqual(frames(fs.readFileSync(output), 'flac'), frames(audio('flac'), 'flac'));
    s.config.enabled = false; s.save();
    assert.equal(await Promise.race([exited, sleep(3000).then(() => 'timeout')]), 0);
});
