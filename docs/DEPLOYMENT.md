# 部署与密钥管理

## 1. 部署目标

项目由两部分组成：

| 部分 | 部署位置 |
| --- | --- |
| 静态前端 | Vercel、Netlify、Cloudflare Pages、Supabase Hosting 或任意静态站点服务 |
| OCR/AI 函数 | Supabase Edge Functions |

不需要购买或维护 VPS。

## 2. 前端环境变量

这些变量会进入浏览器，可以公开，但必须配合 Supabase RLS：

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

不要在前端配置中出现：

```text
OPENAI_API_KEY
GOOGLE_VISION_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
```

## 3. Supabase Edge Function Secrets

以下密钥只存入 Supabase Edge Function Secrets：

```text
OPENAI_API_KEY
GOOGLE_VISION_KEY
SUPABASE_SERVICE_ROLE_KEY
```

设置示例：

```bash
supabase secrets set OPENAI_API_KEY=sk-xxx
supabase secrets set GOOGLE_VISION_KEY=xxx
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxx
```

本地开发可以使用 `.env.local`，但必须加入 `.gitignore`。仓库只保留 `.env.example`。

## 4. Supabase 资源

需要创建：

1. Supabase Auth。
2. Storage bucket：`receipts`。
3. Postgres 表：`receipts`、`receipt_items`。
4. RLS policies。
5. Edge Function：`parse-receipt`。

数据库和 RLS 参考 [SUPABASE_SCHEMA.sql](./SUPABASE_SCHEMA.sql)。

## 5. 公网安全要求

上线前必须完成：

- 所有业务表启用 RLS。
- Storage bucket 默认不公开。
- Storage policy 限制用户只能访问 `receipts/{auth.uid()}/...`。
- Edge Function 校验 JWT，不接受匿名 OCR/AI 请求。
- Edge Function 调用前检查 `receipt_id` 所属用户。
- OpenAI/Google/Supabase service role key 不进入前端包。
- 对单用户 OCR/AI 调用量做基础限制，避免盗刷。

## 6. CORS

前端使用 Supabase JS：

```js
await supabase.functions.invoke('parse-receipt', {
  body: { receipt_id }
})
```

优先使用 SDK 调用 Edge Function。若直接使用 `fetch`，Edge Function 需要处理 `OPTIONS` 预检并返回允许的来源。

## 7. 项目部署记录

上线前填写：

```text
Supabase project ref:
Supabase URL:
Frontend deploy URL:
Storage bucket: receipts
Edge Function: parse-receipt
```

## 8. Storage Policy

`docs/SUPABASE_SCHEMA.sql` 会创建私有 `receipts` bucket，并按对象路径第一段限制访问：

```text
{user_id}/{receipt_id}/original.ext
```

前端上传文件时必须使用该路径格式。Edge Function 使用 service role 读取原始文件并写回解析结果。

