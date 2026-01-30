# GitHub Setup - Uputstvo

Ovaj fajl sadrži korake za postavljanje projekta na GitHub i aktivaciju GitHub Pages.

## 📋 Preduslovi

- Git instaliran na vašem računaru
- GitHub nalog kreiran
- Repozitorijum kreiran na GitHub-u: `https://github.com/StalniKorisnik89/arhitekta`

## 🚀 Koraci za postavljanje

### 1. Inicijalizacija Git repozitorijuma

Otvorite terminal/command prompt u folderu projekta i izvršite:

```bash
# Inicijalizuj git repozitorijum
git init

# Dodaj sve fajlove
git add .

# Napravi prvi commit
git commit -m "Initial commit: Arhitektonski Studio website with admin panel"
```

### 2. Povezivanje sa GitHub repozitorijumom

```bash
# Dodaj remote repozitorijum
git remote add origin https://github.com/StalniKorisnik89/arhitekta.git

# Proveri da li je remote dodat
git remote -v
```

### 3. Push koda na GitHub

```bash
# Push na main branch
git branch -M main
git push -u origin main
```

**Napomena:** Ako GitHub zahteva autentifikaciju:
- Koristite Personal Access Token umesto lozinke
- Ili koristite GitHub CLI (`gh auth login`)

### 4. Aktivacija GitHub Pages

1. Idite na GitHub repozitorijum: https://github.com/StalniKorisnik89/arhitekta
2. Kliknite na **Settings** (gore desno)
3. U levom meniju, kliknite na **Pages**
4. Pod **Source**, izaberite:
   - **Branch:** `main`
   - **Folder:** `/ (root)`
5. Kliknite **Save**

### 5. Pristup sajtu

Nakon nekoliko minuta, vaš sajt će biti dostupan na:
```
https://stalnikorisnik89.github.io/arhitekta/
```

## 🔐 Admin Panel Setup

### 1. Prijava u Admin Panel

1. Otvorite: `https://stalnikorisnik89.github.io/arhitekta/admin.html`
2. Unesite:
   - **GitHub Personal Access Token** (kreirajte ga [ovde](https://github.com/settings/tokens))
   - **Repo Owner:** `StalniKorisnik89`
   - **Repo Name:** `arhitekta`
3. Kliknite "Prijavi se"

### 2. Kreiranje GitHub Token-a

1. Idite na: https://github.com/settings/tokens
2. Kliknite **Generate new token (classic)**
3. Dajte ime tokenu (npr. "Arhitektonski Studio Admin")
4. Izaberite dozvole:
   - ✅ **repo** (potpuna kontrola nad repozitorijumom)
5. Kliknite **Generate token**
6. **VAŽNO:** Kopirajte token odmah (nećete moći da ga vidite ponovo!)

## 📝 Ažuriranje sajta

Nakon što napravite izmene u admin panelu:

1. Promene se automatski commit-uju u GitHub repozitorijum
2. GitHub Pages automatski ažurira sajt (može potrajati 1-5 minuta)
3. Očistite browser cache ako ne vidite izmene

## 🔄 Ručno ažuriranje (ako je potrebno)

```bash
# Dodaj izmene
git add .

# Commit
git commit -m "Update content"

# Push
git push origin main
```

## ⚠️ Važne napomene

1. **Ne commit-ujte token-e:**
   - Token se čuva samo u browser localStorage-u
   - Ne dodajte token u kod

2. **GitHub API Rate Limits:**
   - Autentifikovani zahtevi: 5,000/sat
   - Dovoljno za normalno korišćenje admin panela

3. **Privatan repozitorijum:**
   - Ako je repo privatan, samo vi možete pristupiti admin panelu
   - Za javni repo, svi mogu videti kod, ali samo vi možete menjati sadržaj (sa tokenom)

## 🐛 Rešavanje problema

### "Permission denied" pri push-u
- Proverite da li imate pristup repozitorijumu
- Koristite Personal Access Token za autentifikaciju

### Sajt se ne učitava
- Proverite da li je GitHub Pages aktiviran
- Sačekajte nekoliko minuta (cache)
- Proverite da li je `index.html` u root folderu

### Admin panel ne radi
- Proverite da li je token ispravan
- Proverite da li imate `repo` dozvole
- Proverite da li su owner i repo name tačni

## 📚 Dodatni resursi

- [GitHub Pages dokumentacija](https://docs.github.com/en/pages)
- [GitHub API dokumentacija](https://docs.github.com/en/rest)
- [Git dokumentacija](https://git-scm.com/doc)

---

**Srećno sa postavljanjem! 🎉**
