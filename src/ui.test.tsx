import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import App, { FrontColumn, HistoryPanel } from './App';
import { newBoard, type Board, type RoundRecord } from './game';

describe('UI Bug Fixes Verification', () => {
  it('renders history-detail with history-row classes and AVVERSARIO label properly', () => {
    const mockHistory: RoundRecord[] = [
      {
        turn: 1,
        you: { card: 2, lane: 'C' },
        bot: { card: 4, lane: 'A' },
        revealed: true,
      },
      {
        turn: 2,
        you: { card: 5, lane: 'B' },
        bot: { card: 8, lane: 'B' },
        revealed: false,
      },
    ];

    const html = renderToString(
      <HistoryPanel
        history={mockHistory}
        isOver={false}
        opponentLabel="AVVERSARIO"
      />
    );

    // Verify history-row class presence
    expect(html).toContain('class="history-row"');

    // Verify both player labels exist
    expect(html).toContain('<b>TU</b>');
    expect(html).toContain('<b>AVVERSARIO</b>');

    // Verify values rendered
    expect(html).toMatch(/2<!-- --> <i>→<\/i> <!-- -->C/);
    expect(html).toMatch(/4<!-- --> <i>→<\/i> <!-- -->A/);
    expect(html).toMatch(/5<!-- --> <i>→<\/i> <!-- -->B/);
    expect(html).toContain('carta coperta <i>→</i> <!-- -->B');
    expect(html).toContain('stesso fronte · coperta');
  });

  it('renders HistoryPanel with BOT label for single player', () => {
    const mockHistory: RoundRecord[] = [
      {
        turn: 1,
        you: { card: 7, lane: 'A' },
        bot: { card: 3, lane: 'A' },
        revealed: true,
      },
    ];

    const html = renderToString(
      <HistoryPanel
        history={mockHistory}
        isOver={false}
        opponentLabel="BOT"
      />
    );

    expect(html).toContain('<b>TU</b>');
    expect(html).toContain('<b>BOT</b>');
    expect(html).toMatch(/7<!-- --> <i>→<\/i> <!-- -->A/);
    expect(html).toMatch(/3<!-- --> <i>→<\/i> <!-- -->A/);
  });

  it('distinguishes concealed own cards from visible own cards on a front and reveals them when game is over', () => {
    const board: Board = {
      ...newBoard(),
      A: {
        you: [
          { card: 6, lane: 'A', turn: 1, revealed: true },
          { card: 9, lane: 'A', turn: 2, revealed: false },
        ],
        bot: [
          { card: 4, lane: 'A', turn: 2, revealed: false },
        ],
      },
    };

    const inProgressHtml = renderToString(
      <FrontColumn lane="A" board={board} isOver={false} opponentLabel="BOT" />
    );

    expect(inProgressHtml).toContain('VISIBILE');
    expect(inProgressHtml).toContain('COPERTA');
    expect(inProgressHtml).toContain('playing-card own-card concealed-card');
    expect(inProgressHtml).toContain('card-secret-badge');

    const gameOverHtml = renderToString(
      <FrontColumn lane="A" board={board} isOver={true} opponentLabel="BOT" />
    );

    expect(gameOverHtml).toContain('VISIBILE');
    expect(gameOverHtml).not.toContain('COPERTA');
    expect(gameOverHtml).not.toContain('concealed-card');
    expect(gameOverHtml).not.toContain('card-secret-badge');
  });

  it('renders App with valid styles and structure', () => {
    const html = renderToString(<App />);
    expect(html).toContain('class="history-panel"');
    expect(html).toContain('class="legend-you-secret"');
  });
});

