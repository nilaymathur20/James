import os
from pathlib import Path

DEMO_DIR = Path("data/demo_docs")
DEMO_DIR.mkdir(parents=True, exist_ok=True)

docs = {
    "Housing_Scheme_Demo.md": """
# Housing Scheme Guidelines 2026
**DEMO / SYNTHETIC DOCUMENT**

## 1. Introduction
The Municipal Housing Scheme 2026 aims to provide affordable housing to residents.

## 2. Eligibility
Applicants must satisfy the eligibility conditions specified in the scheme guidelines:
- Must be a resident of the municipality for at least 5 years.
- Annual household income must not exceed INR 5,00,000.
- Must not own a concrete (pucca) house anywhere in the country.

## 3. Required Documents
- Aadhaar card (self-attested copy)
- Income certificate issued by the Competent Authority
- Domicile certificate

## 4. Application Procedure
Submit the required application and documents to the Municipal Ward Office.
The deadline for submission is 15 November 2026.
""",
    "Property_Tax_Rebate_Notice.md": """
# Property Tax Rebate Notice
**DEMO / SYNTHETIC DOCUMENT**

Notice to all property owners:
A rebate of 10% on property tax is available for those who pay their annual dues before 31 May 2026.
Payments can be made online or at the Municipal Tax Office.
"""
}

for filename, content in docs.items():
    with open(DEMO_DIR / filename, "w") as f:
        f.write(content.strip())

print("Demo documents created.")
