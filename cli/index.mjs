import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { availableCards, createGame, openLanes, playRound } from '../.cli/game.js';
import { BANNER, paint, renderBoard, renderHand } from './view.mjs';
import { isHelp, isStatus, translations } from './i18n.mjs';

let language = 'it';
let t = translations[language];
const input = createInterface({ input: stdin, crlfDelay: Infinity });
// An iterator also preserves lines pasted together or supplied through a pipe.
const lines = input[Symbol.asyncIterator]();
let interrupted = false;
input.on('SIGINT', () => {
  interrupted = true;
  input.close();
});

async function ask(prompt) {
  if (interrupted) return null;
  stdout.write(paint(prompt, 'strong'));
  const answer = await lines.next();
  if (answer.done) return null;
  const value = answer.value.trim().toLowerCase();
  return ['esci', 'q', 'exit', 'quit'].includes(value) ? null : value;
}

function showState(game) {
  console.log(renderBoard(game, { language }));
  if (game.completed < 9) console.log(renderHand(game, { language }));
}

async function run() {
  console.log(paint(BANNER, 'title'));
  while (true) {
    const choice = await ask('Lingua / Language: 1 Italiano, 2 English [Invio / Enter: 1]: ');
    if (choice === null) return;
    if (['', '1', 'it', 'italiano'].includes(choice)) { language = 'it'; break; }
    if (['2', 'en', 'english'].includes(choice)) { language = 'en'; break; }
    console.log('Inserisci 1 o 2. / Enter 1 or 2.');
  }
  t = translations[language];
  console.log(`\n${t.help}`);
  while (true) {
    let difficulty;
    while (!difficulty) {
      const choice = await ask(t.opponentPrompt);
      if (choice === null) return;
      if (choice === '' || t.strategic.includes(choice)) difficulty = 'strategic';
      else if (t.random.includes(choice)) difficulty = 'random';
      else if (isHelp(choice)) console.log(t.help);
      else console.log(t.opponentError);
    }

    let game = createGame(difficulty);
    console.log(t.opponent(difficulty));
    showState(game);
    while (game.completed < 9) {
      const answer = await ask(t.movePrompt);
      if (answer === null) return;
      if (isHelp(answer)) {
        console.log(t.help);
        continue;
      }
      if (isStatus(answer)) {
        showState(game);
        continue;
      }
      const match = /^([1-9])\s+([abc])$/i.exec(answer);
      if (!match) {
        console.log(paint(t.invalidMove, 'error'));
        continue;
      }
      const move = { card: Number(match[1]), lane: match[2].toUpperCase() };
      // Validate with the shared rules so engine error text never leaks into another language.
      if (!availableCards(game.board, 'you').includes(move.card)) {
        console.log(paint(t.usedCard, 'error'));
        continue;
      }
      if (!openLanes(game.board, 'you').includes(move.lane)) {
        console.log(paint(t.fullLane, 'error'));
        continue;
      }
      game = playRound(game, move);
      const round = game.history.at(-1);
      console.log(paint(`\n${t.yourMove(round.you.card, round.you.lane)}`, 'you'));
      console.log(paint(round.revealed ? t.botMove(round.bot.card, round.bot.lane) : t.hiddenMove(round.bot.lane), 'bot'));
      showState(game);
    }

    while (true) {
      const again = await ask(t.replay);
      if (again === null || ['', 'n', 'no'].includes(again)) return;
      if (t.yes.includes(again)) break;
      console.log(t.replayError);
    }
  }
}

try {
  await run();
  console.log(`\n${t.goodbye}`);
} finally {
  input.close();
}
