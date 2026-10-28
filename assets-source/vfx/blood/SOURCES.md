# 角色受击血液动画

作者：para。资源页：[Animated particle effects #2](https://opengameart.org/content/animated-particle-effects-2)。检索及下载日期：2026-10-04。

页面将此包标为 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。作者说明血液序列为 512×512、每格 128×128、16 帧、30 FPS。当前游戏采用原始 `blood_hit_03.png`；未改动 PNG，按 4×4 图集在世界空间播放，内嵌为 data URL，不需要联网加载。原文件及校验值保留在此目录。

| 文件 | 用途 | SHA256 |
| --- | --- | --- |
| [blood_hit_03.png](blood_hit_03.png) | 当前内置的受击喷溅动画 | `772881ae173e39f488e7ef5cbbc60ae70515460c0faa28db4f6236dfdacd3270` |
| [blood_hit_02.png](blood_hit_02.png) | 下载比较的竖向效果，未接入运行包 | `eef5bcd4096e70a1c52a060731108a4bc6e868ae65a7fc0f5467878f65180fc1` |
| [blood_hit_01.png](blood_hit_01.png) | 下载比较的斜向效果，未接入运行包 | `0947f82ef68ef7d338291961f66ff89710bdbea439d12ec4430dd707f4f8b434` |

原始下载：[01](https://opengameart.org/sites/default/files/blood_hit_01.png)、[02](https://opengameart.org/sites/default/files/blood_hit_02.png)、[03](https://opengameart.org/sites/default/files/blood_hit_03.png)。这些是独立的通用受击特效素材，没有将其标为 CF 官方素材。CC0 许可仅适用于本页记录的新增特效，不改变项目其他资源的许可。

构建时 `scripts/embed-blood.mjs` 校验图集大小并生成 `src/generated/blood-asset.js`。`src/blood-effects.js` 播放透明帧动画并限制同时存在的数量；具体触发与验证见 [受击效果说明](../../../BLOOD-EFFECTS.md)。

2026-10-28：地面血泊复用此图首帧的浓血区域，运行时仅调整纹理 UV 范围并居中，不改动原始 PNG；与喷溅共用图像源。地面投影及血迹叠加由 `src/ground-blood.js` 处理。
