# 商店更新说明

BetterDownload 0.5.0 修复状态文件读写冲突造成的误报与转换程序退出；封面或标签写入失败时仍保存音频；转换程序改为按需启动；新增“转换已有下载”；重新设计进度卡片（专辑封面、环境光、本轮计数）与设置页。

- 源码：https://github.com/xiaoming6680/BetterDownload
- 发布：https://github.com/xiaoming6680/BetterDownload/releases/tag/v0.5.0
- 作者：XIAOMING6680
- `worker.exe` 由固定版本的 Roslyn 确定性编译，可按 [BUILD.md](BUILD.md) 重新构建并比对哈希。
- 版本安装包由标签对应的 Actions 构建，发布附件附构建信息与校验文件。

首次登记 #737 已合并；0.4.1 同步申请为 #750。0.5.0 正式包已在作者本机网易云中完成真实下载转换验收，见 [VALIDATION.md](VALIDATION.md)。
