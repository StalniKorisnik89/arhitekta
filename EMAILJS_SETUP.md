# EmailJS Setup Instructions

## Šta je EmailJS?

EmailJS je besplatan servis koji omogućava slanje email-ova direktno sa frontend-a bez potrebe za backend serverom.

## Kako da podesite EmailJS:

### 1. Kreirajte nalog na EmailJS
- Idite na https://www.emailjs.com/
- Registrujte se (besplatno)
- Verifikujte email adresu

### 2. Dodajte Email Service
- U dashboard-u, idite na "Email Services"
- Kliknite "Add New Service"
- Izaberite vašeg email provajdera (Gmail, Outlook, itd.)
- Povežite vaš email nalog
- Zapišite **Service ID** (npr. `service_abc123`)

### 3. Kreirajte Email Template
- Idite na "Email Templates"
- Kliknite "Create New Template"
- Koristite sledeće varijable u template-u:
  ```
  Subject: {{subject}}
  
  Poruka od: {{from_name}}
  Email: {{from_email}}
  Telefon: {{phone}}
  
  Poruka:
  {{message}}
  ```
- Zapišite **Template ID** (npr. `template_xyz789`)

### 4. Dobijte Public Key
- Idite na "Account" → "General"
- Pronađite "Public Key"
- Zapišite **Public Key** (npr. `abcdefghijklmnop`)

### 5. Ažurirajte kod
- Otvorite `script.js`
- Pronađite linije:
  ```javascript
  const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';
  const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
  const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
  ```
- Zamenite sa vašim stvarnim vrednostima:
  ```javascript
  const EMAILJS_PUBLIC_KEY = 'abcdefghijklmnop';
  const EMAILJS_SERVICE_ID = 'service_abc123';
  const EMAILJS_TEMPLATE_ID = 'template_xyz789';
  ```

### 6. Testirajte
- Osvežite sajt
- Popunite kontakt formu
- Kliknite "Pošalji"
- Proverite vaš email inbox

## Besplatni plan:
- 200 email-ova mesečno
- Dovoljno za većinu sajtova

## Napomena:
Ako ne podesite EmailJS, forma će i dalje raditi koristeći `mailto:` link (otvara email klijent).
