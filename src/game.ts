export const LANES = ['A', 'B', 'C'] as const;
export type LaneId = (typeof LANES)[number];
export type Difficulty = 'random' | 'strategic';
export type PlayerId = 'you' | 'bot';

export type Move = { card: number; lane: LaneId };
export type PlayedCard = Move & { turn: number; revealed: boolean };
export type MaskedPlayedCard = Omit<PlayedCard, 'card'> & { card: number | null };
export type Lane = { you: PlayedCard[]; bot: PlayedCard[] };
export type MaskedLane = { you: PlayedCard[]; bot: MaskedPlayedCard[] };
export type RoundRecord = { turn: number; you: Move; bot: Move; revealed: boolean };
export type Board = Record<LaneId, Lane>;
export type MaskedBoard = Record<LaneId, MaskedLane>;

export type GameState = {
  completed: number;
  board: Board;
  history: RoundRecord[];
  botCommit: Move;
  difficulty: Difficulty;
};

export const newBoard = (): Board => ({
  A: { you: [], bot: [] },
  B: { you: [], bot: [] },
  C: { you: [], bot: [] },
});

export function availableCards(board: Board | MaskedBoard, player: PlayerId): number[] {
  const used = new Set(
    LANES.flatMap((lane) =>
      board[lane][player]
        .map(({ card }) => card)
        .filter((c): c is number => typeof c === 'number')
    )
  );
  return Array.from({ length: 9 }, (_, index) => index + 1).filter((card) => !used.has(card));
}

export function openLanes(board: Board | MaskedBoard, player: PlayerId): LaneId[] {
  return LANES.filter((lane) => board[lane][player].length < 3);
}

function randomChoice<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function randomMove(board: Board): Move {
  return { card: randomChoice(availableCards(board, 'bot')), lane: randomChoice(openLanes(board, 'bot')) };
}

function scoreCompletedBoard(board: Board, botMove: Move, botFuture: number[], humanFuture: number[]): number {
  const botSums: Record<LaneId, number> = { A: 0, B: 0, C: 0 };
  const humanSums: Record<LaneId, number> = { A: 0, B: 0, C: 0 };
  for (const lane of LANES) {
    botSums[lane] = board[lane].bot.reduce((sum, play) => sum + play.card, 0);
    // The bot can total face-up human cards only. A same-front card stays secret
    // to the bot as well as to the public until the final reveal.
    humanSums[lane] = board[lane].you.filter((play) => play.revealed).reduce((sum, play) => sum + play.card, 0);
  }
  botSums[botMove.lane] += botMove.card;

  const botSlots: LaneId[] = LANES.flatMap((lane) => Array.from({ length: 3 - board[lane].bot.length - (lane === botMove.lane ? 1 : 0) }, () => lane));
  const humanSlots: LaneId[] = LANES.flatMap((lane) => Array.from({ length: 3 - board[lane].you.filter((play) => play.revealed).length }, () => lane));
  const shuffledBot = shuffled(botFuture);
  const shuffledHuman = shuffled(humanFuture);
  for (let index = 0; index < botSlots.length; index += 1) botSums[botSlots[index]] += shuffledBot[index];
  for (let index = 0; index < humanSlots.length; index += 1) humanSums[humanSlots[index]] += shuffledHuman[index];

  let botFronts = 0;
  let humanFronts = 0;
  for (const lane of LANES) {
    if (botSums[lane] > humanSums[lane]) botFronts += 1;
    else if (humanSums[lane] > botSums[lane]) humanFronts += 1;
  }
  if (botFronts >= 2) return 1;
  if (humanFronts >= 2) return 0;
  return 0.5;
}

/**
 * The strategic bot estimates a move by completing both boards at random.
 * It sees its own cards, the opponent's face-up cards, and nothing else.
 * Hidden opponent cards remain among the possible unseen values.
 */
