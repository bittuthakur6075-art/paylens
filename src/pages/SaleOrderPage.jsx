import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { 
  FileText, Plus, Trash2, Download, Eye, 
  Printer, ClipboardList, Calculator, Receipt, User, 
  Building2, Percent, CheckSquare, Save, Sparkles,
  RotateCcw, Landmark, Truck, Calendar, Hash, FileCheck2,
  ChevronDown, ChevronUp, Copy
} from 'lucide-react';

// Format Indian Currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

// Convert number to Indian words format (INR Lakhs / Crores)
const numberToWords = (num) => {
  if (!num || isNaN(num) || num === 0) return 'INR Zero Only';
  
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const inWords = (n) => {
    if (n === 0) return '';
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? 'and ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? 'and ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? 'and ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? 'and ' + inWords(n % 10000000) : '');
  };

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);
  
  let words = inWords(integerPart).trim();
  if (!words) words = 'Zero';
  
  let result = 'INR ' + words;
  if (decimalPart > 0) {
    result += ' and ' + inWords(decimalPart).trim() + ' Paise';
  }
  return result + ' Only';
};

// Pre-configured Company Profiles (User can customize or save as default)
const defaultCompanies = [
  {
    id: "aman",
    firmName: "AMAN ENTERPRISES",
    address: "1827, Gali No. 8, Raja Garden, Cantt Onk,\nDelhi - 110027",
    mobile: "",
    gstin: "07BFVPV7083K1Z2",
    state: "Delhi",
    stateCode: "07",
    bank: {
      accountName: "Aman Enterprises",
      accountNo: "236711100002209",
      bankName: "UNION BANK OF INDIA",
      branch: "BRANCH RAJENDRA NAGAR, NEW DELHI-110060",
      ifscCode: "UBIN0823678",
      swiftCode: "UBININBBNCC"
    }
  }
];

const defaultSeller = defaultCompanies[0];
const defaultBankDetails = defaultCompanies[0].bank;

const defaultBuyer = {
  partyName: "Reworks",
  address: "40/3 ITI Colony Sandwa, Naini Industrial Area, Allahabad, Uttar Pradesh, 211010",
  mobile: "63790 91946",
  gstin: "09DEKPS4410D1ZI",
  state: "Uttar Pradesh",
  stateCode: "09"
};

const unitOptions = ["pcs", "Kg", "Mtr", "Ltr", "Box", "Set", "Dozen", "Pair", "Bundle", "Nos"];

