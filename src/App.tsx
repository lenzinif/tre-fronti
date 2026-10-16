import { useEffect, useRef, useState } from 'react';
import {
  availableCards,
  createGame,
  getFrontWins,
  getMatchResult,
  getZoneTotals,
  LANES,
  openLanes,
  playRound,
  type Board,
  type Difficulty,
  type GameState,
  type LaneId,
  type MaskedBoard,
  type MaskedPlayedCard,
  type PlayedCard,
  type RoundRecord,
} from './game';

export type GameMode = 'solo' | 'multiplayer';
export type MultiplayerPhase = 'lobby' | 'waiting_opponent' | 'playing';

type MaskedGameState = {
  roomCode: string;
  seat: 'p1' | 'p2';
  board: MaskedBoard;
  history: RoundRecord[];
  completed: number;
  isOver: boolean;
  wins: { you: number; bot: number; ties: number } | null;
  matchOutcome: 'you' | 'bot' | 'draw' | null;
  forfeit?: boolean;
  yourMoveLocked: boolean;
  opponentMoveLocked: boolean;
  rematchRequested: boolean;
  opponentRematchRequested: boolean;
};

function CardBack() {
  return <span className="card-back" aria-label="Carta coperta"><span>✳</span></span>;
}

function SecretEyeIcon() {
  return (
    <svg
      className="secret-eye-svg"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 2l12 12" />
      <path d="M6.6 6.6a2 2 0 0 0 2.8 2.8" />
      <path d="M3.7 5.8C2.5 6.9 1.8 8 1.8 8s2.5 4.5 6.2 4.5c1.2 0 2.3-.4 3.2-1" />
      <path d="M6.2 3.7c.6-.1 1.2-.2 1.8-.2 3.7 0 6.2 4.5 6.2 4.5a11.3 11.3 0 0 1-1.9 2.4" />
    </svg>
  );
}

export function FrontColumn({
  lane,
  board,
  isOver,
  opponentLabel = 'BOT',
}: {
  lane: LaneId;
  board: Board | MaskedBoard;
  isOver: boolean;
  opponentLabel?: string;
}) {
  const front = board[lane];
  const totals = getZoneTotals(board)[lane];
  const concealed = front.bot.filter((play) => !play.revealed).length;
  const youWon = isOver && totals.you > totals.bot;
  const botWon = isOver && totals.bot > totals.you;
  const cards = (player: 'you' | 'bot') => Array.from({ length: 3 }, (_, index) => {
    const play: PlayedCard | MaskedPlayedCard | undefined = front[player][index];
    const hiddenFromYou = player === 'bot' && Boolean(play && !play.revealed && !isOver);
    const hiddenFromOpponent = player === 'you' && Boolean(play && !play.revealed && !isOver);
    const caption = player === 'you' ? (hiddenFromOpponent ? 'COPERTA' : 'VISIBILE') : opponentLabel;
    return (
      <div className={`card-slot ${play ? 'filled' : ''} ${hiddenFromYou ? 'covered' : ''}`} key={`${player}-${index}`}>
        {play ? hiddenFromYou ? <CardBack /> : (
          <span
            className={`playing-card ${player === 'you' ? 'own-card' : 'opponent-card'}${hiddenFromOpponent ? ' concealed-card' : ''}`}
            title={hiddenFromOpponent ? "Carta coperta: l'avversario non vede questo valore fino a fine partita" : undefined}
          >
            {hiddenFromOpponent && (
              <span className="card-secret-badge" aria-label="Carta coperta all'avversario">
                <SecretEyeIcon />
              </span>
            )}
            <span className="card-value">{play.card}</span>
            <span className="card-caption">{caption}</span>
          </span>
        ) : <span className="empty-card" aria-hidden="true" />}
      </div>
    );
  });

  const botTotal = concealed > 0 && !isOver ? '?' : totals.bot;
  return (
    <section className={`front-column ${youWon ? 'won' : ''} ${botWon ? 'lost' : ''}`} aria-label={`Fronte ${lane}`}>
      <header className="front-heading">
        <span className="front-letter">{lane}</span>
        <div><h3>Fronte {lane}</h3><span className="front-count">{front.you.length}/3 · {front.bot.length}/3 carte</span></div>
        {youWon ? <span className="front-result" aria-label="Fronte vinto">✦</span> : null}
        {botWon ? <span className="front-result bot-result" aria-label="Fronte perso">·</span> : null}
      </header>
      <div className="side-label"><span>{opponentLabel}</span><span className="lane-total">{botTotal}</span></div>
      <div className="card-row bot-row" aria-label={`Carte di ${opponentLabel}`}>{cards('bot')}</div>
      <div className="front-divider"><span /><small>{concealed > 0 && !isOver ? `${concealed} coperta` : 'somma'}</small><span /></div>
      <div className="card-row you-row" aria-label="Le tue carte">{cards('you')}</div>
      <div className="side-label you-label"><span>TU</span><span className="lane-total">{totals.you}</span></div>
    </section>
  );
}

