import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createMultiplayerServer } from './index.mjs';

describe('multiplayer server end-to-end', () => {
  let app;
  const PORT = 3987;

  beforeAll(async () => {
    app = createMultiplayerServer(PORT);
    await new Promise((resolve) => app.listen(resolve));
  });

  afterAll(async () => {
    await new Promise((resolve) => app.close(resolve));
  });

  function createClient() {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    const queue = [];
    const waiters = [];

    ws.on('message', (raw) => {
      const data = JSON.parse(raw.toString());
      if (waiters.length > 0) {
        const resolve = waiters.shift();
        resolve(data);
      } else {
        queue.push(data);
      }
    });

    return {
      ws,
      send(data) {
        ws.send(JSON.stringify(data));
      },
      nextMessage() {
        if (queue.length > 0) {
          return Promise.resolve(queue.shift());
        }
        return new Promise((resolve) => waiters.push(resolve));
      },
      close() {
        ws.close();
      },
    };
  }

  it('gestisce una partita multiplayer completa con anti-cheat sulle carte coperte', async () => {
    const p1 = createClient();
    const p2 = createClient();

    await new Promise((resolve) => p1.ws.on('open', resolve));
    await new Promise((resolve) => p2.ws.on('open', resolve));

    // 1. P1 crea stanza
    p1.send({ type: 'CREATE_ROOM' });
    const createdMsg = await p1.nextMessage();
    expect(createdMsg.type).toBe('ROOM_CREATED');
    expect(createdMsg.roomCode).toHaveLength(4);
    const code = createdMsg.roomCode;

    // 2. P2 entra nella stanza
    p2.send({ type: 'JOIN_ROOM', roomCode: code });
    const p2Joined = await p2.nextMessage();
    expect(p2Joined.type).toBe('ROOM_JOINED');

    // 3. Entrambi ricevono GAME_START
    const p1Start = await p1.nextMessage();
    const p2Start = await p2.nextMessage();
    expect(p1Start.type).toBe('GAME_START');
    expect(p2Start.type).toBe('GAME_START');
    expect(p1Start.state.completed).toBe(0);
    expect(p2Start.state.completed).toBe(0);

    // 4. Turno 1: stesso fronte (A), carte diverse (P1 gioca 7, P2 gioca 4)
    p1.send({ type: 'SUBMIT_MOVE', move: { card: 7, lane: 'A' } });
    const p1MoveAck = await p1.nextMessage();
    expect(p1MoveAck.type).toBe('MOVE_ACCEPTED');

    const p2OpponentMoved = await p2.nextMessage();
    expect(p2OpponentMoved.type).toBe('OPPONENT_MOVED');

    p2.send({ type: 'SUBMIT_MOVE', move: { card: 4, lane: 'A' } });
    const p2MoveAck = await p2.nextMessage();
    expect(p2MoveAck.type).toBe('MOVE_ACCEPTED');

    // Entrambi ricevono ROUND_RESOLVED
    const p1Round1 = await p1.nextMessage();
    const p2Round1 = await p2.nextMessage();
    expect(p1Round1.type).toBe('ROUND_RESOLVED');
    expect(p2Round1.type).toBe('ROUND_RESOLVED');

    // Verifica ANTI-CHEAT: le carte coperte NON hanno il valore dell'avversario
    expect(p1Round1.state.board.A.you[0].card).toBe(7);
    expect(p1Round1.state.board.A.bot[0].card).toBeNull(); // Segreto per P1!
    expect(p1Round1.state.board.A.bot[0].revealed).toBe(false);

    expect(p2Round1.state.board.A.you[0].card).toBe(4);
    expect(p2Round1.state.board.A.bot[0].card).toBeNull(); // Segreto per P2!
    expect(p2Round1.state.board.A.bot[0].revealed).toBe(false);

    // 5. Turno 2: fronti diversi (P1 gioca 8 su B, P2 gioca 3 su C)
    p1.send({ type: 'SUBMIT_MOVE', move: { card: 8, lane: 'B' } });
    await p1.nextMessage(); // MOVE_ACCEPTED
    await p2.nextMessage(); // OPPONENT_MOVED

    p2.send({ type: 'SUBMIT_MOVE', move: { card: 3, lane: 'C' } });
    await p2.nextMessage(); // MOVE_ACCEPTED

    const p1Round2 = await p1.nextMessage();
    const p2Round2 = await p2.nextMessage();
    expect(p1Round2.type).toBe('ROUND_RESOLVED');
    expect(p2Round2.type).toBe('ROUND_RESOLVED');

    // Fronti diversi: entrambe le carte sono rivelate
    expect(p1Round2.state.board.B.you[0].card).toBe(8);
    expect(p1Round2.state.board.C.bot[0].card).toBe(3);
    expect(p1Round2.state.board.C.bot[0].revealed).toBe(true);

    // Turni 3 a 9
    const remainingMovesP1 = [
      { card: 9, lane: 'A' }, { card: 1, lane: 'A' },
      { card: 2, lane: 'B' }, { card: 3, lane: 'B' },
      { card: 4, lane: 'C' }, { card: 5, lane: 'C' }, { card: 6, lane: 'C' },
    ];
    const remainingMovesP2 = [
      { card: 5, lane: 'A' }, { card: 6, lane: 'A' },
      { card: 7, lane: 'B' }, { card: 8, lane: 'B' },
      { card: 9, lane: 'B' }, { card: 1, lane: 'C' }, { card: 2, lane: 'C' },
    ];

    for (let i = 0; i < remainingMovesP1.length; i += 1) {
      p1.send({ type: 'SUBMIT_MOVE', move: remainingMovesP1[i] });
      await p1.nextMessage();
      await p2.nextMessage();

      p2.send({ type: 'SUBMIT_MOVE', move: remainingMovesP2[i] });
      await p2.nextMessage();

      const r1 = await p1.nextMessage();
      const r2 = await p2.nextMessage();

      if (i === remainingMovesP1.length - 1) {
        // Ultimo turno: GAME_OVER
        expect(r1.type).toBe('GAME_OVER');
        expect(r2.type).toBe('GAME_OVER');

        // A fine partita tutte le carte coperte sono SVELATE!
        expect(r1.state.board.A.bot[0].card).toBe(4);
        expect(r2.state.board.A.bot[0].card).toBe(7);
        expect(r1.state.isOver).toBe(true);
        expect(r2.state.isOver).toBe(true);
        expect(r1.state.wins).toBeDefined();
      } else {
        expect(r1.type).toBe('ROUND_RESOLVED');
        expect(r2.type).toBe('ROUND_RESOLVED');
      }
    }

    // 6. Test rivincita
    p1.send({ type: 'REMATCH' });
    const p1RematchAck = await p1.nextMessage();
    expect(p1RematchAck.type).toBe('REMATCH_ACCEPTED');

    const p2RematchOffered = await p2.nextMessage();
    expect(p2RematchOffered.type).toBe('REMATCH_OFFERED');

    p2.send({ type: 'REMATCH' });
    const p1Restart = await p1.nextMessage();
    const p2Restart = await p2.nextMessage();
    expect(p1Restart.type).toBe('GAME_START');
    expect(p2Restart.type).toBe('GAME_START');
    expect(p1Restart.state.completed).toBe(0);

    // 7. Test disconnessione
    p2.close();
    const p1DisconnectMsg = await p1.nextMessage();
    expect(p1DisconnectMsg.type).toBe('OPPONENT_DISCONNECTED');

    p1.close();
  });

  it('notifica errore se la stanza non esiste', async () => {
    const client = createClient();
    await new Promise((resolve) => client.ws.on('open', resolve));

    client.send({ type: 'JOIN_ROOM', roomCode: 'INEXISTENT' });
    const errorMsg = await client.nextMessage();
    expect(errorMsg.type).toBe('ERROR');
    expect(errorMsg.message).toContain('non trovata');

    client.close();
  });

  it('gestisce in modo sicuro payload non validi o null senza crashare il server', async () => {
    const client = createClient();
    await new Promise((resolve) => client.ws.on('open', resolve));

    // Invio di "null" come JSON
    client.ws.send('null');
    const msgNull = await client.nextMessage();
    expect(msgNull.type).toBe('ERROR');
    expect(msgNull.message).toContain('Payload non valido');

    // Invio di numero come JSON
    client.ws.send('12345');
    const msgNum = await client.nextMessage();
    expect(msgNum.type).toBe('ERROR');

    // Invio di JSON non valido
    client.ws.send('{ invalid json');
    const msgInvalid = await client.nextMessage();
    expect(msgInvalid.type).toBe('ERROR');
    expect(msgInvalid.message).toContain('non valido');

    client.close();
  });

  it('impedisce a P1 di muovere prima che P2 sia entrato e impedisce il self-join', async () => {
    const p1 = createClient();
    await new Promise((resolve) => p1.ws.on('open', resolve));

    p1.send({ type: 'CREATE_ROOM' });
    const createdMsg = await p1.nextMessage();
    const code = createdMsg.roomCode;

    // Tentativo di mossa prima che P2 sia presente
    p1.send({ type: 'SUBMIT_MOVE', move: { card: 5, lane: 'A' } });
    const earlyMoveErr = await p1.nextMessage();
    expect(earlyMoveErr.type).toBe('ERROR');
    expect(earlyMoveErr.message).toContain('In attesa');

    // Tentativo di unione alla propria stanza sullo stesso socket
    p1.send({ type: 'JOIN_ROOM', roomCode: code });
    const selfJoinErr = await p1.nextMessage();
    expect(selfJoinErr.type).toBe('ERROR');
    expect(selfJoinErr.message).toContain('già');

    p1.close();
  });

  it('assegna vittoria per abbandono se un giocatore si disconnette durante la partita', async () => {
    const p1 = createClient();
    const p2 = createClient();
    await new Promise((resolve) => p1.ws.on('open', resolve));
    await new Promise((resolve) => p2.ws.on('open', resolve));

    p1.send({ type: 'CREATE_ROOM' });
    const { roomCode } = await p1.nextMessage();

    p2.send({ type: 'JOIN_ROOM', roomCode });
    await p2.nextMessage(); // ROOM_JOINED
    await p1.nextMessage(); // GAME_START
    await p2.nextMessage(); // GAME_START

    // P2 si disconnette a partita in corso
    p2.close();
    const disconnectMsg = await p1.nextMessage();
    expect(disconnectMsg.type).toBe('OPPONENT_DISCONNECTED');
    expect(disconnectMsg.state.isOver).toBe(true);
    expect(disconnectMsg.state.forfeit).toBe(true);
    expect(disconnectMsg.state.matchOutcome).toBe('you');

    p1.close();
  });

  it('impedisce l ingresso a una stanza piena', async () => {
    const p1 = createClient();
    const p2 = createClient();
    const p3 = createClient();
    await new Promise((resolve) => p1.ws.on('open', resolve));
    await new Promise((resolve) => p2.ws.on('open', resolve));
    await new Promise((resolve) => p3.ws.on('open', resolve));

    p1.send({ type: 'CREATE_ROOM' });
    const { roomCode } = await p1.nextMessage();

    p2.send({ type: 'JOIN_ROOM', roomCode });
    await p2.nextMessage();
    await p1.nextMessage();
    await p2.nextMessage();

    // P3 cerca di entrare in una stanza che ha già 2 giocatori
    p3.send({ type: 'JOIN_ROOM', roomCode });
    const fullErr = await p3.nextMessage();
    expect(fullErr.type).toBe('ERROR');
    expect(fullErr.message).toContain('già piena');

    p1.close();
    p2.close();
    p3.close();
  });
});
