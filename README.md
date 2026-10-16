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

In inglese i comandi equivalenti sono `help`, `status` e `quit`. Entrambi i set di comandi funzionano a prescindere dalla lingua scelta.

Non serve avviare il server web. Il comando prepara automaticamente il motore del gioco nella cartella `.cli/` e avvia l'interfaccia in `cli/`, senza dipendenze aggiuntive.

Il tavolo usa carte ASCII e fronti affiancati, che vanno a capo se il terminale è stretto. Nei terminali compatibili le tue carte sono verdi e quelle del bot gialle. I colori vengono disattivati quando l'output è reindirizzato o è impostata la variabile `NO_COLOR`.

## Avvio del gioco

Apri un terminale in questa cartella e lancia:

```sh
npm install
npm run dev
```

Vite indica nel terminale l'indirizzo locale da aprire nel browser. Per fermare il server, premi `Ctrl+C` nel terminale.

## Partite online

Non è necessario che entrambi i giocatori abbiano il progetto o installino Node.js: **un solo giocatore fa da host** sul proprio computer, mentre all'altro basta **aprire il link d'invito nel browser** (da computer, tablet o smartphone).

### 1. Avviare il gioco (sul PC dell'host)

Apri due terminali nella cartella del progetto:

```sh
# Terminale 1: server di gioco WebSocket (porta 3001)
npm run server

# Terminale 2: interfaccia web
npm run dev
```

### 2. Far collegare l'avversario

#### A distanza (tramite Internet)
Per condividere la partita online senza dover aprire porte sul router:

1. In un terzo terminale, lancia un tunnel temporaneo Cloudflare:
   ```sh
   npx cloudflared tunnel --url http://localhost:5173
   ```
2. Trova nell'output il link pubblico HTTPS generato (per esempio `https://xxxx.trycloudflare.com`) e aprilo nel tuo browser.
3. Nella barra superiore seleziona **Online**, clicca su **Crea stanza**, poi clicca su **Copia link d'invito** e invialo all'altra persona.
4. L'avversario apre il link nel proprio browser e la partita inizia subito.

#### Sulla stessa rete (stesso Wi-Fi)
1. Avvia Vite specificando l'ascolto su rete locale:
   ```sh
   npm run dev -- --host
   ```
2. Apri l'indirizzo di rete indicato nel terminale (per esempio `http://192.168.1.X:5173`).
3. Seleziona **Online** -> **Crea stanza** e condividi con l'altra persona il codice a quattro lettere o il link d'invito.

### Note di sicurezza delle mosse
Il server riceve le mosse simultanee e invia ai client solo le carte visibili. I valori delle carte coperte vengono trasmessi solo al termine del nono turno.

## Test e build

```sh
npm test       # esegue i test delle regole, dell'interfaccia e del server
npm run build  # compila TypeScript e crea la versione di produzione in dist/
```

Il bot casuale sceglie una carta e un fronte tra quelli disponibili. Il bot strategico simula possibili combinazioni delle carte non ancora viste per stimare la mossa più efficace, senza conoscere le carte coperte dell'avversario.
