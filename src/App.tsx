import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Upload, FileText, Search, Filter, Download, CheckCircle, Clock, AlertCircle, 
  Loader2, MoreHorizontal, Settings, Plus, X, ChevronRight, Database, Trash2, 
  ExternalLink, ChevronDown, Eye, CreditCard, Building2, Receipt, Save, RefreshCw,
  Info, ShieldCheck, Landmark, Globe, Palette, Layout, ShoppingCart, Calculator,
  Tag, AlertTriangle, FileSpreadsheet, Cpu, RefreshCcw, FileOutput, ZoomIn, Cloud,
  Languages, Sun, Moon, Banknote
} from 'lucide-react';
import {
  createReceiptFileSignedUrl,
  createReceiptFromFile,
  deleteReceipt,
  listReceipts,
  saveReceipt,
} from './lib/receiptApi';
import { downloadReceiptsXlsx } from './lib/exportExcel';

// 初始模拟数据：完全覆盖 PRD V1.1 的所有字段与要求状态
const INITIAL_HISTORY = [
  {
    id: 'hdl-001',
    status: 'Pending', 
    merchant_name: 'Hai Di Lao Malaysia Sdn. Bhd.',
    company_reg_no: '1280055-D',
    sst_no: 'B16-1903-32100036',
    tin_no: 'C258100200', 
    phone: '03-33221100', 
    date: '2026-03-30',
    time: '18:34',
    subtotal: 118.70,
    discount: 0.00, 
    service_charge: 11.87, 
    tax_sst: 7.12, 
    rounding: 0.09,
    grand_total: 137.60,
    change: 0.00, 
    payment_method: 'Touch-go',
    doc_type: 'Receipt',
    industry: 'F&B',
    tags: ['Business', 'Tax Deductible'], 
    invoice_no: '2026033000074',
    confidence_score: 0.99,
    image_url: '/input_file_2.png', 
    items: [
      { id: 'i1', name: "清水火锅 (Soup Base)", qty: 1, unit_price: 48.00, line_total: 48.00 },
      { id: 'i2', name: "芝士鱼豆腐 (Cheese Fish Tofu)", qty: 1, unit_price: 14.00, line_total: 14.00 },
      { id: 'i3', name: "猪梅花肉 (Pork Collar)", qty: 2, unit_price: 19.80, line_total: 39.60 }
    ]
  },
  {
    id: 'shell-002',
    status: 'Synced', 
    merchant_name: 'APPLE LEAF ENTERPRISE (SHELL)',
    company_reg_no: 'PG0187462-K',
    date: '2026-04-14',
    time: '15:27',
    subtotal: 138.01,
    discount: 0,
    service_charge: 0,
    tax_sst: 0,
    rounding: 0,
    grand_total: 138.01,
    subsidy_info: 'Targeted Subsidy Applied (Budi Madani)',
    doc_type: 'Receipt',
    industry: 'Fuel',
    tags: ['Business'],
    invoice_no: 'IRFI5ONDW',
    confidence_score: 0.97,
    image_url: '/input_file_0.png', 
    items: [
      { id: 'i4', name: "FuelSave 95", qty: 32.32, unit_price: 4.27, line_total: 138.01 }
    ]
  },
  {
    id: '99-003',
    status: 'Pending', 
    merchant_name: '99 SPEED MART SDN. BHD.',
    company_reg_no: '519537-X',
    sst_no: '',
    tin_no: '', 
    phone: '', 
    date: '2024-05-09',
    time: '21:25',
    subtotal: 19.89,
    discount: 0.00, 
    service_charge: 0.00, 
    tax_sst: 0.00, 
    rounding: 0.01,
    grand_total: 19.90,
    change: 0.00, 
    payment_method: 'MyKasih',
    doc_type: 'Receipt',
    industry: 'Grocery',
    tags: ['Personal'], 
    invoice_no: '288321314/102/T0314',
    confidence_score: 0.95,
    image_url: '/input_file_1.png', 
    items: [
      { id: 'i5', name: "8503 GARDENIA TOASTEM COKLA", qty: 1, unit_price: 5.30, line_total: 5.30 },
      { id: 'i6', name: "3717 CHIPSMORE MINI COKLAT", qty: 1, unit_price: 5.69, line_total: 5.69 },
      { id: 'i7', name: "2476 FITE ANTIBAC DETERGENT", qty: 1, unit_price: 8.90, line_total: 8.90 }
    ]
  },
  {
    id: 'fail-004',
    status: 'Failed', 
    merchant_name: 'Unknown Merchant',
    date: '-',
    grand_total: 0,
    doc_type: 'Receipt',
    industry: 'Other',
    tags: ['Pending'],
    confidence_score: 0.32,
    image_url: '/input_file_2.png', 
    items: []
  }
];

const INDUSTRIES = ['Grocery', 'Fuel', 'F&B', 'Retail', 'Service', 'Other', 'Custom (自定义)'];
const DOC_TYPES = ['Receipt', 'Invoice', 'Credit Note', 'Expense', 'Custom (自定义)'];
const TAGS_OPTIONS = ['Business', 'Personal', 'Tax Deductible', 'Pending']; 

const THEMES = [
  { name: 'Indigo', color: 'bg-indigo-600', text: 'text-indigo-600', light: 'bg-indigo-50' },
  { name: 'Emerald', color: 'bg-emerald-600', text: 'text-emerald-600', light: 'bg-emerald-50' },
  { name: 'Rose', color: 'bg-rose-600', text: 'text-rose-600', light: 'bg-rose-50' }
];
const LANGUAGES = ['中文', 'English', 'Melayu'];
const CURRENCIES = ['RM', 'SGD', 'USD', '¥'];

const DISPLAY_STATUS_BY_DB_STATUS: Record<string, string> = {
  uploaded: 'Pending',
  processing: 'Pending',
  pending_review: 'Pending',
  synced: 'Synced',
  failed: 'Failed',
};

const DB_STATUS_BY_DISPLAY_STATUS: Record<string, string> = {
  Pending: 'pending_review',
  Synced: 'synced',
  Failed: 'failed',
};

function toDisplayReceipt(receipt: any) {
  const items = receipt.receipt_items || receipt.items || [];
  const category = receipt.category || receipt.industry || 'Other';
  const tax = receipt.tax ?? receipt.tax_sst ?? 0;

  return {
    ...receipt,
    status: DISPLAY_STATUS_BY_DB_STATUS[receipt.status] || receipt.status || 'Pending',
    category,
    industry: category,
    tax,
    tax_sst: tax,
    subsidy_info: receipt.subsidy_info || receipt.subsidy_details?.description || '',
    items,
  };
}

function toApiReceipt(receipt: any) {
  return {
    ...receipt,
    status: DB_STATUS_BY_DISPLAY_STATUS[receipt.status] || receipt.status || 'pending_review',
    category: receipt.category || receipt.industry || 'Other',
    tax: receipt.tax ?? receipt.tax_sst ?? 0,
    subsidy_details: receipt.subsidy_details || (receipt.subsidy_info ? { description: receipt.subsidy_info } : null),
    receipt_items: receipt.receipt_items || receipt.items || [],
  };
}

