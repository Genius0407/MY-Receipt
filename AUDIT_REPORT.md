# 代码审核报告 — 马来西亚发票智能识别系统 (ResitMY OCR)

> 审核日期：2026-05-16
> 审核范围：全部源代码（前端 React/TypeScript + Supabase Edge Function Deno + 配置文件）

---

## 1. 审核概要

| 维度 | 评分 | 说明 |
|------|------|------|
| 代码结构 | ★★★☆☆ | 模块划分基本合理，但存在单文件过大、职责混杂的问题 |
| 可读性 | ★★★★☆ | 命名规范良好、注释较充分，但函数规模需控制 |
| 错误处理 | ★★★★☆ | Edge Function 错误处理完善，前端较弱 |
| 安全性 | ★★★☆☆ | 存在敏感信息泄露风险、CORS 配置过松、缺少输入校验 |
| 性能 | ★★★★☆ | 总体合理，前端小优化空间 |
| 测试 | ★☆☆☆☆ | **无任何实际测试用例** |
| 技术债务 | ★★☆☆☆ | 多处 mock 数据、未使用的 import、重复代码 |

---

## 2. 严重问题

### S-01 [严重] `.env.local` 泄露真实 Supabase Anon Key

- **文件**: `.worktrees/supabase-receipt-platform/.env.local`
- **问题**: 文件中包含真实可用的 Supabase URL 和 Anon Key
- **风险**: 已公开至 Git（虽被 `.gitignore` 忽略，但 worktree 中仍然存在）。若该 Key 未被 RLS 充分约束，攻击者可匿名读取/写入数据库
- **修复建议**:
  - 立即吊销该 Anon Key
  - 确认 `receipts` 表和 `receipt_items` 表的 RLS 策略已启用
  - 确认 Storage bucket `receipts` 未公开
  - 确认 `.env.local` 确已在 `.gitignore` 中并执行 `git rm --cached` 清理缓存

### S-02 [严重] 尝试从构建产物访问 `process.env.GEMINI_API_KEY`

