import { ReceiptData } from "../services/geminiService";
import * as XLSX from "xlsx";

export function exportToExcel(receipts: (ReceiptData & { filename: string; processedAt: string })[]) {
  const flatData = receipts.flatMap((r) => {
    if (r.items && r.items.length > 0) {
      return r.items.map((item) => ({
        Filename: r.filename,
        Merchant: r.merchant_name,
        RegNo: r.company_reg_no,
        InvoiceNo: r.invoice_no,
        Date: r.date,
        Time: r.time,
        DocType: r.doc_type,
        Category: r.category,
        Item: item.item,
        Qty: item.qty,
        UnitPrice: item.unit_price,
        LineTotal: item.line_total,
        Subtotal: r.subtotal,
        Tax: r.tax,
        ServiceCharge: r.service_charge,
        Rounding: r.rounding,
        GrandTotal: r.grand_total,
        Payment: r.payment_method,
        Tags: r.tags?.join(", ") || "",
        ProcessedAt: r.processedAt,
      }));
    } else {
      return [{
        Filename: r.filename,
        Merchant: r.merchant_name,
        RegNo: r.company_reg_no,
        InvoiceNo: r.invoice_no,
        Date: r.date,
        Time: r.time,
        DocType: r.doc_type,
        Category: r.category,
        Item: "N/A",
        Qty: 0,
        UnitPrice: 0,
        LineTotal: 0,
        Subtotal: r.subtotal,
        Tax: r.tax,
        ServiceCharge: r.service_charge,
        Rounding: r.rounding,
        GrandTotal: r.grand_total,
        Payment: r.payment_method,
        Tags: r.tags?.join(", ") || "",
        ProcessedAt: r.processedAt,
      }];
    }
  });

  const ws = XLSX.utils.json_to_sheet(flatData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Receipts");

  const dateStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `Receipts_Export_${dateStr}.xlsx`);
}