// 深度扩充的 I18N 全局多语言词典
const I18N: any = {
  '中文': {
    workflow: '采集与校验',
    upload: '工作流',
    database: '云端数据库',
    settings: '设置',
    theme: '系统颜色',
    language: '语言选择',
    currency: '货币选择',
    exportAll: '全部导出 Excel',
    exportSelected: '导出已选',
    title: '智能采集与审核队列',
    dbTitle: 'Supabase 云端数据库',
    connected: 'Supabase 已连接',
    dragDrop: '拖拽上传 / 点击选择',
    supportText: '支持 PDF, PNG, JPG。图片将自动上传至云端并提取数据。',
    processing: '云端处理引擎运行中',
    searchUpload: '搜索商户名或发票号...',
    searchDb: '在 Supabase 数据库中搜索...',
    statusAll: '状态: 全部',
    statusPending: '待核对 (Pending Sync)',
    statusFailed: '解析失败 (Failed)',
    typeAll: '单据类型: 全部',
    tagAll: '标签: 全部',
    noPending: '没有待处理记录。',
    noData: '数据库中无记录。',
    colMerchant: '状态/商户 (Merchant)',
    colFinance: '财务摘要 (Financials)',
    colTags: '分类与标签 (Tags)',
    colAudit: '人工审计 (Audit)',
    colCloud: 'Cloud Data (Database)',
    colTotal: '合计金额',
    colAction: '查看单据与原图',
    modalTitle: '系统偏好与集成',
    storageSettings: '存储引擎',
    pgDesc: '关系型数据与状态同步。',
    storageDesc: '发票原图持久化云端存储。',
    exportSingle: '导出当前单据 (XLSX)',
    originalImg: '单据原图',
    headerInfo: '发票抬头、商户信息与分类标签',
    skuInfo: '商品明细表 (SKU Items)',
    financeInfo: '财务汇总与数学校验引擎',
    addSku: '添加 SKU 行',
    hold: '保持挂起',
    syncToCloud: '同步至云端',
    merchantLabel: '商户名称 (Merchant)',
    dateLabel: '日期 (Date)',
    invoiceLabel: '发票号 (Invoice No)',
    regNoLabel: '注册号 (Reg No)',
    sstIdLabel: 'SST ID',
    phonePaymentLabel: '电话 (Phone) & 支付 (Payment)',
    docTypeIndLabel: '单据类型 & 行业',
    quickTagsLabel: '快捷标签',
    customTagPlaceholder: '+ 自定义标签',
    add: '添加',
    noImgLabel: '暂无原图记录',
    zoomIn: '放大原图',
    diffLabel: '差异',
    mathPassed: '数学校验通过',
    ocrTotal: '票面识别总额 (OCR):',
    subsidyInfo: '政府补贴 / 援助金',
    itemName: 'Item Description',
    qty: 'Qty',
    subtotal: 'Subtotal (Items)',
    discount: 'Discount (-)',
    serviceCharge: 'Service Chg (+)',
    taxSst: 'Tax/SST (+)',
    rounding: 'Rounding (+/-)',
    change: 'Change (找零)',
    grandTotal: 'Calculated Grand Total',
    saveAndApply: '保存并应用',
    languagePref: '语言配置',
    currencyPref: '货币设置',
    themeMode: '主题模式',
    brandColor: '品牌主色调',
    lightMode: '浅色模式',
    darkMode: '深色模式',
    auditQueue: '审核队列',
    archiveLib: '存档库',
    exportExcel: '导出 Excel',
    uploadHint: '拖拽上传新的单据',
    uploadLimit: '单次最多上传 20 个文件',
    searchPlaceholder: '搜索商户、发票号...',
    financialsLabel: '财务详情',
    tagsLabel: '分类标签',
    auditLabel: '操作',
    retry: '重试',
    noRecords: '没有记录',
    totalItems: '条记录',
    noArchive: '存档库为空',
    confidence: '置信度',
    merchantInfo: '商户信息',
    skuItems: '明细列表',
    calculator: '计算引擎',
    calculatedTotal: '计算所得总计',
    keepPending: '保持挂起',
    syncToSheets: '同步至云端',
    systemPref: '系统偏好',
    zoomTip: '详情预览',
    mathFailed: '数学校验差异',
    history: '云端档案'
  },
  'English': {
    workflow: 'Processing',
    upload: 'Workflow',
    database: 'Cloud Database',
    settings: 'Settings',
    theme: 'Theme Color',
    language: 'Language',
    currency: 'Currency',
    exportAll: 'Export All (Excel)',
    exportSelected: 'Export Selected',
    title: 'Smart Extraction & Audit Queue',
    dbTitle: 'Supabase Cloud Database',
    connected: 'Supabase Connected',
    dragDrop: 'Drag & Drop / Click to Upload',
    supportText: 'Supports PDF, PNG, JPG. Images auto-upload to cloud & extract data.',
    processing: 'Cloud Engine Running...',
    searchUpload: 'Search merchant or invoice no...',
    searchDb: 'Search in Supabase database...',
    statusAll: 'Status: All',
    statusPending: 'Pending Sync',
    statusFailed: 'Failed to Parse',
    typeAll: 'Doc Type: All',
    tagAll: 'Tag: All',
    noPending: 'No pending records.',
    noData: 'No records in database.',
    colMerchant: 'Status / Merchant',
    colFinance: 'Financials',
    colTags: 'Tags',
    colAudit: 'Audit',
    colCloud: 'Cloud Data (Database)',
    colTotal: 'Total Amount',
    colAction: 'View Data & Image',
    modalTitle: 'System Preferences',
    storageSettings: 'Storage Engine',
    pgDesc: 'Relational data and state sync.',
    storageDesc: 'Persistent cloud storage for receipt images.',
    exportSingle: 'Export Current (XLSX)',
    originalImg: 'Original Receipt',
    headerInfo: 'Header, Merchant & Classification',
    skuInfo: 'SKU Items List',
    financeInfo: 'Financials & Math Verification',
    addSku: 'Add SKU Line',
    hold: 'Keep Pending',
    syncToCloud: 'Sync to Cloud',
    merchantLabel: 'Merchant Name',
    dateLabel: 'Date',
    invoiceLabel: 'Invoice No',
    regNoLabel: 'Registration No',
    sstIdLabel: 'SST ID',
    phonePaymentLabel: 'Phone & Payment',
    docTypeIndLabel: 'Doc Type & Industry',
    quickTagsLabel: 'Quick Tags',
    customTagPlaceholder: '+ Custom Tag',
    add: 'Add',
    noImgLabel: 'No Original Image',
    zoomIn: 'Zoom In',
    diffLabel: 'Diff',
    mathPassed: 'Math Verified',
    ocrTotal: 'OCR Ticket Total:',
    subsidyInfo: 'Subsidy / Aid',
    itemName: 'Item Description',
    qty: 'Qty',
    subtotal: 'Subtotal (Items)',
    discount: 'Discount (-)',
    serviceCharge: 'Service Chg (+)',
    taxSst: 'Tax/SST (+)',
    rounding: 'Rounding (+/-)',
    change: 'Change',
    grandTotal: 'Calculated Grand Total',
    saveAndApply: 'Save and Apply',
    languagePref: 'Language Configuration',
    currencyPref: 'Currency Setting',
    themeMode: 'Theme Mode',
    brandColor: 'Brand Primary Color',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    auditQueue: 'Audit Queue',
    archiveLib: 'Archive Lib',
    exportExcel: 'Export Excel',
    uploadHint: 'Click or Drag to upload receipts',
    uploadLimit: 'Up to 20 files at once',
    searchPlaceholder: 'Search merchant, invoice...',
    financialsLabel: 'Financials',
    tagsLabel: 'Tags',
    auditLabel: 'Action',
    retry: 'Retry',
    noRecords: 'No records found',
    totalItems: 'Items',
    noArchive: 'Archive is empty',
    confidence: 'Confidence',
    merchantInfo: 'Merchant Info',
    skuItems: 'SKU Items',
    calculator: 'Calculator',
    calculatedTotal: 'Calculated Total',
    keepPending: 'Keep Pending',
    syncToSheets: 'Sync to Cloud',
    systemPref: 'System Preference',
    zoomTip: 'Zoom View',
    mathFailed: 'Math Error',
    history: 'Cloud History'
  },
  'Melayu': {
    workflow: 'Pemprosesan',
    upload: 'Aliran Kerja',
    database: 'Pangkalan Data',
    settings: 'Tetapan',
    theme: 'Warna Tema',
    language: 'Bahasa',
    currency: 'Mata Wang',
    exportAll: 'Eksport Semua (Excel)',
    exportSelected: 'Eksport Pilihan',
    title: 'Gilir Pengekstrakan Pintar',
    dbTitle: 'Pangkalan Data Awan Supabase',
    connected: 'Supabase Disambung',
    dragDrop: 'Tarik & Lepas / Klik untuk Muat Naik',
    supportText: 'Sokong PDF, PNG, JPG. Imej akan dimuat naik & data diekstrak secara automatik.',
    processing: 'Enjin Awan Sedang Berjalan...',
    searchUpload: 'Cari saudagar atau no invois...',
    searchDb: 'Cari dalam pangkalan data...',
    statusAll: 'Status: Semua',
    statusPending: 'Menunggu',
    statusFailed: 'Gagal Diekstrak',
    typeAll: 'Jenis Dokumen: Semua',
    tagAll: 'Tag: Semua',
    noPending: 'Tiada rekod yang menunggu.',
    noData: 'Tiada rekod dalam pangkalan data.',
    colMerchant: 'Status / Saudagar',
    colFinance: 'Kewangan',
    colTags: 'Tag',
    colAudit: 'Audit',
    colCloud: 'Data Awan (Pangkalan Data)',
    colTotal: 'Jumlah',
    colAction: 'Lihat Data & Imej',
    modalTitle: 'Pilihan Sistem',
    storageSettings: 'Enjin Penyimpanan',
    pgDesc: 'Penyegerakan data & status.',
    storageDesc: 'Penyimpanan awan untuk imej resit.',
    exportAllExcel: 'Eksport Semua (Excel)',
    exportSingle: 'Eksport Semasa (XLSX)',
    originalImg: 'Resit Asal',
    headerInfo: 'Pengepala, Saudagar & Klasifikasi',
    skuInfo: 'Senarai Item SKU',
    financeInfo: 'Kewangan & Pengesahan Matematik',
    addSku: 'Tambah Baris SKU',
    hold: 'Kekal Menunggu',
    syncToCloud: 'Segerak ke Awan',
    merchantLabel: 'Nama Saudagar',
    dateLabel: 'Tarikh',
    invoiceLabel: 'No Invois',
    regNoLabel: 'No Pendaftaran',
    sstIdLabel: 'ID SST',
    phonePaymentLabel: 'Telefon & Pembayaran',
    docTypeIndLabel: 'Jenis Dok. & Industri',
    quickTagsLabel: 'Tag Pantas',
    customTagPlaceholder: '+ Tag Tersuai',
    add: 'Tambah',
    noImgLabel: 'Tiada Imej Asal',
    zoomIn: 'Besarkan',
    diffLabel: 'Beza',
    mathPassed: 'Matematik Disahkan',
    ocrTotal: 'Jumlah OCR:',
    subsidyInfo: 'Subsidi / Bantuan',
    itemName: 'Deskripsi Item',
    qty: 'Kuantiti',
    subtotal: 'Subjumlah (Item)',
    discount: 'Diskaun (-)',
    serviceCharge: 'Caj Perkhidmatan (+)',
    taxSst: 'Cukai/SST (+)',
    rounding: 'Pembundaran (+/-)',
    change: 'Baki',
    grandTotal: 'Jumlah Besar Dikira',
    saveAndApply: 'Simpan dan Guna',
    languagePref: 'Konfigurasi Bahasa',
    currencyPref: 'Tetapan Mata Wang',
    themeMode: 'Mod Tema',
    brandColor: 'Warna Jenama Utama',
    lightMode: 'Mod Cerah',
    darkMode: 'Mod Gelap',
    auditQueue: 'Gilir Audit',
    archiveLib: 'Arkib',
    exportExcel: 'Eksport Excel',
    uploadHint: 'Klik atau Tarik untuk muat naik resit',
    uploadLimit: 'Hingga 20 fail sekaligus',
    searchPlaceholder: 'Cari saudagar, invois...',
    financialsLabel: 'Kewangan',
    tagsLabel: 'Tag',
    auditLabel: 'Tindakan',
    retry: 'Cuba Lagi',
    noRecords: 'Tiada rekod dijumpai',
    totalItems: 'Item',
    noArchive: 'Arkib kosong',
    confidence: 'Keyakinan',
    merchantInfo: 'Maklumat Saudagar',
    skuItems: 'Item SKU',
    calculator: 'Kalkulator',
    calculatedTotal: 'Jumlah Dikira',
    keepPending: 'Kekal Menunggu',
    syncToSheets: 'Segerak ke Awan',
    systemPref: 'Pilihan Sistem',
    zoomTip: 'Pandangan Besar',
    mathFailed: 'Ralat Matematik',
    history: 'Sejarah Awan'
  }
};

