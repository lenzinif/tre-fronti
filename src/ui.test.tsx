import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import App, { HistoryPanel } from './App';
import type { RoundRecord } from './game';

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

  it('renders App with valid styles and structure', () => {
    const html = renderToString(<App />);
    expect(html).toContain('class="history-panel"');
  });
});
