# 开发者指南

## 1. 本地环境准备

### 1.1 前提条件

| 工具 | 版本要求 | 用途 |
|------|---------|------|
| Node.js | >= 18 | 前端开发与构建 |
| npm | >= 9 | 包管理 |
| Git | >= 2.30 | 版本控制 |
| Supabase CLI（可选） | 最新版 | Edge Function 本地调试 |

### 1.2 安装依赖

```bash
# 前端依赖
npm install

# Supabase CLI（如需要本地调试 Edge Function）
npm install -g supabase
```

### 1.3 环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 填入你的密钥
```

### 1.4 启动开发服务器

```bash
npm run dev
```

前端开发服务器运行在 `http://localhost:3000`，支持 HMR。

---

## 2. 项目结构详解

```
ResitAI/
│
├── src/                           # React 前端源码
│   ├── App.tsx                    # 主应用组件
│   │   └── 包含：上传区、列表表格、三栏审校面板、
│   │             设置弹窗、图片缩放、多语言、深色模式
│   ├── main.tsx                   # 应用入口
│   ├── index.css                  # 全局样式 + Tailwind CSS 入口
│   ├── lib/
│   │   ├── supabase.ts            # Supabase 客户端单例
│   │   └── exportExcel.ts         # ExcelJS 导出工具
│   └── services/
│       └── receiptApi.ts          # 浏览器侧唯一 receipt 数据入口
│
├── supabase/functions/            # Edge Function 源码
│   ├── README.md                  # 开发说明
│   └── parse-receipt/             # 核心 OCR/AI 处理函数
│       ├── index.ts               # 主逻辑（多管线调度、标准化写入）
│       ├── prompt.ts              # AI 提示词模板
│       └── cors.ts                # CORS 头配置
│
├── docs/                          # 文档目录
│   ├── architecture.md            # 架构说明
│   ├── api.md                     # API 文档
│   ├── deployment.md              # 部署与密钥管理
│   ├── development.md             # 本指南
│   └── SUPABASE_SCHEMA.sql        # 数据库 DDL
│
├── 发票示例/                      # 用于测试的发票图片
├── {分支: supabase-receipt-platform}/
│   └── supabase/functions/...     # 该分支包含完整的 Edge Function 实现
│
├── index.html                     # Vite HTML 入口
├── package.json
├── vite.config.ts
├── tsconfig.json
└── .env.example
```

---

## 3. 核心开发工作流

### 3.1 添加新发票模板/识别规则

发票识别管线位于 Edge Function `supabase/functions/parse-receipt/index.ts`。添加新规则通常涉及以下步骤：

#### 步骤 A：修改 Prompt（AI 模板）

编辑 `supabase/functions/parse-receipt/prompt.ts`：

```ts
// 在 SYSTEM_PROMPT 中添加新规则
export const SYSTEM_PROMPT = `You extract structured data from Malaysian receipts and invoices.
...
New rule: [你的规则描述]
`
```

#### 步骤 B：添加规则引擎逻辑

在 `index.ts` 中添加推断函数：

```ts
function inferCustomField(lines: string[]): string | null {
  // 从 OCR 文本中提取自定义字段
  for (const line of lines) {
    const match = line.match(/your-regex-here/i)
    if (match) return match[1]
  }
  return null
}
```

然后在 `inferReceiptFromOcrText()` 中调用。

#### 步骤 C：添加字段到 Normalize 函数

```ts
// 在 normalizeReceipt() 中添加
custom_field: stringOrNull(input.custom_field),
```

#### 步骤 D：更新数据库 Schema（如有新字段）

在 `docs/SUPABASE_SCHEMA.sql` 中添加列，并执行 ALTER TABLE。

#### 步骤 E：更新导出模板

在 `src/lib/exportExcel.ts` 中添加新字段到 `Receipts` sheet；明细字段放入 `Items` sheet。

#### 步骤 F：更新前端界面

在 `src/App.tsx` 的审校面板中添加新字段输入框。

### 3.2 添加新 AI 供应商

1. 在 `prompt.ts` 中确认 Prompt 兼容
2. 在 `index.ts` 中添加调用函数（参考 `runTencentOCR()`、`runQwenVision()` 模式）
3. 在 `serve()` 主路由中添加管线分支（参考现有 `parseMode` 选择逻辑）
4. 在 `.env.example` 中添加对应密钥变量
5. 在 `docs/deployment.md` 中添加环境变量说明

### 3.3 添加新 UI 组件

当前 `src/App.tsx` 是超级组件，建议逐步拆分：

