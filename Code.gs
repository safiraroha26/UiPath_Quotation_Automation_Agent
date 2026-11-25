function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const template = ss.getSheetByName("Quotation_Template");
    if (!template) {
      throw new Error("Tab 'Quotation_Template' tidak ditemukan di Spreadsheet!");
    }

    const logSheet = ss.getSheetByName("Quotation_Log");
    const refSheet = ss.getSheetByName("Product_Reference");

    const valOrDash = (val) => (val !== null && val !== undefined && String(val).trim() !== "") ? val : "-";

    // Normalisasi daftar produk
    let items = [];
    if (Array.isArray(data.Items) && data.Items.length > 0) {
      items = data.Items;
    } else {
      items = [{
        Product_Name: data.Product_Name,
        Quantity: data.Quantity,
        Unit: data.Unit,
        MSRP: data.MSRP,
        Diskon_Percent: data.Diskon_Percent !== undefined ? data.Diskon_Percent : data.Discount_Percent,
        Buying_Price: data.Buying_Price
      }];
    }

    // Cadangan lookup Unit dari Product_Reference Kolom G (index 6)
    const unitMap = {};
    if (refSheet) {
      const refValues = refSheet.getDataRange().getValues();
      for (let i = 1; i < refValues.length; i++) {
        const pName = String(refValues[i][0] || "").trim().toLowerCase();
        if (pName && refValues[i][6]) {
          unitMap[pName] = refValues[i][6];
        }
      }
    }

    // 1. Hitung Nomor Quotation (Hanya baca baris di atas baris Total)
    const year = new Date().getFullYear();
    const now = new Date();
    const dateStr = Utilities.formatDate(now, "Asia/Jakarta", "dd/MM/yyyy");

    const logData = logSheet ? logSheet.getDataRange().getValues() : [];
    const dataRows = [];
    for (let i = 1; i < logData.length; i++) {
      const rowText = logData[i].join(" ").toLowerCase();
      if (rowText.includes("total")) break;
      if (String(logData[i][0] || "").trim() !== "") {
        dataRows.push(logData[i]);
      }
    }

    const nums = dataRows
      .map(r => parseInt(String(r[0]).substring(0, 3), 10))
      .filter(n => !isNaN(n));
    const nextNum = String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');

    const firstProduct = String(items[0].Product_Name || "").trim();
    const existingMatches = dataRows.filter(r =>
      String(r[3] || "").trim().toLowerCase() === String(data.Organization || "").trim().toLowerCase() &&
      String(r[7] || "").trim().toLowerCase() === firstProduct.toLowerCase()
    );

    let quotationNo = `${nextNum}-SDNR-${year}`;
    let baseNumForTab = nextNum;

    if (existingMatches.length > 0) {
      const prevQuo = String(existingMatches[existingMatches.length - 1][0]);
      baseNumForTab = prevQuo.substring(0, 3);
      const revMatch = prevQuo.match(/R(\d+)/i);
      const nextRev = revMatch ? parseInt(revMatch[1], 10) + 1 : 1;
      quotationNo = `${baseNumForTab}R${nextRev}-SDNR-${year}`;
    }

    const orgClean = valOrDash(data.Organization).replace(/[\/\\:]/g, "-");
    const prodClean = valOrDash(firstProduct).replace(/[\/\\:]/g, "-");
    let sheetName = `${baseNumForTab}-${orgClean}-${prodClean}${existingMatches.length > 0 ? `-R${existingMatches.length}` : ""}`;
    if (ss.getSheetByName(sheetName)) {
      sheetName = `${sheetName}-${Date.now().toString().slice(-3)}`;
    }

    // 2. Duplikasi Quotation_Template & isi header/customer
    const newSheet = template.copyTo(ss).setName(sheetName);

    newSheet.getRange("H11").setValue(dateStr);
    newSheet.getRange("H12").setValue(quotationNo);
    if (newSheet.getRange("N7").getValue() === "Quotation No:") {
      newSheet.getRange("O7").setValue(quotationNo);
    }
    newSheet.getRange("H14").setValue(valOrDash(data.Project_Name));

    newSheet.getRange("D11").setValue(valOrDash(data.Organization));
    newSheet.getRange("D12").setValue(valOrDash(data.Contact_Person));
    newSheet.getRange("D13").setValue(valOrDash(data.Email_Customer));
    newSheet.getRange("D14").setValue(valOrDash(data.Address));
    newSheet.getRange("D15").setValue(valOrDash(data.Phone));

    // 3. Isi baris produk mulai baris 19 (Template sekarang punya 1 baris produk di baris 19)
    const startRow = 19;
    const templateItemRows = 1;

    if (items.length > templateItemRows) {
      const extraRows = items.length - templateItemRows;
      newSheet.insertRowsAfter(startRow, extraRows);
      const sourceRange = newSheet.getRange(startRow, 1, 1, newSheet.getLastColumn());
      for (let k = 0; k < extraRows; k++) {
        sourceRange.copyTo(newSheet.getRange(startRow + 1 + k, 1));
      }
    }

    items.forEach((item, idx) => {
      const r = startRow + idx;
      const qty = Number(item.Quantity) || 0;
      const msrp = Number(item.MSRP) || 0;
      const buyPrice = Number(item.Buying_Price) || 0;
      const rawDisc = item.Diskon_Percent !== undefined ? item.Diskon_Percent : item.Discount_Percent;
      const hasDiskon = rawDisc !== null && rawDisc !== undefined && String(rawDisc).trim() !== "" && Number(rawDisc) !== 0;
      const discPct = hasDiskon ? Number(rawDisc) : 0;

      newSheet.getRange(`B${r}`).setValue(idx + 1);
      newSheet.getRange(`C${r}`).setValue(valOrDash(item.Product_Name));
      newSheet.getRange(`M${r}`).setValue(qty || "-");
      newSheet.getRange(`N${r}`).setValue(msrp || "-");
      newSheet.getRange(`P${r}`).setValue(hasDiskon ? discPct : "");
      newSheet.getRange(`Q${r}`).setValue(buyPrice || "-");
    });

    SpreadsheetApp.flush();

    // 4. Catat ke Quotation_Log TEPAT DI ATAS baris Total & bersihkan baris di bawah Total
    if (logSheet) {
      const currentLogVals = logSheet.getDataRange().getValues();
      let totalRowIndex = -1;
      for (let i = 1; i < currentLogVals.length; i++) {
        const rowText = currentLogVals[i].join(" ").toLowerCase();
        if (rowText.includes("total")) {
          totalRowIndex = i + 1;
          break;
        }
      }

      if (totalRowIndex > 1 && logSheet.getLastRow() > totalRowIndex) {
        logSheet.deleteRows(totalRowIndex + 1, logSheet.getLastRow() - totalRowIndex);
      }

      items.forEach((item) => {
        const prodName = valOrDash(item.Product_Name);
        const qty = Number(item.Quantity) || 0;
        const unit = (item.Unit && String(item.Unit).trim() !== "")
          ? item.Unit
          : (unitMap[String(item.Product_Name || "").trim().toLowerCase()] || "Unit");
        const unitPricelist = Number(item.MSRP) || 0;
        const rawDisc = item.Diskon_Percent !== undefined ? item.Diskon_Percent : item.Discount_Percent;
        const discPercent = Number(rawDisc) || 0;

        const subtotalSelling = qty * unitPricelist * (1 - (discPercent / 100));
        const buyingPrice = Number(item.Buying_Price) || 0;
        const totalBuyingCost = qty * buyingPrice;
        const marginValue = subtotalSelling - totalBuyingCost;
        const marginPercent = subtotalSelling > 0 ? (marginValue / subtotalSelling) : 0;
        const ppn11 = subtotalSelling * 0.11;
        const grandTotal = subtotalSelling + ppn11;

        const logRow = [
          quotationNo,
          dateStr,
          valOrDash(data.Project_Name),
          valOrDash(data.Organization),
          valOrDash(data.Contact_Person),
          valOrDash(data.Email_Customer),
          valOrDash(data.Phone),
          prodName,
          qty,
          unit,
          unitPricelist,
          discPercent / 100,
          subtotalSelling,
          buyingPrice,
          totalBuyingCost,
          marginValue,
          marginPercent,
          ppn11,
          grandTotal
        ];

        if (totalRowIndex > 1) {
          logSheet.insertRowBefore(totalRowIndex);
          const targetRange = logSheet.getRange(totalRowIndex, 1, 1, logRow.length);
          if (totalRowIndex > 2) {
            logSheet.getRange(totalRowIndex - 1, 1, 1, logRow.length).copyFormatToRange(logSheet, 1, logRow.length, totalRowIndex, totalRowIndex);
          }
          targetRange.setValues([logRow]);
          totalRowIndex++;
        } else {
          logSheet.appendRow(logRow);
        }
      });
    }

    SpreadsheetApp.flush();

    // 5. Export Tab Baru (Kolom A - K sampai baris terakhir yang ada teks, A4 Portrait, tanpa gridlines) ke PDF di Folder Quotation_TDN
    const lastRowAll = newSheet.getLastRow();
    const akValues = newSheet.getRange(1, 1, lastRowAll, 11).getValues();
    let lastRowAK = 1;
    for (let r = akValues.length - 1; r >= 0; r--) {
      if (akValues[r].some(cell => String(cell).trim() !== "")) {
        lastRowAK = r + 1;
        break;
      }
    }

    const ssId = ss.getId();
    const gid = newSheet.getSheetId();
    const exportUrl = `https://docs.google.com/spreadsheets/d/${ssId}/export?` +
      `format=pdf&size=A4&portrait=true&fitw=true&gridlines=false&printtitle=false&sheetnames=false&fzr=false` +
      `&gid=${gid}&r1=0&c1=0&r2=${lastRowAK}&c2=11`;

    const response = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error("Gagal export PDF (HTTP " + response.getResponseCode() + "): " + response.getContentText().slice(0, 200));
    }

    const pdfBlob = response.getBlob().setName(`${sheetName}.pdf`);
    
    // Simpan langsung ke dalam Folder Quotation_TDN
    const folders = DriveApp.getFoldersByName("Folder Quotation_TDN");
    const targetFolder = folders.hasNext() ? folders.next() : DriveApp.getRootFolder();
    const pdfFile = targetFolder.createFile(pdfBlob);

    // Pengaman ganda: pastikan file PDF otomatis bisa dibuka publik lewat link tanpa minta akses
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return ContentService
      .createTextOutput(JSON.stringify({
        status: "success",
        sheetName: sheetName,
        quotationNo: quotationNo,
        pdfFileId: pdfFile.getId(),
        pdfFileName: pdfFile.getName(),
        savedInFolder: targetFolder.getName()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: err.message,
        stack: err.stack
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}