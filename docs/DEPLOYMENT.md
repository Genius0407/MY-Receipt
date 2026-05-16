# 部署文档

## 1. 部署架构

```
                    ┌─────────────────────────────┐
                    │     静态托管服务              │
                    │  (Vercel / Netlify / CF     │
                    │   Pages / Supabase Hosting)  │
                    │                             │
                    │  dist/ (Vite 构建产物)       │
                    └────────────┬────────────────┘
                                 │
                    环境变量：VITE_SUPABASE_URL
                             VITE_SUPABASE_ANON_KEY
                                 │
                                 ▼
                    ┌─────────────────────────────┐
                    │      Supabase 项目            │
                    │                              │
                    │  ├─ Auth                      │
                    │  ├─ Storage (receipts bucket) │
                    │  ├─ Postgres (receipts +      │
                    │  │            receipt_items)  │
                    │  └─ Edge Functions            │
                    │     (parse-receipt)           │
                    └──────────────────────────────┘
```

**特点**：无需 VPS 或自建服务器。前端为纯静态 SPA，后端依赖 Supabase 全托管 BaaS。

---

## 2. 环境变量清单

### 2.1 前端环境变量（需设置到托管平台）

| 变量 | 示例值 | 说明 |
|------|--------|------|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | `sb-publishable-xxx` | Supabase 匿名密钥（可在 Supabase Dashboard → Settings → API 获取） |

### 2.2 Edge Function Secrets（Supabase Dashboard 设置）

```bash
# 使用 Supabase CLI 设置
supabase secrets set OPENAI_API_KEY=sk-xxx
supabase secrets set GOOGLE_VISION_KEY=xxx
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxx
supabase secrets set TENCENT_SECRET_ID=xxx
supabase secrets set TENCENT_SECRET_KEY=xxx
supabase secrets set DASHSCOPE_API_KEY=sk-xxx
supabase secrets set DEEPSEEK_API_KEY=sk-xxx
```

或在 Supabase Dashboard → Edge Functions → Secrets 中设置。

| 密钥 | 必需 | 说明 |
|------|------|------|
| `OPENAI_API_KEY` | 可选 | OpenAI GPT-4o-mini Vision |
| `GOOGLE_VISION_KEY` | 可选 | Google Vision OCR（未使用于当前管线） |
| `SUPABASE_SERVICE_ROLE_KEY` | **是** | 用于 Edge Function 服务端操作数据库 |
| `TENCENT_SECRET_ID` | 可选 | 腾讯云 OCR |
| `TENCENT_SECRET_KEY` | 可选 | 腾讯云 OCR |
| `DASHSCOPE_API_KEY` | 可选 | 阿里云 Qwen VL |
| `DEEPSEEK_API_KEY` | 可选 | DeepSeek 文本修复/视觉优化 |

> **安全红线**：以下密钥**绝对不可**出现在前端构建产物中：
> - `OPENAI_API_KEY`
> - `GOOGLE_VISION_KEY`
> - `SUPABASE_SERVICE_ROLE_KEY`
> - `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY`
> - `DASHSCOPE_API_KEY`
> - `DEEPSEEK_API_KEY`

---

## 3. Supabase 初始化

### 3.1 创建项目

在 [supabase.com](https://supabase.com) 创建新项目。

### 3.2 创建数据库表

打开 Supabase SQL Editor，执行 `docs/SUPABASE_SCHEMA.sql`。该脚本将创建：

- `public.receipts` 表 + 索引
- `public.receipt_items` 表 + 索引
- RLS 策略（用户只能访问自己的数据）
- `updated_at` 自动更新触发器

### 3.3 创建 Storage Bucket

```bash
# 方法一：Supabase CLI
supabase storage create receipts

# 方法二：Supabase Dashboard → Storage → Create bucket
# 名称： receipts
# 公开： 否
```

推荐的文件路径格式：
```
receipts/{user_id}/{receipt_id}/original.ext
```

### 3.4 部署 Edge Function

```bash
# 本地开发
cd supabase/functions/parse-receipt

# 部署
npx supabase functions deploy parse-receipt

# 设置 Secrets
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxx
# ... 其他密钥
```

---

## 4. 前端部署

### 4.1 Vercel 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel --prod

# 设置环境变量（也可以在 Vercel Dashboard 操作）
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

### 4.2 Netlify 部署

1. 连接 Git 仓库
2. 构建设置：
   - Build command: `npm run build`
   - Publish directory: `dist`
3. 环境变量：在 Site settings → Environment variables 中设置
4. 部署

### 4.3 Docker 部署

项目为纯静态 SPA，可通过 nginx 容器化：

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```nginx
# nginx.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
docker build -t my-receipt .
docker run -p 8080:80 my-receipt
```

---

## 5. AI 管线配置

通过环境变量控制 Edge Function 的 AI 行为：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `OCR_PROVIDER` | (空) | `tencent` 使用腾讯云 OCR |
| `USE_OPENAI_VISION` | `false` | 设为 `true` 使用 OpenAI Vision |
| `VISION_PROVIDER` | `qwen` | 视觉模型供应商 |
| `QWEN_VL_MODEL` | `qwen3.6-plus` | Qwen 模型版本 |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | DeepSeek 模型版本 |
| `AI_REPAIR_PROVIDER` | (空) | `deepseek` 启用文本修复 |
| `VISION_REPAIR_PROVIDER` | (空) | `deepseek` 启用视觉优化 |
| `OCR_FREE_MONTHLY_LIMIT` | `900` | 免费 OCR 月度配额 |
| `VISION_MONTHLY_LIMIT` | `100` | 视觉模型月度配额 |
| `DEEPSEEK_MONTHLY_LIMIT` | `500` | DeepSeek 月度配额 |
| `TENCENT_OCR_ACTION` | `GeneralBasicOCR` | 腾讯 OCR API 动作 |
| `TENCENT_OCR_LANGUAGE` | `may` | 腾讯 OCR 语言（may=马来文） |
| `TENCENT_OCR_REGION` | `ap-guangzhou` | 腾讯云地域 |

---

## 6. 安全清单

上线前逐项确认：

- [ ] 所有业务表已启用 RLS
- [ ] Storage bucket `receipts` 设为非公开
- [ ] Storage policy 限制用户路径 `receipts/{auth.uid()}/...`
- [ ] Edge Function 校验 JWT
- [ ] Edge Function 调用前检查 `receipt_id` 所属用户
- [ ] AI 密钥不在前端包中
- [ ] 对单用户 OCR 调用量有限制
- [ ] CORS 已限制到具体域名
- [ ] `.env` / `.env.local` 不在 Git 中
- [ ] `npm run build` 通过且无 TypeScript 错误

---

## 7. 本地开发

### 7.1 Supabase 本地开发

```bash
# 安装 Supabase CLI
npm install -g supabase

# 启动本地 Supabase
supabase start

# 本地 Edge Function 调试
supabase functions serve parse-receipt --env-file .env.local
```

### 7.2 前端本地开发

```bash
npm run dev
# 访问 http://localhost:3000
```

### 7.3 验证命令

```bash
npm run lint       # TypeScript 类型检查
npm run build      # 生产构建
```