export function HistoryPanel({
  history,
  isOver,
  opponentLabel = 'BOT',
}: {
  history: RoundRecord[];
  isOver: boolean;
  opponentLabel?: string;
}) {
  if (!history.length) {
    return <div className="history-empty"><span className="history-sparkle">✳</span><p>Le mosse appariranno qui, un turno alla volta.</p></div>;
  }
  return <ol className="history-list">
    {[...history].reverse().map((record) => {
      const faceUp = record.revealed || isOver;
      return <li className="history-item" key={record.turn}>
        <span className="history-turn">{String(record.turn).padStart(2, '0')}</span>
        <div className="history-detail">
          <div className="history-row"><b>TU</b><span>{record.you.card} <i>→</i> {record.you.lane}</span></div>
          <div className="history-row"><b>{opponentLabel}</b><span>{faceUp ? <>{record.bot.card} <i>→</i> {record.bot.lane}</> : <>carta coperta <i>→</i> {record.bot.lane}</>}</span></div>
          {!record.revealed && <small>{isOver ? 'rivelata a fine partita' : 'stesso fronte · coperta'}</small>}
        </div>
        <span className={`history-state ${faceUp ? 'visible' : ''}`} title={faceUp ? 'Mosse rivelate' : 'Mosse coperte'}>{faceUp ? '↗' : '◌'}</span>
      </li>;
    })}
  </ol>;
}

