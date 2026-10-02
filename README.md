# 旧战线 · Retro Front

一个受早期军事 FPS 氛围启发的 **iOS 横屏离线游戏原型**。已有可运行的大厅、仓库和第一人称单机爆破闭环。使用原创程序化低多边形模型，没有使用 CF 官方模型、地图、音效、标识或客户端文件。

当前是可继续开发的首版，不是 CF 官方客户端、私服后端或完整复刻。角色动画、枪械细节、地图美术和枪感仍需继续打磨。

## 已实现

- 军事风大厅：角色展示、地图任务卡、攻守选择、电脑难度和本地战绩。
- 仓库：M4A1、AK-47、AWM、MP5 四种主武器；固定 USP 与战术匕首；两名基础角色；配装本地保存。
- 一张原创 3D 地图“边境货场”：A/B 双点位、仓房、货柜、木箱、掩体碰撞和弹道遮挡。
- 玩家独自迎战 3 名电脑对手，可选进攻方或防守方；先得 3 分获胜。
- 95 秒回合，安放 3 秒、拆除 5 秒、引爆 35 秒；消灭、超时、引爆和拆除判定。
- 电脑寻路、瞄准射击、进攻安放、防守拆除；简单、标准、困难三档。
- 第一人称枪械、弹药、换弹、武器切换、开镜、命中反馈、程序合成音效和战术雷达。
- 双指触控：摇杆与转向独立；开火按钮支持拖动瞄准；后台自动暂停。
- iPhone / iPad 原生安装工程、全离线资源和 GitHub Actions 打包流程。

不含联机、账号服务器、官方资源、商城、英雄级武器、跳跃/蹲伏、投掷物或精细骨骼动画。地图与模型使用代码生成，适合先验证玩法，再替换资源。

## 现在试玩

已附上构建好的离线资源。电脑浏览器可直接打开：

`ios/RetroFront/Game/index.html`

也可在安装 Node.js 22 后，于项目根目录运行：

```sh
npm ci
npm test
npm run build
npm start
```

随后打开 `http://127.0.0.1:4173`。本地预览服务仅监听当前电脑。

电脑：WASD 移动，点击空白场景锁定鼠标，左键开火，右键瞄准，R 换弹，1 / 2 / 3 切换步枪 / USP / 匕首，长按 E 安放或拆除，Esc 暂停。半自动武器每次射击需要新的点击。瞄准按钮也可直接点击。

手机：横屏使用；左摇杆移动，右侧空白区域滑动转向，右侧按钮控制开火、瞄准、换弹、切枪；进入对应区域后长按安放/拆除按钮。触发系统切后台时战局会暂停。角色仅改变展示外观，属性一致。

## GitHub 云编译 IPA

**上传本文件所在目录中的内容到仓库根目录**，保留隐藏目录 `.github`。不要把 `node_modules` 上传。`package.json` 与 `.github` 应直接位于仓库根目录。

1. 创建一个 GitHub 仓库，把本项目上传/推送到 `main` 或 `master`。
2. 打开 **Actions → Build iOS IPA → Run workflow**。
3. 首次保持 `signed` 关闭。默认 Bundle ID 为 `com.example.retrofront`。
4. 等待运行完成，在这次运行底部 **Artifacts** 下载 `RetroFront-iOS-运行编号`。
5. 解压可得到 `RetroFront-unsigned.ipa`。

自动流程在 macOS 上运行单元测试、打包全部网页资源、构建 iOS 模拟器版本检查 Swift，再归档 arm64 真机版本。默认不会发布到 App Store，也不会创建公开 Release。

**未签名 IPA 不能直接安装到普通 iPhone。** 它是供后续签名的完整包。有效证书、描述文件和设备授权决定能否安装；不是把文件扩展名改成 IPA 就可以绕过签名。

### 直接生成已签名 IPA（可选）

准备 Apple Development 或 Apple Distribution 的 **P12 文件（含私钥）**，以及匹配 Bundle ID、证书和目标设备的 Development / Ad Hoc 描述文件。本流程不接受 App Store 或企业分发描述文件。

在仓库 **Settings → Secrets and variables → Actions** 添加：

| Secret | 内容 |
| --- | --- |
| `IOS_CERTIFICATE_P12_BASE64` | P12 文件的 Base64 文本 |
| `IOS_CERTIFICATE_PASSWORD` | 导出 P12 时设置的密码 |
| `IOS_PROFILE_BASE64` | `.mobileprovision` 文件的 Base64 文本 |

用 Windows PowerShell 转换文件时，可将输出复制到相应 Secret；不要把它们写进仓库：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\certificate.p12')) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\profile.mobileprovision')) | Set-Clipboard
```

手动运行 workflow，勾选 `signed`，填写与描述文件对应的 `bundle_id`。流程会检查描述文件有效期、Bundle ID 和设备分发类型，导出签名版本。导出的 IPA 可按 Apple 的设备安装流程安装；开发调试安装可能要求开启“开发者模式”。证书过期或未包含目标设备都会导致安装失败。

### 在 Mac / Xcode 本地运行

打开 `ios/RetroFront.xcodeproj`，选择 `RetroFront` Scheme。在 Signing & Capabilities 中设置自己的 Team 与 Bundle Identifier，连接 iPhone 后 Run。最低部署版本 iOS 15；需要支持 WebGL 2 的设备。Xcode 工程使用 UIKit + WKWebView，3D 渲染由随包内置的 Three.js 提供，运行不依赖 CDN 或网络。

## 代码结构

```text
src/catalog.js            枪械、角色、配装校验
src/map.js                共享地图、碰撞、视线与寻路
src/game.js               独立可测试的回合、战斗和电脑逻辑
src/render.js             程序化模型、灯光、3D 渲染
src/main.js               大厅/仓库、触控、HUD、存档
src/audio.js              离线合成音效
src/style.css             横屏界面与安全区域布局
tests/game.test.mjs       核心规则与回归测试
ios/RetroFront/           原生外壳与已打包游戏资源
.github/workflows/ios.yml 云构建入口
scripts/sign-ios.sh       可选签名、描述文件检查与导出
```

修改源码后运行 `npm run build`。如果修改了工程生成器或图标，分别运行 `node scripts/project.mjs` / `node scripts/icon.mjs`。Xcode 工程无需 CocoaPods 或第三方项目生成工具。

## 验证范围

当前已完成 22 项 Node 自动化检查，并在浏览器中验证大厅、844×390 横屏仓库、配装持久化、进入地图、切枪、射击和暂停。浏览器预览不等同 iOS 真机验证。

**本次尚未运行 GitHub 云构建、Xcode 编译或 iPhone 安装测试；交付物是源码工程及打包配置，没有已编译的 IPA。** 首次上传后应确认 Actions 全部通过，并在目标手机上检查多指操作、帧率、音效、后台恢复和安全区域。

建议后续依次：完成真机试玩与枪感调节 → 换成更精细的原创人物/武器/地图 → 增加角色骨骼动画、蹲跳和投掷物 → 再考虑队友与更多地图。

## 参考与许可

- [Apple：将 App 分发到已注册设备](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices)
- [GitHub：为 Xcode 构建配置签名证书](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications)
- [GitHub：下载构建产物](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)
- [Three.js：安装与构建](https://threejs.org/manual/pages/installation.html)

Three.js 使用 MIT 许可证，原文随离线资源附带于 `ios/RetroFront/Game/THREE-LICENSE.txt`。程序化模型、界面和音效为本项目新建内容。本项目与 CF 官方无关联。
