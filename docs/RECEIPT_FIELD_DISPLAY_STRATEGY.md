# Receipt Field Display Strategy

目标：不同马来西亚票据格式差异很大，审核页不能把所有字段塞进同一套固定表单。页面应保持稳定的审核骨架，同时按票据类型展示专属字段，避免丢失模型识别出的重要信息。

## Rendering Model

审核页分三层展示：

1. 通用字段区
   - 商户名称
   - 日期、时间
   - 发票号或收据号
   - 公司注册号
   - 电话
   - 支付方式
   - 单据类型、行业、标签

2. 明细表区
   - 默认列：名称、数量、单价、行金额
   - 根据 `category` 调整列语义，但不改变底层 `receipt_items` 数据结构

3. 类型专属财务区
   - 用 `category`、`doc_type`、`subsidy_details`、`raw_ai.parser_meta` 决定展示模板
   - 未被模板消费的字段保留在“更多字段”折叠区，避免模型抽到的信息在 UI 中消失

## Type Profiles

### Grocery / Retail

适用：99 Speedmart、便利店、超市、小额零售。

明细列：
- 商品名
- 数量
- 单价
- 行金额

财务字段：
- Subtotal
- Discount
- Rounding
- Grand Total
- Change

显示重点：
- 商品行金额加总是否等于小计
- Rounding 是否解释了小计和总额的差异
- 若 OCR 明细名称质量低，显示人工复核提示

### F&B

适用：餐厅、火锅、咖啡店、酒楼。

明细列：
- 菜品或服务项
- 数量
- 单价
- 行金额

财务字段：
- Subtotal
- Discount
- Service Charge
- SST / Tax
- Rounding
- Grand Total

显示重点：
- Service Charge 和 SST 必须独立展示，不能合并到 Tax 或 Discount
- 如果票据上有 table no、server、pax、service staff，后续放入 `extra_fields`

### Fuel

适用：Shell、Petronas、Petron、BHP、Caltex 等加油收据。

明细列：
- 油品
- 升数
- RM/L
- 燃油总额

财务字段：
- Gross Total / Grand Total
- Government Subsidy
- Payable Total / OPT
- Pump Price
- Subsidy Price
- Subsidised Litre
- Previous Balance
- Remaining Balance

显示重点：
- `grand_total` 保留票面燃油总额，例如 RM 138.01
- `subsidy_details.government_subsidy` 展示政府补贴，例如 RM 73.69
- `subsidy_details.payable_total` 展示客户实付，例如 RM 64.32
- 政府补贴不应默认塞进 `discount`，除非票面明确写作普通折扣

### Tax Invoice

适用：正式税务发票、B2B 发票。

明细列：
- 项目
- 数量
- 单价
- 行金额
- 后续可扩展税率列

财务字段：
- Subtotal
- Tax / SST
- Grand Total
- Company Registration No
- SST No
- TIN

显示重点：
- 企业税务字段比商品明细更重要
- 如果模型抽出 `sst_no`、`tin_no`、`buyer_info`，后续应放入专门的 Tax block

### Payment Slip / Card Terminal Section

适用：收据下半部分的 VISA / MasterCard / terminal slip。

显示策略：
- 默认不作为商品明细
- 只抽取支付方式、授权码、交易参考号等关键字段
- 放在支付信息或更多字段中，不参与总额计算

## Data Contract

当前稳定字段：

```ts
category: 'Grocery' | 'Fuel' | 'F&B' | 'Retail' | 'Service' | 'Other'
doc_type: 'Receipt' | 'Invoice' | 'Credit Note' | 'Expense'
receipt_items: Array<{
  name: string
  qty: number
  unit: string | null
  unit_price: number
  line_total: number
}>
subsidy_details: Record<string, unknown> | null
raw_ai: Record<string, unknown> | null
```

建议下一步扩展：

```ts
extra_fields: Record<string, unknown> | null
parser_profile: 'grocery' | 'fnb' | 'fuel' | 'tax_invoice' | 'generic'
```

短期不需要新增数据库列也能工作，因为专属信息可先放在 `subsidy_details` 或 `raw_ai`。等票据类型稳定后，再把 `extra_fields` 提升为正式列。

## UI Rules

- 通用字段始终显示，减少审核人员切换成本。
- 类型专属字段只在有值时显示。
- 总额校验永远使用可解释公式，不把补贴、服务费、税费混在一起。
- 模型抽出的字段如果没有映射到 UI，要能在“更多字段”里看到。
- 对同一张票据，展示“票面总额”和“客户实付”时必须使用不同标签。

## Implementation Order

1. 保留当前通用审核页。
2. 已完成 Fuel / Budi Madani 专属展示。
3. 下一步补 F&B service/tax block。
4. 再补 Tax Invoice block。
5. 最后加 `extra_fields` 和字段折叠面板。
