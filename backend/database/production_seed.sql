-- Production seed: the ONE thing a fresh live database needs before anyone can sign up.
-- sign_liability() requires an active procedure version. Safe to run more than once.
-- Run it in Supabase Dashboard > SQL Editor. (Do NOT run seed.sql in production: it adds demo inventory.)

-- Active operational procedure (v2.4, the version the UI text is written against)
INSERT INTO procedure_versions (version_string, document_url, content, active)
VALUES ('v2.4', 'procedures/v2.4.pdf', '## 1. Scope and Acceptance

These Operational Procedures govern the use of the Ruhuna Makerspace facility at the Faculty of Engineering, University of Ruhuna. By signing this agreement, you acknowledge that you have read, understood, and agree to be bound by all terms herein. This agreement is legally binding. Acceptance is required before any access to the Space or its equipment is granted. Continued use of the Space constitutes ongoing acceptance of the then-current version of these procedures. The procedures are reviewed and updated at the start of each academic year, and re-acceptance is required each time a new version is published.

## 2. Keyholder Supervision Requirements

Access to the Space is only permitted when a designated Keyholder is physically present. No student may enter, occupy, or use any equipment in the Space without a Keyholder on-site for the duration of the session. A Keyholder is defined as a current-year authorised student who has completed the Keyholder training programme. Keyholders are identified by their role status in the Makerspace Management System. You must not remain in the Space after the Keyholder has departed, even if the session has not yet concluded.

## 3. Equipment Operation and Training

You must not operate any machinery or power tool for which you have not received documented training. A list of equipment requiring mandatory training is maintained within the System. Attempting to operate restricted equipment without prior training authorisation is a serious violation and will result in immediate revocation of access privileges. You must notify the Keyholder before operating any equipment, and cease operation immediately upon instruction from the Keyholder or any other authorised person.

## 4. Personal Protective Equipment (PPE)

Appropriate PPE is mandatory at all times when operating equipment or working in active zones. This includes but is not limited to: safety glasses when in the fabrication area, hearing protection when operating the CNC machine or angle grinder for extended periods, and closed-toe footwear at all times. You are responsible for correctly donning PPE before beginning work and returning all borrowed PPE to the designated storage locations after use.

## 5. Fire and Emergency Procedures

You must familiarise yourself with the location of all fire extinguishers, emergency exits, and the assembly point. In the event of a fire or emergency: immediately cease all operations, alert the Keyholder and all occupants, evacuate via the nearest marked exit, proceed to the assembly point, and contact emergency services. Do not attempt to re-enter the Space until formally cleared to do so.

## 6. Material Usage and Consumables

You must submit a materials request as part of your project access request detailing all consumables required. Taking materials not specified in your approved request is prohibited. Waste materials must be sorted into the designated bins. Hazardous materials may only be used under direct Keyholder supervision in accordance with posted material safety data sheets.

## 7. Liability and Personal Responsibility

You use the Makerspace and all of its equipment entirely at your own risk. The University of Ruhuna, the Faculty of Engineering, and the Ruhuna Makerspace management team expressly disclaim liability for any personal injury, property damage, or consequential loss arising from your use of the Space. You agree to indemnify and hold harmless the University, its staff, and all Makerspace personnel against any claims arising from your activities within the Space.

## 8. Code of Conduct

All users are expected to treat all equipment with care, respect other users'' work and workspace, report any equipment faults or damage immediately to the Keyholder without attempting self-repair, and leave your workstation in a clean and orderly condition at the conclusion of every session. Wilful damage, theft, or misuse of equipment will be reported to the Faculty Disciplinary Committee and may result in permanent access revocation.

## 9. Digital System Usage

Access is managed exclusively through the Makerspace Management System. You are responsible for maintaining the accuracy of your account information. You must not attempt to access the System under another user''s credentials or submit false information in any request form. All system interactions are logged and form part of your compliance record.

## 10. Agreement Acknowledgement

By signing below, you confirm that you have scrolled through and read the entirety of these Operational Procedures (Version 2.4, June 2026), that you understand all terms, and that you voluntarily agree to be bound by them. You acknowledge that a digital record of this agreement, including your name, student ID, the timestamp of signature, and your IP address, will be stored permanently and may be produced as evidence in any disciplinary or legal proceedings.', true)
ON CONFLICT (version_string) DO NOTHING;
