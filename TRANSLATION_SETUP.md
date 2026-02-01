# Višejezični Sadržaj - Uputstvo

## Kako funkcioniše prevod za sadržaj iz admin panela?

### Trenutno stanje:
- **Statički sadržaj** (navigacija, dugmad, itd.) se prevodi automatski preko `translations/sr.json`, `translations/en.json`, `translations/ru.json`
- **Dinamički sadržaj** (usluge, portfolio, about) iz admin panela se čuva samo na srpskom i prikazuje se bez obzira na izabrani jezik

### Nova funkcionalnost:
Sada možete dodati prevode za sve tri jezika direktno u admin panelu!

## Kako da dodate prevode:

### 1. Usluge (Services)
Kada dodajete ili menjate uslugu, unesite:
- **Naziv usluge (SR)** - srpski naziv
- **Naziv usluge (EN)** - engleski naziv  
- **Naziv usluge (RU)** - ruski naziv
- **Opis (SR)** - srpski opis
- **Opis (EN)** - engleski opis
- **Opis (RU)** - ruski opis

### 2. Portfolio Projekti
Kada dodajete ili menjate projekat, unesite:
- **Naziv projekta (SR/EN/RU)** - za sva tri jezika
- **Kategorija (SR/EN/RU)** - za sva tri jezika
- **Opis (SR/EN/RU)** - za sva tri jezika
- **Specifikacije** (površina, godina, lokacija, status) - ovo ostaje isti za sve jezike

### 3. O nama (About)
- **Naslov (SR/EN/RU)**
- **Podnaslov (SR/EN/RU)**
- **Opis (SR/EN/RU)**
- **Statistike** - ovo ostaje isti za sve jezike

## Struktura podataka:

Podaci se čuvaju u `data/content.json` u sledećem formatu:

```json
{
  "about": {
    "sr": { "title": "...", "subtitle": "...", "description": "..." },
    "en": { "title": "...", "subtitle": "...", "description": "..." },
    "ru": { "title": "...", "subtitle": "...", "description": "..." }
  },
  "services": [
    {
      "id": 1,
      "sr": { "title": "...", "description": "..." },
      "en": { "title": "...", "description": "..." },
      "ru": { "title": "...", "description": "..." }
    }
  ],
  "portfolio": [
    {
      "id": 1,
      "sr": { "title": "...", "category": "...", "description": "..." },
      "en": { "title": "...", "category": "...", "description": "..." },
      "ru": { "title": "...", "category": "...", "description": "..." },
      "image": "...",
      "specs": { "area": "...", "year": "...", "location": "...", "status": "..." }
    }
  ]
}
```

## Napomena:
- Ako ne unesete prevod za neki jezik, koristiće se srpski kao fallback
- Kontakt informacije (telefon, email, adresa) ostaju isti za sve jezike
