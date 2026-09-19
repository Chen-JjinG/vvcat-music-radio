# My Little Radio

基于 `music_radio_static_web_requirements.md` v1.1 制作的纯静态音乐作品展示页。

## 项目结构

```text
/
├── index.html
├── README.md
├── css/
│   └── style.css
├── js/
│   └── app.js
├── assets/
│   ├── logo/
│   │   └── logo.png
│   └── cat/
│       └── cat.png
└── music/
    ├── playlist.json
    ├── demo-summer.wav
    ├── demo-midnight.wav
    └── demo-rain.wav
```

## 更换自己的 LOGO / 小猫

直接替换以下文件即可，不需要修改 HTML / CSS / JavaScript：

- `assets/logo/logo.png`
- `assets/cat/cat.png`

LOGO 也可以改成 JPG / WEBP / SVG，但如果直接替换文件名，需保持 `logo.png` 路径；小猫建议使用透明背景 PNG。

## 添加自己的音乐

把音频文件放进 `music/`，然后编辑 `music/playlist.json`：

```json
[
  {
    "title": "My Song",
    "file": "my-song.mp3"
  }
]
```

`file` 是相对于 `music/` 的文件名。推荐使用英文 / 数字文件名，并优先使用 MP3。

## 本地预览

因为浏览器会限制直接以 `file://` 方式读取 `playlist.json`，本地预览建议在项目目录启动一个最简单的静态文件服务器，例如：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000/`。

部署到任意静态服务器时，直接上传整个目录即可，不需要 Node.js、后端 API 或数据库。

## 播放列表循环

打开 `js/app.js`，顶部配置：

```js
const PLAYER_CONFIG = {
  loopPlaylist: false,
  defaultVolume: 0.75,
  noteIntervalMs: 1250,
};
```

把 `loopPlaylist` 改成 `true` 即可让最后一首结束后回到第一首。
