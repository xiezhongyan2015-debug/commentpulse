# BiliPulse 前端说明

这是 `BiliPulse` 插件的新前端工程，基于下面这些东西：

- `WXT`
- `React`
- `Tailwind CSS`

## 常用命令

```bash
npm install
npm run dev
npm run build
npm run assets:store
npm run zip
```

## 本地开发

```bash
npm run dev
```

开发版构建结果会放在：

```bash
.output/chrome-mv3
```

在 Chrome 里本地加载插件时，选这个目录，不要直接选仓库里旧的静态文件。

## 生产构建

```bash
npm run build
```

## 生成可测试的正式包

```bash
npm run zip
```

这条命令会做几件事：

1. 构建正式插件
2. 生成发布前暂存目录
3. 从 zip 里去掉 `showcase.html` 和对应资源
4. 输出可上传测试的压缩包

默认输出位置：

```bash
.output/bilipulse-ext-1.1.1-chrome.zip
```

## 运行时配置

当前运行时读取：

```bash
public/config.js
```

这里面会挂一个 `window.APP_CONFIG`。

默认配置是：

- `API_BASE_URL`：`https://bilipulse-api.xiezhongyan2015.workers.dev`
- `OFFICIAL_SITE_URL`：`https://github.com/xiezhongyan2015-debug/commentpulse`

如果你要接你自己的后端，优先改这个文件，或者复制 `public/config.example.js` 自己出一份配置。

## 商店素材

自动生成命令：

```bash
npm run assets:store
```

它会自动：

1. 构建插件
2. 打开 `showcase` 页面
3. 生成 5 张商店截图
4. 生成 1 张宣传图

生成目录：

```bash
pictures/store/generated
```

## 目录说明

- `entrypoints/sidepanel`：插件主界面
- `entrypoints/showcase`：商店截图和展示页
- `entrypoints/background.ts`：点击图标后打开 side panel
- `entrypoints/content.ts`：B 站页面评论和弹幕提取
- `components/`：通用界面组件和业务组件
- `lib/`：接口请求、B 站辅助逻辑、类型和测试数据

## 补充说明

根目录里旧的 `popup.html`、`popup.js`、`popup.css`、`manifest.json` 还保留着，主要是为了兼容以前的实现和做对照。

现在真正的正式入口是 WXT 构建产物。`npm run zip` 会在打包时把展示页去掉，再生成给商店或测试用的包。