function getWsUrl(): string {
  const isHttps = window.location.protocol === 'https:';
  const proto = isHttps ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export function TopBar({
  gameMode,
  mpPhase,
  onSelectMode,
  onOpenRules,
  onNewGame,
  onCreateRoom,
  onLeaveRoom,
}: {
  gameMode: GameMode;
  mpPhase: MultiplayerPhase;
  onSelectMode: (mode: GameMode) => void;
  onOpenRules: () => void;
  onNewGame: () => void;
  onCreateRoom: () => void;
  onLeaveRoom: () => void;
}) {
  return (
    <header className="topbar">
      <a className="wordmark" href="#inizio" aria-label="Tre Fronti, inizio">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span>TRE<span className="wordmark-light">FRONTI</span></span>
      </a>

      <div className="mode-toggle" role="group" aria-label="Modalità di gioco">
        <button
          type="button"
          className={`mode-btn ${gameMode === 'solo' ? 'active' : ''}`}
          onClick={() => onSelectMode('solo')}
        >
          Vs Bot
        </button>
        <button
          type="button"
          className={`mode-btn ${gameMode === 'multiplayer' ? 'active' : ''}`}
          onClick={() => onSelectMode('multiplayer')}
        >
          <span className="live-dot" /> Online
        </button>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="text-button rules-button"
          onClick={onOpenRules}
          aria-label="Come si gioca"
          title="Come si gioca"
        >
          <span className="question-mark" aria-hidden="true">?</span> Come si gioca
        </button>
        {gameMode === 'solo' ? (
          <button
            type="button"
            className="new-game-button"
            onClick={onNewGame}
            title="Inizia una nuova partita contro il bot"
          >
            <span aria-hidden="true">↻</span> Nuova partita
          </button>
        ) : mpPhase === 'lobby' ? (
          <button
            type="button"
            className="new-game-button"
            onClick={onCreateRoom}
            title="Crea una nuova stanza per giocare online"
          >
            <span aria-hidden="true">+</span> Crea stanza
          </button>
        ) : mpPhase === 'waiting_opponent' ? (
          <button
            type="button"
            className="new-game-button subtle"
            onClick={onLeaveRoom}
            title="Annulla l'attesa ed esci dalla stanza"
          >
            <span aria-hidden="true">✕</span> Annulla stanza
          </button>
        ) : (
          <button
            type="button"
            className="new-game-button subtle"
            onClick={onLeaveRoom}
            title="Esci dalla stanza multiplayer"
          >
            <span aria-hidden="true">✕</span> Esci dalla stanza
          </button>
        )}
      </div>
    </header>
  );
}

function App() {
  const [gameMode, setGameMode] = useState<GameMode>('solo');
  const [game, setGame] = useState<GameState>(() => createGame('strategic'));
  const [selectedCard, setSelectedCard] = useState<number | null>(1);
  const [selectedLane, setSelectedLane] = useState<LaneId>('A');
  const [showRules, setShowRules] = useState(false);
  const rulesDialogRef = useRef<HTMLDialogElement>(null);

  // Multiplayer state
  const [mpPhase, setMpPhase] = useState<MultiplayerPhase>('lobby');
  const [mpRoomCode, setMpRoomCode] = useState<string | null>(null);
  const [mpState, setMpState] = useState<MaskedGameState | null>(null);
  const [mpError, setMpError] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Auto-fill room code from URL query param if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setJoinCodeInput(room.toUpperCase());
      setGameMode('multiplayer');
    }
  }, []);

  useEffect(() => {
    if (!showRules) return;
    const dialog = rulesDialogRef.current;
    if (!dialog) return;

    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [showRules]);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  function ensureWsConnection(onReady: (ws: WebSocket) => void) {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        onReady(wsRef.current);
        return;
      }
      if (wsRef.current.readyState === WebSocket.CONNECTING) {
        const currentWs = wsRef.current;
        const prevOpen = currentWs.onopen;
        currentWs.onopen = (e) => {
          if (prevOpen) (prevOpen as (ev: Event) => void)(e);
          onReady(currentWs);
        };
        return;
      }
    }

    setMpError(null);
    let ws: WebSocket;
    try {
      ws = new WebSocket(getWsUrl());
    } catch {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${window.location.hostname}:3001`);
    }

    wsRef.current = ws;

    ws.onopen = () => {
      onReady(ws);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (err) {
        console.error('Errore parsing messaggio server:', err);
      }
    };

    ws.onerror = () => {
      setMpError('Impossibile connettersi al server. Assicurati che sia avviato (npm run server).');
    };

    ws.onclose = () => {
      wsRef.current = null;
    };
  }

  function handleServerMessage(msg: { type: string; [key: string]: any }) {
    switch (msg.type) {
      case 'ROOM_CREATED':
        setMpRoomCode(msg.roomCode);
        setMpPhase('waiting_opponent');
        setMpError(null);
        break;

      case 'ROOM_JOINED':
        setMpRoomCode(msg.roomCode);
        setMpError(null);
        break;

      case 'GAME_START':
        setMpPhase('playing');
        setMpState(msg.state);
        setMpError(null);
        setSelectedCard(availableCards(msg.state.board, 'you')[0] ?? null);
        setSelectedLane(openLanes(msg.state.board, 'you')[0] ?? 'A');
        break;

      case 'MOVE_ACCEPTED':
      case 'OPPONENT_MOVED':
        setMpState(msg.state);
        break;

      case 'ROUND_RESOLVED':
        setMpState(msg.state);
        setSelectedCard(availableCards(msg.state.board, 'you')[0] ?? null);
        setSelectedLane(openLanes(msg.state.board, 'you')[0] ?? 'A');
        break;

      case 'GAME_OVER':
        setMpState(msg.state);
        break;

      case 'REMATCH_ACCEPTED':
      case 'REMATCH_OFFERED':
        setMpState(msg.state);
        break;

      case 'OPPONENT_DISCONNECTED':
        if (msg.state) {
          setMpState(msg.state);
        } else if (mpState) {
          setMpState((prev) => (prev ? { ...prev, isOver: true } : null));
        }
        setMpError(msg.message || "L'avversario si è disconnesso dalla partita.");
        break;

      case 'ERROR':
        setMpError(msg.message);
        break;

      default:
        break;
    }
  }

  function handleCreateRoom() {
    ensureWsConnection((ws) => {
      ws.send(JSON.stringify({ type: 'CREATE_ROOM' }));
    });
  }

  function handleJoinRoom() {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) {
      setMpError('Inserisci un codice stanza valido.');
      return;
    }
    ensureWsConnection((ws) => {
      ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode: code }));
    });
  }

  function handleLeaveRoom() {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'LEAVE_ROOM' }));
    }
    setMpPhase('lobby');
    setMpState(null);
    setMpRoomCode(null);
    setMpError(null);
  }

  function handleRematch() {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'REMATCH' }));
    }
  }

  function copyInviteLink() {
    if (!mpRoomCode) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${mpRoomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  }

  // Active game projection (Single Player vs Multiplayer)
  const isMultiplayer = gameMode === 'multiplayer';
  const activeBoard = isMultiplayer && mpState ? mpState.board : game.board;
  const activeHistory = isMultiplayer && mpState ? mpState.history : game.history;
  const activeCompleted = isMultiplayer && mpState ? mpState.completed : game.completed;
  const activeIsOver = isMultiplayer && mpState ? mpState.isOver : game.completed === 9;
  const activeWins = isMultiplayer && mpState ? mpState.wins : (activeIsOver ? getFrontWins(game.board) : null);
  const activeOutcome = isMultiplayer && mpState ? mpState.matchOutcome : (activeIsOver ? getMatchResult(game.board) : null);

  const cards = availableCards(activeBoard, 'you');
  const lanes = openLanes(activeBoard, 'you');
  const opponentLabel = isMultiplayer ? 'AVVERSARIO' : 'BOT';
  const isForfeit = isMultiplayer && Boolean(mpState?.forfeit);
  const result = isForfeit
    ? (activeOutcome === 'you' ? "Vittoria per abbandono dell'avversario." : 'Partita abbandonata.')
    : activeOutcome === 'you'
      ? 'Vittoria.'
      : activeOutcome === 'bot'
        ? (isMultiplayer ? "Ha vinto l'avversario." : 'Ha vinto il bot.')
        : activeOutcome === 'draw'
          ? 'Pareggio.'
          : null;

  const turnNumber = Math.min(activeCompleted + 1, 9);

  function startNewGame(difficulty: Difficulty = game.difficulty) {
    setGame(createGame(difficulty));
    setSelectedCard(1);
    setSelectedLane('A');
  }

  function changeDifficulty(difficulty: Difficulty) {
    startNewGame(difficulty);
  }

  function confirmMove() {
    if (selectedCard === null || activeIsOver || !lanes.includes(selectedLane)) return;

    if (isMultiplayer) {
      if (!mpState || mpState.yourMoveLocked || mpState.isOver) return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setMpError('Connessione al server persa. Riprova o ricarica la pagina.');
        return;
      }
      wsRef.current.send(JSON.stringify({
        type: 'SUBMIT_MOVE',
        move: { card: selectedCard, lane: selectedLane },
      }));
    } else {
      const next = playRound(game, { card: selectedCard, lane: selectedLane });
      setGame(next);
      setSelectedCard(availableCards(next.board, 'you')[0] ?? null);
      setSelectedLane(openLanes(next.board, 'you')[0] ?? 'A');
    }
  }

  return (
    <main className="app-shell">
      <TopBar
        gameMode={gameMode}
        mpPhase={mpPhase}
        onSelectMode={(mode) => {
          setGameMode(mode);
          if (mode === 'solo') setMpError(null);
        }}
        onOpenRules={() => setShowRules(true)}
        onNewGame={() => startNewGame()}
        onCreateRoom={handleCreateRoom}
        onLeaveRoom={handleLeaveRoom}
      />

      <section className="game-intro" id="inizio">
        <div className="intro-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> {isMultiplayer ? 'PARTITA ONLINE' : 'DUELLO IN NOVE TURNI'}</div>
          <h1>{isMultiplayer ? 'Sfida online' : 'Nove carte.'}<br /><em>{isMultiplayer ? 'in contemporanea.' : 'Tre fronti da vincere.'}</em></h1>
          <p>{isMultiplayer ? 'Entrambi scegliete la carta nello stesso momento. Sullo stesso fronte le carte restano coperte fino alla fine.' : 'Gioca una carta per turno su uno dei tre fronti. Vince chi ottiene la somma più alta su almeno due fronti.'}</p>
        </div>
        <div className="score-area" aria-live="polite">
          <div className="score-player"><span>IL TUO PUNTEGGIO</span><strong>{activeWins ? activeWins.you : '-'}</strong><small>fronti vinti</small></div>
          <span className="score-separator"><i /><b>VS</b><i /></span>
          <div className="score-player bot-score"><span>PUNTEGGIO {opponentLabel}</span><strong>{activeWins ? activeWins.bot : '-'}</strong><small>fronti vinti</small></div>
          <div className="score-caption">vince chi conquista almeno due fronti</div>
        </div>
      </section>

      {/* MULTIPLAYER LOBBY / WAITING SCREEN */}
      {isMultiplayer && mpPhase !== 'playing' ? (
        <section className="game-frame mp-lobby-frame" aria-label="Lobby multiplayer">
          <div className="game-topline">
            <div className="turn-readout"><span className="live-dot" /><span>STANZA ONLINE</span></div>
            <span className="duel-type">DUELLO IN DIRETTA</span>
          </div>

          {mpError && <div className="mp-error-banner" role="alert">{mpError}</div>}

          {mpPhase === 'lobby' ? (
            <div className="mp-lobby-grid">
              <div className="mp-card">
                <h3>Crea una stanza</h3>
                <p>Crea una nuova partita e condividi il codice o il link d'invito.</p>
                <button type="button" className="confirm-button" onClick={handleCreateRoom}>
                  Crea stanza <span>↗</span>
                </button>
              </div>

              <div className="mp-divider-v"><span>OPPURE</span></div>

              <div className="mp-card">
                <h3>Unisciti a una stanza</h3>
                <p>Inserisci il codice di quattro caratteri per entrare nella partita.</p>
                <div className="mp-join-form">
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="ES. 7K9P"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    className="mp-code-input"
                    aria-label="Codice stanza"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button type="button" className="confirm-button" onClick={handleJoinRoom} disabled={!joinCodeInput.trim()}>
                    Entra <span>↗</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mp-waiting-box">
              <div className="eyebrow"><span className="eyebrow-line" /> IN ATTESA DELL'AVVERSARIO</div>
              <h2>Condividi il codice stanza</h2>
              <div className="mp-room-display">
                <span className="mp-room-tag">{mpRoomCode}</span>
              </div>
              <p className="mp-waiting-sub">Invia questo codice o il link d'invito all'altra persona.</p>
              <div className="mp-actions-row">
                <button type="button" className="confirm-button copy-btn" onClick={copyInviteLink}>
                  {copiedLink ? '✓ Link copiato negli appunti' : "Copia link d'invito ↗"}
                </button>
                <button type="button" className="text-button cancel-room-btn" onClick={handleLeaveRoom}>
                  Annulla ed esci
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        /* ACTIVE ARENA (Solo or Multiplayer Playing) */
        <>
          <section className="game-frame" aria-label="Partita in corso">
            <div className="game-topline">
              <div className="turn-readout">
                <span className="live-dot" />
                <span>
                  {activeIsOver
                    ? 'PARTITA CONCLUSA'
                    : isMultiplayer
                      ? `TURNO ${String(turnNumber).padStart(2, '0')} / 09 · STANZA ${mpRoomCode}`
                      : `TURNO ${String(turnNumber).padStart(2, '0')} / 09`}
                </span>
              </div>
              <div className="turn-progress" aria-label={`${activeCompleted} turni completati su 9`}>
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} className={i < activeCompleted ? 'done' : i === activeCompleted && !activeIsOver ? 'current' : ''} />
                ))}
              </div>
              <span className="duel-type">
                {isMultiplayer ? `ONLINE · SEI ${mpState?.seat === 'p1' ? 'GIOCATORE 1' : 'GIOCATORE 2'}` : 'CONTRO IL BOT'}
              </span>
            </div>

            {mpError && <div className="mp-error-banner" role="alert">{mpError}</div>}

            {activeIsOver && (
              <div className="end-banner" role="status">
                <span className="end-star">✦</span>
                <div>
                  <small>{isForfeit ? "ABBANDONO DELL'AVVERSARIO" : 'RISULTATO FINALE'}</small>
                  <strong>{result}</strong>
                </div>
                {!isForfeit && <span className="end-count">{activeWins?.you} <i>-</i> {activeWins?.bot} fronti</span>}
              </div>
            )}

            <div className="fronts-grid">
              {LANES.map((lane) => (
                <FrontColumn
                  key={lane}
                  lane={lane}
                  board={activeBoard}
                  isOver={activeIsOver}
                  opponentLabel={opponentLabel}
                />
              ))}
            </div>

            <div className="arena-legend">
              <span><i className="legend-you" /> Le tue carte</span>
              <span><i className="legend-you-secret" /> Tua carta coperta</span>
              <span><i className="legend-bot" /> Carte {opponentLabel.toLowerCase()}</span>
              <span className="legend-note"><b>?</b> Se scegliete lo stesso fronte, le carte si svelano a fine partita.</span>
            </div>
          </section>

          <div className="lower-grid">
            <section className="hand-panel" aria-label="La tua mano">
              <div className="panel-heading">
                <div><div className="eyebrow compact"><span className="eyebrow-line" /> LA TUA MANO</div><h2>Scegli una carta</h2></div>
                <span className="cards-remaining">{cards.length}<small> / 9 carte</small></span>
              </div>
              <div className="hand-cards" role="group" aria-label="Seleziona una carta da giocare">
                {Array.from({ length: 9 }, (_, index) => index + 1).map((card) => {
                  const used = !cards.includes(card);
                  const isLocked = isMultiplayer && Boolean(mpState?.yourMoveLocked);
                  return (
                    <button
                      key={card}
                      className={`hand-card ${selectedCard === card && !used ? 'selected' : ''} ${used ? 'used' : ''}`}
                      disabled={used || activeIsOver || isLocked}
                      onClick={() => setSelectedCard(card)}
                      aria-pressed={selectedCard === card && !used}
                      aria-label={`Carta ${card}${used ? ', già giocata' : ''}`}
                    >
                      <span className="hand-number">{used ? '·' : card}</span>
                      <span className="hand-pip" aria-hidden="true">{used ? '' : '✳'}</span>
                    </button>
                  );
                })}
              </div>
              <div className="selection-hint">
                <span className="selection-star">✳</span>
                {isMultiplayer && activeIsOver
                  ? (isForfeit ? "Partita terminata per abbandono dell'avversario." : 'Partita terminata.')
                  : isMultiplayer && mpState?.yourMoveLocked
                    ? "Mossa inviata. In attesa dell'avversario."
                    : isMultiplayer && mpState?.opponentMoveLocked
                      ? "L'avversario ha scelto la sua mossa. Scegli la tua carta e conferma."
                      : 'Seleziona una carta, poi scegli il fronte.'}
              </div>
            </section>

            <aside className="command-panel">
              <div className="command-head">
                <span>LA TUA MOSSA</span>
                <span className="lock-icon" aria-label="Mossa simultanea">⌑</span>
              </div>
              <span className="field-label">Scegli un fronte</span>
              <div className="lane-picker" role="group" aria-label="Scegli il fronte">
                {LANES.map((lane) => {
                  const full = !lanes.includes(lane);
                  const isLocked = isMultiplayer && Boolean(mpState?.yourMoveLocked);
                  return (
                    <button
                      type="button"
                      key={lane}
                      disabled={full || activeIsOver || isLocked}
                      aria-pressed={selectedLane === lane}
                      className={`lane-choice ${selectedLane === lane ? 'active' : ''} ${full ? 'full' : ''}`}
                      onClick={() => setSelectedLane(lane)}
                    >
                      <span>{lane}</span>
                      <small>{full ? 'pieno' : `${3 - activeBoard[lane].you.length} posti`}</small>
                    </button>
                  );
                })}
              </div>
              <div className="move-summary">
                <span>Giochi</span>
                <strong>{selectedCard ?? '-'}</strong>
                <span>sul fronte</span>
                <b>{selectedLane}</b>
              </div>

              {activeIsOver ? (
                isMultiplayer ? (
                  mpState?.rematchRequested ? (
                    <button className="confirm-button" disabled>
                      In attesa dell'avversario... <span>◌</span>
                    </button>
                  ) : mpState?.opponentRematchRequested ? (
                    <button className="confirm-button replay-button" onClick={handleRematch}>
                      Accetta rivincita <span>✦</span>
                    </button>
                  ) : (
                    <button className="confirm-button replay-button" onClick={handleRematch}>
                      Richiedi rivincita <span>↗</span>
                    </button>
                  )
                ) : (
                  <button className="confirm-button replay-button" onClick={() => startNewGame()}>
                    Nuova partita <span>↗</span>
                  </button>
                )
              ) : isMultiplayer && mpState?.yourMoveLocked ? (
                <button className="confirm-button" disabled>
                  Mossa inviata <span>◌</span>
                </button>
              ) : (
                <button
                  className="confirm-button"
                  onClick={confirmMove}
                  disabled={selectedCard === null || !lanes.includes(selectedLane)}
                >
                  Conferma la mossa <span>↗</span>
                </button>
              )}

              {isMultiplayer ? (
                <div className="mp-turn-feedback">
                  {mpState?.opponentMoveLocked && !mpState?.yourMoveLocked ? (
                    <div className="opponent-alert">L'avversario ha completato la mossa.</div>
                  ) : null}
                  <button type="button" className="text-button leave-room-link" onClick={handleLeaveRoom}>
                    Abbandona stanza
                  </button>
                </div>
              ) : (
                <div className="difficulty-control">
                  <label htmlFor="difficulty-select">AVVERSARIO</label>
                  <select
                    id="difficulty-select"
                    value={game.difficulty}
                    onChange={(event) => changeDifficulty(event.target.value as Difficulty)}
                  >
                    <option value="strategic">Bot strategico</option>
                    <option value="random">Bot casuale</option>
                  </select>
                  <small>Se cambi avversario la partita ricomincia.</small>
                </div>
              )}
            </aside>

            <section className="history-panel" aria-label="Cronologia delle mosse">
              <div className="history-heading">
                <div><div className="eyebrow compact"><span className="eyebrow-line" /> REGISTRO DELLA PARTITA</div><h2>Cronologia delle mosse</h2></div>
                <span className="history-count">{String(activeCompleted).padStart(2, '0')}<small> / 09</small></span>
              </div>
              <HistoryPanel history={activeHistory} isOver={activeIsOver} opponentLabel={opponentLabel} />
              <div className="history-foot"><span className="live-dot" /> Le carte coperte vengono svelate al termine del nono turno.</div>
            </section>
          </div>
        </>
      )}

      <footer className="page-footer">
        <span>TRE FRONTI</span>
        <span>CARTE DA 1 A 9 · NOVE TURNI · TRE FRONTI</span>
        <span>VERSIONE WEB E CLI</span>
      </footer>

      <dialog
        ref={rulesDialogRef}
        className="dialog-backdrop"
        aria-labelledby="rules-title"
        onCancel={(event) => { event.preventDefault(); setShowRules(false); }}
        onClick={(event) => { if (event.target === event.currentTarget) setShowRules(false); }}
      >
        <section className="rules-dialog">
          <button className="dialog-close" autoFocus aria-label="Chiudi istruzioni" onClick={() => setShowRules(false)}>×</button>
          <div className="eyebrow"><span className="eyebrow-line" /> REGOLE DEL GIOCO</div>
          <h2 id="rules-title">Regole di Tre Fronti</h2>
          <ol className="rules-list">
            <li><span>01</span><p>Tu e l'avversario avete ciascuno nove carte, <b>da 1 a 9</b>. Ogni carta si gioca una sola volta.</p></li>
            <li><span>02</span><p>A ogni turno scegli una carta e un fronte: <b>A, B o C</b>. Entrambi i giocatori scelgono senza conoscere la mossa dell'altro.</p></li>
            <li><span>03</span><p>Ogni fronte può ospitare al massimo <b>tre carte per giocatore</b>. Se scegliete lo stesso fronte, le carte di quel turno restano coperte fino alla fine della partita; la tua carta resta comunque visibile a te.</p></li>
            <li><span>04</span><p>Dopo nove turni tutte le carte coperte vengono svelate e si sommano i valori di ciascun fronte. Vince chi conquista almeno due fronti, altrimenti è pareggio.</p></li>
          </ol>
          <div className="rules-bot">
            <span>✳</span>
            <p>Nelle partite online il server comunica il valore delle carte coperte solo alla fine del nono turno. Nelle partite in singolo il bot calcola le proprie mosse basandosi unicamente sulle carte visibili sul tavolo.</p>
          </div>
          <button className="confirm-button rules-ok" onClick={() => setShowRules(false)}>Ho capito <span>↗</span></button>
        </section>
      </dialog>
    </main>
  );
}

export default App;
