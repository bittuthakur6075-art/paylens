# Google Apps Script Backend for PayLens (Multi-Device Cloud Database)

This document contains the complete Google Apps Script code to use your Google Sheet as a live, multi-device database for PayLens.

---

### Why is this needed? (Multi-Device Sync / Kahi Pe Bhi Data Dikhe)
Previously, data was stored only in the local browser's storage. When logging in from another laptop, mobile phone, or after logging out, the second system did not show any transactions because the data was not being fetched back from Google Sheets.

With this updated script:
1. **Universal Access**: Logging in with your ID and password from any laptop, PC, iPhone, or Android phone instantly loads all your saved transactions.
2. **Persistent Storage**: Logout hone pe data delete nahi hoga. Data is permanently saved in your Google Sheet and Google Drive.
3. **Cross-Device Login**: You can change your password on one device and use that same password on any other device.

---

### Step-by-Step Setup / Update Guide (1 Minute)

If you already have a Google Sheet and script deployed:
1. Open your Google Sheet.
2. In the top menu bar, click **Extensions** > **Apps Script**.
3. Select all existing code (Ctrl+A), delete it, and paste the **Complete Google Apps Script Code** below.
4. Save the file (Ctrl+S).
5. At the top right, click **Deploy** > **Manage deployments**.
6. Click the pencil icon (**Edit**) next to your active deployment.
7. Under **Version**, select **New version**.
8. Make sure **Who has access** is set to **Anyone**.
9. Click **Deploy**.
10. Done! Now open PayLens on any device and click **Sync** — all your data will be visible everywhere!

---

### Google Apps Script Code (`Code.gs`)

```javascript
/**
 * PayLens - Complete Multi-Device Google Apps Script Backend
 * Enables full read/write synchronization across all devices and phones.
 * Paste this into: Extensions > Apps Script in your Google Sheet
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getTransactions";

  // Healthcheck / Ping action
  if (action === "ping") {
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "PayLens Webhook connected with multi-device sync!"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Get or verify user credentials for cross-device authentication
  if (action === "getAuth") {
    var authSheet = ss.getSheetByName("_PayLens_Auth");
    if (!authSheet) {
      authSheet = ss.insertSheet("_PayLens_Auth");
      authSheet.appendRow(["Username", "PasswordHash", "FullName", "UpdatedAt"]);
      authSheet.appendRow([
        "pradeep",
        "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
        "PRADEEP KUMAR SHARMA",
        new Date().toISOString()
      ]);
    }
    var authData = authSheet.getDataRange().getValues();
    if (authData.length > 1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        user: {
          username: String(authData[1][0] || "pradeep"),
          passwordHash: String(authData[1][1] || ""),
          fullName: String(authData[1][2] || "PRADEEP KUMAR SHARMA")
        }
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Fetch all transactions from sheet
  var sheet = ss.getSheetByName("Extracted Data") || ss.getSheets()[0];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      transactions: []
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var numCols = Math.max(sheet.getLastColumn(), 9);
  var range = sheet.getRange(2, 1, lastRow - 1, numCols);
  var values = range.getValues();
  var formulas = range.getFormulas();

  var transactions = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowFormula = formulas[i];
    var timestamp = row[0] ? String(row[0]) : new Date().toISOString();
    var appName = row[1] ? String(row[1]) : "Unknown";
    var type = row[2] ? String(row[2]) : "Sent";
    var from = row[3] ? String(row[3]) : "";
    var to = row[4] ? String(row[4]) : "";
    var amount = row[5] ? String(row[5]) : "₹0";
    var dateTime = row[6] ? String(row[6]) : "";
    var rawTxn = row[7] ? String(row[7]) : "";
    var transactionId = rawTxn.replace(/^'/, "");

    // Screenshot extraction from formula or value
    var screenshotCell = row[8] ? String(row[8]) : "";
    var formulaCell = (rowFormula && rowFormula[8]) ? String(rowFormula[8]) : "";
    var screenshotUrl = null;
    var hyperlinkMatch = formulaCell.match(/=HYPERLINK\("([^"]+)"/i);
    if (hyperlinkMatch && hyperlinkMatch[1]) {
      screenshotUrl = hyperlinkMatch[1];
    } else if (screenshotCell.indexOf("http") === 0) {
      screenshotUrl = screenshotCell;
    }

    transactions.push({
      id: "tx-" + (transactionId && transactionId !== "N/A" ? transactionId : (i + "-" + Date.now())),
      timestamp: timestamp,
      appName: appName,
      type: type,
      from: from,
      to: to,
      amount: amount,
      dateTime: dateTime,
      transactionId: transactionId || "N/A",
      screenshotUrl: screenshotUrl,
      synced: true
    });
  }

  // Reverse so newest records appear on top
  transactions.reverse();

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    transactions: transactions
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Extracted Data") || ss.getSheets()[0];

    if (sheet.getName() === "Sheet1") {
      try { sheet.setName("Extracted Data"); } catch(err) {}
    }

    var requestData = {};
    if (e && e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    }

    // Ping check
    if (requestData.action === "ping" || requestData.test) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "PayLens Webhook connected successfully!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Sync user auth across devices
    if (requestData.action === "updateAuth") {
      var authSheet = ss.getSheetByName("_PayLens_Auth");
      if (!authSheet) {
        authSheet = ss.insertSheet("_PayLens_Auth");
      }
      authSheet.clear();
      authSheet.appendRow(["Username", "PasswordHash", "FullName", "UpdatedAt"]);
      authSheet.appendRow([
        requestData.username || "pradeep",
        requestData.passwordHash || "",
        requestData.fullName || "PRADEEP KUMAR SHARMA",
        new Date().toISOString()
      ]);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Auth credentials synced to Google Sheet successfully!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Delete transaction
    if (requestData.action === "deleteTransaction") {
      var targetTxnId = requestData.transactionId;
      var targetTimestamp = requestData.timestamp;
      var lastRow = sheet.getLastRow();
      var deleted = false;
      if (lastRow > 1) {
        var range = sheet.getRange(2, 1, lastRow - 1, 8);
        var values = range.getValues();
        for (var r = values.length - 1; r >= 0; r--) {
          var rowTxn = String(values[r][7] || "").replace(/^'/, "");
          var rowTime = String(values[r][0] || "");
          if ((targetTxnId && targetTxnId !== "N/A" && rowTxn === targetTxnId) ||
              (targetTimestamp && rowTime === targetTimestamp)) {
            sheet.deleteRow(r + 2);
            deleted = true;
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: deleted ? "success" : "not_found",
        message: deleted ? "Row deleted" : "Row not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Clear all transactions
    if (requestData.action === "clearAll") {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "All records cleared"
      })).setMimeType(ContentService.MimeType.JSON);
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
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#4338ca");
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    var txnId = requestData.transactionId ? "'" + requestData.transactionId : "N/A";
    var screenshotCell = "No Screenshot";
    var base64Data = requestData.screenshotBase64 || (requestData.screenshotUrl && requestData.screenshotUrl.indexOf("data:image") !== -1 ? requestData.screenshotUrl : null);

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
      message: "Row appended with screenshot link successfully"
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
```
