# Arhitektonski Studio - Website

Moderan, profesionalan i elegantan sajt za arhitektu/dizajnera enterijera sa višejezičnom podrškom.

## 🌐 Jezici

Sajt podržava tri jezika:
- **Srpski (SR)** - podrazumevani jezik
- **Engleski (EN)**
- **Ruski (RU)**

Jezik se menja preko language switcher-a u headeru, a izbor se čuva u localStorage-u.

## 📁 Struktura projekta

```
arhitekta/
├── index.html          # Glavna HTML stranica
├── about.html          # O nama stranica
├── portfolio-detail.html # Detalji projekta
├── admin.html          # Admin panel
├── styles.css          # CSS stilovi
├── admin.css           # Admin panel stilovi
├── script.js           # JavaScript funkcionalnosti
├── admin.js            # Admin panel JavaScript
├── data-loader.js      # Učitavanje podataka sa frontenda
├── data/               # JSON fajlovi sa sadržajem
│   └── content.json    # Glavni fajl sa sadržajem
├── translations/       # JSON fajlovi za prevode
│   ├── sr.json         # Srpski prevod
│   ├── en.json         # Engleski prevod
│   └── ru.json         # Ruski prevod
├── README.md           # Dokumentacija
└── ADMIN_README.md     # Admin panel dokumentacija
```

## 🎨 Dizajn

### Paleta boja
- **Beton**: #E8E6E3
- **Bela**: #FFFFFF
- **Siva**: #8B8B8B
- **Crna**: #1A1A1A
- **Drvo**: #C9A961

### Tipografija
- **Display font**: Playfair Display (serif) - za naslove
- **Body font**: Inter (sans-serif) - za tekst

## ✨ Funkcionalnosti

### Header
- Logo
- Navigacija sa smooth scroll efektom
- Language switcher (SR | EN | RU)
- Responsive mobile menu

### Hero sekcija
- Jak headline vezan za arhitekturu
- Kratak opis filozofije rada
- CTA dugmad (Kontakt / Portfolio)

### O nama
- Predstavljanje studija
- Statistike (godine iskustva, projekti, klijenti)

### Usluge
- Arhitektonsko projektovanje
- Dizajn enterijera
- 3D vizualizacije
- Konsultacije
- Kartice sa hover efektima

### Portfolio
- Grid sa projektima
- Hover efekti sa overlay-em
- Spremno za proširenje na detaljnu stranicu

### Kontakt
- Kontakt forma sa validacijom
- Kontakt informacije (telefon, email, lokacija)
- Responsive layout

### Footer
- Brzi linkovi
- Kontakt podaci
- Copyright

## 🚀 Pokretanje

### Lokalno pokretanje

1. Otvorite `index.html` u web browser-u
2. Za lokalni development server, koristite:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js (sa http-server)
   npx http-server
   ```

### GitHub Pages Hosting

1. Push-ujte kod u GitHub repozitorijum
2. Idite na Settings > Pages
3. Izaberite branch (obično `main` ili `master`)
4. Sajt će biti dostupan na `https://username.github.io/repo-name`

**Detaljno uputstvo:** Pogledajte [GITHUB_SETUP.md](./GITHUB_SETUP.md)

**Napomena:** Za admin panel, pogledajte [ADMIN_README.md](./ADMIN_README.md)

## 📱 Responsive Design

Sajt je potpuno responsive i optimizovan za:
- Mobile (320px+)
- Tablet (768px+)
- Desktop (1024px+)
- Large Desktop (1200px+)

## ⚡ Performanse

- Optimizovani fontovi sa preconnect
- Lazy loading za slike (spremno za implementaciju)
- Smooth scroll animacije
- Intersection Observer za fade-in efekte
- Minimalan JavaScript bundle

## 🔧 Prilagođavanje

### Dodavanje novog jezika

1. Kreirajte novi JSON fajl u `translations/` folderu (npr. `de.json`)
2. Kopirajte strukturu iz `sr.json` i prevedite sadržaj
3. Dodajte dugme u language switcher u `index.html`:
   ```html
   <button class="lang-btn" data-lang="de">DE</button>
   ```
4. Dodajte prevod u `script.js` u `updateMetaTags()` funkciji

### Dodavanje stvarnih slika u portfolio

Zamenite `portfolio-placeholder` div-ove sa stvarnim `<img>` tagovima:
```html
<img src="images/project1.jpg" alt="Project 1" loading="lazy">
```

### Prilagođavanje boja

Boje su definisane kao CSS varijable u `styles.css`:
```css
:root {
    --color-concrete: #E8E6E3;
    --color-wood: #C9A961;
    /* ... */
}
```

## 📝 SEO Optimizacija

- Semantički HTML5 tagovi
- Meta tagovi (title, description, keywords)
- Open Graph tagovi za društvene mreže
- Canonical URL
- Responsive meta viewport
- Alt tekstovi za slike (dodati kada se dodaju stvarne slike)

## 🌟 Animacije

- Fade-in efekti pri scroll-u
- Hover efekti na kartice i dugmad
- Smooth scroll navigacija
- Portfolio overlay animacije

## 📧 Kontakt forma

Kontakt forma je spremna za integraciju sa backend-om. Trenutno prikazuje success poruku. Za produkciju, dodajte server-side validaciju i email slanje.

## 🔐 Admin Panel

Sajt ima integrisan admin panel za upravljanje sadržajem bez potrebe za backend serverom.

- **Admin panel:** `admin.html`
- **Dokumentacija:** [ADMIN_README.md](./ADMIN_README.md)

Admin panel koristi GitHub API za direktno upravljanje sadržajem u repozitorijumu.

## 📄 Licenca

Ovaj projekat je kreiran za arhitektonski studio. Svi prava zadržana.

---

**Napomena**: Sajt je kreiran sa potpuno originalnim dizajnom, bojama, fontovima i tekstom. Nije korišćen sadržaj sa referentnog sajta.
