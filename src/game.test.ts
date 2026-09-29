import { describe, expect, it, vi } from 'vitest';
import {
  availableCards,
  chooseBotMove,
  createGame,
  getFrontWins,
  getMatchResult,
  LANES,
  newBoard,
  openLanes,
  playRound,
  playSimultaneousRound,
  type Board,
  type GameState,
} from './game';

describe('regole di Tre Fronti', () => {
  it('distribuisce ciascuna carta da 1 a 9 una sola volta e riempie tre carte per fronte', () => {
    let game = createGame('random');
    expect(game.botCommit.card).toBeGreaterThanOrEqual(1);
    expect(game.botCommit.card).toBeLessThanOrEqual(9);

    for (let turn = 0; turn < 9; turn += 1) {
      const card = availableCards(game.board, 'you')[0];
      const lane = openLanes(game.board, 'you')[0];
      game = playRound(game, { card, lane });
      for (const id of LANES) {
        expect(game.board[id].you.length).toBeLessThanOrEqual(3);
        expect(game.board[id].bot.length).toBeLessThanOrEqual(3);
      }
    }

    expect(game.completed).toBe(9);
    for (const id of LANES) {
      expect(game.board[id].you).toHaveLength(3);
      expect(game.board[id].bot).toHaveLength(3);
    }
    for (const player of ['you', 'bot'] as const) {
      expect(LANES.flatMap((id) => game.board[id][player].map((play) => play.card)).sort((a, b) => a - b))
        .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  });

  it('tiene mosse già bloccate per il bot e copre il turno se le zone coincidono', () => {
    const game = createGame('random');
    const botChoice = game.botCommit;
    const played = playRound(game, { card: availableCards(game.board, 'you')[0], lane: botChoice.lane });
    expect(played.board[botChoice.lane].you[0].revealed).toBe(false);
    expect(played.board[botChoice.lane].bot[0].revealed).toBe(false);
    expect(played.history[0].bot).toEqual(botChoice);
  });

  it('rivela entrambe le mosse quando i giocatori scelgono zone diverse', () => {
    const game = createGame('random');
    const playerLane = openLanes(game.board, 'you').find((lane) => lane !== game.botCommit.lane)!;
    const played = playRound(game, { card: availableCards(game.board, 'you')[0], lane: playerLane });
    expect(played.board[playerLane].you[0].revealed).toBe(true);
    expect(played.board[game.botCommit.lane].bot[0].revealed).toBe(true);
  });

  it('risolve un turno simultaneo tra due giocatori umani', () => {
    const board = newBoard();
    const res1 = playSimultaneousRound(board, { card: 7, lane: 'A' }, { card: 4, lane: 'A' }, 1);
    expect(res1.record.revealed).toBe(false);
    expect(res1.board.A.you[0].revealed).toBe(false);
    expect(res1.board.A.bot[0].revealed).toBe(false);

    const res2 = playSimultaneousRound(res1.board, { card: 8, lane: 'B' }, { card: 3, lane: 'C' }, 2);
    expect(res2.record.revealed).toBe(true);
    expect(res2.board.B.you[0].revealed).toBe(true);
    expect(res2.board.C.bot[0].revealed).toBe(true);
  });

  it('vieta di riutilizzare carte e di giocare in un fronte pieno', () => {
    let game = createGame('random');
    for (let turn = 0; turn < 3; turn += 1) {
      game = playRound(game, { card: availableCards(game.board, 'you')[0], lane: 'A' });
    }
    expect(() => playRound(game, { card: 1, lane: 'B' })).toThrow('Questa carta è già stata giocata.');
    expect(() => playRound(game, { card: availableCards(game.board, 'you')[0], lane: 'A' })).toThrow('Questo fronte ha già tre carte.');
  });

  it('dichiara vittoria solo con almeno due fronti e pareggio negli altri casi', () => {
    const board: Board = {
      A: { you: [{ card: 9, lane: 'A', turn: 1, revealed: true }], bot: [{ card: 1, lane: 'A', turn: 1, revealed: true }] },
      B: { you: [{ card: 8, lane: 'B', turn: 1, revealed: true }], bot: [{ card: 2, lane: 'B', turn: 1, revealed: true }] },
      C: { you: [{ card: 1, lane: 'C', turn: 1, revealed: true }], bot: [{ card: 9, lane: 'C', turn: 1, revealed: true }] },
    };
    expect(getFrontWins(board)).toEqual({ you: 2, bot: 1, ties: 0 });
    const drawBoard: Board = {
      ...board,
      B: { you: [{ card: 2, lane: 'B', turn: 1, revealed: true }], bot: [{ card: 2, lane: 'B', turn: 1, revealed: true }] },
      C: { you: [{ card: 1, lane: 'C', turn: 1, revealed: true }], bot: [{ card: 9, lane: 'C', turn: 1, revealed: true }] },
    };
    expect(getFrontWins(drawBoard)).toEqual({ you: 1, bot: 1, ties: 1 });
    expect(getMatchResult(board)).toBe('you');
    expect(getMatchResult(drawBoard)).toBe('draw');
  });

  it('non usa il valore delle carte avversarie coperte per scegliere', () => {
    const hiddenBoard = (privateCard: number): Board => ({
      A: { you: [{ card: privateCard, lane: 'A', turn: 1, revealed: false }], bot: [{ card: 2, lane: 'A', turn: 1, revealed: false }] },
      B: { you: [], bot: [] },
      C: { you: [], bot: [] },
    });
    const game: GameState = { ...createGame('strategic'), board: hiddenBoard(1) };
    const seed = (initial: number) => {
      let value = initial;
      vi.spyOn(Math, 'random').mockImplementation(() => {
        value = (value * 48271) % 2147483647;
        return value / 2147483647;
      });
    };
    seed(7);
    const first = chooseBotMove(game.board, 'strategic');
    vi.restoreAllMocks();
    seed(7);
    const second = chooseBotMove(hiddenBoard(9), 'strategic');
    vi.restoreAllMocks();
    expect(first).toEqual(second);
  });
});
