# Tre Fronti

Gioco di carte in nove turni, disponibile nel browser e da terminale. Le due versioni condividono le stesse regole e gli stessi bot.

## Giocare da linea di comando

Apri un terminale in questa cartella e lancia:

```sh
npm install
npm run cli
```

All'avvio scegli la lingua: italiano (`1`, oppure Invio) o inglese (`2`). Poi scegli il bot strategico (`1`, oppure Invio) o casuale (`2`). Per giocare, scrivi una carta e un fronte, per esempio `7 B`, e premi Invio. I fronti sono `A`, `B`, `C`; ogni carta da 1 a 9 si usa una sola volta e ogni fronte contiene tre carte per giocatore.

Puoi scrivere `aiuto` per le regole, `stato` per rivedere il tavolo ed `esci` per uscire, oppure premere `Ctrl+C`. Le carte coperte del bot e le somme che le includono appaiono come `?` fino alla fine. Dopo nove turni vengono mostrati risultato e carte, poi puoi scegliere di rigiocare.

In inglese i comandi sono `help`, `status` e `quit`. I comandi italiani e inglesi funzionano in entrambe le lingue. Il titolo rimane **Tre Fronti**.

Non serve avviare il server web. Il comando prepara automaticamente il motore del gioco nella cartella `.cli/` e avvia l'interfaccia in `cli/`, senza dipendenze aggiuntive.

Il tavolo usa carte ASCII e fronti affiancati, che vanno a capo se il terminale è stretto. Nei terminali compatibili le tue carte sono verdi e quelle del bot gialle. I colori vengono disattivati quando l'output è reindirizzato o è impostata la variabile `NO_COLOR`.

## Avvio del gioco

Apri un terminale in questa cartella e lancia:

```sh
npm install
npm run dev
```

Vite indica nel terminale l'indirizzo locale da aprire nel browser. Per fermare il server, premi `Ctrl+C` nel terminale.

## Modalità Multiplayer Online

Per giocare online contro un'altra persona in tempo reale:

1. Avvia il server multiplayer in un terminale:
   ```sh
   npm run server
   ```
2. Apri il browser all'indirizzo dell'app (es. `http://127.0.0.1:5173`) e seleziona **Online** nella barra superiore.
3. Clicca su **Crea Nuova Stanza** per ottenere un codice (es. `7K9P`) e inviare il link diretto all'avversario, oppure inserisci un codice esistente per unirti.

Il server fa da arbitro autoritativo via WebSocket: riceve le scelte contemporanee e maschera le carte coperte (`card: null`) fino alla fine del nono turno, prevenendo qualsiasi tipo di sbirciata o manomissione.


## Controlli del progetto

```sh
npm test       # controlla le regole principali della partita
npm run build  # controlla TypeScript e crea la versione di produzione in dist/
```

Il bot casuale sceglie una carta e un fronte a caso tra quelli disponibili. Il bot strategico confronta le mosse candidate completando le zone con assegnazioni casuali. Può usare le proprie carte e quelle avversarie rivelate; considera ignoti i valori delle carte coperte. È un'euristica sperimentale: questa implementazione non dimostra che il bot abbia un vantaggio.
