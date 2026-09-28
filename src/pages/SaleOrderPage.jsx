import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { 
  FileText, Plus, Trash2, Download, Eye, 
  Printer, ClipboardList, Calculator, Receipt, User, 
  Building2, Percent, CheckSquare, Save, Sparkles,
  RotateCcw, Landmark, Truck, Calendar, Hash, FileCheck2,
  ChevronDown, ChevronUp
} from 'lucide-react';

// Format Indian Currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
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

// Default Seller / Company Info matching reference document
const defaultSeller = {
  firmName: "Reworks",
  address: "40/3 ITI Colony Sandwa, Naini Industrial Area, Allahabad, Uttar Pradesh, 211010",
  mobile: "63790 91946",
  gstin: "09DEKPS4410D1ZI",
  state: "Uttar Pradesh",
  stateCode: "09"
};

// Default Bank Details from Reference PDF
const defaultBankDetails = {
  accountName: "Aman Enterprises",
  accountNo: "236711100002209",
  bankName: "UNION BANK OF INDIA",
  branch: "BRANCH RAJENDRA NAGAR, NEW DELHI-110060",
  ifscCode: "UBIN0823678",
  swiftCode: "UBININBBNCC"
};

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
  const [dispatchThrough, setDispatchThrough] = useState("SafeExpress");
  const [destination, setDestination] = useState("New Delhi");
  const [termsOfDelivery, setTermsOfDelivery] = useState("Goods once sold will not be taken back.");
  const [orderNote, setOrderNote] = useState("Note : - 50% Advance and 50% Before Dispatch");
  
  // Parties
  const [sellerInfo, setSellerInfo] = useState(defaultSeller);
  const [buyerInfo, setBuyerInfo] = useState(defaultBuyer);
  const [bankDetails, setBankDetails] = useState(defaultBankDetails);

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
    setBuyerInfo(defaultBuyer);
    setItems([{ id: Date.now(), name: "", hsn: "", dueOn: "", qty: 1, unit: "pcs", rate: 0, amount: 0 }]);
  };

  // Load exact reference sample from Reworks 9 april.pdf
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
    setDispatchThrough("SafeExpress");
    setDestination("New Delhi");
    setTermsOfDelivery("Goods once sold will not be taken back.");
    setOrderNote("Note : - 50% Advance and 50% Before Dispatch");
    
    setSellerInfo({
      firmName: "Reworks",
      address: "40/3 ITI Colony Sandwa, Naini Industrial Area, Allahabad, Uttar Pradesh, 211010",
      mobile: "63790 91946",
      state: "Uttar Pradesh",
      stateCode: "09",
      gstin: "09DEKPS4410D1ZI"
    });
    
    setBuyerInfo({
      partyName: "Reworks",
      address: "40/3 ITI Colony Sandwa, Naini Industrial Area, Allahabad, Uttar Pradesh, 211010",
      mobile: "63790 91946",
      state: "Uttar Pradesh",
      stateCode: "09",
      gstin: "09DEKPS4410D1ZI"
    });

    setBankDetails(defaultBankDetails);

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
  // EXACT TALLY GST SALE ORDER PDF GENERATOR (MATCHING REFERENCE DOCUMENT)
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

    const pageWidth = 210;
    const left = 10;
    const right = 200;
    const width = right - left; // 190mm
    const top = 18;
    const bottom = 280;

    // Document Title: "Sale Order" at center top
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("Sale Order", pageWidth / 2, 14, { align: "center" });

    // Main Outer Box Border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(left, top, width, bottom - top);

    // -------------------------------------------------------------
    // SECTION 1: SELLER & VOUCHER DETAILS (Y: 18 -> 95)
    // -------------------------------------------------------------
    const midX = 105;
    doc.line(midX, top, midX, 95); // Vertical split between Seller/Buyer and Voucher details

    // LEFT COLUMN: Seller Details (Top part: 18 -> 55)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(data.seller.firmName, left + 3, top + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const sellerAddr = doc.splitTextToSize(data.seller.address, midX - left - 6);
    doc.text(sellerAddr, left + 3, top + 11);

    let curSellerY = top + 11 + (sellerAddr.length * 3.8);
    doc.text(`Mob. ${data.seller.mobile}`, left + 3, curSellerY + 3);
    doc.text(`STATE NAME : ${data.seller.state} , Code : ${data.seller.stateCode}`, left + 3, curSellerY + 7);
    doc.setFont("helvetica", "bold");
    doc.text(`GST NO. : ${data.seller.gstin}`, left + 3, curSellerY + 11);

    // Horizontal divider between Seller and Buyer at Y = 55
    doc.line(left, 55, midX, 55);

    // LEFT COLUMN: Buyer / Consignee Details (Bottom part: 55 -> 95)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("Buyer (Bill to)", left + 3, 59);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(data.buyer.partyName || "CASH SALE", left + 3, 64);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const buyerAddr = doc.splitTextToSize(data.buyer.address || "Local", midX - left - 6);
    doc.text(buyerAddr, left + 3, 69);

    let curBuyerY = 69 + (buyerAddr.length * 3.8);
    if (data.buyer.mobile) {
      doc.text(`Mob. ${data.buyer.mobile}`, left + 3, curBuyerY + 2.5);
      curBuyerY += 3.5;
    }
    doc.text(`STATE NAME : ${data.buyer.state || data.seller.state} , Code : ${data.buyer.stateCode || data.seller.stateCode}`, left + 3, curBuyerY + 2.5);
    doc.setFont("helvetica", "bold");
    doc.text(`GST NO. : ${data.buyer.gstin || "N/A"}`, left + 3, curBuyerY + 6.5);

    // RIGHT COLUMN: Voucher Details Grid (18 -> 95)
    const colSplit = 152.5; // Split between two right columns
    
    // Row 1: Y: 18 -> 27
    doc.line(colSplit, 18, colSplit, 72);
    doc.line(midX, 27, right, 27);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Voucher No.", midX + 2, 21.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(data.orderNo, midX + 2, 25.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Dated", colSplit + 2, 21.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(data.date, colSplit + 2, 25.5);

    // Row 2: Y: 27 -> 36
    doc.line(midX, 36, right, 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Delivery Note", midX + 2, 30.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(data.deliveryNote || data.orderNo, midX + 2, 34.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Mode/Terms of Payment", colSplit + 2, 30.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const payTerms = doc.splitTextToSize(data.paymentTerms, right - colSplit - 4);
    doc.text(payTerms, colSplit + 2, 34);

    // Row 3: Y: 36 -> 45
    doc.line(midX, 45, right, 45);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Reference No. & Date.", midX + 2, 39.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(data.refNo || "-", midX + 2, 43.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Other Reference(s)", colSplit + 2, 39.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(data.otherRef || "-", colSplit + 2, 43.5);

    // Row 4: Y: 45 -> 54
    doc.line(midX, 54, right, 54);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Buyer's Order No.", midX + 2, 48.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(data.buyersOrderNo || data.orderNo, midX + 2, 52.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Dated", colSplit + 2, 48.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(data.refDate || data.date, colSplit + 2, 52.5);

    // Row 5: Y: 54 -> 63
    doc.line(midX, 63, right, 63);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Dispatch Doc No.", midX + 2, 57.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(data.dispatchDocNo || "-", midX + 2, 61.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Delivery Note Date", colSplit + 2, 57.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(data.deliveryDate || "-", colSplit + 2, 61.5);

    // Row 6: Y: 63 -> 72
    doc.line(midX, 72, right, 72);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Dispatched through", midX + 2, 66.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(data.dispatchThrough || "SafeExpress", midX + 2, 70.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Destination", colSplit + 2, 66.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(data.destination || "Domestic", colSplit + 2, 70.5);

    // Row 7: Y: 72 -> 95 (Terms of Delivery)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Terms of Delivery", midX + 2, 76);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const termsDelivery = doc.splitTextToSize(data.termsOfDelivery || "As per agreement.", right - midX - 4);
    doc.text(termsDelivery, midX + 2, 80);

    // Horizontal line separating Header from Table
    doc.line(left, 95, right, 95);

    // -------------------------------------------------------------
    // SECTION 2: ITEMS TABLE (Y: 95 -> 200)
    // -------------------------------------------------------------
    const tableHeaderTop = 95;
    const tableHeaderBottom = 103;
    const tableBodyBottom = 192; // Table rows end here
    const tableTotalBottom = 200; // Total row ends here

    doc.line(left, tableHeaderBottom, right, tableHeaderBottom);

    const cols = [
      { name: "Sl\nNo.", x1: 10, x2: 20 },
      { name: "Description of Goods", x1: 20, x2: 92 },
      { name: "HSN/SAC", x1: 92, x2: 110 },
      { name: "Due on", x1: 110, x2: 128 },
      { name: "Quantity", x1: 128, x2: 148 },
      { name: "Rate", x1: 148, x2: 166 },
      { name: "per", x1: 166, x2: 176 },
      { name: "Amount", x1: 176, x2: 200 }
    ];

    // Header Labels
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    cols.forEach(c => {
      const midCol = (c.x1 + c.x2) / 2;
      if (c.name.includes("\n")) {
        const parts = c.name.split("\n");
        doc.text(parts[0], midCol, tableHeaderTop + 3.2, { align: "center" });
        doc.text(parts[1], midCol, tableHeaderTop + 6.8, { align: "center" });
      } else {
        doc.text(c.name, midCol, tableHeaderTop + 5.5, { align: "center" });
      }
    });

    // FULL-HEIGHT VERTICAL COLUMN LINES DOWN TO TOTAL ROW
    cols.slice(1).forEach(c => {
      doc.line(c.x1, tableHeaderTop, c.x1, tableTotalBottom);
    });

    // Table Body Items
    let itemY = tableHeaderBottom + 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    data.items.forEach((item, idx) => {
      doc.text((idx + 1).toString(), (cols[0].x1 + cols[0].x2) / 2, itemY, { align: "center" });
      
      doc.setFont("helvetica", "bold");
      doc.text(item.name, cols[1].x1 + 2, itemY);
      
      doc.setFont("helvetica", "normal");
      doc.text(item.hsn || "-", (cols[2].x1 + cols[2].x2) / 2, itemY, { align: "center" });
      doc.text(item.dueOn || data.refDate || "-", (cols[3].x1 + cols[3].x2) / 2, itemY, { align: "center" });
      
      doc.setFont("helvetica", "bold");
      doc.text(`${item.qty} ${item.unit}`, cols[4].x2 - 2, itemY, { align: "right" });
      
      doc.setFont("helvetica", "normal");
      doc.text(Number(item.rate).toFixed(2), cols[5].x2 - 2, itemY, { align: "right" });
      doc.text(item.unit || "pcs", (cols[6].x1 + cols[6].x2) / 2, itemY, { align: "center" });
      
      doc.setFont("helvetica", "bold");
      doc.text(Number(item.qty * item.rate).toFixed(2), cols[7].x2 - 2, itemY, { align: "right" });
      
      itemY += 8;
    });

    // Tax Line inside Table Body (Tally style)
    const taxY = Math.max(itemY + 14, 150);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    if (data.taxType === 'cgst_sgst') {
      const half = (data.taxRate / 2).toFixed(1);
      doc.text(`Output CGST @ ${half}%`, cols[1].x1 + 2, taxY);
      doc.text(data.totals.cgstAmt.toFixed(2), cols[7].x2 - 2, taxY, { align: "right" });

      doc.text(`Output SGST @ ${half}%`, cols[1].x1 + 2, taxY + 6);
      doc.text(data.totals.sgstAmt.toFixed(2), cols[7].x2 - 2, taxY + 6, { align: "right" });
    } else {
      doc.text(`Output IGST`, cols[1].x1 + 2, taxY);
      doc.setFont("helvetica", "bold");
      doc.text(data.totals.igstAmt.toFixed(2), cols[7].x2 - 2, taxY, { align: "right" });
    }

    // TOTAL ROW (Y: 192 -> 200)
    doc.line(left, tableBodyBottom, right, tableBodyBottom);
    doc.line(left, tableTotalBottom, right, tableTotalBottom);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Total", cols[1].x2 - 3, tableBodyBottom + 5.5, { align: "right" });
    doc.text(`${data.totals.totalQty} pcs`, cols[4].x2 - 2, tableBodyBottom + 5.5, { align: "right" });
    doc.text(`INR ${data.totals.grandTotal.toFixed(2)}`, cols[7].x2 - 2, tableBodyBottom + 5.5, { align: "right" });

    // -------------------------------------------------------------
    // SECTION 3: AMOUNT IN WORDS & NOTE (Y: 200 -> 218)
    // -------------------------------------------------------------
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("Amount Chargeable (in words)", left + 2, 204.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(data.totals.amountInWords, left + 2, 209);

    doc.line(left, 212, right, 212);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(data.orderNote || "Note : - 50% Advance and 50% Before Dispatch", left + 2, 216.5);

    doc.line(left, 220, right, 220);

    // -------------------------------------------------------------
    // SECTION 4: BANK DETAILS, TERMS & SIGNATURE (Y: 220 -> 280)
    // -------------------------------------------------------------
    const bankSplitX = 110;
    doc.line(bankSplitX, 220, bankSplitX, bottom);

    // Left Box: Bank Details (Top: 220 -> 254)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Company's Bank Details", left + 2, 224.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`A/c Holder's Name : ${data.bank.accountName}`, left + 2, 229);
    doc.text(`Bank Name          : ${data.bank.bankName}`, left + 2, 233);
    doc.text(`A/c No.            : ${data.bank.accountNo}`, left + 2, 237);
    doc.text(`Branch & IFS Code  : ${data.bank.branch} & ${data.bank.ifscCode}`, left + 2, 241);
    doc.text(`Swift Code         : ${data.bank.swiftCode}`, left + 2, 245);

    // Divider in Bank box at Y = 249
    doc.line(left, 249, bankSplitX, 249);

    // Declaration (Bottom: 249 -> 280)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("Declaration", left + 2, 253.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    const declText = "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.";
    const splitDecl = doc.splitTextToSize(declText, bankSplitX - left - 4);
    doc.text(splitDecl, left + 2, 258);

    // Right Box: Signature (Y: 220 -> 280)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`for ${data.seller.firmName}`, right - 3, 225.5, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Authorised Signatory", right - 3, bottom - 3, { align: "right" });

    // -------------------------------------------------------------
    // BOTTOM FOOTER
    // -------------------------------------------------------------
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text("This is a Computer Generated Document", pageWidth / 2, 285, { align: "center" });

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

        {/* Seller & Buyer Details (Two Column Layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          
          {/* SELLER (CONSIGNOR) */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Building2 className="w-4 h-4" /> Company / Seller Details
              </span>
              <span className="text-[10px] text-slate-400">Top-Left Box on PDF</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Company / Firm Name</label>
                <input
                  type="text"
                  value={sellerInfo.firmName}
                  onChange={e => setSellerInfo({ ...sellerInfo, firmName: e.target.value })}
                  placeholder="Reworks"
                  className="w-full px-3 py-2 rounded-xl text-sm font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Address</label>
                <input
                  type="text"
                  value={sellerInfo.address}
                  onChange={e => setSellerInfo({ ...sellerInfo, address: e.target.value })}
                  placeholder="40/3 ITI Colony Sandwa, Naini Industrial Area, Allahabad, Uttar Pradesh, 211010"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Mobile</label>
                  <input
                    type="text"
                    value={sellerInfo.mobile}
                    onChange={e => setSellerInfo({ ...sellerInfo, mobile: e.target.value })}
                    placeholder="63790 91946"
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">State &amp; Code</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={sellerInfo.state}
                      onChange={e => setSellerInfo({ ...sellerInfo, state: e.target.value })}
                      placeholder="Uttar Pradesh"
                      className="w-3/4 px-2 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                    />
                    <input
                      type="text"
                      value={sellerInfo.stateCode}
                      onChange={e => setSellerInfo({ ...sellerInfo, stateCode: e.target.value })}
                      placeholder="09"
                      className="w-1/4 px-1 py-1.5 rounded-lg text-xs text-center font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={sellerInfo.gstin}
                    onChange={e => setSellerInfo({ ...sellerInfo, gstin: e.target.value.toUpperCase() })}
                    placeholder="09DEKPS4410D1ZI"
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono uppercase bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BUYER (CONSIGNEE) */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <User className="w-4 h-4" /> Buyer (Bill to / Consignee)
              </span>
              <span className="text-[10px] text-slate-400">Mid-Left Box on PDF</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Buyer / Party Name</label>
                <input
                  type="text"
                  value={buyerInfo.partyName}
                  onChange={e => setBuyerInfo({ ...buyerInfo, partyName: e.target.value })}
                  placeholder="Reworks / Party Name"
                  className="w-full px-3 py-2 rounded-xl text-sm font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Address</label>
                <input
                  type="text"
                  value={buyerInfo.address}
                  onChange={e => setBuyerInfo({ ...buyerInfo, address: e.target.value })}
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
                    onChange={e => setBuyerInfo({ ...buyerInfo, mobile: e.target.value })}
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
                      onChange={e => setBuyerInfo({ ...buyerInfo, state: e.target.value })}
                      placeholder="Uttar Pradesh"
                      className="w-3/4 px-2 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                    />
                    <input
                      type="text"
                      value={buyerInfo.stateCode}
                      onChange={e => setBuyerInfo({ ...buyerInfo, stateCode: e.target.value })}
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
                    onChange={e => setBuyerInfo({ ...buyerInfo, gstin: e.target.value.toUpperCase() })}
                    placeholder="09DEKPS4410D1ZI"
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono uppercase bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
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
                  <th className="py-3 px-3 w-24 text-right">Rate (₹)</th>
                  <th className="py-3 px-3 w-28 text-right">Amount (₹)</th>
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
