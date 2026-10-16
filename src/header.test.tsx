import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import App, { TopBar } from './App';

describe('Header layout consistency', () => {
  it('renders topbar with 3 distinct zones and proper classes in default solo mode in App', () => {
    const html = renderToString(<App />);
    expect(html).toContain('class="topbar"');
    expect(html).toContain('class="wordmark"');
    expect(html).toContain('class="mode-toggle"');
    expect(html).toContain('class="topbar-actions"');
    expect(html).toContain('Nuova partita');
    expect(html).toContain('Come si gioca');
  });

  it('renders TopBar with consistent structure in solo mode', () => {
    const html = renderToString(
      <TopBar
        gameMode="solo"
        mpPhase="lobby"
        onSelectMode={() => {}}
        onOpenRules={() => {}}
        onNewGame={() => {}}
        onCreateRoom={() => {}}
        onLeaveRoom={() => {}}
      />
    );

    // Verify left, center, right structure
    expect(html).toContain('class="wordmark"');
    expect(html).toContain('class="mode-toggle"');
    expect(html).toContain('class="topbar-actions"');

    // Both mode buttons are present in toggle
    expect(html).toContain('Vs Bot');
    expect(html).toContain('Online');
    expect(html).toMatch(/mode-btn active[^>]*>Vs Bot/);

    // Both rules and action buttons exist in right actions
    expect(html).toContain('Come si gioca');
    expect(html).toContain('Nuova partita');
    expect(html).toContain('class="new-game-button"');
  });

  it('renders TopBar with consistent structure and primary action in online lobby mode', () => {
    const html = renderToString(
      <TopBar
        gameMode="multiplayer"
        mpPhase="lobby"
        onSelectMode={() => {}}
        onOpenRules={() => {}}
        onNewGame={() => {}}
        onCreateRoom={() => {}}
        onLeaveRoom={() => {}}
      />
    );

    // Verify left, center, right structure
    expect(html).toContain('class="wordmark"');
    expect(html).toContain('class="mode-toggle"');
    expect(html).toContain('class="topbar-actions"');

    // Online button is active
    expect(html).toMatch(/mode-btn active[^>]*>.*?Online/);

    // Both rules and primary action buttons exist in right actions (no empty slots or shifting)
    expect(html).toContain('Come si gioca');
    expect(html).toContain('Crea stanza');
    expect(html).toContain('class="new-game-button"');
  });

  it('renders TopBar with consistent structure and cancel action in online waiting mode', () => {
    const html = renderToString(
      <TopBar
        gameMode="multiplayer"
        mpPhase="waiting_opponent"
        onSelectMode={() => {}}
        onOpenRules={() => {}}
        onNewGame={() => {}}
        onCreateRoom={() => {}}
        onLeaveRoom={() => {}}
      />
    );

    expect(html).toContain('class="wordmark"');
    expect(html).toContain('class="mode-toggle"');
    expect(html).toContain('class="topbar-actions"');
    expect(html).toContain('Come si gioca');
    expect(html).toContain('Annulla stanza');
    expect(html).toContain('class="new-game-button subtle"');
  });

  it('renders TopBar with consistent structure and leave action in online playing mode', () => {
    const html = renderToString(
      <TopBar
        gameMode="multiplayer"
        mpPhase="playing"
        onSelectMode={() => {}}
        onOpenRules={() => {}}
        onNewGame={() => {}}
        onCreateRoom={() => {}}
        onLeaveRoom={() => {}}
      />
    );

    expect(html).toContain('class="wordmark"');
    expect(html).toContain('class="mode-toggle"');
    expect(html).toContain('class="topbar-actions"');
    expect(html).toContain('Come si gioca');
    expect(html).toContain('Esci dalla stanza');
    expect(html).toContain('class="new-game-button subtle"');
  });
});
