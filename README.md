# BetterDownload

![BetterDownload](plugin/preview.jpg)

自动解锁下载的 VIP 歌曲。此 BetterNCM 插件在网易云正常完成下载后，将本地 NCM 提取为原始 FLAC / MP3，并把已有封面和歌曲信息写入音频文件。

当前为 **0.4.2 正式版**，本次仅更新商店预览图。自动化转换测试与界面回归已通过，作者已在 BetterNCM 1.3.4 环境确认真实下载转换验收成功，输出目录及歌曲标签正常。

## 使用方式

通过 BetterNCM 安装构建出的 `.plugin`，重启网易云。插件默认启用，设置页只有一个启用/关闭按钮。

歌曲完成下载和标签写入后开始转换，输出固定在实际下载位置的 `VipSongsDownload/unlock`，保留歌手子目录。例如：

```text
D:/CloudMusic/VipSongsDownload/歌手/歌曲.ncm
→ D:/CloudMusic/VipSongsDownload/unlock/歌手/歌曲.flac
```

右下角以 270px 亚克力卡片显示进度，完成后提供“打开文件夹”文字入口。鼠标或键盘焦点位于卡片时保持显示，离开并闲置 6 秒后向右完全退出，没有拉出入口。转换中已退出的卡片不会被普通进度更新反复唤回，任务完成可以单独提示一次。

## 行为

- 从当前客户端 SDK 获取真实下载路径，订阅 `storage.addid3done` 成功事件；不扫描音乐目录，不补处理历史文件。
- 自动识别 NCM 下载并启动转换；已是普通 FLAC / MP3 的下载不重复处理，也不弹出转换卡片。下载完成后没有出现转换卡片，可能是这首歌本来就无需解锁。
- 文件完成后直接入队；工作程序保持就绪，100ms 检查任务，界面 250ms 读取进度。文件仍被占用时短暂重试，没有固定 15 秒等待。
- 原始音频帧保持不变，不重新编码。NCM 内是 MP3 就输出 MP3，不会把它升级成 FLAC。
- 使用 TagLibSharp 嵌入已有封面、标题、专辑、歌手及曲目号，不生成封面或标签附属文件。源文件没有封面时不会联网补图。
- 保留 NCM 源文件，不覆盖已有同名音频，临时文件验证后才提交为正式输出。
- 关闭插件会撤销事件订阅并停止处理；关闭网易云后工作程序在心跳到期后退出。程序运行时不依赖第三方转换网站。

## 兼容性

Windows、BetterNCM >= 1.3.4、.NET Framework 4.6.2 或更新版本。下载接口面向网易云 3.x，已对照本机 3.1.37 前端源码核对，并在作者的 BetterNCM 1.3.4 环境通过真实下载转换验收；不保证全部 3.x 版本适用。未找到 SDK 时设置页提示等待接口，不会改为目录扫描。

支持 Windows 盘符路径；不处理 UNC 网络路径、目录链接或 `VipSongsDownload` 外的文件。程序和 DLL 随插件分发，用户无需安装 Node 或 Python。

## 构建与验证

Windows 下运行：

```powershell
./scripts/build.ps1
node --test tests/*.test.cjs
```

构建首次需要网络下载 NuGet 的固定版本 TagLibSharp，随后校验 SHA256；运行插件不需要该下载过程。输出在 `dist/`。

界面验证需要 Playwright 和浏览器：

```powershell
npm install --no-save playwright
$env:NBD_BROWSER_CHANNEL = 'msedge'
node scripts/ui-check.cjs
```

源码 `src/Worker.cs` 负责队列、容器提取和文件保护；`src/Metadata.cs` 负责内嵌标签；`plugin/download-hook.js` 负责原生下载事件；`plugin/progress-card.js` 与 `plugin/main.js` 负责界面和工作程序生命周期。

完整记录见 [验证文档](docs/VALIDATION.md)。商店登记、Actions 产物和 PR 步骤见 [发布指南](docs/PUBLISHING.md)。

## 开源

本项目采用 GPL-3.0-or-later，完整源码应随发布保持可获得。TagLibSharp 2.3.0 的 LGPL 许可证与源码地址见 `plugin/TAGLIB-LICENSE` 和 `plugin/NOTICE.md`。

作者：[XIAOMING6680](https://github.com/xiaoming6680)。[下载更新](https://github.com/xiaoming6680/BetterDownload/releases) · [问题反馈](https://github.com/xiaoming6680/BetterDownload/issues)。插件标识保留 `ncm-better-download`，支持已有开发版覆盖升级。
