# 云悠悠端游原版素材核查

日期：2026-10-10。目标：CF 端游云悠悠全身角色、配套第一人称左右手臂、原始贴图。用户确认本机没有端游客户端或原版模型包。

| 来源 | 已取得的证据 | 结论 |
| --- | --- | --- |
| [CF YunYouYou Re](https://steamcommunity.com/sharedfiles/filedetails/?id=2947299500) | Steam 元数据：MyLittlePony，app 4000，8,172,525 字节；描述 GR+BL+SP / Model+PM+NPC；file_url 为空。公开合集也列出同名条目。 | 社区移植候选；未取得包体，无法核验原始网格、贴图、配套手臂。不能标为已取得官方素材。 |
| [当前流星移植模型](https://www.lxres.com/RenWuWuQi/ZiZhiRenWu/2411.html) | 已有 SKC/BNC、3 张 TGA，30 骨骼、11,748 三角形，身体贴图 512×512；没有独立第一人称手模。 | 保留为现有临时资源，不能满足原版替换要求。 |
| [CFHD 社区包](https://steamcommunity.com/sharedfiles/filedetails/?id=2896840814) | 已有 VPK 包内含独立 arms 文件；版本为 CFHD。 | 版本不符，不接入本次替换。 |
| [MMD 条目](https://www.44mmd.com/mmdmoxing/66600/) | 页面要求付费/会员下载，未给出足以核验 CF 端游原始资产的来源信息。 | 未购买、未下载，不绕过下载限制。 |
| [云悠悠皮肤设定](https://www.zcool.com.cn/work/ZNTk4Mjc5ODA%3D.html) | 角色设计图和说明。 | 仅外观参考；不等于可用原版 3D/手臂包。 |

访问记录：Steam 单品页面返回 HTTP 429；CF 官网下载页本次连接失败。SteamCMD 原先停在旧版自更新，本次从 Steam 官方 HTTPS CDN 下载并按官方清单 SHA-256 校验其组件，随后尝试通过 SteamCMD 正常获取公开条目；启动后仍卡在连接更新清单，未进入工坊包体下载，已停止本轮启动的进程。未取得候选包，也未运行任何模型包附带脚本。

本轮源码变更只撤回被否定的程序化外观，不将候选包或未验证文件放进发布工程。模型渲染、手臂兼容、角色动画等 20 项针对性测试通过；离线游戏构建成功。
