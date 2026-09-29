import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  availableCards,
  getFrontWins,
  getMatchResult,
  LANES,
  newBoard,
  openLanes,
  playSimultaneousRound,
} from '../.cli/game.js';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 4; i += 1) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export function createMultiplayerServer(port = 3001) {
  const rooms = new Map();
  const playerRooms = new Map(); // ws -> { roomCode, seat }

  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', activeRooms: rooms.size }));
      return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  const wss = new WebSocketServer({ server });

  function send(ws, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
      } catch {
        // Silently ignore send errors on closing sockets
      }
    }
  }

  function getMaskedState(room, seat) {
    const isP1 = seat === 'p1';
    const isOver = room.isOver;

    // Perspective mapping: 'you' is the player requesting state, 'bot' is the opponent
    const board = {
      A: { you: [], bot: [] },
      B: { you: [], bot: [] },
      C: { you: [], bot: [] },
    };

    for (const lane of LANES) {
      const myPlays = isP1 ? room.board[lane].you : room.board[lane].bot;
      const oppPlays = isP1 ? room.board[lane].bot : room.board[lane].you;

      board[lane].you = myPlays.map((p) => ({ ...p }));
      board[lane].bot = oppPlays.map((p) => {
        // If not over and not revealed, mask card value to prevent inspection in browser
        if (!isOver && !p.revealed) {
          return { card: null, lane: p.lane, turn: p.turn, revealed: false };
        }
        return { ...p };
      });
    }

    const history = room.history.map((record) => {
      const myMove = isP1 ? record.you : record.bot;
      const oppMove = isP1 ? record.bot : record.you;
      if (!isOver && !record.revealed) {
        return {
          turn: record.turn,
          you: myMove,
          bot: { card: null, lane: oppMove.lane },
          revealed: false,
        };
      }
      return {
        turn: record.turn,
        you: myMove,
        bot: oppMove,
        revealed: record.revealed,
      };
    });

    const wins = isOver
      ? (room.forfeitWinner
        ? (room.forfeitWinner === seat ? { you: 2, bot: 0, ties: 0 } : { you: 0, bot: 2, ties: 0 })
        : getFrontWins(board))
      : null;
    const matchOutcome = isOver
      ? (room.forfeitWinner
        ? (room.forfeitWinner === seat ? 'you' : 'bot')
        : getMatchResult(board))
      : null;

    return {
      roomCode: room.code,
      seat,
      board,
      history,
      completed: room.turn - 1,
      isOver,
      wins,
      matchOutcome,
      forfeit: Boolean(room.forfeitWinner),
      yourMoveLocked: Boolean(room.pendingMoves[seat]),
      opponentMoveLocked: Boolean(room.pendingMoves[isP1 ? 'p2' : 'p1']),
      rematchRequested: room.rematchRequests.has(seat),
      opponentRematchRequested: room.rematchRequests.has(isP1 ? 'p2' : 'p1'),
    };
  }

  function handleDisconnect(ws) {
    const info = playerRooms.get(ws);
    if (!info) return;
    const { roomCode, seat } = info;
    playerRooms.delete(ws);

    const room = rooms.get(roomCode);
    if (!room) return;

    const otherSeat = seat === 'p1' ? 'p2' : 'p1';
    const otherPlayer = room[otherSeat];

    room[seat] = null;

    // Se la partita era iniziata o c'è un avversario presente e non era finita, assegna vittoria per forfeit
    if (!room.isOver && otherPlayer) {
      room.isOver = true;
      room.forfeitWinner = otherSeat;
    }

    if (otherPlayer && otherPlayer.ws && otherPlayer.ws.readyState === WebSocket.OPEN) {
      send(otherPlayer.ws, {
        type: 'OPPONENT_DISCONNECTED',
        message: "L'avversario si è disconnesso dalla partita.",
        state: getMaskedState(room, otherSeat),
      });
    }

    // Clean up empty room
    if (!room.p1 && !room.p2) {
      rooms.delete(roomCode);
    }
  }

  // Periodic heartbeat to prevent ghost sockets and prune stale rooms
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();
    for (const client of wss.clients) {
      if (client.isAlive === false) {
        handleDisconnect(client);
        try { client.terminate(); } catch {}
        continue;
      }
      client.isAlive = false;
      try { client.ping(); } catch {}
    }

    for (const [code, room] of rooms.entries()) {
      if (!room.p1 && !room.p2) {
        rooms.delete(code);
      } else if (now - room.createdAt > 2 * 60 * 60 * 1000) {
        if (room.p1?.ws) try { room.p1.ws.close(); } catch {}
        if (room.p2?.ws) try { room.p2.ws.close(); } catch {}
        rooms.delete(code);
      }
    }
  }, 30000);

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: 'ERROR', message: 'Messaggio non valido.' });
        return;
      }

      if (!data || typeof data !== 'object' || typeof data.type !== 'string') {
        send(ws, { type: 'ERROR', message: 'Payload non valido.' });
        return;
      }

      switch (data.type) {
        case 'CREATE_ROOM': {
          if (playerRooms.has(ws)) {
            handleDisconnect(ws);
          }

          let code = generateRoomCode();
          let attempts = 0;
          while (rooms.has(code) && attempts < 100) {
            code = generateRoomCode();
            attempts += 1;
          }

          if (attempts >= 100) {
            send(ws, { type: 'ERROR', message: 'Impossibile creare una stanza: limite raggiunto.' });
            return;
          }

          const room = {
            code,
            createdAt: Date.now(),
            p1: { ws },
            p2: null,
            board: newBoard(),
            history: [],
            turn: 1,
            pendingMoves: { p1: null, p2: null },
            rematchRequests: new Set(),
            isOver: false,
            forfeitWinner: null,
          };

          rooms.set(code, room);
          playerRooms.set(ws, { roomCode: code, seat: 'p1' });

          send(ws, {
            type: 'ROOM_CREATED',
            roomCode: code,
            seat: 'p1',
          });
          break;
        }

        case 'JOIN_ROOM': {
          const code = (data.roomCode || '').trim().toUpperCase();
          const existing = playerRooms.get(ws);
          if (existing && existing.roomCode === code) {
            send(ws, { type: 'ERROR', message: 'Sei già in questa stanza.' });
            return;
          }
          if (existing) {
            handleDisconnect(ws);
          }

          const room = rooms.get(code);

          if (!room) {
            send(ws, { type: 'ERROR', message: 'Stanza non trovata.' });
            return;
          }

          if (room.p1 && room.p1.ws === ws) {
            send(ws, { type: 'ERROR', message: 'Sei già nella stanza come Giocatore 1.' });
            return;
          }

          if (room.isOver) {
            send(ws, { type: 'ERROR', message: 'Questa partita è già terminata.' });
            return;
          }

          if (room.turn > 1) {
            send(ws, { type: 'ERROR', message: 'La partita è già in corso.' });
            return;
          }

          if (!room.p1 || !room.p1.ws || room.p1.ws.readyState !== WebSocket.OPEN) {
            send(ws, { type: 'ERROR', message: 'Il creatore della stanza si è disconnesso.' });
            return;
          }

          if (room.p2 && room.p2.ws && room.p2.ws.readyState === WebSocket.OPEN) {
            send(ws, { type: 'ERROR', message: 'La stanza è già piena.' });
            return;
          }

          room.p2 = { ws };
          playerRooms.set(ws, { roomCode: code, seat: 'p2' });

          send(ws, {
            type: 'ROOM_JOINED',
            roomCode: code,
            seat: 'p2',
          });

          // Both players are now in: start game
          send(room.p1?.ws, {
            type: 'GAME_START',
            state: getMaskedState(room, 'p1'),
          });
          send(room.p2?.ws, {
            type: 'GAME_START',
            state: getMaskedState(room, 'p2'),
          });
          break;
        }

        case 'SUBMIT_MOVE': {
          const info = playerRooms.get(ws);
          if (!info) {
            send(ws, { type: 'ERROR', message: 'Non sei in alcuna stanza.' });
            return;
          }

          const room = rooms.get(info.roomCode);
          if (!room || room.isOver) {
            send(ws, { type: 'ERROR', message: 'Partita non attiva.' });
            return;
          }

          if (!room.p1 || !room.p2) {
            send(ws, { type: 'ERROR', message: 'In attesa del secondo giocatore.' });
            return;
          }

          const seat = info.seat;
          if (room.pendingMoves[seat]) {
            send(ws, { type: 'ERROR', message: 'Hai già inviato la mossa per questo turno.' });
            return;
          }

          const move = data.move;
          if (!move || typeof move.card !== 'number' || !['A', 'B', 'C'].includes(move.lane)) {
            send(ws, { type: 'ERROR', message: 'Mossa malformata.' });
            return;
          }

          const playerSide = seat === 'p1' ? 'you' : 'bot';
          const cardsLeft = availableCards(room.board, playerSide);
          const validLanes = openLanes(room.board, playerSide);

          if (!cardsLeft.includes(move.card)) {
            send(ws, { type: 'ERROR', message: 'Carta già giocata.' });
            return;
          }
          if (!validLanes.includes(move.lane)) {
            send(ws, { type: 'ERROR', message: 'Fronte già pieno.' });
            return;
          }

          room.pendingMoves[seat] = move;

          const otherSeat = seat === 'p1' ? 'p2' : 'p1';
          const otherPlayer = room[otherSeat];
          const bothMoved = Boolean(room.pendingMoves.p1 && room.pendingMoves.p2);

          send(ws, {
            type: 'MOVE_ACCEPTED',
            move,
            state: getMaskedState(room, seat),
          });

          if (otherPlayer && !bothMoved) {
            send(otherPlayer.ws, {
              type: 'OPPONENT_MOVED',
              state: getMaskedState(room, otherSeat),
            });
          }

          // If both players have moved, resolve the simultaneous round
          if (bothMoved) {
            const currentTurn = room.turn;
            let roundResult;
            try {
              roundResult = playSimultaneousRound(
                room.board,
                room.pendingMoves.p1,
                room.pendingMoves.p2,
                currentTurn
              );
            } catch (err) {
              send(ws, { type: 'ERROR', message: err.message });
              return;
            }

            room.board = roundResult.board;
            room.history.push(roundResult.record);
            room.pendingMoves = { p1: null, p2: null };

            if (currentTurn >= 9) {
              room.isOver = true;
              send(room.p1?.ws, {
                type: 'GAME_OVER',
                state: getMaskedState(room, 'p1'),
              });
              send(room.p2?.ws, {
                type: 'GAME_OVER',
                state: getMaskedState(room, 'p2'),
              });
            } else {
              room.turn = currentTurn + 1;
              send(room.p1?.ws, {
                type: 'ROUND_RESOLVED',
                state: getMaskedState(room, 'p1'),
              });
              send(room.p2?.ws, {
                type: 'ROUND_RESOLVED',
                state: getMaskedState(room, 'p2'),
              });
            }
          }
          break;
        }

        case 'REMATCH': {
          const info = playerRooms.get(ws);
          if (!info) return;

          const room = rooms.get(info.roomCode);
          if (!room || !room.isOver) return;

          room.rematchRequests.add(info.seat);

          // If both want a rematch, start new game directly
          if (room.rematchRequests.has('p1') && room.rematchRequests.has('p2')) {
            room.board = newBoard();
            room.history = [];
            room.turn = 1;
            room.pendingMoves = { p1: null, p2: null };
            room.rematchRequests.clear();
            room.isOver = false;
            room.forfeitWinner = null;

            send(room.p1?.ws, {
              type: 'GAME_START',
              state: getMaskedState(room, 'p1'),
            });
            send(room.p2?.ws, {
              type: 'GAME_START',
              state: getMaskedState(room, 'p2'),
            });
          } else {
            const otherSeat = info.seat === 'p1' ? 'p2' : 'p1';
            const otherPlayer = room[otherSeat];

            if (otherPlayer) {
              send(otherPlayer.ws, {
                type: 'REMATCH_OFFERED',
                state: getMaskedState(room, otherSeat),
              });
            }
            send(ws, {
              type: 'REMATCH_ACCEPTED',
              state: getMaskedState(room, info.seat),
            });
          }
          break;
        }

        case 'LEAVE_ROOM': {
          handleDisconnect(ws);
          break;
        }

        default:
          send(ws, { type: 'ERROR', message: `Tipo di azione sconosciuto: ${data.type}` });
      }
    });

    ws.on('close', () => {
      handleDisconnect(ws);
    });

    ws.on('error', () => {
      handleDisconnect(ws);
    });
  });

  return {
    server,
    wss,
    rooms,
    listen(cb) {
      return server.listen(port, cb);
    },
    close(cb) {
      clearInterval(heartbeatInterval);
      for (const client of wss.clients) {
        try { client.terminate(); } catch {}
      }
      wss.close(() => {
        server.close(cb);
      });
    },
  };
}

// When run directly as standalone script:
if (process.argv[1] && process.argv[1].endsWith('index.mjs')) {
  const PORT = Number(process.env.PORT) || 3001;
  const instance = createMultiplayerServer(PORT);
  instance.listen(() => {
    console.log(`Server multiplayer Tre Fronti attivo su http://127.0.0.1:${PORT} (WebSocket porta ${PORT})`);
  });
}
