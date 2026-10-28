# 旧版平面沙漠灰地图素材来源（历史记录）

本目录记录此前平面重建版本使用的 Poly Haven 素材。2026-10-04 已由完整 CF DUST2 社区 BSP 地图替换默认场景；当前来源与许可见 [完整地图记录](../desert-full/SOURCES.md)。下文 CC0 仅适用于列出的 Poly Haven 原素材，不适用于新的 BSP、WAD、天空或转换后的完整地图。

旧素材核验日期：2026-10-04。实际下载均来自 Poly Haven 主站，采用 [CC0 许可](https://polyhaven.com/license)。原始文件下载通过官方 API 文件清单的 MD5 核对，本地 SHA-256 与下载 URL 见同目录 `manifest.json`。这些模型和贴图曾由旧版本的游戏包本地加载。

| 包内文件 | 原资源 | 作者 | 用途 |
| --- | --- | --- | --- |
| `src/assets/maps/desert/brick.jpg` | [Brick Wall 08](https://polyhaven.com/a/brick_wall_08) | Amal Kumar | 灰砖墙 |
| `src/assets/maps/desert/sandstone.jpg` | [Sandstone Blocks 05](https://polyhaven.com/a/sandstone_blocks_05) | Rob Tuytel | 石门框、屋顶边、石墙 |
| `src/assets/maps/desert/plaster.jpg` | [Grey Plaster 03](https://polyhaven.com/a/grey_plaster_03) | Rob Tuytel | 旧灰抹墙 |
| `src/assets/maps/desert/sand.jpg` | [Sand 01](https://polyhaven.com/a/sand_01) | Rob Tuytel | 砂地 |
| `src/assets/maps/desert/wood.jpg` | [Wood Planks](https://polyhaven.com/a/wood_planks) | Amal Kumar | 木门与简化木箱 |
| `src/assets/maps/desert/wooden_crate_02/` | [Wooden Crate 02](https://polyhaven.com/a/wooden_crate_02) | James Ray Cock / Jurita Burger | 四处木箱掩体 |

五张 diffuse 贴图均为原始 1024×1024 JPG；旧地图未采用墙面 normal 图，以减少移动端纹理占用。木箱采用完整 1K glTF、bin、diffuse、ARM 和 normal 图，实测 5,176 三角面、3,719 顶点、两个 mesh、一个材质，总下载约 2.24 MB。旧版本运行时复用几何和材质，按各木箱碰撞尺寸缩放，未改原文件。

旧地图结构参考 [17173 2015 年沙漠灰俯视图及点位介绍](https://cf.17173.com/content/2015-06-10/20150610103940912.shtml)。截图只用于结构对照，没有作为运行时贴图或游戏包内素材；旧版拱门、木门简化形状和地图分块由本项目建模。大厅 `desert-grey.png` 随默认地图更换而更新，不应据本记录判断其新版本许可。

当时调查到的候选包括 CGModel 456761 的付费 OBJ/FBX/Maya 和 Sketchfab vrchris 的 CS Dust2，未采用。后续已取得 dustsanzo 的完整社区移植包并用于本地测试，当前高差、碰撞及跳跃范围见 [DESERT-MAP.md](../../../DESERT-MAP.md)。