- **文件**: `vite.config.ts:11`
  ```ts
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  ```
- **文件**: `src/services/geminiService.ts:3`
  ```ts
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  ```
- **问题**: Gemini API Key 被编译到前端静态资源中。浏览器 DevTools 可轻松提取
- **风险**: 前端直接持有 AI 服务密钥，可被滥用导致盗刷
- **修复建议**:
  - 迁移所有 AI/OCR 调用至 Supabase Edge Function
  - 前端仅保留 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`
  - `GEMINI_API_KEY` 仅作为原型开发用途，生产路径必须移除

### S-03 [中等] CORS 配置允许任意来源

- **文件**: `supabase/functions/parse-receipt/cors.ts:2`
  ```ts
  'Access-Control-Allow-Origin': '*',
  ```
- **问题**: Edge Function 在生产环境暴露 CORS 通配符
- **风险**: 任何网站均可发起 API 请求（尽管仍需 JWT 鉴权）
- **修复建议**: 指定允许的源（如前端部署域名）：
  ```ts
  'Access-Control-Allow-Origin': Deno.env.get('CORS_ORIGIN') || 'https://your-frontend.vercel.app',
  ```

### S-04 [中等] 前端无 XSS/注入防护

- **文件**: `src/App.tsx:1095-1118` 多处
- **问题**: 使用 `value={...}` + `onChange` 直接写入用户输入到 DOM，无 sanitize
- **风险**: 如果数据来源（如商户名称）包含恶意脚本，可导致 XSS
- **修复建议**: 使用 DOMPurify 或 React 默认转义机制，确保不通过 `dangerouslySetInnerHTML` 渲染

---

## 3. 代码质量问题

### Q-01 [中等] `App.tsx` 单文件过大（1423 行）

- **文件**: `src/App.tsx`
- **问题**: 所有组件逻辑（侧栏、上传区、表格、详情面板、设置弹窗、图片缩放）全部堆在一个组件内
- **影响**: 可维护性差，难以测试
- **修复建议**: 按以下结构拆分：
  - `components/Sidebar.tsx`
  - `components/UploadDropzone.tsx`
  - `components/ReceiptTable.tsx`
  - `components/ReceiptDetailPanel.tsx`
  - `components/SettingsModal.tsx`
  - `components/Toast.tsx`
  - `components/ZoomModal.tsx`

### Q-02 [中等] 大量使用 `any` 类型

- **文件**: `src/App.tsx:434` `useState<any[]>(INITIAL_HISTORY)`
- **问题**: 整个文件几乎全部使用 `any` 类型
- **影响**: 失去了 TypeScript 的类型安全保障
- **修复建议**: 定义完整的 `Receipt`、`ReceiptItem`、`UploadItem`、`Config` 等接口，替换所有 `any`

### Q-03 [中等] 前端 OCR 流程使用 `setTimeout` 模拟

- **文件**: `src/App.tsx:703-724`
  ```ts
  setTimeout(async () => {
    const mockResult = { ... };
    await syncToDatabase(mockResult);
    ...
  }, 1000);
  ```
- **问题**: 上传后使用 1 秒 `setTimeout` 生成 mock 数据
- **影响**: 用户获取不到真实 OCR 结果
- **修复建议**: 接入 Supabase Edge Function 或 Gemini SDK 的实际调用

### Q-04 [建议] 未使用的 import

- **文件**: `src/App.tsx:2-9`
- **问题**: 大量导入的 icon（如 `Clock`, `Loader2`, `Palette`, `Layout`, `Cloud`, `ShieldCheck`, `Landmark`, `Globe` 等）未在文件中使用
- **修复建议**: 删除未使用的 import

### Q-05 [建议] Edge Function 中 `any` 类型泛滥

- **文件**: `supabase/functions/parse-receipt/index.ts`（worktree 中）
- **问题**: 函数签名大量使用 `any`
- **修复建议**: 为 `Receipt`、`ReceiptItem`、`OcrResult` 等定义 TypeScript 接口

### Q-06 [建议] 前端 CSV 导出实现不完善

- **文件**: `src/App.tsx:614-658`
- **问题**:
  - 导出为 CSV 而非 XLSX（虽有 `xlsx` 依赖）
  - 未处理值中包含逗号/引号的情况（只对 merchant 和 tags 加了双引号）
  - 文件名使用 `:` 字符，在 Windows 上无效
- **修复建议**: 使用 `xlsx` 库导出真正的 `.xlsx` 文件，参考 `src/lib/export.ts` 的实现

---

## 4. 性能问题

### P-01 [中等] 每次重新渲染重新计算 `filteredHistory`

- **文件**: `src/App.tsx:533-542`
- **问题**: `useMemo` 依赖 `[history, filters]`，但 `history` 是整个列表
- **影响**: 列表较大时每次输入搜索字符都会全量过滤
- **修复建议**: 对搜索使用 `debounce`（300ms），或不在 `useMemo` 中过滤已同步的记录

### P-02 [建议] Edge Function 中 base64 转换效率低

- **文件**: `supabase/functions/parse-receipt/index.ts:1090-1097`
  ```ts
  async function blobToBase64(blob: Blob): Promise<string> {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }
    return btoa(binary)
  }
  ```
- **问题**: 使用字符串拼接将 `Uint8Array` 转换为二进制字符串，对大文件效率低
- **修复建议**: 使用 `FileReader` 或在 Deno 中使用标准库的 `encode` 方法

---

## 5. 测试覆盖

| 测试类型 | 状态 | 说明 |
|---------|------|------|
| 单元测试 | ❌ 无 | 无任何 `*.test.ts` 或 `*.spec.ts` 文件 |
| 集成测试 | ❌ 无 | 无集成测试 |
| E2E 测试 | ❌ 无 | 无 Playwright/Cypress 测试 |

- `docs/superpowers/plans/2026-05-14-supabase-receipt-platform.md` 中规划了 Vitest 测试，但尚未实现
- 核心业务逻辑（金额规范化、日期解析、类别校验）完全无测试覆盖

---

## 6. 马来西亚发票特定逻辑审核

### M-01 [严重] SST/GST 处理不一致

- **问题**: 前端 mock 数据使用 `tax_sst` 字段，而 Edge Function 规范字段使用 `tax`
- **文件对比**:
  - `src/App.tsx:27` 使用 `tax_sst: 7.12`
  - `supabase/functions/parse-receipt/index.ts:1061` 使用 `tax`
  - `docs/SUPABASE_SCHEMA.sql:28` 字段名为 `tax`
- **影响**: 前端 sync 到 Supabase 时字段名不匹配，`tax_sst` 值会丢失
- **修复建议**: 统一字段名为 `tax`（符合架构文档约定）

### M-02 [中等] SST 编号格式未校验

- **文件**: `src/App.tsx:1109-1111` 显示 `SST ID` 输入框
- **问题**: 马来西亚 SST-02 编号格式为 `B16-XXXX-XXXXXXXX`，代码中无校验
- **修复建议**: 添加 `sst_no` 格式校验正则：`/^[A-Z]\d{2}-\d{4}-\d{8}$/`

### M-03 [中等] 公司注册号格式未校验

- **文件**: `supabase/functions/parse-receipt/index.ts:839-846`
- **问题**: `inferCompanyRegNo` 中正则 `/^\d{8,14}\s*\([A-Z0-9-]{4,}\)$/i` 未覆盖所有马来西亚注册号格式
- **建议**: 马来西亚公司注册号格式为 `XXXXXXXX-X`（数字+连字符+校验码），当前抽取逻辑需增强

### M-04 [建议] 马来西亚电话号码格式

- **文件**: `supabase/functions/parse-receipt/index.ts:832-837`
- **问题**: 正则跨行匹配逻辑不够灵活
- **建议**: 马来西亚手机号格式为 `+60XX-XXXXXXX` 或 `01X-XXXXXXX`，当前正则 `(?:\+?60|0)\s?\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}` 覆盖较好，但建议增加对固话 `03-XXXXXXX` 的专门处理

### M-05 [建议] 日期解析默认 dd/MM/yyyy

- **文件**: `supabase/functions/parse-receipt/index.ts:801-814`
- **问题**: 代码实现了合理的日期推导逻辑，但优先将第一个数字作为日期（dd）而非月份
- **建议**: 马来西亚发票通常使用 dd/MM/yyyy 格式，当前逻辑符合要求。但建议增加对 `MM/dd/yyyy` 格式的容错

### M-06 [良好] 马来西亚燃油补贴发票处理完善

- **文件**: `supabase/functions/parse-receipt/prompt.ts:28-34`（worktree）
- **评价**: BUDI MADANI RON95 补贴发票的处理逻辑设计完善，涵盖 `subsidy_details` 中的 program、ref_no、pump_price、subsidy_price 等字段

---

## 7. 技术债务清单

| ID | 描述 | 位置 | 严重度 |
|----|------|------|--------|
| TD-01 | 前端 OCR 仅 mock 实现，未连接真实服务 | `src/App.tsx:703` | 严重 |
| TD-02 | `index (2).html` 为 Google AI Studio 导出，内容几乎与 `src/App.tsx` 重复 | 根目录 | 中等 |
| TD-03 | 前端 Supabase sync 使用 `upsert` 但未处理冲突 | `src/App.tsx:472-498` | 中等 |
| TD-04 | `src/App.tsx` 超级组件需拆分 | 全文件 | 中等 |
| TD-05 | 无 lint/prettier 配置 | 根目录 | 建议 |
| TD-06 | 前端导出 CSV 而非 XLSX（虽有 xlsx 依赖） | `src/App.tsx:614` | 建议 |
| TD-07 | 缺少分页实现，大数据量时列表卡顿 | `src/App.tsx:964` | 建议 |
| TD-08 | Edge Function 中 `consume_ocr_quota` RPC 在 SUPABASE_SCHEMA.sql 中未定义 | worktree/index.ts:141 | 中等 |

---

## 8. 安全评分卡

| 检查项 | 结果 | 备注 |
|--------|------|------|
| API Key 不在前端硬编码 | ⚠️ | Gemini Key 通过 Vite define 注入前端 |
| RLS 启用 | ✅ | SQL schema 已启用 |
| Storage 私有 | ✅ | SQL schema 注释说明 bucket 不公开 |
| JWT 校验 | ✅ | Edge Function 执行 |
| CORS 限制 | ❌ | 通配符 `*` |
| 输入 sanitize | ❌ | 无实现 |
| SQL 注入防护 | ✅ | 使用 Supabase SDK 参数化查询 |
| 请求速率限制 | ⚠️ | Edge Function 有配额逻辑但 SQL 中无对应 RPC 函数 |

---

## 9. 总结

### 亮点
- Edge Function 实现了多供应商 AI OCR 流水线（Tencent OCR + DeepSeek 修复、Qwen VL + DeepSeek 优化、OpenAI Vision）
- 马来西亚燃油补贴发票处理逻辑完善
- 日期/金额/类别规范化逻辑合理
- 配额管理系统防止 AI API 盗刷
- git 分支管理整洁，有明确的架构规划文档

### 必须修复（高优先级）
1. **吊销暴露的 Anon Key**（S-01）
2. **移除前端 Gemini API Key**（S-02）
3. **统一 `tax` / `tax_sst` 字段名**（M-01）

### 建议修复（中优先级）
4. 拆分 `App.tsx` 超级组件（Q-01）
5. 替换所有 `any` 为具体类型（Q-02）
6. 前端对接真实 OCR 服务（Q-03/TD-01）
7. 限制 Edge Function CORS 来源（S-03）
8. 创建 OCR 配额 RPC 函数（TD-08）

### 长期改进
9. 建立测试体系
10. 引入 lint/prettier
11. 清理 Google AI Studio 遗留文件
12. 添加 CI/CD 流水线
