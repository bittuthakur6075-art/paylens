# Google Apps Script Backend for PayLens

This document contains the complete Google Apps Script code to use your Google Sheet as a live database backend for PayLens.

---

### Step-by-Step Setup Guide

1. **Open Google Sheets**:
   - Create a new Google Sheet or open an existing one: [sheets.new](https://sheets.new)
   - Name it `Payment Tracker` or `PayLens Database`.

2. **Open Apps Script Editor**:
   - In the top menu, navigate to: **Extensions** > **Apps Script**.

3. **Paste the Code**:
   - Replace any existing code in the editor with the complete snippet below.

4. **Deploy as a Web App**:
   - Click the blue **Deploy** button at top right > **New deployment**.
   - Click the gear icon (Select type) > choose **Web app**.
   - Fill in:
     - **Description**: `PayLens Webhook v1`
     - **Execute as**: `Me (your email)`
     - **Who has access**: `Anyone` *(Crucial: This enables the browser app to write records to your sheet without OAuth login prompt)*
   - Click **Deploy**.

5. **Authorize Access**:
   - Click **Authorize Access** and select your Google account.
   - Click **Advanced** > **Go to Untitled project (unsafe)** > **Allow**.

6. **Copy Web App URL**:
   - Copy the generated **Web app URL** (starts with `https://script.google.com/macros/s/.../exec`).
   - Paste it into your `.env` file as `VITE_SHEETS_WEBHOOK_URL` or directly into the PayLens in-app **Connect Google Sheets** settings modal!

---

### Google Apps Script Code (`Code.gs`)

```javascript
/**
 * PayLens - Google Apps Script Webhook Backend
 * Automatically handles incoming payment records and writes them to the sheet.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Wait up to 30 seconds for other concurrent requests
  lock.tryLock(30000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    // Target the primary first sheet (Sheet1 / gid=0) directly
    var sheet = ss.getSheets()[0];

    // Automatically rename Sheet1 to Extracted Data if applicable
    if (sheet.getName() === "Sheet1") {
      try { sheet.setName("Extracted Data"); } catch(e) {}
    }

    // Automatically create headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      var headers = [
        "Timestamp",
        "Payment App",
        "Type (Sent/Received)",
        "From (Sender)",
        "To (Receiver)",
        "Amount",
        "Date & Time",
        "Transaction ID / UTR",
        "Screenshot Info"
      ];
      sheet.appendRow(headers);
      
      // Stylize header row
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#4338ca"); // Indigo header color
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }

    // Parse incoming JSON body
    var requestData = {};
    if (e && e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    }

    // Healthcheck / Ping action
    if (requestData.action === "ping" || requestData.test) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "PayLens Webhook connected successfully!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Format transaction ID with leading quote to preserve 12 digits from scientific notation
    var txnId = requestData.transactionId ? "'" + requestData.transactionId : "N/A";

    // Process Screenshot: Save image to Google Drive & Create Viewable Link
    var screenshotCell = "No Screenshot";
    var base64Data = requestData.screenshotBase64 || requestData.screenshotUrl;

    if (base64Data && base64Data.indexOf("data:image") !== -1) {
      try {
        var folderName = "PayLens Receipts";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

        var parts = base64Data.split(",");
        var contentType = parts[0].split(":")[1].split(";")[0];
        var decoded = Utilities.base64Decode(parts[1]);
        var fileName = (requestData.appName || "Payment") + "_" + (requestData.transactionId || Date.now()) + ".jpg";
        var blob = Utilities.newBlob(decoded, contentType, fileName);
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        var fileUrl = file.getUrl();
        screenshotCell = '=HYPERLINK("' + fileUrl + '", "🖼️ View Screenshot")';
      } catch (driveErr) {
        screenshotCell = "Attached in Dashboard";
      }
    } else if (requestData.screenshotUrl && requestData.screenshotUrl.indexOf("http") === 0) {
      screenshotCell = '=HYPERLINK("' + requestData.screenshotUrl + '", "🖼️ View Screenshot")';
    }

    // Append new structured payment record row
    sheet.appendRow([
      requestData.timestamp || new Date().toISOString(),
      requestData.appName || "N/A",
      requestData.type || "Sent",
      requestData.from || "N/A",
      requestData.to || "N/A",
      requestData.amount || "₹0.00",
      requestData.dateTime || "N/A",
      txnId,
      screenshotCell
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Row appended successfully"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

/**
 * Handle GET requests for testing in browser directly
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "PayLens Google Apps Script Webhook is active and waiting for POST data."
  })).setMimeType(ContentService.MimeType.JSON);
}
```

---

### Expected Payload Structure

```json
{
  "appName": "PhonePe",
  "type": "Sent",
  "from": "Rahul Sharma",
  "to": "Merchant Store",
  "amount": "₹250.00",
  "dateTime": "16 Aug 2026, 04:21 PM",
  "transactionId": "110452974474",
  "screenshotUrl": "base64_or_drive_link",
  "timestamp": "2026-09-27T11:00:00.000Z"
}
```
