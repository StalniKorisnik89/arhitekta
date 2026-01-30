#!/bin/bash

echo "========================================"
echo "Arhitektonski Studio - GitHub Deploy"
echo "========================================"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "[1/5] Inicijalizacija Git repozitorijuma..."
    git init
    if [ $? -ne 0 ]; then
        echo "ERROR: Git nije instaliran"
        exit 1
    fi
else
    echo "[1/5] Git repozitorijum već postoji"
fi

echo ""
echo "[2/5] Dodavanje fajlova..."
git add .
if [ $? -ne 0 ]; then
    echo "ERROR: Greška pri dodavanju fajlova"
    exit 1
fi

echo ""
echo "[3/5] Kreiranje commit-a..."
git commit -m "Initial commit: Arhitektonski Studio website with admin panel"
if [ $? -ne 0 ]; then
    echo "WARNING: Nema novih izmena za commit ili commit već postoji"
fi

echo ""
echo "[4/5] Povezivanje sa GitHub repozitorijumom..."
git remote remove origin 2>/dev/null
git remote add origin https://github.com/StalniKorisnik89/arhitekta.git
if [ $? -ne 0 ]; then
    echo "ERROR: Greška pri dodavanju remote repozitorijuma"
    exit 1
fi

echo ""
echo "[5/5] Push na GitHub..."
git branch -M main
git push -u origin main
if [ $? -ne 0 ]; then
    echo ""
    echo "========================================"
    echo "ERROR: Push nije uspeo!"
    echo "========================================"
    echo ""
    echo "Mogući uzroci:"
    echo "1. GitHub zahteva autentifikaciju"
    echo "2. Repozitorijum ne postoji ili nemate pristup"
    echo "3. Mreža nije dostupna"
    echo ""
    echo "Rešenje:"
    echo "- Koristite Personal Access Token umesto lozinke"
    echo "- Proverite da li repozitorijum postoji"
    echo "- Pokušajte ponovo sa: git push -u origin main"
    echo ""
    exit 1
fi

echo ""
echo "========================================"
echo "Deploy uspešan!"
echo "========================================"
echo ""
echo "Sledeći koraci:"
echo "1. Idite na: https://github.com/StalniKorisnik89/arhitekta/settings/pages"
echo "2. Izaberite Source: Branch main, Folder: / (root)"
echo "3. Kliknite Save"
echo "4. Sajt će biti dostupan na: https://stalnikorisnik89.github.io/arhitekta/"
echo ""
