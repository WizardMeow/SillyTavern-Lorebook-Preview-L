# Lorebook Reader — Agent Guide

## 项目目的

这是一个纯前端的 SillyTavern LoreBook 快速预览器：用户通过 JSON 文本、URL、本地文件、拖放或粘贴 PNG 角色卡载入内容，在浏览器中阅读、搜索并切换 Markdown / 纯文本渲染。应用没有后端；本地文件不上传。

## 领域背景

- **独立世界书（World Info）**：顶层 `entries` 的 JSON 文档。
- **角色卡（Character Card）**：与世界书是不同格式；只在 `data.character_book` 存在时，才提供可提取的内嵌世界书。
- **PNG 角色卡**：`ccv3` 或 `chara` PNG 文本元数据中可包含角色卡 JSON，随后按角色卡格式解析。
- 更完整的字段依据与兼容性结论见 [调研笔记](docs/research/sillytavern-lorebook-json-format.md)。

## 架构约束

- 领域模型和导入输入类型从 Zod schema 推导；兼容性归一化时保留未知字段到 `raw`。
- `src/features/import/importer.ts` 是唯一导入 seam。`source-adapters/` 负责来源（文本、URL、文件），`adapters/` 负责格式（世界书、角色卡、PNG 卡）。新增来源或格式时注册适配器，界面不感知分派细节。
- 默认 Markdown 渲染，不启用原始 HTML；导航与详情保持分离。
- 测试仅覆盖核心解析器。界面、导入交互和部署配置以构建及人工验证为准。

## 命令

- `npm run dev`：启动本地开发服务器。
- `npm run test`：运行核心解析器测试。
- `npm run build`：生产构建。
- `npm run preview`：本地预览生产构建。

## 发布

- `main` 分支的推送会触发 `.github/workflows/deploy-pages.yml`，构建 `dist/` 并部署到 GitHub Pages。
- Pages 地址：<https://wizardmeow.github.io/SillyTavern-Lorebook-Preview-L/>。
- GitHub Actions 环境通过 `GITHUB_ACTIONS` 为 Rsbuild 配置 `/SillyTavern-Lorebook-Preview-L/` 资源前缀；调整仓库名时必须同步更新 `rsbuild.config.ts`。

### 发布扩展

- 自定义域名、发布保护规则或预览环境确定后，在本节补充相应配置与验证步骤。
