# Lobby visual references and assets

Retrieved and inspected on 2026-10-03 (Asia/Shanghai).

## `cf-official-logo.png`

- Asset URL: <https://game.gtimg.cn/images/cf/web202410/logo.png>
- Source page: <https://cf.qq.com/main.shtml>
- Source stylesheet: <https://cf.qq.com/web202410/css/index.css?v=241223>, `.header a.logo-cf`.
- 298 × 68 pixels, transparent PNG, 6,605 bytes. White Chinese CF / 穿越火线 wordmark, with “Mercenary Forces Corporation” subtitle.
- This is the current official website wordmark; it is not claimed to be the original 2008 metallic wordmark. Suitable for a compact dark header in the local nostalgic prototype.
- Attribution: CrossFire / 穿越火线, Tencent official site. No open license or redistribution permission was declared for the image. Website publication alone is not an asset license.

## `reference-room-softpedia.jpg`

- Image URL: <https://games-cdn.softpedia.com/screenshots/Cross-Fire-Client_2.jpg>
- Source page: <https://games.softpedia.com/get/Online-Games-Clients/Cross-Fire-Client.shtml>
- Source page identifies “CrossFire Client 1122”, updated 2013-04-15.
- 800 × 600 pixels, JPEG, 130,343 bytes. North American classic CrossFire room UI, Search & Destroy on Sub Base.
- Reference only. Do not embed the full screenshot as the app background or present the pictured map/roster as playable content.
- Attribution: CrossFire game interface, screenshot hosted by Softpedia. No open license was declared. Softpedia footer states all rights reserved.

### Observed classic room structure

- Compact metallic top bar: game wordmark at left, raised beveled navigation buttons, utility icons at right.
- Left column occupies about one third of the screen: room/channel breadcrumb, room map thumbnail, compact settings rows, Bag / My Info / Friend / Clan tabs, and two weapon slots with durability bars.
- Right column contains opposing Black List and Global Risk roster tables, amber and blue team headers, alternating dark rows, a few small action buttons, and a gold join/start button at lower right.
- The bottom system/chat area uses a dark desaturated blue background, small light text, olive yellow system lines, and a thin entry strip.
- Frames have layered dark-to-light edges, worn gunmetal/diamond-plate surfaces, square corners, and occasional orange selected borders.

The prototype recreates the arrangement and metallic UI in local HTML/CSS, while adapting the controls to mobile touch. Its available rooms remain local offline bot match presets.

## Project-created assets

- `src/assets/lobby/border-depot.png`: 640 × 320 still rendered from the project's actual `MAP` and `Renderer` world geometry, with actors, guns and bomb hidden. It depicts the playable Border Depot map; it is not a screenshot of a CF map obtained online.
- The route view is drawn locally from the same `src/map.js` layout as collisions and the combat radar. The player spawn marker follows the selected faction.
- `src/assets/lobby/cf-logo.png` is a byte-for-byte copy of the official wordmark above. Only these runtime assets are copied to the app's `Game/assets/lobby` folder; reference screenshots remain in the source-reference folder.

## Additional inspected web references, not bundled

- <https://m.onlinedown.net/article/10044528.htm>
  - Image: <https://img.onlinedown.net/article/202504/163541-6806035d85d72.png>
  - Promotional montage of a Chinese legacy room window; skewed and overlaid with text, unsuitable as a reusable background.
- <https://cf.qq.com/webplat/info/news_version3/125/860/862/m640/202012/877351.shtml>
  - Official 2020 interface discussion referenced by <https://m.houdao.com/r14656633>.
  - Historical layout context; not treated as an asset download or a reproduction license.
