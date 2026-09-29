export const translations = {
  it: {
    help: `COME SI GIOCA

Tu e il bot avete ciascuno nove carte, numerate da 1 a 9. Il tavolo è diviso in tre fronti: A, B e C. Per vincere la partita devi ottenere la somma più alta in almeno due fronti.

Ogni turno scegli una carta dalla tua mano e il fronte in cui giocarla. Il bot sceglie la propria mossa prima di conoscere la tua. Ogni carta si può usare una sola volta e ogni fronte può contenere al massimo tre carte per giocatore.

Se giocate su fronti diversi, entrambe le carte vengono scoperte. Se scegliete lo stesso fronte, le carte restano coperte fino alla fine della partita. Puoi sempre vedere le tue carte, anche quando sono coperte per il bot.

Dopo nove turni si scoprono tutte le carte e si confrontano le somme di ciascun fronte. Vince chi conquista almeno due fronti. Se nessuno ci riesce, la partita è patta. Un fronte con due somme uguali non viene assegnato a nessuno.

COMANDI

- 7 B: gioca la carta 7 sul fronte B. Conferma con Invio.
- aiuto: leggi le regole.
- stato: rivedi il tavolo e la tua mano.
- esci: chiudi il gioco. Puoi anche premere Ctrl+C.`,
    opponentPrompt: '\nScegli il bot: 1 strategico, 2 casuale [Invio: 1]: ',
    opponentError: 'Inserisci 1 o 2, oppure scrivi esci.',
    strategic: ['1', 'strategico'], random: ['2', 'casuale'],
    opponent: (difficulty) => `\nAvversario: bot ${difficulty === 'strategic' ? 'strategico' : 'casuale'}.`,
    movePrompt: '\nLa tua mossa > ',
    invalidMove: 'Mossa non valida. Scrivi il numero della carta e il fronte, per esempio 7 B.',
    usedCard: 'Hai già giocato questa carta. Scegline una dalla tua mano.',
    fullLane: 'Hai già tre carte su questo fronte. Scegline un altro.',
    yourMove: (card, lane) => `Hai giocato ${card} sul fronte ${lane}.`,
    botMove: (card, lane) => `Il bot ha giocato ${card} sul fronte ${lane}.`,
    hiddenMove: (lane) => `Il bot ha giocato una carta coperta sul fronte ${lane}.`,
    replay: '\nUn’altra partita? [s/N]: ',
    yes: ['s', 'si', 'sì'], replayError: 'Scrivi s per rigiocare o n per uscire.',
    goodbye: 'Alla prossima!',
    front: 'FRONTE', you: 'TU', sum: 'somma',
    laneWin: 'VINCI TU', laneLoss: 'VINCE IL BOT', laneDraw: 'PARI', full: 'PIENO',
    slots: (count) => `Posti liberi: ${count}`,
    finalBoard: 'FINE PARTITA', turn: (count) => `TURNO ${count}/9`,
    score: (wins) => `Fronti vinti: tu ${wins.you}, bot ${wins.bot}. Fronti pari: ${wins.ties}.`,
    win: 'Hai vinto!', loss: 'Ha vinto il bot.', draw: 'Pareggio.',
    legend: 'Legenda: ? carta coperta; - posto libero.',
    hand: (count) => `LA TUA MANO (${count} ${count === 1 ? 'carta' : 'carte'})`,
    hint: 'Gioca una carta, per esempio 7 B. Comandi: aiuto, stato, esci.',
  },
  en: {
    help: `HOW TO PLAY

You and the bot each have nine cards, numbered 1 to 9. The board has three fronts: A, B and C. To win the game, you need the higher total on at least two fronts.

Each turn, choose a card from your hand and a front to play it on. The bot picks its move before seeing yours. Each card can only be played once, and each front holds up to three cards per player.

If you play on different fronts, both cards are revealed. If you choose the same front, both cards stay face down until the end of the game. You can always see your own cards, even when they are hidden from the bot.

After nine turns, all cards are revealed and the totals on each front are compared. Whoever wins at least two fronts wins the game. If neither player does, the game is a draw. A tied front counts as a win for neither player.

COMMANDS

- 7 B: play card 7 on front B. Press Enter to confirm.
- help: read the rules.
- status: show the board and your hand.
- quit: leave the game. You can also press Ctrl+C.`,
    opponentPrompt: '\nChoose a bot: 1 strategic, 2 random [Enter: 1]: ',
    opponentError: 'Enter 1 or 2, or type quit.',
    strategic: ['1', 'strategic'], random: ['2', 'random'],
    opponent: (difficulty) => `\nOpponent: ${difficulty === 'strategic' ? 'strategic' : 'random'} bot.`,
    movePrompt: '\nYour move > ',
    invalidMove: 'Invalid move. Enter a card number and a front, for example 7 B.',
    usedCard: 'You have already played that card. Choose one from your hand.',
    fullLane: 'You already have three cards on that front. Choose another front.',
    yourMove: (card, lane) => `You played ${card} on front ${lane}.`,
    botMove: (card, lane) => `The bot played ${card} on front ${lane}.`,
    hiddenMove: (lane) => `The bot played a face-down card on front ${lane}.`,
    replay: '\nPlay again? [y/N]: ',
    yes: ['y', 'yes'], replayError: 'Type y to play again or n to quit.',
    goodbye: 'Thanks for playing!',
    front: 'FRONT', you: 'YOU', sum: 'total',
    laneWin: 'YOU WIN', laneLoss: 'BOT WINS', laneDraw: 'TIED', full: 'FULL',
    slots: (count) => `Your free slots: ${count}`,
    finalBoard: 'GAME OVER', turn: (count) => `TURN ${count}/9`,
    score: (wins) => `Fronts won: you ${wins.you}, bot ${wins.bot}. Tied fronts: ${wins.ties}.`,
    win: 'You win!', loss: 'The bot wins.', draw: 'Draw.',
    legend: 'Key: ? face-down card; - empty slot.',
    hand: (count) => `YOUR HAND (${count} ${count === 1 ? 'card' : 'cards'})`,
    hint: 'Play a card, for example 7 B. Commands: help, status, quit.',
  },
};

// Both command sets work in either language.
export const isHelp = (value) => ['aiuto', 'help', '?'].includes(value);
export const isStatus = (value) => ['stato', 'status'].includes(value);
