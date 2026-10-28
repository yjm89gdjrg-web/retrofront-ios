# 击杀反馈素材 · 2026-10-04

本次内置 7 张透明 PNG 和 14 条 WAV。素材来自公开社区页面；没有使用原包中的 EXE、DLL 或修改游戏客户端的脚本。逐个文件的来源地址、原文件名和 SHA-256 见同目录 `manifest.json`。

## 图标

来源：[nta2005 / CustomKillmark](https://github.com/nta2005/CustomKillmark)，固定提交 `c7a308bfc339d947dc2d805f80d140f307fcab84`，目录 `#CustomKillmark/Hero_Classic_Killmark`。

| 项目文件 | 原文件 |
|---|---|
| `src/assets/killmarks/kill-1.png` 至 `kill-5.png` | `badge_multi1.PNG` 至 `badge_multi5.PNG` |
| `src/assets/killmarks/headshot.png` | `badge_headshot.PNG` |
| `src/assets/killmarks/knife.png` | `badge_knife.PNG` |

PNG 原样保存，仅重命名。击杀与爆头图标为 158×158，近战为 116×170；全部含透明通道。选择这套是因为一到五杀和特殊击杀资源完整。它是 Hero Classic 社区套组，并非已经核实的早期默认 CF 图标复刻。

## 音效

来源：[ElysiumLeoSK：CF Kill Marks/Effects](https://gamebanana.com/mods/39342)，下载编号 `2603`，压缩包 `cf_kill_marks.rar`。作者页将原作与配音归于 SmileGate，另列 Martin DJB、csoldjb、bluelytning 和 Mr.Headshot。

取用 `Choose Voice/Male/sound/vox/kill/`、`Choose Voice/Female/sound/vox/kill/` 两个目录中的 `kill_1.wav` 至 `kill_5.wav`、`headshot.wav`、`knife.wav`。

- 原 WAV 保存在本目录 `voices/`，以 `reward_male_*` / `reward_female_*` 重命名。
- 游戏用文件保存在 `assets-source/cf/audio/`，使用 FFmpeg 转成 22,050 Hz、单声道、16-bit PCM，保留完整长度，没有拼接或变调。
- 一杀文件是源包的一杀音效；不能将全部文件都理解为说出相应杀人数的语音。多杀档位按源包命名映射，未承诺国服指定角色专属台词。
- 男声用于奥摩，女声用于灵狐和 STAR；没有冒称各角色独立专属录音。
- 构建时写入 `src/generated/cf-sounds.js`，随离线游戏脚本打包。运行无需访问素材站点。

## 来源与使用范围

GitHub 图标目录未附独立再分发许可证；GameBanana 页面对源作者和移植来源的说明也不等于对本项目授予公开发行权。此记录用于当前本地原型的资源追溯，不作为 CF 官方授权证明。原作权利属于相应权利人；当前没有执行上传或公开发布。

## 已接入行为

玩家实际击杀敌方后显示徽章并播放对应性别音效；普通命中、队友击杀和重复伤害不会触发个人奖励。间隔不超过 8 秒的击杀累计到下一档，死亡、新回合会重置。8 秒是本原型设置，并非声称复刻了某个 CF 版本的精确计时。

第一杀若是爆头或近战，优先使用特殊图标和音效；二到五杀优先使用多杀档位，并在副标题注明爆头或近战。更高计数保留真实数字，图标与语音上限暂为五杀。新的播报替换旧播报，暂停、静音、返回大厅会停止待播声音；回合结束保留最后一次击杀播报。

当前已为 5v5；四杀、五杀通过正常五名敌人的连续击杀验证，最后一杀在回合结束时仍显示徽章并播放语音。

## 验证

自动检查 7 张 PNG 的透明通道与文件尺寸；14 条 PCM 的格式、非静音内容和生成数据一致性。Node 回归覆盖一至五杀、最后一杀与回合结束事件顺序、爆头/近战、死亡/跨回合重置和播报替换。浏览器检查包含两种横屏尺寸、一至五杀图标与 14 条音效解码。浏览器验证不替代 iPhone 真机听音和触控验证。
