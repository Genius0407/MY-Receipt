export type SubsidyDetails = Record<string, unknown> | null | undefined

export interface SubsidyRow {
  label: string
  value: string
}

export function asSubsidyObject(details: SubsidyDetails) {
  return details && typeof details === 'object' ? details : null
}

export function readSubsidyText(details: SubsidyDetails, keys: string[]) {
  const object = asSubsidyObject(details)
  if (!object) return ''
  for (const key of keys) {
    const value = object[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

export function readSubsidyNumber(details: SubsidyDetails, keys: string[]) {
  const object = asSubsidyObject(details)
  if (!object) return null
  for (const key of keys) {
    const value = object[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value.replace(/[^\d.-]/g, ''))
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

export function hasSubsidyDetails(details: SubsidyDetails) {
  const object = asSubsidyObject(details)
  if (!object) return false
  return Object.values(object).some((value) => value !== null && value !== undefined && String(value).trim() !== '')
}

export function getSubsidyPayable(details: SubsidyDetails) {
  return readSubsidyNumber(details, ['payable_total', 'paid_total', 'opt', 'outstanding_payment_total'])
}

export function formatSubsidyHeadline(details: SubsidyDetails, currency = 'RM') {
  const program = readSubsidyText(details, ['program', 'scheme', 'name'])
  const description = readSubsidyText(details, ['description', 'notes', 'note'])
  const governmentSubsidy = readSubsidyNumber(details, ['government_subsidy', 'subsidy_amount'])
  const payableTotal = getSubsidyPayable(details)

  if (program && governmentSubsidy !== null && payableTotal !== null) {
    return `${program}: subsidy ${currency} ${governmentSubsidy.toFixed(2)}, payable ${currency} ${payableTotal.toFixed(2)}`
  }
  return program || description || ''
}

export function buildSubsidyRows(details: SubsidyDetails, currency: string): SubsidyRow[] {
  const object = asSubsidyObject(details)
  if (!object) return []

  const payableTotal = getSubsidyPayable(object)
  const money = (value: number | null) => value === null ? '' : `${currency} ${value.toFixed(2)}`
  const litres = (value: number | null) => value === null ? '' : `${value.toFixed(3)} L`

  const rows = [
    { label: '计划', value: readSubsidyText(object, ['program', 'scheme', 'name']) },
    { label: '参考号', value: readSubsidyText(object, ['ref_no', 'reference_no']) },
    { label: '原价', value: money(readSubsidyNumber(object, ['pump_price'])) },
    { label: '补贴价', value: money(readSubsidyNumber(object, ['subsidy_price'])) },
    { label: '补贴升数', value: litres(readSubsidyNumber(object, ['subsidised_litre', 'subsidized_litre', 'litres'])) },
    { label: '政府补贴', value: money(readSubsidyNumber(object, ['government_subsidy', 'subsidy_amount'])) },
    { label: '实付/OPT', value: money(payableTotal) },
    { label: '补贴前余额', value: litres(readSubsidyNumber(object, ['previous_balance_litre', 'previous_balance'])) },
    { label: '补贴后余额', value: litres(readSubsidyNumber(object, ['remaining_balance_litre', 'remaining_balance'])) },
  ]

  return rows.filter((row) => row.value)
}
