# Admin Panel - Uputstvo

Admin panel omogućava upravljanje sadržajem sajta bez potrebe za backend serverom. Sve promene se čuvaju direktno u GitHub repozitorijumu preko GitHub API-ja.

## 🚀 Početak rada

### 1. Kreiranje GitHub Personal Access Token

1. Idite na [GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens)
2. Kliknite na "Generate new token (classic)"
3. Dajte tokenu ime (npr. "Arhitektonski Studio Admin")
4. Izaberite dozvole:
   - ✅ **repo** (potpuna kontrola nad privatnim repozitorijumima)
5. Kliknite "Generate token"
6. **VAŽNO**: Kopirajte token odmah (nećete moći da ga vidite ponovo!)

### 2. Prijava u Admin Panel

1. Otvorite `admin.html` u browser-u
2. Unesite:
   - **GitHub Personal Access Token** (token koji ste kreirali)
   - **Repo Owner** (vaš GitHub username)
   - **Repo Name** (ime repozitorijuma, npr. "arhitekta")
3. Kliknite "Prijavi se"

Token će biti sačuvan u localStorage-u, tako da nećete morati da se prijavljujete svaki put.

## 📝 Upravljanje sadržajem

### O nama sekcija

1. Kliknite na tab "O nama"
2. Izmenite:
   - Naslov
   - Podnaslov
   - Opis
   - Statistike (godine iskustva, projekti, klijenti)
3. Kliknite "Sačuvaj izmene"

### Usluge

1. Kliknite na tab "Usluge"
2. **Dodavanje nove usluge:**
   - Kliknite "+ Dodaj uslugu"
   - Unesite naziv i opis
   - Kliknite "Sačuvaj"
3. **Izmena usluge:**
   - Kliknite "Izmeni" na kartici usluge
   - Izmenite podatke
   - Kliknite "Sačuvaj"
4. **Brisanje usluge:**
   - Kliknite "Obriši" na kartici usluge
   - Potvrdite brisanje

### Portfolio

1. Kliknite na tab "Portfolio"
2. **Dodavanje novog projekta:**
   - Kliknite "+ Dodaj projekat"
   - Unesite:
     - Naziv projekta
     - Kategoriju
     - URL slike (ili upload preko GitHub)
     - Opis
     - Specifikacije (površina, godina, lokacija, status)
   - Kliknite "Sačuvaj"
3. **Izmena projekta:**
   - Kliknite "Izmeni" na kartici projekta
   - Izmenite podatke
   - Kliknite "Sačuvaj"
4. **Brisanje projekta:**
   - Kliknite "Obriši" na kartici projekta
   - Potvrdite brisanje

### Kontakt informacije

1. Kliknite na tab "Kontakt"
2. Izmenite:
   - Telefon
   - Email
   - Adresu
3. Kliknite "Sačuvaj izmene"

## 🔧 Tehnički detalji

### Kako funkcioniše

1. **Čitanje podataka:**
   - Admin panel čita `data/content.json` fajl iz GitHub repozitorijuma
   - Koristi GitHub API endpoint: `GET /repos/{owner}/{repo}/contents/{path}`

2. **Čuvanje podataka:**
   - Kada sačuvate izmene, admin panel:
     - Konvertuje JSON u base64
     - Šalje PUT zahtev GitHub API-ju
     - GitHub automatski kreira commit sa vašim promenama

3. **Frontend integracija:**
   - Frontend (`index.html`) koristi `data-loader.js` da učita podatke
   - Podaci se učitavaju sa `data/content.json` fajla
   - Ako fajl ne postoji, koriste se default vrednosti

### Struktura podataka

Svi podaci se čuvaju u `data/content.json`:

```json
{
  "about": {
    "title": "...",
    "subtitle": "...",
    "description": "...",
    "stats": {
      "experience": "...",
      "projects": "...",
      "clients": "..."
    }
  },
  "services": [...],
  "portfolio": [...],
  "contact": {
    "phone": "...",
    "email": "...",
    "address": "..."
  }
}
```

## 🔒 Bezbednost

- **Token se čuva lokalno** u browser localStorage-u
- **Token ima pristup vašem repozitorijumu** - čuvajte ga sigurno
- **Ne delite token** sa drugima
- **Ako token bude kompromitovan**, odmah ga obrišite i kreirajte novi

## ⚠️ Važne napomene

1. **GitHub API Rate Limits:**
   - Za autentifikovane zahteve: 5,000 zahteva/sat
   - Za neautentifikovane: 60 zahteva/sat
   - Admin panel koristi autentifikovane zahteve, tako da imate dovoljno

2. **Commit poruke:**
   - Svaka izmena kreira commit u GitHub repozitorijumu
   - Commit poruke su automatski generisane (npr. "Update about section")

3. **GitHub Pages:**
   - Nakon što sačuvate izmene, GitHub Pages će automatski ažurirati sajt
   - Može potrajati nekoliko minuta dok se promene propagiraju

4. **Upload slika:**
   - Trenutno admin panel podržava samo URL slika
   - Za upload slika direktno u repo, možete koristiti GitHub web interfejs ili GitHub Desktop

## 🐛 Rešavanje problema

### "Greška pri povezivanju"
- Proverite da li je token ispravan
- Proverite da li imate dozvole za repo
- Proverite da li su owner i repo name tačni

### "Greška pri učitavanju podataka"
- Proverite da li `data/content.json` postoji u repozitorijumu
- Proverite da li imate pristup repozitorijumu

### Promene se ne prikazuju na sajtu
- Sačekajte nekoliko minuta (GitHub Pages cache)
- Očistite browser cache
- Proverite da li je `data/content.json` ažuriran u repozitorijumu

## 📚 Dodatni resursi

- [GitHub API Documentation](https://docs.github.com/en/rest)
- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [GitHub Pages](https://pages.github.com/)

---

**Napomena:** Admin panel je dizajniran da radi sa statičkim hostingom (GitHub Pages). Ne zahteva backend server ili bazu podataka.