```
src/components/
├── Sidebar.tsx           # 侧栏导航
├── UploadDropzone.tsx    # 拖拽上传区
├── UploadProgress.tsx    # 上传进度列表
├── ReceiptTable.tsx      # 发票列表表格
├── ReceiptDetailPanel.tsx # 三栏审校面板
├── SettingsModal.tsx     # 设置弹窗
├── Toast.tsx             # Toast 通知
└── ZoomModal.tsx         # 图片缩放预览
```

---

## 4. 代码风格指南

### 4.1 TypeScript 约定

```ts
// ✅ 正确定义接口
interface Receipt {
  id: string
  merchant_name: string | null
  items: ReceiptItem[]
}

// ❌ 避免 any
const [data, setData] = useState<any[]>([])
```

### 4.2 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件 | PascalCase | `ReceiptTable` |
| 函数/变量 | camelCase | `inferMerchantName` |
| 接口 | PascalCase | `ReceiptItem` |
| 类型别名 | PascalCase | `ReceiptStatus` |
| 枚举值 | PascalCase | `'Pending'`、`'Synced'` |
| 常量 | UPPER_SNAKE | `VALID_CATEGORIES` |
| 文件 | camelCase | `receiptApi.ts` |

### 4.3 React 组件规范

```tsx
// ✅ 组件声明
function Component({ prop1, prop2 }: ComponentProps) {
  // hooks 在顶部
  const [state, setState] = useState(initial)
  const derived = useMemo(() => compute(state), [state])

  // 事件处理以 handle 开头
  const handleClick = () => { ... }

  // JSX
  return <div>...</div>
}
```

### 4.4 错误处理

```ts
// ✅ 总是处理错误
try {
  await riskyOperation()
} catch (err) {
  console.error('Context:', err)
  // 用户友好的错误提示
  showToast('操作失败，请重试', 'error')
}
```

### 4.5 Commit 规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <description>

feat:    新功能
fix:     修复
docs:    文档
chore:   构建/工具
refactor:重构
test:    测试
style:   样式（非逻辑变更）
```

示例：
```
feat(edge-function): add Tencent OCR support
fix(frontend): correct date parsing for DD/MM/YYYY
docs: add API documentation
```

---

## 5. 本地调试指南

### 5.1 前端调试

```bash
# 开发模式（HMR）
npm run dev

# TypeScript 检查
npm run lint

# 生产构建
npm run build
```

### 5.2 Edge Function 本地调试

```bash
# 启动本地 Supabase
supabase start

# 启动 Edge Function（热重载）
supabase functions serve parse-receipt --env-file .env.local

# 测试调用（另开终端）
curl -X POST http://localhost:54321/functions/v1/parse-receipt \
  -H 'Authorization: Bearer <your-local-jwt>' \
  -H 'Content-Type: application/json' \
  -d '{"receipt_id": "test-uuid"}' \
  --verbose
```

### 5.3 使用测试图片

`发票示例/` 目录包含 3 张马来西亚发票测试图片：

```
发票示例/
├── f2ca9fab...jpg  # Shell 燃油补贴发票
├── ee709c01...jpg  # 99 Speed Mart 零售发票
└── 370cc824...jpg  # 第三张发票
```

### 5.4 常见调试技巧

- **查看 Supabase 数据库**：使用 Supabase Dashboard → Table Editor
- **查看 Storage 文件**：Supabase Dashboard → Storage
- **查看 Edge Function 日志**：Supabase Dashboard → Edge Functions → parse-receipt → Logs
- **前端调试**：打开浏览器 DevTools → Network 查看 API 请求/响应
- **验证金额计算**：在审校面板查看"数学引擎"计算结果与 OCR 总额的差异

---

## 6. 测试

当前项目**尚未建立测试体系**。建议引入以下框架：

```bash
# 单元测试
npm install -D vitest

# E2E 测试（可选）
npm install -D @playwright/test
```

测试目录约定：

```
src/
  __tests__/
    normalizeReceipt.test.ts
    exportExcel.test.ts
    inferFields.test.ts
```

---

## 7. 分支策略

```
main                         # 稳定分支
├── feature/*                # 新功能开发
├── fix/*                    # Bug 修复
├── refactor/*               # 重构
├── docs/*                   # 文档更新
└── supabase-receipt-platform # Supabase 集成分支（当前 worktree）
```

- 新功能从 `main` 创建特性分支
- 完成后发起 Pull Request 合并回 `main`
- `supabase-receipt-platform` 分支通过 git worktree 管理，包含完整的 Edge Function 实现
