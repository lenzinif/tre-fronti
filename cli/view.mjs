import { LANES, availableCards, getFrontWins, getMatchResult } from '../.cli/game.js';
import { translations } from './i18n.mjs';

const colors = { title: '1;32', you: '32', bot: '33', muted: '90', error: '31', strong: '1' };
export function paint(text, role, enabled = Boolean(process.stdout.isTTY) && !('NO_COLOR' in process.env) && process.env.TERM !== 'dumb') {
  return enabled ? `\x1b[${colors[role]}m${text}\x1b[0m` : text;
}

export const BANNER = `
  +---+ +---+ +---+
  | A | | B | | C |   Tre Fronti
  +---+ +---+ +---+
`;

function cardRows(values) {
  return [
    values.map((v) => v === '-' ? '.---.' : '+---+').join(' '),
    values.map((v) => `| ${v} |`).join(' '),
    values.map((v) => v === '-' ? "'---'" : '+---+').join(' '),
  ];
}

export function renderBoard(game, { columns = process.stdout.columns || 80, color, language = 'it' } = {}) {
  const t = translations[language];
  const over = game.completed === 9;
  const panels = LANES.map((lane) => {
    const rows = [];
    const border = '+---------------------+';
    const row = (text = '', role = 'muted') => rows.push(paint(`| ${text.padEnd(19)} |`, role, color));
    rows.push(paint(border, 'muted', color));
    row(`      ${t.front} ${lane}`, 'strong');
    row();
    for (const player of ['bot', 'you']) {
      const cards = game.board[lane][player];
      const hidden = player === 'bot' && !over && cards.some((card) => !card.revealed);
      const values = Array.from({ length: 3 }, (_, index) => {
        const card = cards[index];
        return !card ? '-' : player === 'bot' && !over && !card.revealed ? '?' : card.card;
      });
      const total = hidden ? '?' : cards.reduce((sum, card) => sum + card.card, 0);
      row(`${(player === 'you' ? t.you : 'BOT').padEnd(3)}      ${t.sum}: ${String(total).padStart(2)}`, player);
      for (const line of cardRows(values)) row(line, player);
      if (player === 'bot') row();
    }
    row();
    if (over) {
      const sum = (player) => game.board[lane][player].reduce((total, card) => total + card.card, 0);
      const difference = sum('you') - sum('bot');
      row(difference > 0 ? t.laneWin : difference < 0 ? t.laneLoss : t.laneDraw, difference > 0 ? 'you' : difference < 0 ? 'bot' : 'strong');
    } else {
      const remaining = 3 - game.board[lane].you.length;
      row(remaining ? t.slots(remaining) : t.full, remaining ? 'strong' : 'muted');
    }
    rows.push(paint(border, 'muted', color));
    return rows;
  });
  const lines = [
    '',
    paint(over ? t.finalBoard : `${t.turn(game.completed + 1)}   [${'#'.repeat(game.completed)}${'.'.repeat(9 - game.completed)}]`, 'strong', color),
    '',
  ];
  const perRow = Math.max(1, Math.min(3, Math.floor((columns + 2) / 25)));
  for (let start = 0; start < panels.length; start += perRow) {
    const group = panels.slice(start, start + perRow);
    lines.push(...group[0].map((_, index) => group.map((panel) => panel[index]).join('  ')), '');
  }
  if (over) {
    const wins = getFrontWins(game.board);
    const result = getMatchResult(game.board);
    lines.push(t.score(wins));
    lines.push(paint(result === 'you' ? t.win : result === 'bot' ? t.loss : t.draw, result === 'you' ? 'title' : 'strong', color));
  } else {
    lines.push(paint(t.legend, 'muted', color));
  }
  return lines.join('\n');
}

export function renderHand(game, { columns = process.stdout.columns || 80, color, language = 'it' } = {}) {
  const t = translations[language];
  const cards = availableCards(game.board, 'you');
  const perRow = Math.max(1, Math.floor((columns + 1) / 6));
  const lines = ['', paint(t.hand(cards.length), 'strong', color)];
  for (let start = 0; start < cards.length; start += perRow) {
    lines.push(...cardRows(cards.slice(start, start + perRow)).map((line) => paint(line, 'you', color)));
  }
  lines.push(paint(t.hint, 'muted', color));
  return lines.join('\n');
}
