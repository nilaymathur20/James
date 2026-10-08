# CivicAI Mobile API Contract Specifications

## Base URL
- Local Emulator: `http://10.0.2.2:8000/api`
- Local Device / LAN: `http://<HOST_IP>:8000/api`

---

## 1. Grounded Municipal Policy Q&A
**POST** `/municipal/faq/query`
- **Request Body**:
```json
{
  "query": "What are the eligibility criteria for the 2026 municipal housing scheme?"
}
```
- **Response Body**:
```json
{
  "answer": "Applicants must be a resident of the municipality for at least 5 years and annual household income must not exceed INR 5,00,000.",
  "grounded": true,
  "confidence": "high",
  "citations": [
    {
      "source": "data/municipal_docs/Housing_Scheme_Guidelines_2026.md",
      "document_id": "Housing_Scheme_Guidelines_2026.md",
      "snippet": "Applicants must satisfy the eligibility conditions...",
      "page": 1,
      "score": 0.95
    }
  ],
  "fraud_warning": "Verified official municipal text.",
  "contact_info": "Municipal Ward Office | Support: 1800-111-222"
}
```

---

## 2. Notice OCR & Structure Extraction
**POST** `/municipal/notices/ocr`
- **Content-Type**: `multipart/form-data`
- **Form Field**: `file` (Binary Image/PDF)
- **Response Body**:
```json
{
  "ocr_text": "नगर निगम गृह कर भुगतान सूचना...",
  "detected_language": "Multilingual (Hindi/English)",
  "blocks": [],
  "sections": [],
  "detected_dates": ["15 November 2026"]
}
```

---

## 3. Notice Translation & AI Intelligence Analysis
**POST** `/municipal/notices/analyze`
- **Request Body**:
```json
{
  "text": "नगर निगम गृह कर भुगतान सूचना...",
  "target_language": "English"
}
```
- **Response Body**:
```json
{
  "translation": "Municipal Corporation House Tax Payment Notice...",
  "jargon": [
    {
      "term": "Remission",
      "explanation": "Rebate or deduction in mandatory fee/tax."
    }
  ],
  "summary": [
    "1. Pay house tax before November 15, 2026.",
    "2. Avail early bird discount of 5%.",
    "3. Submit receipt to Ward Office."
  ],
  "deadline": "15 November 2026",
  "office": "Municipal Ward Office / Civic Center",
  "documents_required": ["Identity Proof (Aadhaar)", "Property/Tax Receipt"],
  "contact_info": "Municipal Helpline: 1800-111-222",
  "fraud_check": "Verified: Standard official notice structure."
}
```
