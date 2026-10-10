# Video 3D Anaglifo

Guarda i video 3D (**Side-by-Side** e **Top-Bottom**) in **anaglifo rosso/ciano** con gli occhialini rosso-ciano, con profondità, zoom e colori regolabili. Gratuito, senza raccolta di dati.

Contiene due strumenti:

| Strumento | A cosa serve |
|---|---|
| [`extension/`](extension) | Estensione per Chrome / Edge / Brave: trasforma in 3D i video dei siti web (es. YouTube) |
| [`player/player3d.html`](player/player3d.html) | Player locale: apri un file video dal PC (basta un doppio clic) |

## Funzioni
- Formati: Side-by-Side, Top-Bottom, 2D
- Profondità da -30% a +30%, anche su un solo occhio, con scambio occhi
- **Transizione graduale**: a ogni avvio o salto nel video la profondità riparte da 0 e sale fino al livello scelto (di base 10 s), per abituare l'occhio
- Zoom e spostamento del fotogramma
- Colore (saturazione), contrasto, gamma, luminosità
- 4 tipi di anaglifo: Dubois, colore, grigio, rosso/blu

## Installare l'estensione (Chrome, Edge, Brave)
1. Scarica il repository: **Code → Download ZIP** (oppure la [Release](../../releases)) e decomprimilo.
2. Apri `chrome://extensions` (su Edge `edge://extensions`).
3. Attiva **Modalità sviluppatore**.
4. Premi **Carica estensione non pacchettizzata** e scegli la cartella `extension`.
5. Fissa l'icona rosso/ciano nella barra (icona puzzle).

### Uso
1. Apri una pagina con un video 3D e **ricaricala (F5)** la prima volta.
2. Premi l'icona dell'estensione oppure **Alt+3**.
3. Nel pannello scegli il **formato** (si parte sempre da 2D) e regola la profondità.

Scorciatoie: `Alt+3` on/off · `Alt+←/→` profondità (con Shift passo più grande) · `Alt+H` mostra/nasconde il pannello.

Se la scorciatoia non funziona, assegnala da `chrome://extensions/shortcuts`.

## Usare il player locale
Apri `player/player3d.html` nel browser e trascina dentro un video (oppure premi **O**).
Tasti: `Spazio` play/pausa · `← →` profondità · `↑ ↓` avanti/indietro 5 s · `PagSu/PagGiù` 30 s · `, .` un fotogramma · `S` scambia occhi · `M` formato · `A` tipo anaglifo · `F` schermo intero · `H` aiuto.
Il browser legge solo alcuni formati (MP4/H.264, WebM). Per altri, converti prima con `ffmpeg`:
```
ffmpeg -i ingresso.avi -c:v libx264 -crf 18 -c:a aac uscita.mp4
```

## Limiti
- I video protetti da **DRM** (Netflix, Prime Video, ecc.) non sono accessibili e restano neri.
- Un video **2D normale non diventa 3D**: serve un video già girato in 3D.
- L'anaglifo rosso/ciano non rende tutti i colori (soprattutto i rossi): è un limite della tecnica.
- Interfaccia solo in italiano.

## Privacy
Nessun dato viene raccolto o inviato. I fotogrammi sono elaborati in locale nel browser. Le impostazioni sono salvate solo sul tuo computer (`chrome.storage`).

## Licenza
MIT, vedi [LICENSE](LICENSE).
