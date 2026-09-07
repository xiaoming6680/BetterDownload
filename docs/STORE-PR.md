# 商店投稿草稿

标题：Add BetterDownload

BetterDownload 自动识别用户正常下载的 NCM 文件，下载完成后在本地转换为原始 FLAC / MP3，并内嵌已有封面与歌曲信息。普通 FLAC / MP3 无需转换。

输出保存在 `VipSongsDownload/unlock`，保留源文件及歌手子目录，不覆盖已有同名音频。提供单按钮启停和毛玻璃进度卡片。

- 作者：XIAOMING6680
- 源码仓库：https://github.com/xiaoming6680/BetterDownload
- 插件目录：`/plugin`，分支：`main`，slug：`ncm-better-download`
- Actions：https://github.com/xiaoming6680/BetterDownload/actions
- 提交时从对应 artifact 的 `build-info.json` 与 `SHA256SUMS.txt` 填入具体构建 run、源码 commit 和程序哈希。
- 设置页加载环境：BetterNCM 1.3.4；完整真实下载验收结果尚待填写。
- 代码许可：GPL-3.0-or-later；TagLibSharp 依赖附 LGPL 许可证及对应源码地址。
- 随包工作程序由 `betterncm.app.exec` 启动。运行时不依赖第三方转换网站，不扫描下载目录。

自动化测试不代替真实客户端验收；完成验收后再提交上架申请。