export default function App() {
  const [history, setHistory] = useState<any[]>(INITIAL_HISTORY);
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [uploadList, setUploadList] = useState<any[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'info' | 'success' | 'error'} | null>(null);
  const [filters, setFilters] = useState({ search: '', status: 'All', docType: 'All', tag: 'All' });

  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('my_receipt_config');
    if (saved) return JSON.parse(saved);
    return {
      theme: THEMES[0],
      language: 'zh',
      currency: 'RM',
      colorMode: 'Light'
    };
  });

  useEffect(() => {
    localStorage.setItem('my_receipt_config', JSON.stringify(config));
  }, [config]);

  // Toast Function
  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const t = useMemo(() => {
    const langMap: any = { 'zh': '中文', 'en': 'English', 'ms': 'Melayu' };
    const langKey = langMap[config.language] || 'English';
    return I18N[langKey];
  }, [config.language]);

  const syncToDatabase = async (data: any) => {
    try {
      const saved = await saveReceipt(toApiReceipt(data), data.items || []);
      const displayReceipt = toDisplayReceipt({
        ...saved,
        image_url: data.image_url,
      });
      setHistory((current) => current.map((item) => item.id === displayReceipt.id ? displayReceipt : item));
      setSelectedReceipt((current: any) => current?.id === displayReceipt.id ? displayReceipt : current);
      showToast("Synced to Supabase Successfully!", "success");
    } catch (err) {
      console.error("Supabase sync error:", err);
      showToast("Supabase sync failed.", "error");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await listReceipts();
        const displayData = await Promise.all(data.map(async (receipt) => {
          const signedUrl = await createReceiptFileSignedUrl(receipt.file_path);
          return toDisplayReceipt({ ...receipt, image_url: signedUrl });
        }));
        setHistory(displayData);
      } catch (error) {
        console.error('Error loading receipts:', error);
        showToast('Failed to load Supabase receipts.', 'error');
      }
    };
    loadData();
  }, []);

  const handleToggleSelectAll = () => {
    const currentPendingIds = filteredHistory.filter(h => h.status !== 'Synced').map(h => h.id);
    if (selectedRowIds.length === currentPendingIds.length) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(currentPendingIds);
    }
  };

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRowIds(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchSearch = item.merchant_name?.toLowerCase().includes(filters.search.toLowerCase()) || 
                          item.invoice_no?.toLowerCase().includes(filters.search.toLowerCase());
      const matchStatus = filters.status === 'All' || item.status === filters.status;
      const matchType = filters.docType === 'All' || item.doc_type === filters.docType;
      const matchTag = filters.tag === 'All' || item.tags?.includes(filters.tag);
      return matchSearch && matchStatus && matchType && matchTag;
    });
  }, [history, filters]);

  const updateItem = (itemId: string, field: string, value: any) => {
    setSelectedReceipt((prev: any) => {
      if (!prev) return prev;
      const newItems = (prev.items || []).map((item: any) => {
        if (item.id === itemId) {
          const updated = { ...item, [field]: value };
          if (field === 'qty' || field === 'unit_price') {
            const qty = parseFloat(updated.qty) || 0;
            const price = parseFloat(updated.unit_price) || 0;
            updated.line_total = qty * price;
          }
          return updated;
        }
        return item;
      });
      return { ...prev, items: newItems };
    });
  };

  const addNewItem = (e?: React.MouseEvent) => {
    if(e) e.preventDefault();
    setSelectedReceipt((prev: any) => {
      if (!prev) return prev;
      const newItem = { id: Math.random().toString(36).substr(2, 9), name: '', qty: 1, unit_price: '', line_total: 0 };
      return { ...prev, items: [...(prev.items || []), newItem] };
    });
  };

  const removeItem = (itemId: string) => {
    setSelectedReceipt((prev: any) => {
      if (!prev) return prev;
      return { ...prev, items: (prev.items || []).filter((i: any) => i.id !== itemId) };
    });
  };

  const toggleTag = (tag: string) => {
    if (!selectedReceipt) return;
    const currentTags = selectedReceipt.tags || [];
    const newTags = currentTags.includes(tag) 
      ? currentTags.filter((t: string) => t !== tag)
      : [...currentTags, tag];
    setSelectedReceipt({ ...selectedReceipt, tags: newTags });
  };

  const handleAddCustomTag = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!newTagInput.trim() || !selectedReceipt) return;
    const currentTags = selectedReceipt.tags || [];
    if (!currentTags.includes(newTagInput.trim())) {
      setSelectedReceipt({
        ...selectedReceipt,
        tags: [...currentTags, newTagInput.trim()]
      });
    }
    setNewTagInput("");
  };

  const itemsTotal = useMemo(() => {
    return selectedReceipt?.items?.reduce((sum: number, item: any) => sum + (item.line_total || 0), 0) || 0;
  }, [selectedReceipt]);

  const manualTotal = useMemo(() => {
    if (!selectedReceipt) return 0;
    return itemsTotal 
      - (parseFloat(selectedReceipt.discount) || 0) 
      + (parseFloat(selectedReceipt.tax_sst) || 0) 
      + (parseFloat(selectedReceipt.service_charge) || 0) 
      + (parseFloat(selectedReceipt.rounding) || 0);
  }, [selectedReceipt, itemsTotal]);

  const handleExport = async (singleItem: any = null) => {
    let dataToExport = [];
    if (singleItem) {
       dataToExport = [singleItem]; 
    } else if (selectedRowIds.length > 0) {
       dataToExport = filteredHistory.filter(h => selectedRowIds.includes(h.id)); 
    } else {
       dataToExport = filteredHistory; 
    }

    if (dataToExport.length === 0) {
       showToast(t.noPending, 'info');
       return;
    }

    await downloadReceiptsXlsx(dataToExport.map(toApiReceipt));

    showToast(`Successfully Exported ${dataToExport.length} Records!`, 'success');
    setSelectedRowIds([]);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).slice(0, 20) as File[]; 
    const newItems = files.map((file: File) => ({ 
      id: Math.random().toString(36).substr(2, 9), 
      name: file.name, 
      status: 'Ready', 
      progress: 0,
      image_url: URL.createObjectURL(file),
      file: file
    }));
    setUploadList(prev => [...newItems, ...prev]);

    for (const item of newItems) {
      setUploadList((old: any[]) => old.map(u => u.id === item.id ? { ...u, status: 'Uploading to Supabase', progress: 25 } : u));

      try {
        const result = await createReceiptFromFile(item.file);
        setUploadList((old: any[]) => old.map(u => u.id === item.id ? { ...u, progress: 90, status: 'Waiting for AI result' } : u));
        const signedUrl = await createReceiptFileSignedUrl(result.receipt.file_path);
        const displayReceipt = toDisplayReceipt({
          ...result.receipt,
          image_url: signedUrl || item.image_url,
        });

        setHistory((prev_history: any[]) => [displayReceipt, ...prev_history.filter((receipt) => receipt.id !== displayReceipt.id)]);
        if (result.parseError) {
          showToast(result.parseError, 'error');
        } else {
          showToast(`${item.name} uploaded.`, 'success');
        }
        setUploadList((old: any[]) => old.filter(u => u.id !== item.id));
      } catch (error) {
        console.error('Receipt upload failed:', error);
        setUploadList((old: any[]) => old.map(u => u.id === item.id ? { ...u, status: 'Failed', progress: 100 } : u));
        showToast(error instanceof Error ? error.message : 'Upload failed.', 'error');
      }
    }
  };

  const handleRetry = (id: string) => {
    showToast(`Retrying API for ID: ${id}`, 'info');
    setHistory(history.filter(h => h.id !== id));
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('确定要删除这条记录吗？')) return;

    try {
      await deleteReceipt(id);
    } catch (err) {
      console.error('Failed to delete from Supabase:', err);
      showToast('Delete failed.', 'error');
      return;
    }

    setHistory(prev => prev.filter(h => h.id !== id));
    if (selectedReceipt?.id === id) setSelectedReceipt(null);
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${config.colorMode === 'Dark' ? 'bg-slate-950 text-slate-100' : 'bg-[#F1F5F9] text-slate-900'}`}>
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-top duration-300 flex items-center gap-3 border ${
          toast.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : 
          toast.type === 'error' ? 'bg-rose-500 text-white border-rose-400' : 
          'bg-slate-800 text-white border-slate-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : 
           toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : 
           <Info className="w-5 h-5" />}
          <span className="text-sm font-black tracking-tight">{toast.message}</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`w-64 border-r hidden lg:flex flex-col shrink-0 z-20 transition-colors ${config.colorMode === 'Dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className={`p-8 border-b ${config.colorMode === 'Dark' ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${config.theme.color} rounded-[14px] flex items-center justify-center shadow-lg transition-all ${config.colorMode === 'Dark' ? 'shadow-black/40' : 'shadow-indigo-100'}`}>
                <Receipt className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className={`font-black tracking-tight text-lg leading-none ${config.colorMode === 'Dark' ? 'text-white' : 'text-slate-800'}`}>MY-Receipt</h1>
                <p className={`text-[9px] font-bold mt-1 uppercase ${config.colorMode === 'Dark' ? 'text-slate-500' : 'text-slate-400'}`}>PRD V1.1 PRO EDITION</p>
              </div>
            </div>
          </div>
          <nav className="p-4 space-y-1.5 flex-1">
            <p className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest ${config.colorMode === 'Dark' ? 'text-slate-600' : 'text-slate-400'}`}>Workflow</p>
            <button onClick={() => setActiveTab('upload')} className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'upload' ? `${config.theme.color} text-white shadow-md` : config.colorMode === 'Dark' ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}>
              <div className="flex items-center gap-3"><RefreshCw className={`w-4 h-4 ${uploadList.length > 0 ? 'animate-spin' : ''}`} /> {t.workflow}</div>
              {uploadList.length > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-md text-[10px]">{uploadList.length}</span>}
            </button>
            <button onClick={() => setActiveTab('history')} className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'history' ? `${config.theme.color} text-white shadow-md` : config.colorMode === 'Dark' ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}>
              <div className="flex items-center gap-3"><Database className="w-4 h-4" /> {t.history}</div>
              <span className={`px-2 py-0.5 rounded-md text-[10px] ${activeTab === 'history' ? 'bg-white/20' : config.colorMode === 'Dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>{history.filter(h=>h.status==='Synced').length}</span>
            </button>
          </nav>
          <div className={`p-6 border-t transition-colors ${config.colorMode === 'Dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
             <button onClick={() => setIsSettingsOpen(true)} className={`flex items-center gap-3 px-4 py-3 w-full rounded-2xl text-sm font-bold transition-all border border-transparent ${config.colorMode === 'Dark' ? 'text-slate-400 hover:bg-slate-800 hover:border-slate-700' : 'text-slate-500 hover:bg-white hover:shadow-sm hover:border-slate-200'}`}>
                <Settings className="w-4 h-4" /> {t.settings}
             </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <header className={`border-b h-16 flex items-center justify-between px-8 shrink-0 z-10 transition-colors ${config.colorMode === 'Dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
             <div className="flex items-center gap-4">
                <h2 className={`text-sm font-black uppercase tracking-widest ${config.colorMode === 'Dark' ? 'text-slate-400' : 'text-slate-800'}`}>
                  {activeTab === 'upload' ? t.auditQueue : t.archiveLib}
                </h2>
             </div>
             <div className="flex items-center gap-4">
                <button onClick={() => handleExport()} className={`flex items-center gap-2 px-5 py-2 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-md ${config.colorMode === 'Dark' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-900 hover:bg-slate-800'}`}>
                   <FileSpreadsheet className="w-4 h-4" /> {t.exportExcel}
                </button>
             </div>
          </header>

          <main className="flex-1 overflow-y-auto p-8 lg:p-10">
            {activeTab === 'upload' ? (
              <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
                <label className={`group relative block border-2 border-dashed rounded-[32px] p-16 text-center transition-all cursor-pointer shadow-sm ${config.colorMode === 'Dark' ? 'bg-slate-900 border-slate-700 hover:border-indigo-500' : 'bg-white border-slate-300 hover:border-indigo-400'}`}>
                  <div className={`w-16 h-16 ${config.theme.light} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-all duration-300 ${config.colorMode === 'Dark' ? 'bg-indigo-900/30' : ''}`}>
                    <Upload className={`w-8 h-8 ${config.theme.text}`} />
                  </div>
                  <h3 className={`text-lg font-black ${config.colorMode === 'Dark' ? 'text-slate-200' : 'text-slate-800'}`}>{t.uploadHint}</h3>
                  <p className={`text-xs mt-2 font-medium ${config.colorMode === 'Dark' ? 'text-slate-500' : 'text-slate-400'}`}>{t.uploadLimit}</p>
                  <input type="file" className="hidden" multiple onChange={handleUpload} accept="application/pdf,image/png,image/jpeg" />
                </label>

                {uploadList.length > 0 && (
                  <div className={`rounded-[24px] border overflow-hidden shadow-sm transition-colors ${config.colorMode === 'Dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className={`px-6 py-3 border-b flex items-center justify-between ${config.colorMode === 'Dark' ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50/80'}`}>
                       <span className={`text-[10px] font-black uppercase flex items-center gap-2 ${config.theme.text}`}>
                         <Cpu className="w-3.5 h-3.5 animate-pulse" /> {t.processing}
                       </span>
                    </div>
                    {uploadList.map(item => (
                      <div key={item.id} className={`px-6 py-4 flex items-center justify-between border-b last:border-0 ${config.colorMode === 'Dark' ? 'border-slate-800/50' : 'border-slate-50'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.theme.light} ${config.theme.text} ${config.colorMode === 'Dark' ? 'bg-indigo-900/30' : ''}`}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold">{item.name}</p>
                            <p className="text-[10px] font-black opacity-50 uppercase">{item.status}</p>
                          </div>
                        </div>
                        <div className={`w-48 h-1.5 rounded-full overflow-hidden ${config.colorMode === 'Dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                          <div className={`${config.theme.color} h-full transition-all duration-300`} style={{ width: `${item.progress}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3 items-center p-2">
                     <div className="relative flex-1 min-w-[200px]">
                        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${config.colorMode === 'Dark' ? 'text-slate-600' : 'text-slate-400'}`} />
                        <input type="text" placeholder={t.searchPlaceholder} value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} className={`w-full border rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium focus:outline-none transition-all shadow-sm ${config.colorMode === 'Dark' ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500 ring-indigo-500/10' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 ring-indigo-500/10'}`} />
                     </div>
                     <div className="relative">
                        <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className={`appearance-none border rounded-xl pl-4 pr-10 py-2.5 text-xs font-black outline-none shadow-sm transition-all cursor-pointer ${config.colorMode === 'Dark' ? 'bg-slate-900 border-slate-800 text-slate-400 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-600 focus:border-indigo-500'}`}>
                           <option value="All">{t.statusAll}</option>
                           <option value="Pending">{t.statusPending}</option>
                           <option value="Failed">{t.statusFailed}</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                     </div>

                     <div className="relative">
                        <select value={filters.docType} onChange={e => setFilters({...filters, docType: e.target.value})} className={`appearance-none border rounded-xl pl-4 pr-10 py-2.5 text-xs font-black outline-none shadow-sm transition-all cursor-pointer ${config.colorMode === 'Dark' ? 'bg-slate-900 border-slate-800 text-slate-400 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-600 focus:border-indigo-500'}`}>
                           <option value="All">{t.typeAll}</option>
                           {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                     </div>

                     <div className="relative">
                        <select value={filters.tag} onChange={e => setFilters({...filters, tag: e.target.value})} className={`appearance-none border rounded-xl pl-4 pr-10 py-2.5 text-xs font-black outline-none shadow-sm transition-all cursor-pointer ${config.colorMode === 'Dark' ? 'bg-slate-900 border-slate-800 text-slate-400 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-600 focus:border-indigo-500'}`}>
                           <option value="All">{t.tagAll}</option>
                           {TAGS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                     </div>
                  </div>

                  <div className={`rounded-[24px] border shadow-sm overflow-hidden transition-colors ${config.colorMode === 'Dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <table className="w-full text-left">
                      <thead className={`text-[10px] font-black uppercase tracking-widest border-b ${config.colorMode === 'Dark' ? 'bg-slate-800/50 text-slate-500 border-slate-800' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                        <tr>
                          <th className="px-6 py-4 w-10">
                            <input 
                              type="checkbox" 
                              checked={selectedRowIds.length === filteredHistory.filter(h => h.status !== 'Synced').length && filteredHistory.filter(h => h.status !== 'Synced').length > 0}
                              onChange={handleToggleSelectAll}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </th>
                          <th className="px-6 py-4">{t.merchantLabel}</th>
                          <th className="px-6 py-4">{t.financialsLabel}</th>
                          <th className="px-6 py-4">{t.tagsLabel}</th>
                          <th className="px-6 py-4 text-right">{t.auditLabel}</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${config.colorMode === 'Dark' ? 'divide-slate-800' : 'divide-slate-100'}`}>
                        {filteredHistory.filter(h => h.status !== 'Synced').map(item => (
                          <tr key={item.id} className={`transition-colors group cursor-pointer ${selectedRowIds.includes(item.id) ? (config.colorMode === 'Dark' ? 'bg-indigo-900/20' : 'bg-indigo-50/50') : ''} ${config.colorMode === 'Dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`} onClick={() => setSelectedReceipt(item)}>
                            <td className="px-6 py-5" onClick={(e) => handleToggleSelectRow(item.id, e)}>
                              <input 
                                type="checkbox" 
                                checked={selectedRowIds.includes(item.id)}
                                onChange={() => {}} // Handle via onClick of cell
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="px-6 py-5">
                               <div className="flex items-start gap-3">
                                  <div className="mt-0.5">
                                     {item.status === 'Failed' ? <AlertCircle className="w-5 h-5 text-rose-500" /> : <CheckCircle className={`w-5 h-5 ${config.colorMode === 'Dark' ? 'text-amber-600' : 'text-amber-500'}`} />}
                                  </div>
                                  <div>
                                    <p className={`text-sm font-black leading-tight mb-1 ${item.status === 'Failed' ? 'text-rose-600' : config.colorMode === 'Dark' ? 'text-slate-200' : 'text-slate-800'}`}>{item.merchant_name}</p>
                                    <div className="flex gap-2">
                                       <span className={`text-[9px] font-bold uppercase ${config.colorMode === 'Dark' ? 'text-slate-600' : 'text-slate-400'}`}>INV: {item.invoice_no || 'N/A'}</span>
                                    </div>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-5">
                               <p className={`text-sm font-black leading-none mb-1 ${config.colorMode === 'Dark' ? 'text-slate-200' : 'text-slate-900'}`}>{config.currency} {parseFloat(item.grand_total as any).toFixed(2)}</p>
                               <p className={`text-[10px] font-bold ${config.colorMode === 'Dark' ? 'text-slate-600' : 'text-slate-400'}`}>{item.date} • {item.items?.length || 0} SKUs</p>
                            </td>
                            <td className="px-6 py-5">
                               <div className="flex flex-col gap-1.5 items-start">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${item.status === 'Failed' ? 'bg-rose-50 text-rose-600' : config.colorMode === 'Dark' ? 'bg-indigo-950 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>{item.doc_type}</span>
                                  <div className="flex flex-wrap gap-1">
                                    {(item.tags || []).slice(0,2).map(t => <span key={t} className={`text-[8px] font-black uppercase px-1 rounded ${config.colorMode === 'Dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>{t}</span>)}
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-5 text-right">
                               <div className="flex items-center justify-end gap-2">
                                 {item.status === 'Failed' ? (
                                    <button onClick={(e) => { e.stopPropagation(); handleRetry(item.id); }} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1">
                                       <RefreshCcw className="w-3 h-3" /> {t.retry}
                                    </button>
                                 ) : (
                                    <button className={`p-2 rounded-xl transition-all ${config.colorMode === 'Dark' ? 'bg-slate-800 text-slate-500 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                                      <ChevronRight className="w-5 h-5" />
                                    </button>
                                 )}
                                 <button onClick={(e) => handleDelete(item.id, e)} className={`p-2 rounded-xl transition-all ${config.colorMode === 'Dark' ? 'bg-slate-800 text-slate-500 hover:bg-rose-600 hover:text-white' : 'bg-slate-100 text-slate-400 hover:bg-rose-600 hover:text-white'}`} title="删除">
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                               </div>
                            </td>
                          </tr>
                        ))}
                        {filteredHistory.filter(h => h.status !== 'Synced').length === 0 && (
                          <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-xs font-bold">{t.noRecords}</td></tr>
                        )}
                      </tbody>
                    </table>
                    <div className={`px-6 py-3 border-t flex justify-between items-center text-[10px] font-black uppercase ${config.colorMode === 'Dark' ? 'bg-slate-800/30 border-slate-800 text-slate-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                       <span>Total: {filteredHistory.filter(h => h.status !== 'Synced').length} {t.totalItems}</span>
                       <span>Page 1 of 1</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-6xl mx-auto space-y-6">
                 <div className="flex gap-4 items-center">
                     <div className="relative flex-1 group min-w-[200px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="全局搜索历史商户或发票号..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium focus:outline-none focus:border-indigo-500 shadow-sm" />
                     </div>
                 </div>

                 <div className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                       <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase border-b border-slate-100">
                          <tr><th className="px-6 py-4">已同步数据 (Google Sheets)</th><th className="px-6 py-4">Total</th><th className="px-6 py-4 text-right">Action</th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {filteredHistory.filter(h => h.status === 'Synced').map(item => (
                            <tr key={item.id} className={`hover:bg-slate-50 transition-all cursor-pointer ${config.colorMode === 'Dark' ? 'hover:bg-slate-800 border-slate-800' : ''}`} onClick={() => setSelectedReceipt(item)}>
                              <td className="px-6 py-5 font-black text-sm">{item.merchant_name}</td>
                              <td className="px-6 py-5 font-black">{config.currency} {parseFloat(item.grand_total as any).toFixed(2)}</td>
                              <td className="px-6 py-5 text-right">
                                 <div className="flex items-center justify-end gap-2">
                                  <ExternalLink className="w-4 h-4 text-slate-400" />
                                  <button onClick={(e) => handleDelete(item.id, e)} className={`p-1.5 rounded-lg transition-all ${config.colorMode === 'Dark' ? 'text-slate-600 hover:bg-rose-600/20 hover:text-rose-500' : 'text-slate-300 hover:bg-rose-50 hover:text-rose-500'}`} title="从存档移除">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                 </div>
                               </td>
                            </tr>
                          ))}
                          {filteredHistory.filter(h => h.status === 'Synced').length === 0 && (
                            <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-400 text-xs font-bold">{t.noArchive}</td></tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* 核心校对面板 - 依据用户期望的 3列宽屏 布局重构 */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className={`w-full max-w-[98vw] h-[96vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col transition-colors ${config.colorMode === 'Dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
              {/* 面板头部 */}
              <div className={`px-8 py-4 border-b flex items-center justify-between shrink-0 transition-colors ${config.colorMode === 'Dark' ? 'bg-slate-800/20 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                 <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 ${selectedReceipt.status === 'Failed' ? 'bg-rose-600' : config.theme.color} rounded-xl flex items-center justify-center text-white shadow-md`}>
                       {selectedReceipt.status === 'Failed' ? <AlertTriangle className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                    </div>
                    <div>
                       <h2 className={`text-lg font-black tracking-tight flex items-center gap-2 ${config.colorMode === 'Dark' ? 'text-white' : 'text-slate-900'}`}>
                          {selectedReceipt.merchant_name}
                          <span className={`px-2 py-0.5 rounded text-[9px] uppercase ${selectedReceipt.status === 'Failed' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                             {t.confidence}: {(selectedReceipt.confidence_score * 100).toFixed(0)}%
                          </span>
                       </h2>
                       <p className={`text-[10px] font-bold uppercase mt-0.5 ${config.colorMode === 'Dark' ? 'text-slate-500' : 'text-slate-400'}`}>Processing Time: {selectedReceipt.time || '10:20'}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <button onClick={() => handleExport(selectedReceipt)} className={`px-4 py-2 border rounded-xl text-[10px] font-black flex items-center gap-2 transition-all shadow-sm ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                       <FileOutput className="w-3.5 h-3.5" /> Export (XLSX)
                    </button>
                    <button onClick={() => setSelectedReceipt(null)} className={`p-2 border rounded-full transition-all ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-100'}`}>
                       <X className="w-5 h-5" />
                    </button>
                 </div>
              </div>

              {/* 3列布局主内容区 */}
              <div className="flex-1 flex overflow-hidden">
                 
                 {/* 左侧：发票原图常驻预览 (25%) */}
                 <div className={`w-[25%] p-6 flex flex-col border-r relative transition-colors ${config.colorMode === 'Dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-100/80 border-slate-200'}`}>
                    <h4 className={`text-[11px] font-black uppercase tracking-[2px] flex items-center gap-2 mb-4 ${config.colorMode === 'Dark' ? 'text-slate-600' : 'text-slate-500'}`}>
                       <Eye className="w-4 h-4" /> {t.originalReceipt}
                    </h4>
                    <div className={`flex-1 rounded-[24px] overflow-hidden border shadow-sm flex items-center justify-center relative group ${config.colorMode === 'Dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                       {selectedReceipt.image_url ? (
                          <>
                             <img 
                               src={selectedReceipt.image_url} 
                               onError={(e: any) => { e.target.onerror = null; e.target.src = '/input_file_2.png'; }} 
                               alt="Original Receipt" 
                               className="w-full h-full object-contain cursor-zoom-in" 
                               onClick={() => setZoomImage(selectedReceipt.image_url)} 
                               referrerPolicy="no-referrer"
                             />
                             
                             <button 
                                onClick={() => setZoomImage(selectedReceipt.image_url)} 
                                className="absolute bottom-4 right-4 px-3 py-2 bg-slate-900/70 hover:bg-slate-900 text-white rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all flex items-center gap-2 text-[10px] font-black uppercase shadow-xl"
                             >
                                <ZoomIn className="w-4 h-4" /> {t.zoomTip}
                             </button>
                          </>
                       ) : (
                          <div className="text-slate-400 text-[10px] font-bold flex flex-col items-center gap-2">
                            <Eye className="w-6 h-6 opacity-20" />
                            暂无原图记录
                          </div>
                       )}
                    </div>
                    {selectedReceipt.subsidy_info && (
                       <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                          <p className={`text-[9px] font-black uppercase mb-1 ${config.colorMode === 'Dark' ? 'text-amber-500' : 'text-amber-700'}`}>政府补贴 / 援助金</p>
                          <p className={`text-xs font-black leading-tight ${config.colorMode === 'Dark' ? 'text-amber-200' : 'text-amber-900'}`}>{selectedReceipt.subsidy_info}</p>
                       </div>
                    )}
                 </div>

                 {/* 右侧：结构化工作台 (75%) */}
                 <div className={`w-[75%] flex flex-col overflow-y-auto ${config.colorMode === 'Dark' ? 'bg-slate-900/50' : 'bg-slate-50/30'}`}>
                    
                    {/* 上部：抬头、商户信息与分类标签 */}
                    <div className={`p-8 border-b space-y-6 transition-colors ${config.colorMode === 'Dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                       <section className="space-y-4">
                          <h4 className={`text-[11px] font-black ${config.theme.text} uppercase tracking-[2px] flex items-center gap-2`}>
                             <Building2 className="w-4 h-4" /> {t.merchantInfo}
                          </h4>
                          <div className="grid grid-cols-4 gap-6">
                             {/* 基础信息区 */}
                             <div className="col-span-4 lg:col-span-3 grid grid-cols-3 gap-4">
                                <div className="col-span-2 space-y-1.5">
                                   <label className={`text-[10px] font-black uppercase ${config.colorMode === 'Dark' ? 'text-slate-500' : 'text-slate-400'}`}>商户名称 (Merchant)</label>
                                   <input type="text" value={selectedReceipt.merchant_name || ''} onChange={(e) => setSelectedReceipt({...selectedReceipt, merchant_name: e.target.value})} className={`w-full border rounded-xl px-4 py-2.5 text-sm font-black focus:ring-2 outline-none transition-all ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700 text-white focus:ring-indigo-500/20' : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-indigo-500/10'}`} />
                                </div>
                                <div className="space-y-1.5">
                                   <label className={`text-[10px] font-black uppercase ${config.colorMode === 'Dark' ? 'text-slate-500' : 'text-slate-400'}`}>日期 (Date)</label>
                                   <input type="text" value={selectedReceipt.date || ''} onChange={(e) => setSelectedReceipt({...selectedReceipt, date: e.target.value})} className={`w-full border rounded-xl px-4 py-2.5 text-sm font-black focus:ring-2 outline-none transition-all ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700 text-white focus:ring-indigo-500/20' : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-indigo-500/10'}`} />
                                </div>
                                <div className="space-y-1.5">
                                   <label className={`text-[10px] font-black uppercase ${config.colorMode === 'Dark' ? 'text-slate-500' : 'text-slate-400'}`}>发票号 (Invoice No)</label>
                                   <input type="text" value={selectedReceipt.invoice_no || ''} onChange={(e) => setSelectedReceipt({...selectedReceipt, invoice_no: e.target.value})} className={`w-full border rounded-xl px-4 py-2.5 text-sm font-black focus:ring-2 outline-none transition-all ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700 text-white focus:ring-indigo-500/20' : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-indigo-500/10'}`} />
                                </div>
                                <div className="space-y-1.5">
                                   <label className={`text-[10px] font-black uppercase ${config.colorMode === 'Dark' ? 'text-slate-500' : 'text-slate-400'}`}>注册号 (Reg No)</label>
                                   <input type="text" value={selectedReceipt.company_reg_no || ''} onChange={(e) => setSelectedReceipt({...selectedReceipt, company_reg_no: e.target.value})} className={`w-full border rounded-xl px-4 py-2.5 text-sm font-black focus:ring-2 outline-none transition-all ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700 text-white focus:ring-indigo-500/20' : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-indigo-500/10'}`} />
                                </div>
                                <div className="space-y-1.5">
                                   <label className={`text-[10px] font-black uppercase ${config.colorMode === 'Dark' ? 'text-slate-500' : 'text-slate-400'}`}>SST ID</label>
                                   <input type="text" value={selectedReceipt.sst_no || ''} onChange={(e) => setSelectedReceipt({...selectedReceipt, sst_no: e.target.value})} className={`w-full border rounded-xl px-4 py-2.5 text-sm font-black focus:ring-2 outline-none transition-all ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700 text-white focus:ring-indigo-500/20' : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-indigo-500/10'}`} />
                                </div>
                                <div className="col-span-2 space-y-1.5">
                                   <label className={`text-[10px] font-black uppercase ${config.colorMode === 'Dark' ? 'text-slate-500' : 'text-slate-400'}`}>电话 (Phone) & 支付 (Payment)</label>
                                   <div className="flex gap-2">
                                      <input type="text" value={selectedReceipt.phone || ''} placeholder="Phone" onChange={(e) => setSelectedReceipt({...selectedReceipt, phone: e.target.value})} className={`w-1/2 border rounded-xl px-4 py-2.5 text-sm font-black focus:ring-2 outline-none transition-all ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700 text-white focus:ring-indigo-500/20' : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-indigo-500/10'}`} />
                                      <input type="text" value={selectedReceipt.payment_method || ''} placeholder="Payment" onChange={(e) => setSelectedReceipt({...selectedReceipt, payment_method: e.target.value})} className={`w-1/2 border rounded-xl px-4 py-2.5 text-sm font-black focus:ring-2 outline-none transition-all ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700 text-white focus:ring-indigo-500/20' : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-indigo-500/10'}`} />
                                   </div>
                                </div>
                             </div>

                             {/* 分类与标签区 */}
                             <div className={`col-span-4 lg:col-span-1 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0 lg:pl-6 ${config.colorMode === 'Dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                                <div className="space-y-1.5">
                                   <label className={`text-[10px] font-black uppercase ${config.colorMode === 'Dark' ? 'text-slate-500' : 'text-slate-400'}`}>单据类型 & 行业</label>
                                   <div className="flex gap-2">
                                       <div className="relative w-1/2">
                                          <select value={selectedReceipt.doc_type} onChange={(e) => setSelectedReceipt({...selectedReceipt, doc_type: e.target.value})} className={`w-full appearance-none border rounded-xl pl-3 pr-8 py-2.5 text-xs font-black outline-none focus:ring-2 transition-all cursor-pointer ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700 text-white focus:ring-indigo-500/20 focus:bg-slate-700' : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-indigo-500/10 focus:bg-white'}`}>
                                             {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                          </select>
                                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                                       </div>
                                       <div className="relative w-1/2">
                                          <select value={selectedReceipt.industry} onChange={(e) => setSelectedReceipt({...selectedReceipt, industry: e.target.value})} className={`w-full appearance-none border rounded-xl pl-3 pr-8 py-2.5 text-xs font-black outline-none focus:ring-2 transition-all cursor-pointer ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700 text-white focus:ring-indigo-500/20 focus:bg-slate-700' : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-indigo-500/10 focus:bg-white'}`}>
                                             {INDUSTRIES.map(t => <option key={t} value={t}>{t}</option>)}
                                          </select>
                                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                                       </div>
                                   </div>
                                </div>
                                <div className="space-y-1.5">
                                   <label className={`text-[10px] font-black uppercase ${config.colorMode === 'Dark' ? 'text-slate-500' : 'text-slate-400'}`}>快捷标签</label>
                                   <div className="flex flex-wrap gap-1.5">
                                      {Array.from(new Set([...TAGS_OPTIONS, ...(selectedReceipt.tags || [])])).map(tag => (
                                          <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`px-2.5 py-1 rounded-lg text-[9px] font-black transition-all ${selectedReceipt.tags?.includes(tag) ? config.theme.color + ' text-white shadow-sm' : config.colorMode === 'Dark' ? 'bg-slate-800 text-slate-500 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                             {tag}
                                          </button>
                                       ))}
                                   </div>
                                   <div className="flex items-center gap-1 mt-1">
                                      <input type="text" value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTag(e)} placeholder="+ 自定义标签" className={`flex-1 border rounded-lg px-2 py-1.5 text-[10px] font-black outline-none focus:ring-1 ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700 text-white focus:ring-indigo-500/50' : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-indigo-500/20'}`} />
                                      <button type="button" onClick={() => handleAddCustomTag()} className={`px-2.5 py-1.5 ${config.theme.color} text-white rounded-lg text-[10px] font-black uppercase hover:brightness-110 transition-all`}>添加</button>
                                   </div>
                                </div>
                             </div>
                          </div>
                       </section>
                    </div>

                    {/* 中部：商品明细表 (SKU) */}
                    <div className="p-8 flex-1 flex flex-col">
                       <div className="flex items-center justify-between mb-4">
                          <h4 className={`text-[11px] font-black ${config.theme.text} uppercase tracking-[2px] flex items-center gap-2`}>
                             <ShoppingCart className="w-4 h-4" /> {t.skuItems}
                          </h4>
                          <button type="button" onClick={addNewItem} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 hover:brightness-95 transition-all ${config.colorMode === 'Dark' ? 'bg-indigo-900/30 text-indigo-400' : `${config.theme.light} ${config.theme.text}`}`}>
                             <Plus className="w-3.5 h-3.5" /> SKU
                          </button>
                       </div>
                       
                       <div className={`border rounded-[20px] overflow-hidden shadow-sm flex-1 transition-colors ${config.colorMode === 'Dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                          <table className="w-full text-left text-sm">
                             <thead className={`text-[9px] font-black uppercase border-b ${config.colorMode === 'Dark' ? 'bg-slate-800/50 text-slate-600 border-slate-800' : 'bg-slate-50/80 text-slate-500 border-slate-100'}`}>
                                <tr>
                                   <th className="px-5 py-3">Item Description</th>
                                   <th className="px-3 py-3 w-20 text-center">Qty</th>
                                   <th className="px-3 py-3 w-28 text-right">Unit {config.currency}</th>
                                   <th className="px-5 py-3 w-28 text-right">Line {config.currency}</th>
                                   <th className="px-3 py-3 w-10 text-center"></th>
                                </tr>
                             </thead>
                             <tbody className={`divide-y ${config.colorMode === 'Dark' ? 'divide-slate-800' : 'divide-slate-50'}`}>
                                {(selectedReceipt.items || []).map((item: any) => (
                                   <tr key={item.id} className="group transition-colors">
                                      <td className="px-5 py-2">
                                         <input type="text" value={item.name || ''} onChange={(e) => updateItem(item.id, 'name', e.target.value)} placeholder="名称" className={`w-full bg-transparent border-none p-1.5 text-xs font-black focus:ring-1 rounded ${config.colorMode === 'Dark' ? 'text-slate-300 focus:ring-slate-700 focus:bg-slate-800' : 'text-slate-700 focus:ring-slate-200 focus:bg-white'}`} />
                                      </td>
                                      <td className="px-3 py-2">
                                         <input type="number" value={item.qty === 0 ? '' : item.qty} onChange={(e) => updateItem(item.id, 'qty', e.target.value)} className={`w-full bg-transparent border-none p-1.5 text-xs font-black focus:ring-1 rounded text-center ${config.colorMode === 'Dark' ? 'text-slate-400 focus:ring-slate-700 focus:bg-slate-800' : 'text-slate-600 focus:ring-slate-200 focus:bg-white'}`} />
                                      </td>
                                      <td className="px-3 py-2">
                                         <input type="number" value={item.unit_price === 0 ? '' : item.unit_price} onChange={(e) => updateItem(item.id, 'unit_price', e.target.value)} className={`w-full bg-transparent border-none p-1.5 text-xs font-black focus:ring-1 rounded text-right ${config.colorMode === 'Dark' ? 'text-slate-400 focus:ring-slate-700 focus:bg-slate-800' : 'text-slate-600 focus:ring-slate-200 focus:bg-white'}`} />
                                      </td>
                                      <td className={`px-5 py-2 text-right text-xs font-black ${config.colorMode === 'Dark' ? 'text-white' : 'text-slate-900'}`}>{item.line_total.toFixed(2)}</td>
                                      <td className="px-3 py-2 text-center">
                                         <button type="button" onClick={() => removeItem(item.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="删除"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </td>
                                   </tr>
                                ))}
                                {(!selectedReceipt.items || selectedReceipt.items.length === 0) && (
                                   <tr><td colSpan={5} className="px-5 py-8 text-center text-[10px] font-bold text-slate-400">暂无明细记录，请手动添加。</td></tr>
                                )}
                             </tbody>
                          </table>
                       </div>
                    </div>

                    {/* 下部：财务汇总和自动数学校验引擎 */}
                    <div className={`p-8 border-t shadow-[0_-10px_30px_rgba(0,0,0,0.02)] z-10 flex flex-col gap-6 transition-colors ${config.colorMode === 'Dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                       <h4 className={`text-[11px] font-black ${config.theme.text} uppercase tracking-[2px] flex items-center gap-2`}>
                        <Calculator className="w-4 h-4" /> {t.calculator}
                       </h4>
                       
                       <div className={`grid grid-cols-6 gap-4 text-xs font-bold ${config.colorMode === 'Dark' ? 'text-slate-500' : 'text-slate-600'}`}>
                          <div className="space-y-1.5">
                             <span className="block text-[10px] text-slate-400 uppercase">Subtotal (Items)</span>
                             <div className={`w-full border border-transparent rounded-lg px-3 py-2.5 text-right font-black transition-colors ${config.colorMode === 'Dark' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`}>{config.currency} {itemsTotal.toFixed(2)}</div>
                          </div>
                          <div className="space-y-1.5">
                             <span className="block text-[10px] text-rose-500 uppercase">Discount (-)</span>
                             <input type="number" value={selectedReceipt.discount === 0 ? '' : selectedReceipt.discount} onChange={(e) => setSelectedReceipt({...selectedReceipt, discount: e.target.value})} className={`w-full border rounded-lg px-3 py-2.5 text-right text-rose-600 outline-none focus:ring-1 ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100 focus:ring-slate-200'}`} placeholder="0" />
                          </div>
                          <div className="space-y-1.5">
                             <span className="block text-[10px] text-slate-400 uppercase">Service Chg (+)</span>
                             <input type="number" value={selectedReceipt.service_charge === 0 ? '' : selectedReceipt.service_charge} onChange={(e) => setSelectedReceipt({...selectedReceipt, service_charge: e.target.value})} className={`w-full border rounded-lg px-3 py-2.5 text-right outline-none focus:ring-1 ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100 focus:ring-slate-200'}`} placeholder="0" />
                          </div>
                          <div className="space-y-1.5">
                             <span className="block text-[10px] text-slate-400 uppercase">Tax/SST (+)</span>
                             <input type="number" value={selectedReceipt.tax_sst === 0 ? '' : selectedReceipt.tax_sst} onChange={(e) => setSelectedReceipt({...selectedReceipt, tax_sst: e.target.value})} className={`w-full border rounded-lg px-3 py-2.5 text-right outline-none focus:ring-1 ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100 focus:ring-slate-200'}`} placeholder="0" />
                          </div>
                          <div className="space-y-1.5">
                             <span className="block text-[10px] text-slate-400 uppercase">Rounding (+/-)</span>
                             <input type="number" value={selectedReceipt.rounding === 0 ? '' : selectedReceipt.rounding} onChange={(e) => setSelectedReceipt({...selectedReceipt, rounding: e.target.value})} className={`w-full border rounded-lg px-3 py-2.5 text-right outline-none focus:ring-1 ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100 focus:ring-slate-200'}`} placeholder="0" />
                          </div>
                          <div className="space-y-1.5">
                             <span className="block text-[10px] text-slate-400 uppercase">Change (找零)</span>
                             <input type="number" value={selectedReceipt.change === 0 ? '' : selectedReceipt.change} onChange={(e) => setSelectedReceipt({...selectedReceipt, change: e.target.value})} className={`w-full border rounded-lg px-3 py-2.5 text-right outline-none focus:ring-1 ${config.colorMode === 'Dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100 focus:ring-slate-200'}`} placeholder="0" />
                          </div>
                       </div>
                       
                       <div className={`pt-6 border-t flex items-center justify-between ${config.colorMode === 'Dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                          <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">{t.calculatedTotal}</p>
                             <div className="flex items-center gap-4">
                               <p className={`text-3xl font-black tracking-tight ${Math.abs(manualTotal - selectedReceipt.grand_total) < 0.05 ? config.theme.text : 'text-rose-600'}`}>
                                  {config.currency} {manualTotal.toFixed(2)}
                               </p>
                               {Math.abs(manualTotal - selectedReceipt.grand_total) > 0.05 ? (
                                  <span className="px-3 py-1.5 bg-rose-50 text-rose-600 text-[10px] font-black uppercase rounded-lg border border-rose-100 flex items-center gap-1 animate-pulse">
                                    <AlertTriangle className="w-4 h-4" /> {t.mathFailed} {config.currency} {(manualTotal - selectedReceipt.grand_total).toFixed(2)}
                                  </span>
                               ) : (
                                  <span className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg border flex items-center gap-1 ${config.colorMode === 'Dark' ? 'bg-emerald-950 text-emerald-400 border-emerald-900/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                    <CheckCircle className="w-4 h-4" /> {t.mathPassed}
                                  </span>
                               )}
                             </div>
                             <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{t.ocrTotal}: {config.currency} {selectedReceipt.grand_total}</p>
                          </div>
                          
                          <div className="flex items-center gap-3">
                             <button onClick={() => setSelectedReceipt(null)} className={`px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${config.colorMode === 'Dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                {t.keepPending}
                             </button>
                             <button 
                                onClick={async () => { 
                                  const updated = { ...selectedReceipt, status: 'Synced' };
                                  setHistory(history.map(h => h.id === selectedReceipt.id ? updated : h)); 
                                  await syncToDatabase(updated);
                                  setSelectedReceipt(null); 
                                }} 
                                className={`px-8 py-4 ${config.theme.color} text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 active:scale-95`}
                             >
                                <Save className="w-4 h-4" /> {t.syncToSheets}
                             </button>
                          </div>
                       </div>
                    </div>
                 </div>

              </div>
           </div>
        </div>
      )}

      {/* Settings Modal - Safety Preserved */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
           <div className={`w-full max-w-md rounded-[32px] shadow-2xl p-8 space-y-6 transition-colors ${config.colorMode === 'Dark' ? 'bg-slate-900 text-white border border-slate-800' : 'bg-white text-slate-900'}`}>
              <div className={`flex justify-between items-center border-b pb-4 ${config.colorMode === 'Dark' ? 'border-slate-800' : 'border-slate-50'}`}>
                 <h3 className="text-xl font-black flex items-center gap-2">
                   <Settings className="w-5 h-5" /> {t.systemPref}
                 </h3>
                 <button onClick={() => setIsSettingsOpen(false)} className={`p-2 rounded-full transition-all ${config.colorMode === 'Dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                   <X className="w-5 h-5" />
                 </button>
              </div>

              <div className="space-y-6">
                 {/* 语言配置 */}
                 <div className="space-y-3">
                    <label className={`text-[10px] font-black uppercase tracking-[2px] flex items-center gap-2 ${config.colorMode === 'Dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                       <Languages className="w-3.5 h-3.5" /> {t.languagePref}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                       {[{ id: 'zh', name: '中文' }, { id: 'en', name: 'English' }, { id: 'ms', name: 'Melayu' }].map(lang => (
                          <button 
                            key={lang.id}
                            onClick={() => setConfig({...config, language: lang.id})}
                            className={`px-4 py-3 rounded-xl text-xs font-black transition-all border ${
                              config.language === lang.id 
                                ? `${config.theme.color} text-white border-transparent shadow-lg` 
                                : config.colorMode === 'Dark' 
                                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' 
                                  : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-white hover:shadow-sm'
                            }`}
                          >
                             {lang.name}
                          </button>
                       ))}
                    </div>
                 </div>

                 {/* 系统颜色深浅 */}
                 <div className="space-y-3">
                    <label className={`text-[10px] font-black uppercase tracking-[2px] flex items-center gap-2 ${config.colorMode === 'Dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                       <Sun className="w-3.5 h-3.5" /> {t.themeMode}
                    </label>
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1">
                       <button 
                          onClick={() => setConfig({...config, colorMode: 'Light'})}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${config.colorMode === 'Light' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                       >
                          <Sun className="w-4 h-4" /> {t.lightMode}
                       </button>
                       <button 
                          onClick={() => setConfig({...config, colorMode: 'Dark'})}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${config.colorMode === 'Dark' ? 'bg-slate-700 shadow-sm text-white' : 'text-slate-500 hover:text-slate-300'}`}
                       >
                          <Moon className="w-4 h-4" /> {t.darkMode}
                       </button>
                    </div>
                 </div>

                 {/* 货币设置 */}
                 <div className="space-y-3">
                    <label className={`text-[10px] font-black uppercase tracking-[2px] flex items-center gap-2 ${config.colorMode === 'Dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                       <Banknote className="w-3.5 h-3.5" /> {t.currencyPref}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                       {['RM', 'USD', 'CNY'].map(cur => (
                          <button 
                            key={cur}
                            onClick={() => setConfig({...config, currency: cur})}
                            className={`px-4 py-3 rounded-xl text-xs font-black transition-all border ${
                              config.currency === cur 
                                ? `${config.theme.color} text-white border-transparent shadow-lg` 
                                : config.colorMode === 'Dark' 
                                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' 
                                  : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-white hover:shadow-sm'
                            }`}
                          >
                             {cur}
                          </button>
                       ))}
                    </div>
                 </div>

                 {/* 主题色选择 */}
                 <div>
                    <label className={`text-[10px] font-black uppercase tracking-[2px] block mb-3 ${config.colorMode === 'Dark' ? 'text-slate-500' : 'text-slate-400'}`}>{t.brandColor}</label>
                    <div className="flex gap-4">
                       {THEMES.map(t_color => (
                          <button 
                            key={t_color.name} 
                            onClick={() => setConfig({...config, theme: t_color})} 
                            className={`w-10 h-10 rounded-2xl ${t_color.color} flex items-center justify-center transition-all ${config.theme.name === t_color.name ? 'scale-110 ring-4 ring-offset-4 ' + (config.colorMode === 'Dark' ? 'ring-slate-700 ring-offset-slate-900' : 'ring-slate-200 ring-offset-white') : 'opacity-40 hover:opacity-100'}`}
                          >
                            {config.theme.name === t_color.name && <CheckCircle className="w-5 h-5 text-white" />}
                          </button>
                       ))}
                    </div>
                 </div>


              </div>

              <div className="pt-2">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className={`w-full py-4 ${config.theme.color} text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:brightness-110 transition-all`}
                >
                  {t.saveAndApply}
                </button>
              </div>
           </div>
        </div>
      )}

      {/* 全屏图片放大预览模态框 */}
      {zoomImage && (
        <div 
           className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-10 bg-slate-900/90 backdrop-blur-sm animate-in fade-in zoom-in duration-200 cursor-zoom-out"
           onClick={() => setZoomImage(null)}
        >
           <button 
              onClick={() => setZoomImage(null)} 
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-rose-500 text-white rounded-full transition-all backdrop-blur-md z-10"
           >
              <X className="w-6 h-6" />
           </button>
           <img 
              src={zoomImage} 
              alt="Zoomed Receipt" 
              className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-lg cursor-default" 
              onClick={(e) => e.stopPropagation()} 
              referrerPolicy="no-referrer"
           />
        </div>
      )}
    </div>
  );
}
