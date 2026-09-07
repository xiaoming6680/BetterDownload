# BetterDownload 发布流程

源码仓库：[xiaoming6680/BetterDownload](https://github.com/xiaoming6680/BetterDownload)。作者：XIAOMING6680。

## 构建与分发

1. 修改代码后同步递增 `plugin/manifest.json` 和 `package.json` 版本。
2. 推送 `main`，等待 `Build and test plugin` 工作流通过。工作流编译程序、验证依赖哈希、运行测试并生成源码包。
3. 下载 `BetterDownload` artifact。`dist/build-info.json` 记录对应源码提交与构建地址，`dist/SHA256SUMS.txt` 记录产物哈希。
4. 商店同步源码仓库的 `plugin/` 目录。将对应 Actions 产物 `worker.exe` 和 `TagLibSharp.dll` 放回该目录并提交：

```powershell
git add -f plugin/worker.exe plugin/TagLibSharp.dll
git commit -m 'Update Actions build artifacts'
git push
```

5. 推送 `v版本号` 标签后，工作流还会生成正式命名的 `.plugin`。将该 Actions 产物、源码包与校验文件作为 GitHub Release 附件；未经完整客户端验收的版本标记为 Pre-release。

工作程序与依赖变化时必须递增版本，避免使用之前版本的运行副本。禁止把本地编译程序标记为 Actions 产物。

## 客户端验收

已知设置页加载环境为 BetterNCM 1.3.4。下载接口对照网易云 3.1.37 前端资源核对，完整下载链路需在发布前验收：

- NCM 内分别为 FLAC 和 MP3 的下载均能转换、播放并显示内嵌封面和中文标签。
- 输出位于 `VipSongsDownload/unlock`，保留源文件和歌手子目录，同名输出不覆盖。
- 验证下载失败、暂停恢复、连续下载、修改下载位置、启停及常用主题兼容性。
- 普通 FLAC / MP3 不触发转换。
- 卡片闲置后完全退出，点击文件夹或窗口失焦后不会卡住。

## BetterNCM 商店投稿

遵循[官方投稿流程](https://github.com/BetterNCM/BetterNCM-Plugins#插件提交及更新)与[上架准则](https://github.com/std-microblock/chromatic/wiki/插件商店上架插件方式及准则)。原生工作程序使用 Actions 编译，插件目录中保留运行文件、预览图与必要许可证。

向官方库 `plugins-list/ncm-better-download.json` 提交以下登记内容：

```json
{
  "name": "BetterDownload",
  "repo": "xiaoming6680/BetterDownload",
  "branch": "main",
  "subpath": "/plugin",
  "author": "XIAOMING6680"
}
```

PR 附对应源码 commit、Actions run 和真实客户端验收结果。初次上架经维护者审核后，官方脚本会定期检查 manifest 版本更新。投稿正文草稿见 [STORE-PR.md](STORE-PR.md)。

## 本地维护工具

`scripts/check-release.ps1 -Release` 检查版本、作者、仓库链接、运行文件和许可证；`scripts/package-source.ps1` 生成不含运行数据和二进制的源码包。`scripts/configure-release.ps1` 可在仓库迁移时更新作者及链接信息。

TagLibSharp 2.3.0 为未修改的 LGPL 依赖，附带许可证与对应源码链接。保留可替换 DLL 的结构。
