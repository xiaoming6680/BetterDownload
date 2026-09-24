const { test } = require('node:test');
const assert = require('node:assert/strict');
const hook = require('../plugin/download-hook.js');
test('resolves completed native paths into VipSongsDownload/unlock retaining artist folders', () => {
    assert.deepEqual(hook.resolveJob('VipSongsDownload/歌手/歌曲.ncm', 'D:/CloudMusic'), { source: 'D:\\CloudMusic\\VipSongsDownload\\歌手\\歌曲.ncm', target: 'D:\\CloudMusic\\VipSongsDownload\\unlock\\歌手\\歌曲.ncm' });
    assert.equal(hook.resolveJob('E:/Music/VipSongsDownload/song.NCM', '').target, 'E:\\Music\\VipSongsDownload\\unlock\\song.NCM');
});
test('rejects incomplete paths, traversal, other formats, non-VIP files and unlocked folder', () => {
    for (const p of ['../VipSongsDownload/a.ncm', 'D:/VipSongsDownload/../a.ncm', 'VipSongsDownload/a.mp3', 'other/a.ncm', 'VipSongsDownload/unlock/a.ncm', 'D:/VipSongsDownload/a:ads.ncm', 'VipSongsDownload/"a.ncm']) assert.equal(hook.resolveJob(p, 'D:/CloudMusic'), null, p);
    assert.equal(hook.resolveJob('VipSongsDownload/a.ncm', ''), null);
});
test('a search covers only VipSongsDownload under a valid download directory', () => {
    assert.equal(hook.scanRoot('D:/CloudMusic/'), 'D:\\CloudMusic\\VipSongsDownload');
    for (const root of ['', 'CloudMusic', 'D:/Music/../x', undefined]) assert.equal(hook.scanRoot(root), '', String(root));
});
test('observes successful ID3 completion only; detaches its own listener; root changes apply immediately', async () => {
    let callback, removed; const jobs = [];
    const sdk = { Storage: { downloadDir: 'D:/Music' }, Bridge: {
        appendRegisterCall: (name, namespace, cb) => { assert.equal(name, 'addid3done'); assert.equal(namespace, 'storage'); callback = cb; },
        removeRegisterCall: (name, namespace, cb) => { removed = cb; }
    } };
    const detach = hook.attach(sdk, job => jobs.push(job));
    callback(1, 0, 'VipSongsDownload/a.ncm'); callback(2, 1, 'VipSongsDownload/a.ncm');
    sdk.Storage.downloadDir = 'E:/New'; callback(3, 1, 'VipSongsDownload/b.ncm');
    await Promise.resolve();
    assert.equal(jobs.length, 2); assert.equal(jobs[0].source, 'D:\\Music\\VipSongsDownload\\a.ncm'); assert.ok(jobs[1].source.startsWith('E:'));
    detach(); assert.equal(removed, callback);
});
test('SDK discovery inspects only cached exports and removes its own module', () => {
    const sdk = { Bridge: { appendRegisterCall() {}, removeRegisterCall() {} }, Storage: { downloadDir: '' } };
    const loader = Object.assign(() => { throw Error('client module execution is forbidden'); }, { c: { sdk: { exports: sdk } }, m: {} });
    const chunks = []; chunks.push = chunk => { const [id] = chunk[0]; loader.c[id] = {}; loader.m[id] = chunk[1][id]; chunk[1][id]({}, {}, loader); };
    assert.equal(hook.findSdk({ webpackJsonp: chunks }), sdk); assert.deepEqual(Object.keys(loader.c), ['sdk']); assert.deepEqual(Object.keys(loader.m), []);
    assert.equal(hook.findSdk({ webpackJsonp: [] }), null);
});
