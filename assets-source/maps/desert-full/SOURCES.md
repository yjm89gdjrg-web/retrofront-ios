# CF DUST2 完整地图来源

核验日期：2026-10-04。当前默认地图由完整社区地图包转换，作者为 **dustsanzo**，发布作品名为 **CF DUST2**。作者说明其为使用已有 CF 地图贴图制作的 CS 1.6 沙漠灰版本；这不是 CF 官方客户端 DAT 地图，也不能把全部资源视为作者原创或 CC0。

| 项目 | 来源与记录 |
| --- | --- |
| 原作者页面 | [GameBanana：CF DUST2](https://gamebanana.com/mods/543106) |
| 本次使用的最终包 | [cf_dust2_final.zip](https://gamebanana.com/dl/1307595)，4,703,896 字节，MD5 `7895c166a3ac0ea0b3017d97576f8d69` |
| 地图文件 | 原包 `maps/CF_DUST2.bsp`；本工程以 `de_dust2_cf.bsp` 保留原字节 |
| 原贴图包 | 原包 `CF_Dust2.wad` |
| 原作者说明 | 同目录 `author-readme.txt`，从最终包 `maps/CF_DUST2.txt` 保留 |
| 地图文件公开镜像 | [Half-Life.fr BSP](https://www.half-life.fr/cs/mapsmirror/maps/de_dust2_cf.bsp)、[CF_Dust2.wad](https://www.half-life.fr/cs/mapsmirror/CF_Dust2.wad)，字节哈希与作者最终包对应文件一致 |
| 声明许可 | [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/)，作者页面另列出再分发和修改分发需询问作者的清单 |

## 文件校验

| 本地原文件 | SHA-256 |
| --- | --- |
| `de_dust2_cf.bsp` | `b92851ec720b2c9b19c395f904707bb476891025b90f61e3f993d452f5a0fb4f` |
| `CF_Dust2.wad` | `9e64cf44888425447f82452aedc863694122d2c9a85ffd3d7dfe9777ea037c5e` |

转换元数据保存于 `metadata.json`，包含原 BSP、所用 WAD 的哈希、坐标变换、各贴图来源、刷体、实体及几何计数。原场景 26 个模型、13,395 个面，生成 39,105 个三角面；97 个材质网格中不可见触发体不作为场景外观显示。

## 贴图、光照与天空

`textures/00.png` 至 `43.png` 共 44 张。42 张由 `CF_Dust2.wad` 调色板纹理转换，一张白色材质来自 GoldSrc 基础 `halflife.wad`，一张天空占位纹理来自 BSP。`metadata.json` 的每个纹理项保留具体原名、尺寸、来源和透明状态。补充白色材质所用 `halflife.wad` 的 SHA-256 为 `38ababf773463fdf6133005d13e543098fc42392b458057f239469b764691300`；它不属于本项目自创素材。

`lightmaps/0.png` 将原 BSP 12,945 个面的静态首种光照样式组合为 2048×2048 光照图。原始 RGB 光照数据也保存在转换后的碰撞导出记录中。`sky/` 下六面 `mountain` PNG 由最终包随附的 TGA 转换。

转换程序保留原贴图外观和烘焙照明，进行坐标、格式、材质批次及游戏接口适配；内嵌脚本属于适配后的资源，不应当标记为未修改原包。游戏采用离线内嵌，不向上述来源发起运行时下载。

## 范围与许可

本次用于本地测试、地图核对和游戏适配。作者声明的许可及网页清单没有给本项目自动授予公开衍生发布权限。公开 GitHub 仓库、其他网站再分发或游戏安装包发布前，应取得作者许可，并核对 CF 原始贴图和 GoldSrc 基础资源等第三方内容的权利。详见 [LICENSE-NOTICE.md](LICENSE-NOTICE.md)。

先前平面地图的 Poly Haven 素材记录仍保留在 `../desert/` 目录；该记录只适用于旧素材，不适用于当前 BSP/WAD 地图。
