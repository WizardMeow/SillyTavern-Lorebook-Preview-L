# Lorebook Reader

一个没有后端的 SillyTavern 世界书预览器。世界书只会在浏览器内解析和渲染。

支持本地选择、拖放、粘贴 JSON，或从允许 CORS 的 URL 读取。原生 SillyTavern World Info 与角色卡是独立格式：前者由 `world-info` 适配器处理，后者仅在存在 `data.character_book` 时由 `character-card` 适配器提取其内嵌世界书。也支持 PNG 角色卡：`png-character-card` 适配器会读取 `ccv3` / `chara` PNG 文本元数据，再交给角色卡适配器处理。

也可通过 `?url=` 在打开页面时自动载入远端内容；参数值必须是经过 URL 编码的 HTTP(S) 地址，例如 `/?url=https%3A%2F%2Fexample.com%2Fworld.json`。该入口只会调用 URL 导入流程，不会尝试解析其他 query 参数。

格式依据与一手来源见 [调研笔记](docs/research/sillytavern-lorebook-json-format.md)。

```bash
npm install
npm run dev
npm run test
npm run build
```

`src/features/import/importer.ts` 是唯一的导入 seam：调用方只传入文本或文件。`source-adapters/` 负责来源获取（JSON 文本、远端 URL、本地文件/PNG），`adapters/` 负责随后识别和归一化世界书格式。每个适配器拥有自己的 Zod schema；归一化后的领域模型也由 Zod schema 推导类型。新增来源或格式时注册对应适配器，无须修改界面调用方。

## 防止敏感信息泄露

仓库使用 [Gitleaks](https://github.com/gitleaks/gitleaks) 扫描硬编码的密码、API 密钥和令牌：本地 hook 阻止其进入提交历史，GitHub Actions 会在发布前再次扫描。首次克隆仓库后执行一次：

```bash
# 安装 pre-commit（任选一种方式，例如 pipx install pre-commit）
pre-commit install
pre-commit run gitleaks --all-files
```

`.env`、证书、私钥和密码库文件已被 `.gitignore` 排除；若要在仓库中提供环境变量说明，请只提交 `.env.example`，绝不填入真实值。对于 Gitleaks 未识别的私密资料，请放在未跟踪的目录中，或先加入 `.gitignore`，再执行 `git add`。

Git hook 可以被本机绕过，因此 GitHub 仓库还应在 **Settings → Code security and analysis → Secret scanning** 中开启 **Push protection**。它会在服务端拦截已识别的凭据；一旦发生泄露，立即撤销/轮换凭据，单纯删除文件并不能从 Git 历史中移除它。
