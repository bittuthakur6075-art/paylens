import { parsePaymentText } from './src/services/ocrService.js';

const samplePhonePe = `
  Paid to
  Rahul Sharma
  Banking Name: RAHUL SHARMA
  ₹72.00
  Transfer Details
  Debited from State Bank of India - 1234
  UTR: 426189123849
  Transaction ID: T2409271945123456789012
  07:45 PM on 27 Sep 2026
  PhonePe
`;
console.log('PhonePe test:', JSON.stringify(parsePaymentText(samplePhonePe), null, 2));

const sampleGPay = `
  Ramesh Provision Stores
  ramesh@okhdfcbank
  ₹1,050.00
  Payment to Ramesh Provision Stores
  Completed
  Sep 27, 2026, 6:30 PM
  UPI transaction ID: 426891029384
  Google Pay
`;
console.log('GPay test:', JSON.stringify(parsePaymentText(sampleGPay), null, 2));

const sampleReceived = `
  Payment Received
  Received from
  Amit Verma
  Banking Name: AMIT VERMA
  ₹500.00
  Credited to HDFC Bank - 5678
  UPI Ref No: 426112233445
  27 Sep 2026 at 4:15 PM
  Paytm
`;
console.log('Received test:', JSON.stringify(parsePaymentText(sampleReceived), null, 2));
