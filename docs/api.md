# API 文档

本系统当前提供两种 API 形式：

1. **Supabase Edge Function** — 服务端 OCR/AI 处理接口
2. **Supabase 客户端 SDK** — 前端通过 SDK 直接操作数据库（受 RLS 保护）

---

## 1. Edge Function: `parse-receipt`

### 基本信息

| 属性 | 值 |
|------|-----|
| **端点** | `POST /functions/v1/parse-receipt` |
| **运行时** | Deno (Supabase Edge Function) |
| **鉴权** | Supabase JWT（Authorization Bearer Token） |
| **Content-Type** | `application/json` |

### 请求格式

```json
{
  "receipt_id": "uuid-string",
  "mode": "ocr"
}
```

**参数说明**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `receipt_id` | string | ✅ | — | 数据库中 `receipts` 表的记录 UUID |
| `mode` | string | ❌ | `"ocr"` | 管线模式，可选值见下表 |

**mode 可选值**：

| 值 | 行为 |
|----|------|
| `"ocr"` | 根据环境变量 `OCR_PROVIDER` 选择（`tencent` / 规则解析） |
| `"vision"` | 使用 `VISION_PROVIDER`（当前仅支持 `qwen`）直接解析图片 |
| `"smart"` | Qwen VL + DeepSeek 双重校验 |
| `"repair"` | 基于已有 `raw_ocr` 文本 + DeepSeek 修复 |

### 成功响应 (200)

```json
{
  "receipt": {
    "id": "uuid",
    "status": "pending_review",
    "merchant_name": "APPLE LEAF ENTERPRISE (SHELL)",
    "company_reg_no": "PG0187462-K",
    "invoice_no": "IRFI5ONDW",
    "date": "2026-04-14",
    "time": "15:27",
    "category": "Fuel",
    "doc_type": "Receipt",
    "subtotal": 138.01,
    "grand_total": 138.01,
    "payment_method": "Card",
    "subsidy_details": {
      "program": "BUDI MADANI",
      "government_subsidy": 34.20,
      "payable_total": 103.81
    },
    "items": [
      {
        "name": "FuelSave 95",
        "qty": 32.32,
        "unit": "L",
        "unit_price": 4.27,
        "line_total": 138.01
      }
    ],
    "receipt_items": [ ... ]
  }
}
```

### 错误响应

| HTTP 状态 | 说明 |
|-----------|------|
| 400 | 缺少必填参数 `receipt_id` |
| 401 | 缺少 Authorization 头 或 用户会话无效 |
| 404 | 未找到指定 receipt 或不属于当前用户 |
| 500 | OCR/AI 处理失败，`error_message` 包含详情 |

```json
// 401 Unauthorized
{ "error": "Missing Authorization header" }

// 400 Bad Request
{ "error": "receipt_id is required" }

// 404 Not Found
{ "error": "Receipt not found" }

// 500 Internal Server Error
{ "error": "Tencent OCR failed with HTTP 403" }
```

### 调用示例 (前端)

```ts
// 使用 Supabase JS SDK（推荐）
const { data, error } = await supabase.functions.invoke('parse-receipt', {
  body: { receipt_id: 'abc-123', mode: 'vision' },
})

// 或使用 fetch
const { data, error } = await fetch(
  'https://<project>.supabase.co/functions/v1/parse-receipt',
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ receipt_id: 'abc-123' }),
  }
).then(res => res.json())
```

---

## 2. Supabase 数据库 API

前端通过 `@supabase/supabase-js` SDK 直接操作数据库。所有请求受 **RLS (Row Level Security)** 保护，用户只能访问自己的数据。

### receipts

| 方法 | 描述 |
|------|------|
| `supabase.from('receipts').select('*, receipt_items(*)')` | 查询列表（含明细） |
| `supabase.from('receipts').insert({...})` | 创建记录 |
| `supabase.from('receipts').update({...}).eq('id', id)` | 更新记录 |
| `supabase.from('receipts').delete().eq('id', id)` | 删除记录 |

### receipt_items

| 方法 | 描述 |
|------|------|
| `supabase.from('receipt_items').insert([...])` | 批量插入明细 |
| `supabase.from('receipt_items').delete().eq('receipt_id', id)` | 删除某发票的全部明细（更新前操作） |

### 查询示例

```ts
// 查询当前用户的发票列表（按创建时间倒序）
const { data, error } = await supabase
  .from('receipts')
  .select('*, receipt_items(*)')
  .order('created_at', { ascending: false })

// 按状态筛选
const { data } = await supabase
  .from('receipts')
  .select('*')
  .eq('status', 'pending_review')

// 按日期范围筛选
const { data } = await supabase
  .from('receipts')
  .select('*')
  .gte('date', '2026-01-01')
  .lte('date', '2026-12-31')
```

---

## 3. Supabase Storage API

### 上传发票图片

```ts
const filePath = `${user.id}/${receiptId}/original.${fileExt}`
const { error } = await supabase.storage
  .from('receipts')
  .upload(filePath, file)
```

### 获取公共 URL

```ts
const { data: { publicUrl } } = supabase.storage
  .from('receipts')
  .getPublicUrl(filePath)
```

---

## 4. 错误码参考

| 错误消息 | 可能原因 |
|----------|---------|
| `Missing Authorization header` | 请求未携带 JWT |
| `Invalid user session` | JWT 已过期或无效 |
| `Receipt not found` | `receipt_id` 不存在或不属于当前用户 |
| `Receipt file_path is missing` | 记录未关联 Storage 文件 |
| `Tencent OCR failed` | Tencent API 调用失败（检查密钥/配额） |
| `Qwen vision receipt parsing failed` | DashScope API 调用失败 |
| `OpenAI receipt parsing failed` | OpenAI API 调用失败 |
| `Missing DEEPSEEK_API_KEY` | 修复模式启用但未配置密钥 |
| `OCR free monthly quota reached` | 当月免费 OCR 额度耗尽 |

---

## 5. 环境变量对照

| 环境变量 | 使用位置 | 说明 |
|----------|---------|------|
| `VITE_SUPABASE_URL` | 前端 | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | 前端 | 匿名 Key (可公开) |
| `GEMINI_API_KEY` | 不使用 | 生产路径已移除前端 Gemini 调用 |
| `OPENAI_API_KEY` | Edge Function | OpenAI API Key |
| `GOOGLE_VISION_KEY` | Edge Function | Google Vision API Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function | Supabase 服务角色密钥 |
| `TENCENT_SECRET_ID` | Edge Function | 腾讯云 SecretId |
| `TENCENT_SECRET_KEY` | Edge Function | 腾讯云 SecretKey |
| `DASHSCOPE_API_KEY` | Edge Function | 阿里云 DashScope API Key |
| `DEEPSEEK_API_KEY` | Edge Function | DeepSeek API Key |
