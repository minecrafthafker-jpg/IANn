# IANn — statische Webseite (nachgebaut)

Dies ist ein einfacher statischer Nachbau, angelehnt an die verlinkte Seite. Ich habe ein minimalistisches One‑Page‑Layout erstellt und eine optionale Firebase‑Integration vorbereitet.

Was ist drin
- index.html — die Seite
- css/style.css — Basisstyles
- js/firebase-config.js — Platzhalter für dein Firebase‑Config (fülle mit Werten aus der Firebase Console)
- js/main.js — Formular‑Handler und Beispiel zur Speicherung in Firestore

Firebase einrichten (kurz)
1. Erstelle ein Firebase‑Projekt in der Firebase Console.
2. Kopiere die Web‑App Konfiguration und füge die Werte in `js/firebase-config.js` ein.
3. (Optional) Aktiviere Firestore in deinem Projekt.

Deployment
- GitHub Pages: Repo → Settings → Pages → Branch `main` / `/ (root)` → Save. Danach ist die Seite unter `https://<dein-username>.github.io/IANn/` erreichbar.
- Firebase Hosting: initialisiere lokal mit `firebase init hosting` und folge der Anleitung; du kannst die Dateien aus diesem Repo deployen.

Anpassungen
- Bilder/Assets: aktuell verwende ich keine großen Bilddateien. Falls du Bilder oder Fonts vom Original übernehmen willst, lade sie in `assets/` hoch und verlinke sie in `index.html`.

Wenn du möchtest, kann ich jetzt:
- nochmal versuchen, die Dateien direkt in dein Repo zu pushen, oder
- die Seite um Bilder/Fonts vom Original erweitern (wenn du mir sagst, welche Dateien übernommen werden dürfen), oder
- Firebase-Hosting Konfigurationsdateien hinzufügen (firebase.json) — dafür bräuchte ich dein OK.
