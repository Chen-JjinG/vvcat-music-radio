/*
 * 站点配置。
 * 添加新曲子：把音频文件放进 music/ 目录，然后在 tracks 里追加一条记录。
 *   title    显示名（会出现在收音机屏幕和底栏）
 *   subtitle 风格标签（简短说明即可）
 *   src      音频相对路径
 * 项目链接：合作作品卡片「项目详情」的跳转地址，留空时点击会提示去配置。
 * 联系方式：显示在「合作联系」卡片里，点击即可复制 QQ 号。
 */
window.VVCAT_CONFIG = {
  tracks: [
    { title: "凯尔特 · Celtic", subtitle: "凯尔特 / 民谣", src: "music/01-celtic.mp3" },
    { title: "Lo-Fi", subtitle: "Lo-Fi / 弛放", src: "music/02-lofi.mp3" },
    { title: "HyperPop", subtitle: "电子 / HyperPop", src: "music/03-hyperpop.mp3" },
    { title: "雨天华尔兹 · Rainy Waltz", subtitle: "钢琴 / 华尔兹", src: "music/04-rainy-waltz.mp3" },
    { title: "幽暗悬疑 · Dark Suspense", subtitle: "氛围 / 悬疑", src: "music/05-dark-suspense.mp3" },
    { title: "8-Bit", subtitle: "8-Bit / 像素", src: "music/06-8bit.mp3" },
    { title: "搞怪小曲 · Quirky Tune", subtitle: "轻快 / 搞怪", src: "music/07-quirky-tune.mp3" },
    { title: "氛围 · Ambient", subtitle: "氛围 / 环境", src: "music/08-ambient.mp3" },
    { title: "伪爵士 · Pseudo Jazz", subtitle: "爵士 / 慵懒", src: "music/09-pseudo-jazz.mp3" },
    { title: "Boss Battle", subtitle: "战斗 / 电子", src: "music/10-boss-battle.mp3" },
    { title: "王国城堡 · Kingdom Castle", subtitle: "管弦 / 场景", src: "music/11-kingdom-castle.mp3" }
  ],
  projectLinks: {
    // 《缚语》是月费连载作品，爱发电没有单独商品页，指向桔桔的主页（可看到作品介绍与发电入口）
    fuyu: "https://afdian.com/a/orangeJuJu",
    // 《缚育宅姬》在爱发电电铺有独立售卖页
    "fuyu-zhaiji": "https://afdian.com/item/c47675b2b7ba11f1b4f252540025c377"
  },
  contacts: [
    { name: "vvcat", qq: "1790993370" },
    { name: "桔大", qq: "2291571658" }
  ]
};
