# CF 资源采集记录

后续武器扩充已接入，仓库现有 14 件武器及各自切枪反馈。新增模型、动作、声音映射和处理说明见 [WEAPONS-SOURCES.md](WEAPONS-SOURCES.md)。下文保留首批采集记录。

本批资源已接入 RetroFront 本地离线游戏包，包括转换后的模型、选定动画和采样音效。已另行补齐 AK 开火声、旧版大厅循环音乐、通用点击声和男女死亡语音；新增文件来源、处理及 SHA-256 见 [AUDIO-SOURCES.md](AUDIO-SOURCES.md)。未上传 GitHub，未生成新的 IPA。原始模型归档和采集审计位于相邻 CF-Resources 目录。

2026-10-04 已另行导入 dustsanzo 的完整 CF DUST2 社区地图。BSP/WAD、44 张贴图、原光照、天空、哈希及 CC BY-NC-ND 4.0 声明见 [完整地图来源](../maps/desert-full/SOURCES.md)；该地图用于本地测试，公开衍生分发需先取得作者许可。

## 已获取

| 资源 | 文件及完整度 | 来源 |
|---|---|---|
| AK47 | 第一人称 MDL，42 骨骼、6 动画序列、4 内嵌贴图，3 个换弹 WAV；已从社区资源集补开火声，第三人称暂由第一人称枪体剔除手臂生成，缺独立原地面模型 | https://gamebanana.com/mods/223482 ，开火声见 [AUDIO-SOURCES.md](AUDIO-SOURCES.md) |
| M4 | 第一人称 MDL：42 骨骼、14 动画序列、7 贴图；地面模型：5 贴图；9 个 WAV。社区移植版迷彩外观已在项目浏览器中检查，尚未确认经典黑色默认皮肤 | https://gamebanana.com/mods/231106 |
| 奥摩 OMOH BL | terror.mdl：40 骨骼、111 动画序列；配套 terrorT.mdl：5 贴图。两文件必须一起保留，仅潜伏者阵营 | https://gamebanana.com/mods/227661 |
| 灵狐 FOX BL/GR | FOX-STAR 包中双方阵营，均 36 骨骼、111 动画序列，分别 6/5 贴图 | https://counter-strike-character-skin.blogspot.com/2014/06/crossfire-fox-star.html |
| 灵狐 GR 备用 | urban.mdl：38 骨骼、111 动画序列、4 贴图 | https://gamebanana.com/mods/228699 |
| STAR / SOV 双阵营（夜玫瑰候选） | FOX-STAR 包内 BL_SOV、GR_SOV，各 33 骨骼、111 动画序列、6 贴图。发布页称 STAR，文件称 SOV；尚未完成外观和国服名称核对 | 同 FOX-STAR 发布页 |
| 旧版大厅音乐 | `lobby_bgm.mp3`，源文件为社区保存的旧版 `MainMenu_Old.ogg` / `bgm_track1_loop`，完整 93.65 秒循环曲，转为 iOS 支持的 MP3 | [AUDIO-SOURCES.md](AUDIO-SOURCES.md) |
| 菜单点击声 | `ui_click.wav`，Kenney CC0 通用点击采样，用于点击、确认和返回反馈；不宣称为 CF 原版按钮声 | [AUDIO-SOURCES.md](AUDIO-SOURCES.md) |
| 男女死亡语音 | `death_male.wav` 与 `death_female.wav`，来自社区保存的经典男性及中文女性语音包；按角色性别共享，并非已确认的角色专属原声 | [AUDIO-SOURCES.md](AUDIO-SOURCES.md) |

FOX-STAR 原始公开下载页：https://www.mediafire.com/file/zdgp1p0143qag2a/FOX_%2526_STAR.rar/file
作者公开解压密码：female new 2

## 验证范围

- 初始 5 个模型压缩包均成功解压。系统 tar 对 FOX-STAR 报压缩兼容错误后，改用官方 7-Zip 成功解压全部文件。
- 4 个 GameBanana 包的实际字节数和 MD5 均与公开 API 元数据一致；FOX-STAR 无作者校验值，仅解压验证。
- 共 10 个 MDL 文件（含奥摩独立贴图文件），均为 IDST / version 10，实际长度与文件头声明相同。
- model-audit.json 记录文件头统计；这不是所有网格、动画帧、渲染效果的完整验证。
- sha256.json 是本地归档校验值；sources 保存网站公开元数据和许可字段。
- MDL 是 GoldSrc 格式，已通过本项目转换器提取网格、骨骼、贴图和选定动画到紧凑 JavaScript 蒙皮资源模块（不是 glTF/GLB），随离线脚本打包；手机真机的性能、动作及材质仍需验证。
- 111 表示动画序列条目数量，不代表 111 个 CF 原版动作。移植包可能使用 CS/Nexon 动画；AK 作者明确说明重新制作动画。
- AK/M4 的第三人称枪口、枪顶方向已统一，按双手位置与躯干方向附着；第一人称与展示模型保留各自用途。
- 新增 5 个音频文件均可完整解码且包含非静音内容。设置提供游戏声音总开关和独立大厅音乐开关；首次触摸解锁，进入战斗停音乐，暂停及后台停止声音，回大厅按设置恢复音乐。未完成 iPhone 真机或原生 IPA 编译验证。

## 后续优先级

1. 在目标手机上复测已接入的模型、动作、手部、第三人称持枪方向、音效与后台恢复。
2. 核对 STAR/SOV 外观；若与所需夜玫瑰不符，另选明确标注夜玫瑰的来源。
3. 补齐 AK 独立地面/第三人称原模型及奥摩保卫者版本；AK 开火声已补齐。
4. 根据真机性能继续优化当前离线蒙皮资源和贴图；是否迁移 GLB 按后续需要决定。

## 已定位但未下载

- https://vrcmods.com/item/6693 ：Crossfire 2.0 SAS，同系列包公开清单包含 CFAK47.FBX、CFM4.FBX、贴图、动画、音效；下载页要求验证码，未取得文件。
- https://vrcmods.com/item?id=6691 ：Crossfire 2.0 OMOH，未取得文件。
- https://steamcommunity.com/workshop/filedetails/?id=3581943473 ：明确标注 CF night rose 夜玫瑰的 XCOM2 移植模组，未取得文件。

## 来源与发布限制

云悠悠的紫发、蓝紫裙装和黑色长袜模型来自窝瓜先生的[社区移植包](https://www.lxres.com/RenWuWuQi/ZiZhiRenWu/2411.html)。原 SKC/BNC/TGA 与校验清单位于 `yunyouyou/`，版本取舍、动作适配和验证见 [云悠悠说明](../../../YUNYOUYOU.md)。CFHD 版本已从当前工程资源中替换。

这些是社区移植资源，不是官方授权开发资源包。AK、M4、奥摩页面标注 CC BY-NC-ND 4.0；灵狐页面的 porting whitelist 声明不是本项目的再分发授权。FOX-STAR 未确认可供本项目公开发布的授权。当前已按用户要求用于本地集成测试；公开仓库和 IPA 分发前仍需解决对应资源及移植内容的使用许可。

格式检查参考 Valve 官方 studio.h：https://github.com/ValveSoftware/halflife/blob/master/engine/studio.h
