# 商店投稿

标题：Add BetterDownload

BetterDownload 自动识别用户正常下载的 NCM 文件，下载完成后在本地转换为原始 FLAC / MP3，并内嵌已有封面与歌曲信息。普通 FLAC / MP3 无需转换。

输出保存在 `VipSongsDownload/unlock`，保留源文件及歌手子目录，不覆盖已有同名音频。提供单按钮启停和毛玻璃进度卡片。

- 作者：XIAOMING6680
- 源码仓库：https://github.com/xiaoming6680/BetterDownload
- 插件目录：`/plugin`，分支：`main`，slug：`ncm-better-download`
- 版本：0.4.1；发布：https://github.com/xiaoming6680/BetterDownload/releases/tag/v0.4.1
- 仓库内工作程序的源码提交：`7cb2286094b25f67d1280b0310a723045ac5ca49`。
- 工作程序编译：https://github.com/xiaoming6680/BetterDownload/actions/runs/34150136265 ，artifact `10029064170`。
- `worker.exe` SHA256：`3a35f028e85604374756ffcc45622433a392203a01ea20994ab3183aa81a6f56`。
- `TagLibSharp.dll` SHA256：`b1833a41ab1e933f7b006e5db15300b7223bfccc2c3b6689d49a9171dd27de1d`。
- 发布附件构建：https://github.com/xiaoming6680/BetterDownload/actions/runs/34150239609 ，源码提交 `94948be2666b352c40d8a18cbeb7701c17764c25`，附件提供构建信息及校验文件。
- 13 项转换与下载事件测试、Edge 界面回归通过。作者于 2026-09-08 在 BetterNCM 1.3.4 环境确认真实下载转换验收成功，输出目录及歌曲标签正常。此结果不代表全部客户端版本与插件组合均已实测。
- 预览图为压缩 JPG，960 × 480，42,960 字节；设置页提供可点击的源码和反馈入口。
- 代码许可：GPL-3.0-or-later；TagLibSharp 依赖附 LGPL 许可证及对应源码地址。
- 随包工作程序由 `betterncm.app.exec` 启动。运行时不依赖第三方转换网站，不扫描下载目录。

构建来源详见 [BUILD.md](BUILD.md)，验证范围详见 [VALIDATION.md](VALIDATION.md)。
