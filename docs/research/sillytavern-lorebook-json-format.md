# SillyTavern LoreBook（World Info）JSON 格式调研

调研日期：2026-08-23。此处的 **LoreBook / World Info / Memory Book** 指同一功能；SillyTavern 官方文档也使用这几个名称。[官方 World Info 文档](https://docs.sillytavern.app/usage/core-concepts/worldinfo/)

源码分析基于官方 `release` 分支当日快照 `8172dcd`；下方的 `release` 链接会随上游演进，固定快照链接用于复核本文。

> 结论：独立导出的 SillyTavern 世界书是一个顶层含 `entries` 的 JSON 对象；`entries` 的常见、由当前实现创建的形状是以 UID 字符串为键的对象（record），每个 value 是一条记录。SillyTavern 服务端对导入的最低硬性检查只有“顶层存在 `entries`”，因此预览器应做宽容解析、严格展示警告，而不要把“完整字段集合”误判成唯一合法格式。

## 一、需要支持的输入形状

### A. 原生独立 World Info 文件（首要）

```json
{
  "entries": {
    "0": {
      "uid": 0,
      "key": ["Aurelia", "奥蕾莉亚"],
      "keysecondary": [],
      "comment": "角色：Aurelia",
      "content": "Aurelia 是王国的天文学家。",
      "constant": false,
      "selective": true,
      "selectiveLogic": 0,
      "order": 100,
      "position": 0,
      "disable": false
    }
  }
}
```

* 当前服务端读取 `.json` 后直接 `JSON.parse`；新建空书为 `{ "entries": {} }`；导入和保存都只检查 `entries` 是否存在。[worldinfo endpoint](https://github.com/SillyTavern/SillyTavern/blob/release/src/endpoints/worldinfo.js#L15-L31) / [导入校验](https://github.com/SillyTavern/SillyTavern/blob/release/src/endpoints/worldinfo.js#L91-L120)
* 当前前端加载原生书时，用对象键遍历 `data.entries`；这证实 `Record<string, entry>` 是应优先支持的原生形状。[加载逻辑](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/world-info.js#L4112-L4125)
* 顶层还可能有 `name` 和 `extensions`：服务端列目录时会读取它们作为显示名/元数据，但不会要求它们存在或解释其内部结构。[目录列表逻辑](https://github.com/SillyTavern/SillyTavern/blob/release/src/endpoints/worldinfo.js#L35-L58)
* 官方仓库的 [`Eldoria.json` 示例](https://github.com/SillyTavern/SillyTavern/blob/8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8/default/content/Eldoria.json) 采用该 record 结构：字符串数字键、条目内重复 `uid`，并保存了较早的全字段序列化值。它说明历史值与当前模板并存是正常兼容情形。

### B. Character Card 内嵌 LoreBook（建议一并识别）

角色卡可含 `data.character_book`。其 `entries` 是 **数组**，字段名与原生 World Info 不同；SillyTavern 将它转换为上面的对象形状。预览器若从“世界书 URL / 文件 / 粘贴”接受任意 JSON，识别这条路径会显著增加可用性。

```json
{
  "data": {
    "character_book": {
      "name": "角色附带设定",
      "entries": [{
        "id": 0,
        "keys": ["Aurelia"],
        "secondary_keys": [],
        "content": "…",
        "enabled": true,
        "insertion_order": 100,
        "position": "before_char",
        "extensions": {}
      }]
    }
  }
}
```

转换证据：`id → uid`、`keys → key`、`secondary_keys → keysecondary`、`insertion_order → order`、`enabled → !disable`；位置优先读 `extensions.position`，否则把字符串 `before_char` / 其他值映射为原生位置枚举。没有 `id` 时，源码以数组下标补齐。[`convertCharacterBook`](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/world-info.js#L5096-L5150)

## 二、原生 entry 字段

下表是当前版本“新建原生 entry”的代码定义；不存在的字段可按默认值归一化。`uid` 在创建时单独写入，且对象键和 `uid` 通常相同。[entry 模板与创建逻辑](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/world-info.js#L3723-L3793)

| 字段 | 类型 / 默认值 | 面向阅读者的含义 |
| --- | --- | --- |
| `uid` | integer | 条目 ID；预览中应优先展示。 |
| `key` | `string[]`, `[]` | 主触发关键词。 |
| `keysecondary` | `string[]`, `[]` | 可选的附加关键词。 |
| `comment` | string, `""` | Memo / 标题；仅供人类识别，不参与提示词。 |
| `content` | string, `""` | 条目正文；激活时插入提示词，是阅读视图核心。 |
| `constant` | boolean, `false` | 无需关键词、始终尝试激活。 |
| `vectorized` | boolean, `false` | 允许由向量相似度选中。 |
| `selective` | boolean, `true` | 是否启用次关键词的选择性匹配。 |
| `selectiveLogic` | enum, `0` | 次关键词逻辑：`0` AND ANY、`1` NOT ALL、`2` NOT ANY、`3` AND ALL。 |
| `order` | number, `100` | 插入排序优先级；数值更大者更靠近上下文末端。 |
| `position` | enum, `0` | 注入位置（完整映射见下）。 |
| `disable` | boolean, `false` | 禁用该条。 |
| `ignoreBudget` | boolean, `false` | 忽略世界书 token 预算。 |
| `excludeRecursion` / `preventRecursion` | boolean, `false` | 分别阻止被递归激活 / 阻止继续触发其他条。 |
| `delayUntilRecursion` | number, `0` | 仅在递归阶段延后激活；历史文件也可能是 boolean。 |
| `probability` / `useProbability` | number `100` / boolean `true` | 激活概率及是否使用它。 |
| `depth` / `role` | number `4` / enum `0` | `@ depth` 注入深度及消息角色。 |
| `outletName` | string, `""` | `position: 7`（Outlet）时的 outlet 名称。 |
| `group` / `groupOverride` / `groupWeight` | string `""` / boolean `false` / number `100` | Inclusion Group 及选取策略。 |
| `scanDepth` | `number \| null`, `null` | 覆盖全局的扫描深度。 |
| `caseSensitive` / `matchWholeWords` / `useGroupScoring` | `boolean \| null`, `null` | 三态条目级覆盖；`null` 表示使用全局设置。 |
| `automationId` | string, `""` | 与 Quick Replies / STscript 自动化关联的 ID。 |
| `sticky` / `cooldown` / `delay` | `number \| null`, `null` | 按消息计的持续、冷却、延迟效果。 |
| `triggers` | `string[]`, `[]` | 限定 generation type；空数组即所有类型。 |
| `displayIndex` | number，可缺省 | 编辑器的显示顺序；历史/转换数据中可见，阅读排序可作为 `uid` 后的稳定回退。 |
| `characterFilter` | object，可缺省 | `{ isExclude, names, tags }`；当前编辑器只在有筛选需求时保存。 |

补充：官方文档明确 `key` 支持普通文本及 JavaScript 风格 `/.../flags` 正则；`comment`/`key` 不注入 prompt，`content` 才会注入。[键与正则](https://docs.sillytavern.app/usage/core-concepts/worldinfo/#regular-expression-regex-as-keys) / [内容与 Memo](https://docs.sillytavern.app/usage/core-concepts/worldinfo/#entry-content)

## 三、数值枚举（应翻译成人类标签）

### `position`

| 值 | 标签 |
| --- | --- |
| `0` | Before Character Definitions |
| `1` | After Character Definitions |
| `2` | Top of Author's Note |
| `3` | Bottom of Author's Note |
| `4` | At Depth |
| `5` | Before Example Messages |
| `6` | After Example Messages |
| `7` | Outlet |

此映射由当前源码枚举定义；Outlet 没有 `outletName` 时，生成阶段会跳过该 entry。[位置枚举](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/world-info.js#L790-L803) / [各位置的注入处理](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/world-info.js#L4711-L4769)

### `role`（只在 `position: 4` 时有意义）

`0 = system`、`1 = user`、`2 = assistant`。[角色枚举](https://github.com/SillyTavern/SillyTavern/blob/release/public/script.js#L455-L471)

## 四、预览器的解析与产品要求

1. 先 `JSON.parse`，再按以下优先级探测：顶层 `entries`（原生对象）→ 顶层 `entries`（数组，作为兼容输入）→ `data.character_book.entries`（嵌入角色卡）。不匹配时显示可读错误和根对象键名，绝不静默丢弃。
2. 将 object record 用 `Object.entries` 转为数组，并保留 `sourceKey`；条目显示 ID 取合法 `uid`，否则取 `sourceKey` / 数组索引。不要要求 record key 与 `uid` 相等。
3. Zod 应执行**宽容归一化**：保证阅读必需字段 `content`、`key`、`comment` 有安全回退；未知顶层字段和未知 entry 字段保留在 `raw`（未来 ST / 扩展兼容），同时收集字段级 warning。这个取舍符合 ST 服务端的低门槛导入策略，而不是凭空伪造严格 schema。
4. 阅读主列表默认使用 `comment`，回退到第一个 `key`，再回退到 `Entry #uid`；正文渲染 `content` 为纯文本或经过消毒的 Markdown。不要在浏览器中执行 `key` 所含正则，也不要把 JSON 的 HTML 当可信内容。
5. 用视觉状态而非过滤丢失信息：禁用、常驻、向量化、选择性、概率、位置、深度、分组、递归、时间效果、角色筛选、触发类型均应在详情中可见。中文世界书尤其应突出 `matchWholeWords` 的实际值，因为官方文档提醒该选项不适合无空格分词语言。[词边界说明](https://docs.sillytavern.app/usage/core-concepts/worldinfo/#match-whole-words)
6. `entries` 为空是可预览的有效空书，而不是 JSON 格式错误；SillyTavern 将其作为缺失书的 dummy 对象。只有根不是 object、缺少 `entries`、或 `entries` 既非 object 也非 array 时才阻断展示。[缺失书 dummy](https://github.com/SillyTavern/SillyTavern/blob/release/src/endpoints/worldinfo.js#L15-L31)

## 五、非目标与兼容边界

* 此网站是阅读预览器，不复刻 ST 的激活/预算/递归执行器。可展示这些配置，但不应宣称“会激活哪些条目”。激活受聊天、全局设置、token 预算、随机概率、分组和向量检索共同影响；官方文档将其定义为动态上下文插入机制。[官方功能说明](https://docs.sillytavern.app/usage/core-concepts/worldinfo/)
* SillyTavern 还在导入时转换 NovelAI、Agnai 与 Risu 格式。若后续要支持它们，应以当前转换器为规范，而不是把它们误认成原生 ST 格式。[导入格式分流](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/world-info.js#L5313-L5358) / [转换器](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/world-info.js#L4962-L5093)

## 六、PNG 角色卡载体（2026-08-23 增补）

角色卡 PNG 是**角色卡 JSON 的图片载体**，并不是 World Info 文件；只有解出的角色卡 `data.character_book` 存在时，才是本预览器可阅读的内嵌世界书。

* SillyTavern 的角色卡读取器扫描 PNG `tEXt` 块，优先读取关键字 `ccv3`，否则读取 `chara`，然后对内容作 Base64 → UTF-8 解码；对应 V3 / V2 角色卡元数据。[官方读取源码](https://github.com/SillyTavern/SillyTavern/blob/release/src/character-card-parser.js#L463-L507)
* 因此预览器的 `png-character-card` 适配器只处理这层 PNG 载体，随后把解出的 JSON 交给 `character-card` 适配器；不把 PNG 当作世界书格式，也不执行角色卡内的任何内容。
* 官方 FAQ 提醒，重保存图片可能会移除内嵌定义，且扩展名为 `.png` 的文件有可能实际是 WebP。对此应给出可读导入错误，而非显示为空书。[官方 FAQ](https://docs.sillytavern.app/usage/faq/#i-tried-to-import-a-png-character-card-but-got-an-error-that-its-invalid-why)

## 七、Inclusion Group 与递归（2026-08-23 增补）

> 结论：SillyTavern 支持**扁平的 Inclusion Group（包含组）**和**运行时递归扫描**；两者都不是 entry 的父子/目录嵌套 JSON。预览器不应把它们显示为可折叠的世界书树。

### Inclusion Group 是标签式的互斥选择

原生 entry 的相关字段为 `group: string`、`groupOverride: boolean`、`groupWeight: number` 和 `useGroupScoring: boolean | null`，默认分别为 `""`、`false`、`100`、`null`。[当前 entry schema](https://github.com/SillyTavern/SillyTavern/blob/8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8/public/scripts/world-info.js#L4002-L4035)

* `group` 是逗号分隔的字符串标签；一条 entry 可以写入多个标签。实现会以 `group.split(/,\s*/)` 建立临时的平面 map，而非读取子条目或路径。[源码：分组构建](https://github.com/SillyTavern/SillyTavern/blob/8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8/public/scripts/world-info.js#L5269-L5280)；官方文档也说明多组以逗号分隔。[官方文档：Inclusion Group](https://docs.sillytavern.app/usage/core-concepts/worldinfo/#inclusion-group)
* 同一标签下有多条 entry 同时激活时只保留一条：有 `groupOverride: true` 的候选时选其 `order` 最大者；否则按 `groupWeight` 加权随机。`useGroupScoring` 可先按关键词命中数量缩小候选集。[源码：优先/权重选择](https://github.com/SillyTavern/SillyTavern/blob/8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8/public/scripts/world-info.js#L5319-L5346) / [官方文档：Prioritize Inclusion 与 Group Scoring](https://docs.sillytavern.app/usage/core-concepts/worldinfo/#prioritize-inclusion)
* 当前标准 entry schema 和分组处理都没有 `parent`、`children`、`folder` 或 `subentries` 语义。因此只能将组展示为平面标签；最多按逗号拆分、去掉空标签，不可凭此构造层级。
* Character Card 的内嵌世界书把等价值放在每条 `extensions.group`、`extensions.group_override`、`extensions.group_weight`、`extensions.use_group_scoring` 中，ST 转换后才成为原生 entry 的 camelCase 字段。[`convertCharacterBook` 映射](https://github.com/SillyTavern/SillyTavern/blob/8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8/public/scripts/world-info.js#L5498-L5535)

### 递归是内容触发的激活链

打开全局 **Recursive Scan** 后，成功激活且未设 `preventRecursion` 的 entry，其 `content` 会写入下一轮扫描缓冲；内容中命中另一条 entry 的 key 就可继续激活。所有 entry 仍留在同一个顶层 `entries` record 中，并不会生成或读取嵌套数据。[官方文档：Recursive scanning](https://docs.sillytavern.app/usage/core-concepts/worldinfo/#recursive-scanning) / [源码：递归缓冲与下一轮](https://github.com/SillyTavern/SillyTavern/blob/8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8/public/scripts/world-info.js#L4960-L5025)

| 字段 | 含义 |
| --- | --- |
| `excludeRecursion` | 不能由递归阶段激活。 |
| `preventRecursion` | 条目仍可激活，但其内容不触发下一轮。 |
| `delayUntilRecursion` | 初始扫描跳过，仅在递归阶段匹配；数值可延后到相应递归层级。 |

三个字段的默认值与实际递归阶段过滤见当前源码。[字段默认值](https://github.com/SillyTavern/SillyTavern/blob/8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8/public/scripts/world-info.js#L4016-L4024) / [阶段过滤](https://github.com/SillyTavern/SillyTavern/blob/8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8/public/scripts/world-info.js#L4747-L4760)。全局 Max Recursion Steps 为非零时限制扫描轮数；设为 0 时仍受 token budget 限制。[官方文档：Max Recursion Steps](https://docs.sillytavern.app/usage/core-concepts/worldinfo/#max-recursion-steps)

这类预览器应显示分组与递归配置，但不应预测最终激活结果：聊天文本、全局开关、概率、预算、组选择和最大轮数都会影响结果。另需区分 Outlet：官方明确禁止 outlet macro 嵌套以避免无限循环，这与世界书递归扫描是不同机制。[Outlet 限制](https://docs.sillytavern.app/usage/core-concepts/worldinfo/#limitations-and-caveats)

## 八、`content` 中的序列化 Character Book 不会被原生展开（2026-08-23 增补）

> 结论：**不支持。**SillyTavern 只会把角色卡对象路径 `data.character_book` 识别为内嵌世界书；若独立世界书某一 entry 的 `content` 恰好是序列化后的 `[{ keys, secondary_keys, content, … }]`，它仍只是该 entry 的字符串正文，不会变成子条目、也不会在编辑器中展开。

* 原生的 Character Book 导入路径先检查 `characters[chid].data.character_book`，随后将该对象传给 `convertCharacterBook`；转换器遍历的是 `characterBook.entries`，并把每项的 `entry.content` 直接赋给生成条目的 `content`。它没有读取或解析已有 world-info entry 的 `content`。[嵌入书识别与导入](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/world-info.js#L5167-L5227) / [`convertCharacterBook`](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/world-info.js#L5096-L5150)
* 生成 prompt 时，当前实现把已激活 entry 的 `content` 当作文本做宏替换、正则处理与插入；没有将其再次作 JSON 解析或转成 entry 集合。[内容进入 prompt 的处理](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/world-info.js#L4581-L4585) / [prompt 插入](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/world-info.js#L4711-L4719)
* 即使启用 Recursive Scan，递归也只是将成功激活条目的 `content` 拼接到下一轮的**关键词匹配文本缓冲**；官方文档所说的是 entry 之间相互激活，而不是解析正文中的 JSON 结构。[递归缓冲源码](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/world-info.js#L4649-L4658) / [官方 Recursive Scanning 文档](https://docs.sillytavern.app/usage/core-concepts/worldinfo/#recursive-scanning)

因此，预览器若为了可读性把这类字符串提供为“可展开的候选子书”，应明确标成**预览器的兼容展示**，不能称为 SillyTavern 原生行为；更不应在无用户操作的情况下把它当作可执行/会被 ST 自动导入的世界书。

## 来源（第一方）

* [SillyTavern 官方文档：World Info](https://docs.sillytavern.app/usage/core-concepts/worldinfo/)
* [SillyTavern 官方仓库：world-info.js（release）](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/world-info.js)
* [SillyTavern 官方仓库：worldinfo 服务端端点（release）](https://github.com/SillyTavern/SillyTavern/blob/release/src/endpoints/worldinfo.js)
* [SillyTavern 官方仓库：角色 prompt role 枚举（release）](https://github.com/SillyTavern/SillyTavern/blob/release/public/script.js#L455-L471)
* [SillyTavern 官方仓库：Eldoria 原生 World Info 示例（固定快照）](https://github.com/SillyTavern/SillyTavern/blob/8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8/default/content/Eldoria.json)
