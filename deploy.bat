@echo off
echo ========================================
echo Arhitektonski Studio - GitHub Deploy
echo ========================================
echo.

REM Check if git is initialized
if not exist ".git" (
    echo [1/5] Inicijalizacija Git repozitorijuma...
    git init
    if errorlevel 1 (
        echo ERROR: Git nije instaliran ili nije u PATH-u
        pause
        exit /b 1
    )
) else (
    echo [1/5] Git repozitorijum vec postoji
)

echo.
echo [2/5] Dodavanje fajlova...
git add .
if errorlevel 1 (
    echo ERROR: Greska pri dodavanju fajlova
    pause
    exit /b 1
)

echo.
echo [3/5] Kreiranje commit-a...
git commit -m "Initial commit: Arhitektonski Studio website with admin panel"
if errorlevel 1 (
    echo WARNING: Nema novih izmena za commit ili commit vec postoji
)

echo.
echo [4/5] Povezivanje sa GitHub repozitorijumom...
git remote remove origin 2>nul
git remote add origin https://github.com/StalniKorisnik89/arhitekta.git
if errorlevel 1 (
    echo ERROR: Greska pri dodavanju remote repozitorijuma
    pause
    exit /b 1
)

echo.
echo [5/5] Push na GitHub...
git branch -M main
git push -u origin main
if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR: Push nije uspeo!
    echo ========================================
    echo.
    echo Moguci uzroci:
    echo 1. GitHub zahteva autentifikaciju
    echo 2. Repozitorijum ne postoji ili nemate pristup
    echo 3. Mreza nije dostupna
    echo.
    echo Resenje:
    echo - Koristite Personal Access Token umesto lozinke
    echo - Proverite da li repozitorijum postoji
    echo - Pokusajte ponovo sa: git push -u origin main
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Deploy uspesan!
echo ========================================
echo.
echo Sledeci koraci:
echo 1. Idite na: https://github.com/StalniKorisnik89/arhitekta/settings/pages
echo 2. Izaberite Source: Branch main, Folder: / (root)
echo 3. Kliknite Save
echo 4. Sajt ce biti dostupan na: https://stalnikorisnik89.github.io/arhitekta/
echo.
pause
