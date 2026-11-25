# 🤖 AI-Powered Sales Quotation Automation (UiPath Studio Web)

![UiPath Studio Web](https://img.shields.io/badge/UiPath-Studio%20Web-FA4616?style=for-the-badge&logo=uipath&logoColor=white)
![Agentic AI](https://img.shields.io/badge/AI-Agentic%20Orchestration-00A88F?style=for-the-badge)
![Google Apps Script](https://img.shields.io/badge/Google-Apps%20Script-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Release Status](https://img.shields.io/badge/Release-MVP%20(Single%20Product)-blue?style=for-the-badge)

An end-to-end **Agentic Orchestration** solution built on **UiPath Studio Web** that transforms unstructured natural-language sales quotation requests into official, ready-to-send PDF proposals, automated financial log entries, and pre-drafted client emails.

---

## 📌 MVP Scope & Constraints (*Minimum Viable Product*)

* **Single-Product Processing Only:** This **MVP** release is designed to process **one (1) primary product per execution/request**. If a user prompt mentions multiple items, the AI Agent extracts only the primary product to ensure deterministic accuracy during initial deployment.
* **Human-in-the-Loop (*Controlled Agency*):** Generated PDF quotations and Gmail drafts are prepared automatically so Sales Representatives can perform a final review before dispatching the official offer to clients.
* **Security & Credential Sanitization:** This repository **does not contain** any passwords, API keys, OAuth tokens, or live Google Apps Script Web App URLs.

---

## 🏗️ System Architecture & Workflow

```text
[User Prompt (Manual Trigger)]
       │
       ▼
1. [UiPath AI Agent] ──────► Extracts client details, project context, & matches
       │                      official product name against Product_Reference (1 product)
       ▼
2. [Google Sheets: Read] ───► Reads Quotation_Log history to compute the next sequence number
       │
       ▼
3. [HTTP Request (POST)] ───► Sends structured JSON payload to Google Apps Script Web App
       │
       ▼
4. [Google Apps Script] ────► • Duplicates Quotation_Template -> creates dedicated tab
       │                      • Generates auto-increment ID (002-SDNR-2026) or revision (R1, R2)
       │                      • Populates client & product cells; calculates margin & 11% VAT
       │                      • Inserts new row into Quotation_Log directly above the Total row
       ▼
5. [Google Drive & Gmail] ──► Exports new tab to PDF (Columns A–K only) & saves Gmail draft


<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/0508d64d-688f-48b9-ba5f-64ce22e81652" />

```

---

## 🛠️ Tech Stack & Tools

| Component | Technology | Primary Role |
| :--- | :--- | :--- |
| **Orchestration Engine** | UiPath Studio Web (*Maestro Automate Flow*) | Coordinates cloud-native execution across AI, Sheets, HTTP, and Gmail nodes. |
| **AI Extraction Engine** | UiPath AI Agent (`AI_Quo`) | Parses unstructured request text and performs semantic matching against the product catalog. |
| **Database & Template** | Google Sheets (`Quotation_Master_Data`) | Stores `Product_Reference`, `Quotation_Template` (with dynamic formulas), and `Quotation_Log`. |
| **Backend Document Engine** | Google Apps Script (`Code.gs`) | Handles sheet duplication, cell mapping, row cleanup, financial logging, and PDF export rules. |
| **Storage & Email Delivery** | Google Drive & Gmail (*Integration Service*) | Stores generated PDF quotations (`Folder Quotation_TDN`) and drafts client emails. |

---

## ⚙️ Prerequisites & Connections

Before running this project in **UiPath Automation Cloud**, ensure the following setup is completed:

1. **UiPath Automation Cloud Account:**
   * Active access to **UiPath Studio Web**, **Maestro Automate (`Flow`)**, and **Agent Builder**.
2. **UiPath Integration Service Connections:**
   * Authenticated **Google Sheets** & **Google Drive** connections.
   * Authenticated **Gmail** connection.
3. **Google Workspace Configuration:**
   * A Google Sheets file named `Quotation_Master_Data` containing three required tabs: `Quotation_Template`, `Product_Reference`, and `Quotation_Log`.
   * `Code.gs` pasted into **Extensions → Apps Script** inside `Quotation_Master_Data` and deployed as a **Web App** (*Execute as: Me*, *Who has access: Anyone*).

---

## 📂 Repository Structure

```text
Quotation_Automation_Source/
├── Quotation_Agent_Submission.uis         # Main UiPath Maestro Flow orchestration project
├── AI_Quo.uis                             # Standalone UiPath AI Agent package
├── Code.gs                                # Google Apps Script backend (doPost handler)
├── Sample_Data/
│   ├── Quotation_Master_Data_Sample.xlsx  # Sample spreadsheet structure
│   └── Contoh_Output_Quotation.pdf        # Sample generated PDF output (Columns A–K)
└── README.md                              # Project documentation
```

---

## 🚀 Setup & Execution Guide

> **Important:** Because the AI Agent and Maestro Flow are modular building blocks, you must import and deploy the **AI Agent** first so the Flow node resolves its dependency properly.

1. **Import & Deploy the AI Agent:**
   * Log in to [UiPath Automation Cloud](https://cloud.uipath.com/) → **Studio Web**.
   * Click **Import** and upload `AI_Quo.uis`.
   * Verify the `Product_Reference` grounding/schema, then click **Deploy**.
2. **Import the Maestro Flow:**
   * Return to the Studio Web home screen, click **Import**, and upload `Quotation_Agent_Submission.uis`.
   * Confirm that the **Agent** node points to your newly deployed AI Agent.
3. **Configure Connections & Web App Endpoint:**
   * Re-bind your **Google Sheets**, **Google Drive**, and **Gmail** connections in the corresponding workflow activities.
   * Open the **HTTP Request** node properties and replace `<MASUKKAN_WEB_APP_URL_APPS_SCRIPT_ANDA>` in the **Request URL** field with your deployed Google Apps Script Web App URL.
4. **Run the Robot:**
   * Click **Debug** or **Run** in the top toolbar of `Quotation_Agent_Submission`.
   * Enter a natural-language quotation request (for **1 product**) into the `UserPrompt` input field and execute.

---

## 🧪 Sample Input & Output

### 📥 Sample Input (`UserPrompt`)

```text
Please create a sales quotation for PT Maju Bersama (Attn: Mr. Andi, email: andi@majubersama.co.id, address: Jl. Sudirman No. 10 Jakarta, phone: 081234567890) for the Office Network Upgrade Project. They need 2 units of Router Ruijie RG-EG406XS with a 5% discount.
```

### 📤 Expected Output

1. **Structured JSON Output from AI Agent:**

   ```json
   {
     "Organization": "PT Maju Bersama",
     "Contact_Person": "Mr. Andi",
     "Email_Customer": "andi@majubersama.co.id",
     "Address": "Jl. Sudirman No. 10 Jakarta",
     "Phone": "081234567890",
     "Project_Name": "Office Network Upgrade Project",
     "Product_Name": "Router Ruijie RG-EG406XS",
     "Quantity": 2,
     "Diskon_Percent": 5,
     "MSRP": 3059000,
     "Buying_Price": 2500000
   }
   ```

2. **Dedicated Quotation Tab in Google Sheets:**
   * Automatically creates a new tab named `002-PT Maju Bersama-Router Ruijie RG-EG406XS` with document number `002-SDNR-2026` (or `002R1-SDNR-2026` for revisions) populated in cells `H12` and `O7`.
   * Removes unused template item rows so the proposal cleanly displays **1 product**.
3. **Automated Financial Log Entry (`Quotation_Log`):**
   * Inserts a new 19-column transaction row **directly above the `Total` row**, including `Margin Value`, `Margin %`, `PPN (11%)`, and `Grand Total`.
4. **Exported PDF & Gmail Draft:**
   * Saves `002-PT Maju Bersama-Router Ruijie RG-EG406XS.pdf` (restricted to **Columns A–K** so internal cost/margin columns remain hidden) in `Folder Quotation_TDN` and creates a ready-to-review Gmail draft addressed to `andi@majubersama.co.id`.

---

## 🗺️ Post-MVP Roadmap

* **Multi-Product Extraction:** Support parsing and populating multiple line items in a single quotation request.
* **Event-Driven Email Trigger:** Automatically trigger the workflow upon receiving incoming RFQ emails in Gmail.
* **ERP & Tiered Partner Pricing Integration:** Sync live stock and authorized partner discount tiers directly from internal ERP systems.
