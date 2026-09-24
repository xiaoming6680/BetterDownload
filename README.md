# BetterDownload

![BetterDownload](plugin/preview.jpg)

自动解锁下载的 VIP 歌曲。此 BetterNCM 插件在网易云正常完成下载后，将本地 NCM 提取为原始 FLAC / MP3，并把已有封面和歌曲信息写入音频文件。

当前为 **0.5.0**：修复状态文件读写冲突造成的误报和转换程序退出，封面或标签写入失败时仍保存音频，转换程序改为按需启动，新增“转换已有下载”，并重新设计进度卡片与设置页。自动化转换测试与界面回归已通过；0.5.0 尚待真实客户端下载验收（0.4.1 已在作者的 BetterNCM 1.3.4 环境验收）。

## 使用方式

通过 BetterNCM 安装构建出的 `.plugin`，重启网易云。插件默认启用，设置页提供启用开关、“转换已有下载”和进度卡片设置：弹出时机可选“每首歌”“仅出错”或“不显示”，样式可选“标准”或更小的单行“简洁”，停留时间可选 2、4 或 6 秒，并可直接预览。

歌曲完成下载和标签写入后开始转换，输出固定在实际下载位置的 `VipSongsDownload/unlock`，保留歌手子目录。例如：

```text
D:/CloudMusic/VipSongsDownload/歌手/歌曲.ncm
→ D:/CloudMusic/VipSongsDownload/unlock/歌手/歌曲.flac
```

右下角以 270px 亚克力卡片显示进度：左侧是歌曲内嵌的专辑封面，玻璃按封面主色带一层淡淡的环境光；标签显示音频格式，连续下载时显示本轮进度（第几首、还剩几首），完成后提供“打开文件夹”。鼠标或键盘焦点位于卡片时保持显示，离开后按设置的停留时间（默认 4 秒）向右完全退出，没有拉出入口。转换中已退出的卡片不会被普通进度更新反复唤回，任务完成可以单独提示一次。

## 行为

- 从当前客户端 SDK 获取真实下载路径，订阅 `storage.addid3done` 成功事件；平时不扫描音乐目录。
- “转换已有下载”只在用户点击时查找下载目录下的 `VipSongsDownload`（跳过 `unlock`）；转换过或 `unlock` 中已有同名音频的歌曲不会重复加入。
- 自动识别 NCM 下载并启动转换；已是普通 FLAC / MP3 的下载不重复处理，也不弹出转换卡片。下载完成后没有出现转换卡片，可能是这首歌本来就无需解锁。
- 有任务时才启动转换程序，空闲 1 分钟后自动退出；转换时界面 250ms 读取进度，空闲时放慢到 1–2 秒。文件仍被占用时短暂重试，没有固定 15 秒等待。
- 原始音频帧保持不变，不重新编码。NCM 内是 MP3 就输出 MP3，不会把它升级成 FLAC。
- 使用 TagLibSharp 嵌入已有封面、标题、专辑、歌手及曲目号，不生成封面或标签附属文件。源文件没有封面时不会联网补图。封面格式无法识别或标签写入失败时仍保存完整音频，并在卡片上说明。
- 保留 NCM 源文件，不覆盖你已有的同名音频（另存为“歌曲 (2)”）；同一首歌重新下载时，只更新插件此前生成且未被改动的文件，不再堆积副本。临时文件验证后才提交为正式输出。
- 转换程序无法启动（例如被安全软件拦截）时，卡片和设置页会提示，并给出需要信任的文件路径。
- 关闭插件会撤销事件订阅并停止处理；关闭网易云后转换程序在心跳到期后退出。旧版本留下的运行副本在启动约 20 秒后清理。程序运行时不依赖第三方转换网站。

## 兼容性

Windows、BetterNCM >= 1.3.4、.NET Framework 4.6.2 或更新版本。下载接口面向网易云 3.x，已对照本机 3.1.37 前端源码核对，并在作者的 BetterNCM 1.3.4 环境通过真实下载转换验收；不保证全部 3.x 版本适用。未找到 SDK 时设置页提示等待接口，不会改为目录扫描。

支持 Windows 盘符路径；不处理 UNC 网络路径、目录链接或 `VipSongsDownload` 外的文件。程序和 DLL 随插件分发，用户无需安装 Node 或 Python。

## 构建与验证

Windows 下运行：

```powershell
npm run build
npm test
```

构建首次需要网络从 NuGet 下载固定版本的 TagLibSharp 和 Roslyn 编译器（Microsoft.Net.Compilers.Toolset 5.9.0），并校验 SHA256；运行插件不需要该下载过程。输出在 `dist/`。

编译启用 `/deterministic`：同一份源码在任何 Windows 机器上编出的 `worker.exe` 逐字节一致，Actions 会核对仓库中的程序是否由当前源码构建，见 [构建来源](docs/BUILD.md)。

界面验证需要 Playwright 和浏览器：

```powershell
npm install --no-save playwright
$env:NBD_BROWSER_CHANNEL = 'msedge'
node scripts/ui-check.cjs
```

脚本会把卡片与设置页（深色、浅色、窄窗口）截图写入 `build/`，便于目视检查。

源码 `src/Worker.cs` 负责队列、容器提取和文件保护；`src/Metadata.cs` 负责内嵌标签；`plugin/download-hook.js` 负责原生下载事件；`plugin/progress-card.js` 与 `plugin/main.js` 负责界面和工作程序生命周期。

完整记录见 [验证文档](docs/VALIDATION.md)。商店登记、Actions 产物和 PR 步骤见 [发布指南](docs/PUBLISHING.md)。

## 开源

本项目采用 GPL-3.0-or-later，完整源码应随发布保持可获得。TagLibSharp 2.3.0 的 LGPL 许可证与源码地址见 `plugin/TAGLIB-LICENSE` 和 `plugin/NOTICE.md`。

作者：[XIAOMING6680](https://github.com/xiaoming6680)。[下载更新](https://github.com/xiaoming6680/BetterDownload/releases) · [问题反馈](https://github.com/xiaoming6680/BetterDownload/issues)。插件标识保留 `ncm-better-download`，支持已有开发版覆盖升级。
