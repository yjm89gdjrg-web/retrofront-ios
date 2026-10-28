# 新增音频来源（2026-10-03）

本批文件用于本地离线集成。只选取独立音乐、音效及公开语音包中的短片段；没有下载完整游戏客户端。已有 M4 和换弹音效的来源见 `SOURCES.md`。

| 本地文件 | 来源与选取文件 | 格式、长度及处理 |
|---|---|---|
| `audio/lobby_bgm.mp3` | [CrossFire Wiki — Music](https://crossfirefps.fandom.com/wiki/Music) 的旧版 Main Menu (#1)，[文件说明页](https://crossfirefps.fandom.com/wiki/File:MainMenu_Old.ogg) | 源 OGG 标题为 `bgm_track1_loop`；93.65 秒、44.1 kHz 双声道。完整转为 128 kbps MP3，约 1.50 MB；无裁剪或重新编曲。MP3 容器时长 93.70 秒包含编码延迟。 |
| `audio/death_male.wav` | [CrossFire Wiki — Character Voice Packs](https://crossfirefps.fandom.com/wiki/Character_Voice_Packs)，[Legacy English male 公开包](https://drive.google.com/open?id=1ukrDWeTVw27sSuWITBazUJovWFo7WpNI)，`english/Message/Die_LowDamage_BL.wav` | 原样复制；16-bit PCM、44.1 kHz 单声道，约 0.97 秒。该包标注适用于 OMOH / SWAT / SAS。 |
| `audio/death_female.wav` | 同语音索引的 [Mandarin male/female 公开包](https://drive.google.com/open?id=1MHEprE5pwZ0-STjlD0b66EeiFodncN2c)，`woman/MESSAGE/Die_LowDamage_BL.wav` | 原样复制；16-bit PCM、22.05 kHz 单声道，约 1.56 秒。当前作为女性角色共享死亡声，不代表已核实灵狐、STAR 的专属录音。 |
| `audio/ak47_fire.wav` | [Lem-c/Unity_CrossFire_base](https://github.com/Lem-c/Unity_CrossFire_base)，[AK47/Sound/Fire.WAV](https://github.com/Lem-c/Unity_CrossFire_base/blob/master/Assets/Resources/Weapons/AK47/Sound/Fire.WAV) | 原样复制；16-bit PCM、22.05 kHz 单声道，约 1.97 秒（含尾音）。仓库说明资源来自 GameBanana CS 1.6 移植包及网络采集，不能据此认定官方独立授权。 |
| `audio/ui_click.wav` | Kenney Vleugels，[51 UI sound effects](https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks)，`UI_SFX_Set.zip/click3.wav` | 约 0.086 秒，转换为 16-bit PCM、22.05 kHz 单声道。CC0；是通用点击音效，不宣称为 CF 原版按钮声。感谢 Kenney.nl。 |

音乐下载地址由文件说明页的 MediaWiki API 获取：

`https://static.wikia.nocookie.net/crossfirefps/images/1/10/MainMenu_Old.ogg/revision/latest?cb=20140111105432`

转换工具为本地 `imageio-ffmpeg 0.6.0` 随包 FFmpeg，使用 `libmp3lame` 和 `pcm_s16le`。5 个新增文件均成功完整解码，检查了容器、采样率、声道、时长和非静音内容；没有在本次采集时完成 iPhone 真机听音验证。

CF Wiki 为社区保存来源，音频的原作品权利仍属于相应权利人。其语音索引注明官方语音归 Smilegate / Tencent 所有，未提供本项目的公开再分发授权；界面点击音效明确使用 Kenney CC0。上述记录不等于获得 CF 音乐、语音或枪声的发布许可。

## SHA-256

云悠悠新增 7 段 MP3 击杀提示，来自 [Steam 社区素材包](https://steamcommunity.com/sharedfiles/filedetails/?id=3809605150)。事件映射、文件校验和验证范围见 [云悠悠说明](../../../YUNYOUYOU.md) 及 `yunyouyou/manifest.json`。死亡仍使用已有通用女声，未将其标为云悠悠独立录音。

```text
ui_click.wav      7fbbe271c57ea8a3feba9f2cd2dc2dfb9db5f9599f7826abf4fb2b8324b4bf0b
death_male.wav    dcdc2d02c87989e6feb12f06d6aa716edc5e648b985c020df247d9091c407fe0
death_female.wav  111a4c0a2869f41fafa9dbf34f7317b7d2862a83e3fb61670c830f3f5c52f957
ak47_fire.wav     906fa2dfe57be8e194fc63666f2415458f9781ab4b235d9f3626b465873ede10
lobby_bgm.mp3     7b055f1888b0f61769ff75dbba7dba58184da1d8fa084c90938b19664e29773e
```
