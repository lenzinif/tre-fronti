import { execFileSync, spawnSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.cli.json']);
});

const moves = ['1 A', '2 A', '3 A', '4 B', '5 B', '6 B', '7 C', '8 C', '9 C'];

function play(answers, language = 'it') {
  const result = spawnSync(process.execPath, ['cli/index.mjs'], {
    input: `${language}\n${answers.join('\n')}\n`, encoding: 'utf8', timeout: 15000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  return result.stdout;
}

describe('gioco da terminale', () => {
  it.each(['1', '2'])('completa nove turni con il bot %s e rivela il tavolo finale', (difficulty) => {
    const output = play([difficulty, ...moves, 'n']);
    expect(output.match(/Hai giocato /g)).toHaveLength(9);
    expect(output).toContain('Fronti vinti:');
    const finalBoard = output.split('FINE PARTITA')[1].split('Un’altra partita?')[0];
    expect(finalBoard).not.toContain('?');
    expect(output).toContain('Alla prossima!');
    expect(output).not.toContain('\x1b[');
  });

  it('rifiuta input errati, carte usate e fronti pieni senza consumare turni', () => {
    const output = play(['2', 'ciao', '10 A', '1 D', 'aiuto', 'stato',
      '1 A', '1 B', '2 A', '3 A', '4 A', ...moves.slice(3), 'n']);
    expect(output.match(/Mossa non valida/g)).toHaveLength(3);
    expect(output).toContain('Hai già giocato questa carta.');
    expect(output).toContain('Hai già tre carte su questo fronte.');
    expect(output.match(/Hai giocato /g)).toHaveLength(9);
    expect(output).toContain('Fronti vinti:');
  });

  it('permette una seconda partita e termina anche quando finisce lo standard input', () => {
    const output = play(['2', ...moves, 's', '2', '1 A']);
    expect(output.match(/Avversario: bot casuale/g)).toHaveLength(2);
    expect(output.match(/Hai giocato /g)).toHaveLength(10);
    expect(output).toContain('Alla prossima!');
    expect(play(['esci'])).not.toContain('TURNO 1/9');
    expect(play(['2', 'esci'])).not.toContain('Hai giocato');
  });

  it('gestisce una partita inglese, errori, comandi e rivincita', () => {
    const output = play(['random', 'help', 'status', 'bad', '1 A', '1 B', '2 A', '3 A', '4 A', ...moves.slice(3), 'y', 'strategic', 'quit'], 'en');
    expect(output).toContain('HOW TO PLAY');
    expect(output).toContain('Invalid move.');
    expect(output).toContain('You have already played that card.');
    expect(output).toContain('You already have three cards on that front.');
    expect(output.match(/You played /g)).toHaveLength(9);
    expect(output).toContain('Fronts won:');
    expect(output).toContain('Opponent: strategic bot.');
    expect(output).toContain('Thanks for playing!');
    expect(output).not.toMatch(/Hai |somma|FRONTE|partita|aiuto/);
    const finalBoard = output.split('GAME OVER')[1].split('Play again?')[0];
    expect(finalBoard).not.toContain('?');
  });

  it.each(['it', 'en'])('nasconde il valore e la somma delle carte coperte del bot (%s)', async (language) => {
    const { renderBoard } = await import('./view.mjs');
    const game = {
      completed: 1,
      board: {
        A: { you: [{ card: 8, revealed: false }], bot: [{ card: 7, revealed: false }] },
        B: { you: [], bot: [] }, C: { you: [], bot: [] },
      },
    };
    const hidden = renderBoard(game, { color: false, language });
    const sum = language === 'it' ? 'somma' : 'total';
    expect(hidden).toContain(`BOT      ${sum}:  ?`);
    expect(hidden).toContain('| ? |');
    expect(hidden).toContain(`${sum}:  8`);
    expect(hidden).toContain('| 8 |');
    expect(hidden).not.toContain('7');
    expect(renderBoard({ ...game, completed: 9 }, { color: false, language })).toContain(`BOT      ${sum}:  7`);
  });
});