export function chooseBotMove(board: Board, difficulty: Difficulty): Move {
  if (difficulty === 'random') return randomMove(board);

  const knownHuman = new Set(LANES.flatMap((lane) => board[lane].you.filter((play) => play.revealed).map(({ card }) => card)));
  const possibleHuman = Array.from({ length: 9 }, (_, index) => index + 1).filter((card) => !knownHuman.has(card));
  const myHand = availableCards(board, 'bot');
  const candidates: Array<{ move: Move; score: number }> = [];

  for (const card of myHand) {
    for (const lane of openLanes(board, 'bot')) {
      const move = { card, lane };
      const futureBot = myHand.filter((other) => other !== card);
      let score = 0;
      const samples = 180;
      for (let sample = 0; sample < samples; sample += 1) {
        score += scoreCompletedBoard(board, move, futureBot, possibleHuman);
      }
      candidates.push({ move, score: score / samples });
    }
  }

  const bestScore = Math.max(...candidates.map(({ score }) => score));
  const tied = candidates.filter(({ score }) => Math.abs(score - bestScore) < 0.02);
  return randomChoice(tied).move;
}

export function createGame(difficulty: Difficulty): GameState {
  const board = newBoard();
  return { completed: 0, board, history: [], botCommit: chooseBotMove(board, difficulty), difficulty };
}

export function playSimultaneousRound(
  board: Board,
  p1Move: Move,
  p2Move: Move,
  turn: number
): { board: Board; record: RoundRecord } {
  if (turn > 9) throw new Error('La partita è già terminata.');
  if (!availableCards(board, 'you').includes(p1Move.card)) throw new Error('Questa carta è già stata giocata dal Giocatore 1.');
  if (!openLanes(board, 'you').includes(p1Move.lane)) throw new Error('Questo fronte ha già tre carte per il Giocatore 1.');
  if (!availableCards(board, 'bot').includes(p2Move.card)) throw new Error('Questa carta è già stata giocata dal Giocatore 2.');
  if (!openLanes(board, 'bot').includes(p2Move.lane)) throw new Error('Questo fronte ha già tre carte per il Giocatore 2.');

  const revealed = p1Move.lane !== p2Move.lane;
  const newB: Board = {
    A: { you: [...board.A.you], bot: [...board.A.bot] },
    B: { you: [...board.B.you], bot: [...board.B.bot] },
    C: { you: [...board.C.you], bot: [...board.C.bot] },
  };
  newB[p1Move.lane].you.push({ ...p1Move, turn, revealed });
  newB[p2Move.lane].bot.push({ ...p2Move, turn, revealed });

  return {
    board: newB,
    record: { turn, you: p1Move, bot: p2Move, revealed },
  };
}

export function playRound(game: GameState, you: Move): GameState {
  if (game.completed >= 9) throw new Error('La partita è già terminata.');
  if (!availableCards(game.board, 'you').includes(you.card)) throw new Error('Questa carta è già stata giocata.');
  if (!openLanes(game.board, 'you').includes(you.lane)) throw new Error('Questo fronte ha già tre carte.');
  const bot = game.botCommit;
  const turn = game.completed + 1;
  const { board, record } = playSimultaneousRound(game.board, you, bot, turn);

  const completed = turn;
  const history = [...game.history, record];
  const next = { ...game, completed, board, history };
  return completed < 9 ? { ...next, botCommit: chooseBotMove(board, game.difficulty) } : next;
}

export function getZoneTotals(board: Board | MaskedBoard): Record<LaneId, { you: number; bot: number }> {
  return Object.fromEntries(LANES.map((lane) => [lane, {
    you: board[lane].you.reduce((sum, play) => sum + (play.card ?? 0), 0),
    bot: board[lane].bot.reduce((sum, play) => sum + (play.card ?? 0), 0),
  }])) as Record<LaneId, { you: number; bot: number }>;
}

export function getFrontWins(board: Board): { you: number; bot: number; ties: number } {
  const totals = getZoneTotals(board);
  return LANES.reduce((wins, lane) => {
    if (totals[lane].you > totals[lane].bot) wins.you += 1;
    else if (totals[lane].bot > totals[lane].you) wins.bot += 1;
    else wins.ties += 1;
    return wins;
  }, { you: 0, bot: 0, ties: 0 });
}

export function getMatchResult(board: Board): PlayerId | 'draw' {
  const wins = getFrontWins(board);
  if (wins.you >= 2) return 'you';
  if (wins.bot >= 2) return 'bot';
  return 'draw';
}