export default function SaleOrderPage() {
  const [orders, setOrders] = useState([]);
  
  // Voucher Meta
  const [orderNo, setOrderNo] = useState("231");
  const [date, setDate] = useState("09-April-26");
  const [deliveryNote, setDeliveryNote] = useState("231");
  const [paymentTerms, setPaymentTerms] = useState("50% Advance and 50% Before Dispatch");
  const [refNo, setRefNo] = useState("17-Mar-26");
  const [otherRef, setOtherRef] = useState("");
  const [buyersOrderNo, setBuyersOrderNo] = useState("231");
  const [refDate, setRefDate] = useState("17-Mar-26");
  const [dispatchDocNo, setDispatchDocNo] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [dispatchThrough, setDispatchThrough] = useState("—");
  const [destination, setDestination] = useState("");
  const [termsOfDelivery, setTermsOfDelivery] = useState("—");
  const [orderNote, setOrderNote] = useState("Note : - 50% Advance and 50% Before Dispatch");
  
  // Saved Seller Companies List
  const [savedCompanies, setSavedCompanies] = useState(() => {
    try {
      const stored = localStorage.getItem('paylens_companies_list');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.filter(c => c.firmName && c.firmName.toLowerCase() !== 'reworks' && !c.address?.includes('PHOOL WALI'));
          if (clean.length > 0) return clean;
        }
      }
    } catch (e) {}
    return defaultCompanies;
  });

  // Parties & Main Company Selection
  const [sellerInfo, setSellerInfo] = useState(() => {
    try {
      const saved = localStorage.getItem('paylens_main_company');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.firmName && parsed.firmName.toLowerCase() !== 'reworks' && !parsed.address?.includes('PHOOL WALI')) {
          return parsed;
        }
      }
    } catch (e) {}
    return defaultCompanies[0];
  });
  const [buyerInfo, setBuyerInfo] = useState(defaultBuyer);
  const [consigneeInfo, setConsigneeInfo] = useState(defaultBuyer);
  const [sameAsBuyer, setSameAsBuyer] = useState(true);
  const [bankDetails, setBankDetails] = useState(() => {
    try {
      const saved = localStorage.getItem('paylens_main_company');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.bank && parsed.firmName && parsed.firmName.toLowerCase() !== 'reworks' && !parsed.bank?.bankName?.includes('PUNJAB')) {
          return parsed.bank;
        }
      }
    } catch (e) {}
    return defaultCompanies[0].bank;
  });
  const [companySavedToast, setCompanySavedToast] = useState(false);

  // Advanced accordion state
  const [showAdvancedVoucher, setShowAdvancedVoucher] = useState(true);
  const [showBankSection, setShowBankSection] = useState(true);

  // Items
  const [items, setItems] = useState([
    { id: 1, name: "Acrylic Keychain", hsn: "42050090", dueOn: "17-Mar-26", qty: 500, unit: "pcs", rate: 7.50, amount: 3750 }
  ]);

  // Tax
  const [taxType, setTaxType] = useState('igst'); // 'igst' or 'cgst_sgst'
  const [taxRate, setTaxRate] = useState(18);
  const [searchTerm, setSearchTerm] = useState("");

  // Load orders from localStorage
  useEffect(() => {
    try {
      const savedOrders = JSON.parse(localStorage.getItem('paylens_sale_orders') || '[]');
      setOrders(savedOrders);
      const counter = parseInt(localStorage.getItem('paylens_so_counter') || '231', 10);
      setOrderNo(counter.toString());
      setDeliveryNote(counter.toString());
      setBuyersOrderNo(counter.toString());
    } catch (e) {
      console.warn('Failed to load saved sale orders:', e);
    }
  }, []);

  // Totals calculations
  const totals = useMemo(() => {
    const subTotal = items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.rate || 0)), 0);
    const totalQty = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    
    let cgstAmt = 0;
    let sgstAmt = 0;
    let igstAmt = 0;
    
    if (taxType === 'cgst_sgst') {
      const halfRate = (Number(taxRate) || 0) / 2;
      cgstAmt = (subTotal * halfRate) / 100;
      sgstAmt = (subTotal * halfRate) / 100;
    } else {
      igstAmt = (subTotal * (Number(taxRate) || 0)) / 100;
    }
    
    const taxTotal = cgstAmt + sgstAmt + igstAmt;
    const grandTotal = Math.round(subTotal + taxTotal);
    
    return {
      subTotal,
      totalQty,
      cgstAmt,
      sgstAmt,
      igstAmt,
      taxTotal,
      grandTotal,
      amountInWords: numberToWords(grandTotal)
    };
  }, [items, taxType, taxRate]);

  // Handle item change
  const handleItemChange = (id, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'qty' || field === 'rate') {
          const q = Number(field === 'qty' ? value : item.qty) || 0;
          const r = Number(field === 'rate' ? value : item.rate) || 0;
          updated.amount = Number((q * r).toFixed(2));
        }
        return updated;
      }
      return item;
    }));
  };

  const addItem = () => {
    setItems(prev => [
      ...prev,
      { id: Date.now(), name: "", hsn: "", dueOn: refDate || date, qty: 1, unit: "pcs", rate: 0, amount: 0 }
    ]);
  };

  const removeItem = (id) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  // Reset Form
  const resetForm = () => {
    const counter = parseInt(localStorage.getItem('paylens_so_counter') || '232', 10);
    const nextNum = (counter + 1).toString();
    setOrderNo(nextNum);
    setDeliveryNote(nextNum);
    setBuyersOrderNo(nextNum);
    setDate(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-'));
    setRefNo("");
    setRefDate("");
    setOtherRef("");
    setDispatchDocNo("");
    setDeliveryDate("");
    setDispatchThrough("—");
    setDestination("");
    setTermsOfDelivery("—");
    setOrderNote("Note : - 50% Advance and 50% Before Dispatch");
    setBuyerInfo(defaultBuyer);
    setConsigneeInfo(defaultBuyer);
    setSameAsBuyer(true);
    setItems([{ id: Date.now(), name: "", hsn: "", dueOn: "", qty: 1, unit: "pcs", rate: 0, amount: 0 }]);
  };

  // Save / Add Company to list and set as default in localStorage
  const handleSaveMainCompany = () => {
    try {
      const name = (sellerInfo.firmName || "").trim();
      if (!name) {
        alert("Please enter a Company / Firm Name first.");
        return;
      }
      const toSave = { ...sellerInfo, bank: bankDetails };
      localStorage.setItem('paylens_main_company', JSON.stringify(toSave));

      // Update or append to savedCompanies list
      setSavedCompanies(prev => {
        const idx = prev.findIndex(c => c.firmName?.toLowerCase() === name.toLowerCase());
        let updated;
        if (idx >= 0) {
          updated = [...prev];
          updated[idx] = { ...updated[idx], ...toSave };
        } else {
          updated = [...prev, { id: Date.now().toString(), ...toSave }];
        }
        localStorage.setItem('paylens_companies_list', JSON.stringify(updated));
        return updated;
      });

      setCompanySavedToast(true);
      setTimeout(() => setCompanySavedToast(false), 3000);
    } catch (e) {
      alert("Failed to save company profile.");
    }
  };

  // Clear inputs to add a fresh new company
  const handleAddNewCompany = () => {
    setSellerInfo({
      firmName: "",
      address: "",
      mobile: "",
      state: "",
      stateCode: "",
      gstin: ""
    });
    setBankDetails({
      accountName: "",
      accountNo: "",
      bankName: "",
      branch: "",
      ifscCode: "",
      swiftCode: ""
    });
  };

  // Delete a company preset
  const handleDeleteCompany = (id, firmName, e) => {
    e.stopPropagation();
    if (savedCompanies.length <= 1) {
      alert("At least one company must remain in the list.");
      return;
    }
    if (window.confirm(`Are you sure you want to remove "${firmName}" from company presets?`)) {
      const updated = savedCompanies.filter(c => c.id !== id);
      setSavedCompanies(updated);
      localStorage.setItem('paylens_companies_list', JSON.stringify(updated));
      if (sellerInfo.firmName?.toLowerCase() === firmName?.toLowerCase()) {
        handleSelectCompanyPreset(updated[0]);
      }
    }
  };

  // Switch Main Company profile
  const handleSelectCompanyPreset = (company) => {
    setSellerInfo({
      firmName: company.firmName || "",
      address: company.address || "",
      mobile: company.mobile || "",
      gstin: company.gstin || "",
      state: company.state || "",
      stateCode: company.stateCode || ""
    });
    if (company.bank) {
      setBankDetails(company.bank);
    }
  };

  // Copy Buyer (Bill to) to Consignee (Ship to)
  const handleCopyBuyerToConsignee = () => {
    setConsigneeInfo({
      partyName: buyerInfo.partyName || "",
      address: buyerInfo.address || "",
      mobile: buyerInfo.mobile || "",
      state: buyerInfo.state || "",
      stateCode: buyerInfo.stateCode || "",
      gstin: buyerInfo.gstin || ""
    });
  };

  // Load exact reference sample from reference document
  const loadReferenceSample = () => {
    setOrderNo("231");
    setDate("09-April-26");
    setDeliveryNote("231");
    setPaymentTerms("50% Advance and 50% Before Dispatch");
    setRefNo("17-Mar-26");
    setOtherRef("");
    setBuyersOrderNo("231");
    setRefDate("17-Mar-26");
    setDispatchDocNo("");
    setDeliveryDate("");
    setDispatchThrough("—");
    setDestination("");
    setTermsOfDelivery("—");
    setOrderNote("Note : - 50% Advance and 50% Before Dispatch");
    
    // Main Company that bills / cuts the bill
    setSellerInfo({
      firmName: "AMAN ENTERPRISES",
      address: "1827, Gali No. 8, Raja Garden, Cantt Onk,\nDelhi - 110027",
      mobile: "",
      state: "Delhi",
      stateCode: "07",
      gstin: "07BFVPV7083K1Z2"
    });
    
    // Consignee (Ship to)
    setConsigneeInfo({
      partyName: "Reworks",
      address: "40/3 ITI Colony Sandwa, Naini Industrial Area, Allahabad, Uttar Pradesh, 211010",
      mobile: "63790 91946",
      state: "Uttar Pradesh",
      stateCode: "09",
      gstin: "09DEKPS4410D1ZI"
    });

    // Buyer (Bill to)
    setBuyerInfo({
      partyName: "Reworks",
      address: "40/3 ITI Colony Sandwa, Naini Industrial Area, Allahabad, Uttar Pradesh, 211010",
      mobile: "63790 91946",
      state: "Uttar Pradesh",
      stateCode: "09",
      gstin: "09DEKPS4410D1ZI"
    });
    setSameAsBuyer(true);

    setBankDetails({
      accountName: "Aman Enterprises",
      accountNo: "236711100002209",
      bankName: "UNION BANK OF INDIA",
      branch: "BRANCH RAJENDRA NAGAR, NEW DELHI-110060",
      ifscCode: "UBIN0823678",
      swiftCode: "UBININBBNCC"
    });

    setItems([
      {
        id: 1,
        name: "Acrylic Keychain",
        hsn: "42050090",
        dueOn: "17-Mar-26",
        qty: 500,
        unit: "pcs",
        rate: 7.50,
        amount: 3750
      }
    ]);

    setTaxType("igst");
    setTaxRate(18);
  };

  // Save order to LocalStorage
  const handleSaveOrder = () => {
    if (!buyerInfo.partyName?.trim()) {
      alert("Please enter Party / Buyer Name!");
      return;
    }

    const orderRecord = {
      id: Date.now(),
      orderNo,
      date,
      deliveryNote,
      paymentTerms,
      refNo,
      otherRef,
      buyersOrderNo,
      refDate,
      dispatchDocNo,
      deliveryDate,
      dispatchThrough,
      destination,
      termsOfDelivery,
      orderNote,
      seller: sellerInfo,
      consignee: sameAsBuyer ? buyerInfo : consigneeInfo,
      buyer: buyerInfo,
      bank: bankDetails,
      items,
      taxType,
      taxRate,
      totals,
      createdAt: new Date().toISOString()
    };

    const updated = [orderRecord, ...orders.filter(o => o.orderNo !== orderNo)];
    setOrders(updated);
    localStorage.setItem('paylens_sale_orders', JSON.stringify(updated));

    const num = parseInt(orderNo, 10);
    if (!isNaN(num)) {
      localStorage.setItem('paylens_so_counter', (num + 1).toString());
    }

    alert(`Sale Order #${orderNo} saved successfully!`);
  };

  // Load existing order from archive
  const handleLoadOrder = (order) => {
    setOrderNo(order.orderNo);
    setDate(order.date || "");
    setDeliveryNote(order.deliveryNote || order.orderNo);
    setPaymentTerms(order.paymentTerms || "50% Advance and 50% Before Dispatch");
    setRefNo(order.refNo || "");
    setOtherRef(order.otherRef || "");
    setBuyersOrderNo(order.buyersOrderNo || order.orderNo);
    setRefDate(order.refDate || "");
    setDispatchDocNo(order.dispatchDocNo || "");
    setDeliveryDate(order.deliveryDate || "");
    setDispatchThrough(order.dispatchThrough || "SafeExpress");
    setDestination(order.destination || "");
    setTermsOfDelivery(order.termsOfDelivery || "Goods once sold will not be taken back.");
    setOrderNote(order.orderNote || "Note : - 50% Advance and 50% Before Dispatch");
    setSellerInfo(order.seller || defaultSeller);
    setBuyerInfo(order.buyer || defaultBuyer);
    setConsigneeInfo(order.consignee || order.buyer || defaultBuyer);
    setSameAsBuyer(!order.consignee || JSON.stringify(order.consignee) === JSON.stringify(order.buyer));
    setBankDetails(order.bank || defaultBankDetails);
    setItems(order.items?.length ? order.items : [{ id: 1, name: "", hsn: "", dueOn: "", qty: 1, unit: "pcs", rate: 0, amount: 0 }]);
    setTaxType(order.taxType || "igst");
    setTaxRate(order.taxRate !== undefined ? order.taxRate : 18);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete order
  const handleDeleteOrder = (id) => {
    if (window.confirm("Are you sure you want to delete this sale order from history?")) {
      const updated = orders.filter(o => o.id !== id);
      setOrders(updated);
      localStorage.setItem('paylens_sale_orders', JSON.stringify(updated));
    }
  };

  // =========================================================================
  // EXACT COMMERCIAL SALES ORDER PDF GENERATOR (MATCHING REFERENCE DOCUMENT)
  // =========================================================================
  const generateAuthenticPDF = (orderData = null, action = 'download') => {
    const data = orderData || {
      orderNo,
      date,
      deliveryNote,
      paymentTerms,
      refNo,
      otherRef,
      buyersOrderNo,
      refDate,
      dispatchDocNo,
      deliveryDate,
      dispatchThrough,
      destination,
      termsOfDelivery,
      orderNote,
      seller: sellerInfo,
      consignee: sameAsBuyer ? buyerInfo : consigneeInfo,
      buyer: buyerInfo,
      bank: bankDetails,
      items,
      taxType,
      taxRate,
      totals
    };

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });



    // Helper to safely wrap text within a maximum width (mm) without horizontal overflow
    const getWrappedLines = (text, maxWidth) => {
      if (!text) return [];
      const rawLines = String(text).split('\n');
      const allWrapped = [];
      rawLines.forEach(rl => {
        const trimmed = rl.trim();
        if (trimmed) {
          const wrapped = doc.splitTextToSize(trimmed, maxWidth);
          if (Array.isArray(wrapped)) {
            allWrapped.push(...wrapped);
          } else {
            allWrapped.push(wrapped);
          }
        }
      });
      return allWrapped;
    };

    // Document margins & dimensions (A4: 210 x 297mm)
    const left = 10;
    const right = 200;
    const width = right - left; // 190mm
    const top = 12;
    const bottom = 282; // 270mm height

    // Single outer bounding rectangle (crisp solid black border)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.45);
    doc.rect(left, top, width, bottom - top);

    // -------------------------------------------------------------
    // SECTION 1: HEADER (Y: 12 -> 54)
    // -------------------------------------------------------------
    const hBottom = 54;
    const midX = 110;

    doc.setLineWidth(0.35);
    doc.line(midX, top, midX, hBottom);
    doc.line(left, hBottom, right, hBottom);

    // Left Part: AMAN ENTERPRISES
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(21);
    doc.setTextColor(0, 0, 0);
    doc.text(data.seller.firmName || "AMAN ENTERPRISES", left + 3.5, top + 8.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const sellerAddrLines = getWrappedLines(data.seller.address || "", midX - left - 7);
    let curSY = top + 15.0;
    const sSpacing = sellerAddrLines.length > 2 ? 3.8 : 4.5;
    sellerAddrLines.slice(0, 3).forEach(l => {
      doc.text(l, left + 3.5, curSY);
      curSY += sSpacing;
    });

    curSY = Math.max(curSY, top + 27.5);
    doc.text(`GSTIN/UIN : ${data.seller.gstin || "07BFVPV7083K1Z2"}`, left + 3.5, curSY);
    curSY += 6.0;
    doc.text(`State Name : ${data.seller.state || "Delhi"}, Code : ${data.seller.stateCode || "07"}`, left + 3.5, curSY);

    // Right Part: SALES ORDER Title Cell
    const titleH = 9.0;
    doc.line(midX, top + titleH, right, top + titleH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14.5);
    doc.text('SALES ORDER', (midX + right) / 2, top + 6.8, { align: 'center' });

    // 5 Meta Rows
    const rH = (hBottom - (top + titleH)) / 5;
    const vSplit = 148;

    doc.line(vSplit, top + titleH, vSplit, hBottom);

    const metaRows = [
      { label: 'Voucher No.', val: data.orderNo || '231' },
      { label: 'Dated', val: data.date || '09-April-26' },
      { label: "Buyer's Ref. Order No.", val: data.buyersOrderNo || data.orderNo || '231' },
      { label: 'Dispatch Through', val: (!data.dispatchThrough || data.dispatchThrough === 'SafeExpress') ? '—' : data.dispatchThrough },
      { label: 'Terms of Delivery', val: (!data.termsOfDelivery || data.termsOfDelivery === 'Goods once sold will not be taken back.') ? '—' : data.termsOfDelivery }
    ];

    metaRows.forEach((r, idx) => {
      const cy = top + titleH + (idx * rH);
      if (idx > 0) doc.line(midX, cy, right, cy);
      const textY = cy + (rH / 2) + 1.2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(r.label, midX + 2.5, textY);
      doc.text(':', vSplit - 3.5, textY);
      doc.setFont('helvetica', 'bold');
      doc.text(String(r.val), vSplit + 3, textY);
    });

    // -------------------------------------------------------------
    // SECTION 2: CONSIGNEE & BUYER (Y: 54 -> 99)
    // -------------------------------------------------------------
    const partiesBottom = 99;
    const partiesMid = 105;

    doc.line(partiesMid, hBottom, partiesMid, partiesBottom);
    doc.line(left, partiesBottom, right, partiesBottom);

    // Headers: Consignee & Buyer
    const pHeaderH = 7.5;
    doc.line(left, hBottom + pHeaderH, right, hBottom + pHeaderH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Consignee (Ship to)', left + 3.5, hBottom + 5.2);
    doc.text('Buyer (Bill to)', partiesMid + 3.5, hBottom + 5.2);

    const pDetailsY = hBottom + pHeaderH;
    const pDividerY = 84.5;
    doc.line(left + 3.5, pDividerY, partiesMid - 3.5, pDividerY);
    doc.line(partiesMid + 3.5, pDividerY, right - 3.5, pDividerY);

    const consignee = data.consignee || data.buyer;
    const buyer = data.buyer;
    const maxPartyW = 82;

    // Consignee details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const consigneeName = doc.splitTextToSize(consignee.partyName || "Reworks", maxPartyW);
    doc.text(consigneeName[0], left + 3.5, pDetailsY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const consigneeAddrLines = getWrappedLines(consignee.address || "", maxPartyW);
    let curCY = pDetailsY + 10.0;
    const cSpacing = consigneeAddrLines.length > 2 ? 3.8 : 4.5;
    consigneeAddrLines.slice(0, 3).forEach(l => {
      doc.text(l, left + 3.5, curCY);
      curCY += cSpacing;
    });
    if (consignee.mobile) {
      doc.text(`Mob. ${consignee.mobile}`, left + 3.5, curCY);
    }

    doc.text(`GST NO.    : ${consignee.gstin || "09DEKPS4410D1ZI"}`, left + 3.5, pDividerY + 5.0);
    doc.text(`STATE NAME : ${consignee.state || "Uttar Pradesh"}, Code : ${consignee.stateCode || "09"}`, left + 3.5, pDividerY + 9.5);

    // Buyer details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const buyerName = doc.splitTextToSize(buyer.partyName || "Reworks", maxPartyW);
    doc.text(buyerName[0], partiesMid + 3.5, pDetailsY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const buyerAddrLines = getWrappedLines(buyer.address || "", maxPartyW);
    let curBY = pDetailsY + 10.0;
    const bSpacing = buyerAddrLines.length > 2 ? 3.8 : 4.5;
    buyerAddrLines.slice(0, 3).forEach(l => {
      doc.text(l, partiesMid + 3.5, curBY);
      curBY += bSpacing;
    });
    if (buyer.mobile) {
      doc.text(`Mob. ${buyer.mobile}`, partiesMid + 3.5, curBY);
    }

    doc.text(`GST NO.    : ${buyer.gstin || "09DEKPS4410D1ZI"}`, partiesMid + 3.5, pDividerY + 5.0);
    doc.text(`STATE NAME : ${buyer.state || "Uttar Pradesh"}, Code : ${buyer.stateCode || "09"}`, partiesMid + 3.5, pDividerY + 9.5);

    // -------------------------------------------------------------
    // SECTION 3: ITEMS TABLE (Y: 99 -> 190)
    // -------------------------------------------------------------
    const tblTop = 99;
    const tblHeaderH = 12;
    const tblHeaderBottom = tblTop + tblHeaderH;
    const totalTop = 182;
    const totalBottom = 190;

    doc.line(left, tblHeaderBottom, right, tblHeaderBottom);

    const cols = [
      { name: 'S.No.', x1: 10, x2: 21 },
      { name: 'Description of Goods', x1: 21, x2: 74 },
      { name: 'HSN/SAC\nCode', x1: 74, x2: 93 },
      { name: 'GST\nRate', x1: 93, x2: 106 },
      { name: 'Due on', x1: 106, x2: 125 },
      { name: 'Quantity', x1: 125, x2: 145 },
      { name: 'Rate', x1: 145, x2: 163 },
      { name: 'per', x1: 163, x2: 174 },
      { name: 'Amount', x1: 174, x2: 200 }
    ];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    cols.forEach(c => {
      const mx = (c.x1 + c.x2) / 2;
      if (c.name.includes('\n')) {
        const parts = c.name.split('\n');
        doc.text(parts[0], mx, tblTop + 4.5, { align: 'center' });
        doc.text(parts[1], mx, tblTop + 9.0, { align: 'center' });
      } else {
        doc.text(c.name, mx, tblTop + 7.0, { align: 'center' });
      }
    });

    // Vertical grid lines down to Total row
    cols.slice(1).forEach(c => {
      doc.line(c.x1, tblTop, c.x1, totalTop);
    });

    // Row Items
    let itemY = tblHeaderBottom + 7.0;
    data.items.forEach((item, idx) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text((idx + 1).toString(), (cols[0].x1 + cols[0].x2) / 2, itemY, { align: 'center' });

      const maxDescW = cols[1].x2 - cols[1].x1 - 5;
      const descLines = doc.splitTextToSize(item.name || '', maxDescW);
      if (descLines.length <= 1) {
        doc.text(descLines[0] || '', cols[1].x1 + 3, itemY);
      } else {
        descLines.forEach((dl, dlIdx) => {
          doc.text(dl, cols[1].x1 + 3, itemY + (dlIdx * 3.8));
        });
      }

      doc.setFont('helvetica', 'normal');
      doc.text(item.hsn || '', (cols[2].x1 + cols[2].x2) / 2, itemY, { align: 'center' });
      doc.text(`${item.gstRate || data.taxRate} %`, (cols[3].x1 + cols[3].x2) / 2, itemY, { align: 'center' });
      doc.text(item.dueOn || data.date || '', (cols[4].x1 + cols[4].x2) / 2, itemY, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.text(`${item.qty} ${item.unit || 'pcs'}`, (cols[5].x1 + cols[5].x2) / 2, itemY, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.text(Number(item.rate || 0).toFixed(2), (cols[6].x1 + cols[6].x2) / 2, itemY, { align: 'center' });
      doc.text(item.unit || 'pcs', (cols[7].x1 + cols[7].x2) / 2, itemY, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.text(Number(item.amount || (item.qty * item.rate)).toLocaleString('en-IN', { minimumFractionDigits: 2 }), cols[8].x2 - 3, itemY, { align: 'right' });

      itemY += Math.max(8, descLines.length * 4.0 + 2);
    });

    // Mid-Table Tax Row
    const taxY = Math.max(itemY + 12, tblHeaderBottom + 35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);

    if (data.taxType === 'cgst_sgst') {
      const halfRate = (data.taxRate / 2).toFixed(0);
      doc.text(`CGST @ ${halfRate}%`, (cols[1].x1 + cols[1].x2) / 2, taxY, { align: 'center' });
      doc.text(data.totals.cgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }), cols[8].x2 - 3, taxY, { align: 'right' });
      
      doc.text(`SGST @ ${halfRate}%`, (cols[1].x1 + cols[1].x2) / 2, taxY + 6, { align: 'center' });
      doc.text(data.totals.sgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }), cols[8].x2 - 3, taxY + 6, { align: 'right' });
    } else {
      doc.text(`IGST @ ${data.taxRate}%`, (cols[1].x1 + cols[1].x2) / 2, taxY, { align: 'center' });
      doc.text(data.totals.igstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }), cols[8].x2 - 3, taxY, { align: 'right' });
    }

    // TOTAL ROW
    doc.line(left, totalTop, right, totalTop);
    doc.line(left, totalBottom, right, totalBottom);

    // Total row vertical lines
    doc.line(cols[5].x1, totalTop, cols[5].x1, totalBottom);
    doc.line(cols[5].x2, totalTop, cols[5].x2, totalBottom);
    doc.line(cols[8].x1, totalTop, cols[8].x1, totalBottom);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text('Total', (cols[0].x1 + cols[4].x2) / 2, totalTop + 5.8, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`${data.totals.totalQty} pcs`, (cols[5].x1 + cols[5].x2) / 2, totalTop + 5.5, { align: 'center' });

    doc.setFontSize(10.5);
    const grandStr = data.totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    doc.text(grandStr, cols[8].x2 - 3, totalTop + 5.5, { align: 'right' });

    // -------------------------------------------------------------
    // SECTION 4: AMOUNT CHARGEABLE IN WORDS (Y: 190 -> 206)
    // -------------------------------------------------------------
    const wordsY = 190;
    const wordsBottom = 206;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.text('Amount Chargeable (in words)', left + 3, wordsY + 4.5);
    doc.text('E. & O.E', right - 3, wordsY + 4.5, { align: 'right' });

    doc.line(left, wordsY + 6.5, right, wordsY + 6.5);
    doc.setFontSize(9.8);
    doc.text(data.totals.amountInWords, left + 3, wordsY + 12.5);

    doc.line(left, wordsBottom, right, wordsBottom);

    // -------------------------------------------------------------
    // SECTION 5: BOTTOM (NOTE, DECLARATION, BANK & SIGNATURE)
    // -------------------------------------------------------------
    const bMidX = 108;
    doc.line(bMidX, wordsBottom, bMidX, bottom);

    // Left Part: Note & Declaration
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Note : - ', left + 3, wordsBottom + 19);
    doc.setFont('helvetica', 'normal');
    doc.text(data.orderNote?.replace(/^Note\s*:\s*-\s*/i, '') || '50% Advance and 50% Before Dispatch', left + 18, wordsBottom + 19);

    const decLine = 248;
    doc.line(left, decLine, bMidX, decLine);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Declaration', left + 3, decLine + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    const decMsg = 'We declare that this order shows the actual price of the goods described and that all particulars are true and correct.';
    doc.text(doc.splitTextToSize(decMsg, bMidX - left - 6), left + 3, decLine + 10);

    // Right Part: Bank Details Box (with subtle double border at top)
    doc.line(bMidX, wordsBottom + 1.6, right, wordsBottom + 1.6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Bank Details (for Payment)', bMidX + 3, wordsBottom + 6.0);
    doc.line(bMidX, wordsBottom + 8.2, right, wordsBottom + 8.2);

    const bankList = [
      { label: 'Account Name', val: data.bank.accountName || 'Aman Enterprises' },
      { label: 'A/C No.', val: data.bank.accountNo || '236711100002209' },
      { label: 'IFSC Code', val: data.bank.ifscCode || 'UBIN0823678' },
      { label: 'Swift Code', val: data.bank.swiftCode || 'UBININBBNCC' },
      { label: 'Bank Name', val: data.bank.bankName || 'UNION BANK OF INDIA' },
      { label: 'Branch', val: data.bank.branch || 'RAJENDRA NAGAR, NEW DELHI-110060' }
    ];

    let curBy = wordsBottom + 13.0;
    bankList.forEach(b => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(b.label, bMidX + 3, curBy);
      doc.text(':', bMidX + 26, curBy);
      doc.setFont('helvetica', 'bold');
      doc.text(String(b.val), bMidX + 28, curBy);
      curBy += 4.5;
    });

    doc.line(bMidX, decLine, right, decLine);

    // Signature Area
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`For ${data.seller.firmName || "AMAN ENTERPRISES"}`, right - 3, decLine + 7.5, { align: 'right' });

    doc.line(right - 55, bottom - 11, right - 3, bottom - 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.text('Authorized Signatory', right - 29, bottom - 5.5, { align: 'center' });

    const safeParty = (data.buyer.partyName || "Party").replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `SaleOrder_${data.orderNo}_${safeParty}.pdf`;

    if (action === 'print') {
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } else {
      doc.save(fileName);
    }
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(o => 
      o.orderNo?.toLowerCase().includes(term) ||
      o.buyer?.partyName?.toLowerCase().includes(term) ||
      o.date?.includes(term)
    );
  }, [orders, searchTerm]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900/50 border border-blue-500/30 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Sale Order Generator
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                Tally Format Match
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Generates 100% authentic GST Sale Order PDF matching the standard commercial format
            </p>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={loadReferenceSample}
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
            title="Load sample matching Reworks 9 april.pdf"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Load Sample (Reworks)
          </button>
          <button
            onClick={resetForm}
            className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5"
            title="Reset to New Order"
          >
            <RotateCcw className="w-4 h-4" />
            New
          </button>
          <button
            onClick={() => generateAuthenticPDF(null, 'print')}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={() => generateAuthenticPDF(null, 'download')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-blue-600/30"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        
        {/* Core Voucher Metadata Strip */}
        <div className="p-5 bg-slate-50 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-blue-500" /> Voucher No.
              </label>
              <input
                type="text"
                value={orderNo}
                onChange={e => {
                  setOrderNo(e.target.value);
                  setDeliveryNote(e.target.value);
                  setBuyersOrderNo(e.target.value);
                }}
                placeholder="231"
                className="w-full px-3 py-2 text-sm font-black rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" /> Dated
              </label>
              <input
                type="text"
                value={date}
                onChange={e => setDate(e.target.value)}
                placeholder="09-April-26"
                className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Mode/Terms of Payment
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)}
                placeholder="50% Advance and 50% Before Dispatch"
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Dispatched Through
              </label>
              <input
                type="text"
                value={dispatchThrough}
                onChange={e => setDispatchThrough(e.target.value)}
                placeholder="SafeExpress / By Road"
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Toggle Advanced Voucher Fields */}
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={() => setShowAdvancedVoucher(prev => !prev)}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              {showAdvancedVoucher ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showAdvancedVoucher ? "Hide Additional Tally Fields" : "Show More Tally Fields (Delivery Note, Ref No, Destination, Terms)"}
            </button>
            <span className="text-[10px] text-slate-400">All fields appear exactly in the Tally PDF grid</span>
          </div>

          {showAdvancedVoucher && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Delivery Note</label>
                <input
                  type="text"
                  value={deliveryNote}
                  onChange={e => setDeliveryNote(e.target.value)}
                  placeholder="231"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Reference No. &amp; Date</label>
                <input
                  type="text"
                  value={refNo}
                  onChange={e => setRefNo(e.target.value)}
                  placeholder="17-Mar-26"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Buyer's Order No. &amp; Date</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={buyersOrderNo}
                    onChange={e => setBuyersOrderNo(e.target.value)}
                    placeholder="231"
                    className="w-1/2 px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  />
                  <input
                    type="text"
                    value={refDate}
                    onChange={e => setRefDate(e.target.value)}
                    placeholder="17-Mar-26"
                    className="w-1/2 px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Destination</label>
                <input
                  type="text"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  placeholder="New Delhi"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 1: SELLER / MAIN COMPANY (BILLER) */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Building2 className="w-4 h-4" /> Main Company / Biller Details (Jo Bill Katega)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                Seller
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 font-medium">My Companies:</span>
              {savedCompanies.map(c => {
                const isActive = sellerInfo.firmName?.trim().toLowerCase() === c.firmName?.trim().toLowerCase();
                return (
                  <div
                    key={c.id || c.firmName}
                    className={`inline-flex items-center rounded-lg border transition-all text-[11px] font-bold overflow-hidden shadow-sm ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectCompanyPreset(c)}
                      className="px-2.5 py-1 text-left cursor-pointer flex items-center gap-1"
                    >
                      <Building2 className="w-3 h-3" />
                      {c.firmName}
                    </button>
                    {savedCompanies.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCompany(c.id, c.firmName, e)}
                        className={`px-1.5 py-1 text-xs hover:bg-red-500 hover:text-white transition-colors cursor-pointer border-l ${
                          isActive ? 'border-blue-500 text-blue-200' : 'border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                        title={`Delete ${c.firmName}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
              
              <button
                type="button"
                onClick={handleAddNewCompany}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                title="Add a new company"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> + Add Company
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Main Company / Firm Name
                </label>
                <input
                  type="text"
                  value={sellerInfo.firmName}
                  onChange={e => {
                    const newName = e.target.value;
                    setSellerInfo({ ...sellerInfo, firmName: newName });
                    if (!bankDetails.accountName || bankDetails.accountName === sellerInfo.firmName) {
                      setBankDetails({ ...bankDetails, accountName: newName });
                    }
                  }}
                  placeholder="AMAN ENTERPRISES"
                  className="w-full px-3 py-2 rounded-xl text-sm font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Biller Address</label>
                <input
                  type="text"
                  value={sellerInfo.address}
                  onChange={e => setSellerInfo({ ...sellerInfo, address: e.target.value })}
                  placeholder="10831, GALI PHOOL WALI, Karol Bagh, Central Delhi, Delhi, 110005"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Mobile</label>
                  <input
                    type="text"
                    value={sellerInfo.mobile}
                    onChange={e => setSellerInfo({ ...sellerInfo, mobile: e.target.value })}
                    placeholder="98100 12345"
                    className="w-full px-2.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">State &amp; Code</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={sellerInfo.state}
                      onChange={e => setSellerInfo({ ...sellerInfo, state: e.target.value })}
                      placeholder="Delhi"
                      className="w-3/4 px-2 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                    />
                    <input
                      type="text"
                      value={sellerInfo.stateCode}
                      onChange={e => setSellerInfo({ ...sellerInfo, stateCode: e.target.value })}
                      placeholder="07"
                      className="w-1/4 px-1 py-2 rounded-xl text-xs text-center font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={sellerInfo.gstin}
                    onChange={e => setSellerInfo({ ...sellerInfo, gstin: e.target.value.toUpperCase() })}
                    placeholder="07BFMPM7025K1Z2"
                    className="w-full px-2.5 py-2 rounded-xl text-xs font-mono uppercase bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
              </div>

              {/* Action Bar for Company */}
              <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
                <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-xl">
                  ✍️ Bottom Box Signature: <strong>for {sellerInfo.firmName || "Company"}</strong>
                </div>
                <button
                  type="button"
                  onClick={handleSaveMainCompany}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Save this company to presets and set as default"
                >
                  <Save className="w-3.5 h-3.5" /> Save to My Companies
                </button>
              </div>
            </div>
          </div>
          {companySavedToast && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
              ✓ Company "{sellerInfo.firmName}" saved to your companies list and set as default!
            </div>
          )}
        </div>

        {/* SECTION 2: BUYER (BILL TO) & CONSIGNEE (SHIP TO) 2-COLUMN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
          
          {/* BUYER (BILL TO) CARD */}
          <div className="p-6 space-y-4 bg-white dark:bg-slate-900/60">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <User className="w-4 h-4" /> Buyer (Bill to) Details
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                Invoice Recipient
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Buyer (Bill to) Party Name
                </label>
                <input
                  type="text"
                  value={buyerInfo.partyName}
                  onChange={e => {
                    const updated = { ...buyerInfo, partyName: e.target.value };
                    setBuyerInfo(updated);
                    if (sameAsBuyer) setConsigneeInfo(prev => ({ ...prev, partyName: e.target.value }));
                  }}
                  placeholder="Reworks / Party Name"
                  className="w-full px-3 py-2 rounded-xl text-sm font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Billing Address</label>
                <input
                  type="text"
                  value={buyerInfo.address}
                  onChange={e => {
                    const updated = { ...buyerInfo, address: e.target.value };
                    setBuyerInfo(updated);
                    if (sameAsBuyer) setConsigneeInfo(prev => ({ ...prev, address: e.target.value }));
                  }}
                  placeholder="40/3 ITI Colony Sandwa, Naini Industrial Area, Allahabad, Uttar Pradesh, 211010"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Mobile</label>
                  <input
                    type="text"
                    value={buyerInfo.mobile}
                    onChange={e => {
                      const updated = { ...buyerInfo, mobile: e.target.value };
                      setBuyerInfo(updated);
                      if (sameAsBuyer) setConsigneeInfo(prev => ({ ...prev, mobile: e.target.value }));
                    }}
                    placeholder="63790 91946"
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">State &amp; Code</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={buyerInfo.state}
                      onChange={e => {
                        const updated = { ...buyerInfo, state: e.target.value };
                        setBuyerInfo(updated);
                        if (sameAsBuyer) setConsigneeInfo(prev => ({ ...prev, state: e.target.value }));
                      }}
                      placeholder="Uttar Pradesh"
                      className="w-3/4 px-2 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                    />
                    <input
                      type="text"
                      value={buyerInfo.stateCode}
                      onChange={e => {
                        const updated = { ...buyerInfo, stateCode: e.target.value };
                        setBuyerInfo(updated);
                        if (sameAsBuyer) setConsigneeInfo(prev => ({ ...prev, stateCode: e.target.value }));
                      }}
                      placeholder="09"
                      className="w-1/4 px-1 py-1.5 rounded-lg text-xs text-center font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={buyerInfo.gstin}
                    onChange={e => {
                      const updated = { ...buyerInfo, gstin: e.target.value.toUpperCase() };
                      setBuyerInfo(updated);
                      if (sameAsBuyer) setConsigneeInfo(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }));
                    }}
                    placeholder="09DEKPS4410D1ZI"
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono uppercase bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CONSIGNEE (SHIP TO) CARD */}
          <div className="p-6 space-y-4 bg-slate-50/30 dark:bg-slate-900/40">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-500" /> Consignee (Ship to) Details
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyBuyerToConsignee}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                  title="Copy all Buyer (Bill to) fields into Consignee (Ship to)"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy from Buyer
                </button>
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  <input
                    type="checkbox"
                    checked={sameAsBuyer}
                    onChange={e => {
                      setSameAsBuyer(e.target.checked);
                      if (e.target.checked) setConsigneeInfo({ ...buyerInfo });
                    }}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  Same as Buyer
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Consignee (Ship to) Party Name
                </label>
                <input
                  type="text"
                  value={consigneeInfo.partyName}
                  onChange={e => {
                    setConsigneeInfo({ ...consigneeInfo, partyName: e.target.value });
                    if (sameAsBuyer) setSameAsBuyer(false);
                  }}
                  placeholder="Consignee / Delivery Party Name"
                  className="w-full px-3 py-2 rounded-xl text-sm font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Shipping / Delivery Address
                </label>
                <input
                  type="text"
                  value={consigneeInfo.address}
                  onChange={e => {
                    setConsigneeInfo({ ...consigneeInfo, address: e.target.value });
                    if (sameAsBuyer) setSameAsBuyer(false);
                  }}
                  placeholder="Consignee Delivery Address"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Mobile</label>
                  <input
                    type="text"
                    value={consigneeInfo.mobile}
                    onChange={e => {
                      setConsigneeInfo({ ...consigneeInfo, mobile: e.target.value });
                      if (sameAsBuyer) setSameAsBuyer(false);
                    }}
                    placeholder="98765 43210"
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">State &amp; Code</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={consigneeInfo.state}
                      onChange={e => {
                        setConsigneeInfo({ ...consigneeInfo, state: e.target.value });
                        if (sameAsBuyer) setSameAsBuyer(false);
                      }}
                      placeholder="State"
                      className="w-3/4 px-2 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                    />
                    <input
                      type="text"
                      value={consigneeInfo.stateCode}
                      onChange={e => {
                        setConsigneeInfo({ ...consigneeInfo, stateCode: e.target.value });
                        if (sameAsBuyer) setSameAsBuyer(false);
                      }}
                      placeholder="09"
                      className="w-1/4 px-1 py-1.5 rounded-lg text-xs text-center font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={consigneeInfo.gstin}
                    onChange={e => {
                      setConsigneeInfo({ ...consigneeInfo, gstin: e.target.value.toUpperCase() });
                      if (sameAsBuyer) setSameAsBuyer(false);
                    }}
                    placeholder="GSTIN/UIN"
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono uppercase bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ITEMS TABLE SECTION */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-blue-500" />
              Goods &amp; Services Items Table (Tally Grid Format)
            </h3>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              Total: {items.length} row(s)
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                  <th className="py-3 px-3 w-10 text-center">Sl</th>
                  <th className="py-3 px-3 min-w-[220px]">Description of Goods</th>
                  <th className="py-3 px-3 w-28 text-center">HSN/SAC</th>
                  <th className="py-3 px-3 w-24 text-center">Due on</th>
                  <th className="py-3 px-3 w-24 text-right">Quantity</th>
                  <th className="py-3 px-3 w-20 text-center">per (Unit)</th>
                  <th className="py-3 px-3 w-24 text-right">Rate</th>
                  <th className="py-3 px-3 w-28 text-right">Amount</th>
                  <th className="py-3 px-3 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{index + 1}</td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={item.name}
                        onChange={e => handleItemChange(item.id, 'name', e.target.value)}
                        placeholder="e.g. Acrylic Keychain"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={item.hsn}
                        onChange={e => handleItemChange(item.id, 'hsn', e.target.value)}
                        placeholder="42050090"
                        className="w-full text-center px-2 py-1.5 rounded-lg bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 font-mono text-slate-800 dark:text-slate-200 outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={item.dueOn || ""}
                        onChange={e => handleItemChange(item.id, 'dueOn', e.target.value)}
                        placeholder="17-Mar-26"
                        className="w-full text-center px-2 py-1.5 rounded-lg bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.qty}
                        onChange={e => handleItemChange(item.id, 'qty', e.target.value)}
                        className="w-full text-right px-2 py-1.5 rounded-lg bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 font-bold text-slate-900 dark:text-slate-100 outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={item.unit}
                        onChange={e => handleItemChange(item.id, 'unit', e.target.value)}
                        className="w-full text-center px-1.5 py-1.5 rounded-lg bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium outline-none"
                      >
                        {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onChange={e => handleItemChange(item.id, 'rate', e.target.value)}
                        className="w-full text-right px-2 py-1.5 rounded-lg bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 font-bold text-slate-900 dark:text-slate-100 outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                      {(Number(item.qty || 0) * Number(item.rate || 0)).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={items.length === 1}
                        title="Remove row"
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={addItem}
              className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-4 h-4" /> Add Item Row
            </button>

            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              Total Quantity: <strong className="text-slate-900 dark:text-white">{totals.totalQty} pcs</strong>
            </div>
          </div>
        </div>

        {/* BANK DETAILS & TAX SUMMARY */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/50 dark:bg-slate-900/40">
          
          {/* LEFT 6 COLS: Bank Details & Notes */}
          <div className="lg:col-span-6 space-y-4">
            
            {/* Bank Details Box */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Landmark className="w-4 h-4" /> Company's Bank Details
                </span>
                <span className="text-[10px] text-slate-400">Printed on Tally Invoice</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">A/c Holder's Name</label>
                  <input
                    type="text"
                    value={bankDetails.accountName}
                    onChange={e => setBankDetails({ ...bankDetails, accountName: e.target.value })}
                    placeholder="Aman Enterprises"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">A/c No.</label>
                  <input
                    type="text"
                    value={bankDetails.accountNo}
                    onChange={e => setBankDetails({ ...bankDetails, accountNo: e.target.value })}
                    placeholder="236711100002209"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-200 font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Bank Name</label>
                  <input
                    type="text"
                    value={bankDetails.bankName}
                    onChange={e => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                    placeholder="UNION BANK OF INDIA"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Branch</label>
                  <input
                    type="text"
                    value={bankDetails.branch}
                    onChange={e => setBankDetails({ ...bankDetails, branch: e.target.value })}
                    placeholder="BRANCH RAJENDRA NAGAR, NEW DELHI-110060"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">IFS Code</label>
                  <input
                    type="text"
                    value={bankDetails.ifscCode}
                    onChange={e => setBankDetails({ ...bankDetails, ifscCode: e.target.value.toUpperCase() })}
                    placeholder="UBIN0823678"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-200 font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Swift Code</label>
                  <input
                    type="text"
                    value={bankDetails.swiftCode}
                    onChange={e => setBankDetails({ ...bankDetails, swiftCode: e.target.value.toUpperCase() })}
                    placeholder="UBININBBNCC"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Note & Terms */}
            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Note (Printed immediately below Amount in Words)
                </label>
                <input
                  type="text"
                  value={orderNote}
                  onChange={e => setOrderNote(e.target.value)}
                  placeholder="Note : - 50% Advance and 50% Before Dispatch"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none font-semibold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Terms of Delivery
                </label>
                <input
                  type="text"
                  value={termsOfDelivery}
                  onChange={e => setTermsOfDelivery(e.target.value)}
                  placeholder="Goods once sold will not be taken back."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>
            </div>
          </div>

          {/* RIGHT 6 COLS: Tax Setup & Totals */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-blue-500" /> GST Tax &amp; Totals
                </span>
                
                {/* Tax Mode Switch */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px]">
                  <button
                    onClick={() => setTaxType('igst')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      taxType === 'igst' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    IGST (Inter-State)
                  </button>
                  <button
                    onClick={() => setTaxType('cgst_sgst')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      taxType === 'cgst_sgst' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    CGST+SGST (Intra)
                  </button>
                </div>
              </div>

              {/* Tax Rate input */}
              <div className="text-xs">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  GST Rate (%)
                </label>
                <select
                  value={taxRate}
                  onChange={e => setTaxRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 outline-none"
                >
                  <option value={18}>18% GST (Reworks Default)</option>
                  <option value={12}>12% GST</option>
                  <option value={5}>5% GST</option>
                  <option value={28}>28% GST</option>
                  <option value={0}>0% (Exempt)</option>
                </select>
              </div>

              {/* Line item summary */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs">
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>Sub Total (Amount before tax)</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">{formatCurrency(totals.subTotal)}</span>
                </div>

                {taxType === 'cgst_sgst' ? (
                  <>
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span>Output CGST @ {(taxRate / 2).toFixed(1)}%</span>
                      <span className="font-bold text-slate-900 dark:text-slate-200">{formatCurrency(totals.cgstAmt)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span>Output SGST @ {(taxRate / 2).toFixed(1)}%</span>
                      <span className="font-bold text-slate-900 dark:text-slate-200">{formatCurrency(totals.sgstAmt)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>Output IGST @ {taxRate}%</span>
                    <span className="font-bold text-slate-900 dark:text-slate-200">{formatCurrency(totals.igstAmt)}</span>
                  </div>
                )}
              </div>

              {/* GRAND TOTAL BOX */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-transparent border border-blue-500/30">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Total</span>
                  <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(totals.grandTotal)}</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic leading-tight">
                  {totals.amountInWords}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex flex-wrap gap-2.5 pt-2">
                <button
                  onClick={handleSaveOrder}
                  className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
                >
                  <Save className="w-4 h-4" /> Save Sale Order
                </button>
                <button
                  onClick={() => generateAuthenticPDF(null, 'download')}
                  className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
                >
                  <Download className="w-4 h-4" /> Download PDF Now
                </button>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* SAVED SALE ORDERS ARCHIVE */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Saved Sale Orders Archive
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {orders.length} orders saved locally
              </p>
            </div>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by Party or Voucher No..."
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
            />
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <ClipboardList className="w-10 h-10 mx-auto opacity-40 text-blue-500" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No sale orders recorded yet</p>
            <p className="text-xs text-slate-400">Fill in the form above and click &quot;Save Sale Order&quot; or &quot;Download PDF&quot;.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Voucher No.</th>
                  <th className="py-3 px-4">Dated</th>
                  <th className="py-3 px-4">Buyer / Party</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-center w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {order.orderNo}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {order.date}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {order.buyer?.partyName || 'Direct Cash'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-xs">
                        {order.buyer?.address || 'No address'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {order.items?.length || 0} items ({order.totals?.totalQty || 0} pcs)
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                      {formatCurrency(order.totals?.grandTotal)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleLoadOrder(order)}
                          title="Open & Edit in form"
                          className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-600 dark:text-blue-400 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => generateAuthenticPDF(order, 'download')}
                          title="Download PDF"
                          className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-600 dark:text-emerald-400 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => generateAuthenticPDF(order, 'print')}
                          title="Print PDF"
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteOrder(order.id)}
                          title="Delete from archive"
                          className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
