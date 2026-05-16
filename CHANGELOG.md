# 变更日志

## [v0.1.0] — 2026-05-14

### 初始版本

### 新增功能

- **项目初始化**：基于 React 19 + TypeScript + Vite 6 + Tailwind CSS 4 的项目结构
- **ResitMY OCR 原型**：
  - Google Gemini API 集成（前端直接调用，原型阶段）
  - 基本发票识别与结构化 JSON 提取
  - 马来西亚发票专用提示词（SST/GST、日期格式、货币）
- **前端界面**：
  - 上传区（拖拽/点击上传）
  - 发票列表与筛选（搜索、状态、类型、标签）
  - 三栏审校面板（原图 + SKU 编辑 + 财务数学引擎）
  - 深色/浅色模式切换
  - 三色主题（Indigo / Emerald / Rose）
  - 三语界面支持（中文 / English / Melayu）
  - 设置弹窗（语言、货币、主题）
  - CSV 导出
- **Supabase 集成规划**：
  - 数据库 Schema（`receipts` + `receipt_items` 表，含索引和 RLS）
  - 架构文档
  - 部署文档与密钥管理方案
  - 开发执行计划

### 文档

- 初始 README.md
- 架构说明文档
- 部署与密钥管理文档
- Supabase 数据库 Schema SQL

## [v0.2.0] — 2026-05-14

### 新增功能

- **Supabase Edge Function 核心实现**（在 `feature/supabase-receipt-platform` 分支）：
  - 多 AI 供应商 OCR 管线
  - JWT 身份验证与用户所有权检查
  - Storage 图片下载
  - 规则引擎 OCR 提取（从文件名/OCR 文本推断字段）
  - Tencent OCR 集成（含 SHA-256 腾讯云 API 签名）
  - OpenAI GPT-4o-mini Vision 集成
  - Qwen VL（阿里云 DashScope）视觉模型集成
  - DeepSeek 文本修复管线
  - DeepSeek 视觉优化管线
  - Smart 模式（Qwen VL + DeepSeek 双重校验）
  - 结果标准化（金额、日期、类别枚举）
  - 配额管理系统（月度免费 OCR 调用限制）
  - 商品质量门控（对可疑商品名称自动降级）
- **燃油补贴发票专项处理**：
  - BUDI MADANI RON95 补贴结构
  - `subsidy_details` JSON 字段（program、ref_no、pump_price、subsidy_price、government_subsidy、payable_total 等）
  - Shell 加油站发票识别规则
- **前端增强**：
  - SheetJS XLSX 导出实现（`src/lib/export.ts`）
  - 完整 TypeScript 接口定义（`ReceiptData`）

### 变更

- 从 Cloudflare Worker 方案迁移至 Supabase Edge Function
- 从 Google Sheets 存储迁移至 Supabase Postgres

### 文档

- Supabase 集成实施计划（`docs/superpowers/plans/2026-05-14-supabase-receipt-platform.md`）
- Edge Function 开发说明
- API 文档

## 发布说明

| 版本 | 日期 | Git 标签 | 主要里程碑 |
|------|------|----------|----------|
| v0.1.0 | 2026-05-14 | `67f44a8` | 初始项目搭建、前端原型、UI 界面 |
| v0.2.0 | 2026-05-14 | `9d594e6` | Edge Function 多管线 AI 实现、燃油发票支持 |
