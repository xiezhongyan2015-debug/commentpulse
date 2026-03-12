# CommentPulse 中文说明

CommentPulse 是一个给内容创作者用的评论分析插件项目。

它会读取视频评论，整理出重复出现的问题、用户一直在问但你没讲清楚的点，以及下一条内容可以怎么改。

当前仓库采用“客户端代码公开，线上服务端暂不公开”的方式。

## 这个仓库公开了什么

- `TubePulse/`：YouTube 插件客户端
- `BiliPulse-ext/`：Bilibili 插件客户端
- 页面数据提取逻辑
- 插件界面代码
- 本地历史记录与配置
- 打包脚本、商店素材生成脚本
- 开源说明、使用说明、安全说明

## 这个仓库没有公开什么

- 后端接口实现
- AI 提示词和线上分析流程
- 计费、试用、限频、反刷处理
- 生产环境密钥和运维配置
- 内部管理工具

## 为什么这样放

- 前端代码公开后，大家可以直接看插件做了什么，放心一些。
- 想自己改界面、接自己的后端、加别的平台，也更方便。
- 线上接口会产生实际成本，计费和限制部分也要单独维护，所以这部分暂时不放。

## 适合谁

- 想自己接一个后端把插件跑起来的人
- 想研究评论提取和插件交互写法的人
- 想帮忙改界面、修问题、补文档的人

## 快速开始

1. 拉下仓库

   ```bash
   git clone https://github.com/xiezhongyan2015-debug/commentpulse.git
   cd commentpulse
   ```

2. 选一个插件目录

   - `TubePulse/`
   - `BiliPulse-ext/`

3. 复制配置模板

   ```bash
   cp config.example.js config.js
   ```

4. 把 `config.js` 里的 `API_BASE_URL` 改成你自己的后端地址

5. 在 Chrome 的 `chrome://extensions` 打开开发者模式，加载对应目录

## 自己接后端时，至少要有这些接口

- `POST /analyze`
- `POST /competitor`
- `POST /improvement`
- `GET /usage`
- `GET /entitlements`
- `GET /trend`
- `DELETE /trend`
- `POST /waitlist`
- `POST /trial/start`
- `POST /events`，这个不是必须

`BiliPulse-ext/` 还需要：

- `POST /danmaku`

更完整的字段说明和接口说明，直接看根目录 [README.md](README.md)。

## 许可证

项目代码使用 `Apache-2.0`。

品牌名、图标、商店图不在自由使用范围里。你如果发自己的版本，建议换名字和视觉。

## 相关说明

- 公开范围：[OPEN_SOURCE_SCOPE.md](OPEN_SOURCE_SCOPE.md)
- 安全说明：[SECURITY.md](SECURITY.md)
- 贡献说明：[CONTRIBUTING.md](CONTRIBUTING.md)
- 品牌说明：[TRADEMARK.md](TRADEMARK.md)
