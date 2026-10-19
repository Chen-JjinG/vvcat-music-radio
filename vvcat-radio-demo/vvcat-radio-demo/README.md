# VVcat Radio 重设计 Demo

这是按照《VVcat Radio 网站重设计方案 v2》制作的本地可运行网页原型。纯 HTML、CSS、JavaScript，无需安装前端框架或构建工具。

## 怎么预览

**最简单：** 解压后用 Chrome / Edge 打开 `index.html`。

如果浏览器在 `file://` 模式下限制本地音频，可以在项目目录运行一个简单静态服务器：

```bash
# Python 3
python -m http.server 8000
```

再打开 `http://localhost:8000`。

## 目前可体验的交互

- 顶部吸顶导航与手机折叠菜单；主要区块依次为介绍、收音机、作品展示。
- 右侧像素猫跑酷：点击开始，随后点击画面或聚焦游戏后按空格 / ↑ 跳跃；碰撞后可重新开始，最高分尝试保存在本地。
- 收音机曲目列表、上一首 / 播放暂停 / 下一首、进度、音量。
- 底部常驻播放器与收音机共享同一个音频实例和播放状态；可展开播放列表。
- 两个项目卡片、关于猫队长弹窗，以及合作联系的缺省提示。
- 窄屏布局、键盘焦点、减少动态效果设置。

## 请注意：这是 Demo，不是直接覆盖线上站点的正式版本

线上站点目前可读取到的内容包含品牌名、`MR-01 / LITTLE RADIO / LISTENING...`、关于这只猫的介绍文案、小猫标志、访客计数器和作者署名。本 Demo 保留并重新编排了这些可确认内容。

以下素材无法从线上页面当前可读取内容中取回，所以本 Demo 使用明确标有 Demo 的本地占位素材：

- `assets/audio/demo-track-01.wav` 至 `demo-track-03.wav` 是短合成演示音轨，并非你的正式音乐作品。
- `assets/cover-fuyu.svg`、`assets/cover-fuyu-zhaiji.svg` 及 `assets/covers/original-demo.svg` 是演示封面，不是游戏真实封面或正式专辑封面。
- `assets/logo.svg` 是根据线上可见的黑橙猫标志重绘的简化矢量稿；若项目中有原始 Logo 文件，正式整合时应替换。
- 当前 Demo 的音频列表是演示数据，并非声称复原线上实际曲目表。整合时应接回原站曲目数据源与音频文件。

## 接入真实素材

编辑 `js/config.js`：

- 将 `tracks` 改为实际曲目名称、说明和音频相对路径；把音频放到合适的 `assets/audio/` 目录，或按项目已有的音乐目录填写正确的 `src`。
- 在 `projectLinks.fuyu` 与 `projectLinks["fuyu-zhaiji"]` 填入已确认的真实项目页面地址。未填写时点击卡片会明确提示“演示封面 / 未配置地址”，不会伪造链接。
- 在 `contactUrl` 中填写真实的联系页面链接；为空时只显示配置提醒，不生成虚假邮箱。
- 替换两个合作封面为真实封面，并更新 HTML 中对应的 `img src` 与替代文字。
- 如果原站已经有访客计数器服务，正式合并时保留原计数器 URL / 配置；本 Demo 通过线上计数器图片地址展示，离线时会退回说明文字。

## 目录结构

```text
vvcat-radio-demo/
├── index.html
├── css/styles.css
├── js/app.js
├── js/config.js
├── assets/logo.svg
├── assets/cover-fuyu.svg
├── assets/cover-fuyu-zhaiji.svg
├── assets/covers/original-demo.svg
└── assets/audio/demo-track-*.wav
```

## 验收备注

这份原型旨在验证信息顺序、视觉风格、响应式排版和核心交互。接正式站点前仍需要把实际曲目数据 / 音频、原始猫咪插画、项目封面 / 地址及联系方式接回，并对真实站点的计数器配置做一次验证。
