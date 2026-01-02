import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import UsernameInput from './components/UsernameInput';
import Matchmaking from './components/Matchmaking';
import GameBoard from './components/GameBoard';
import GameOver from './components/GameOver';
import Leaderboard from './components/Leaderboard';
import './App.css';

const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState(null);
  const [username, setUsername] = useState('');
  const [gameState, setGameState] = useState('username'); // username, matchmaking, playing, gameOver, leaderboard
  const [gameId, setGameId] = useState(null);
  const [players, setPlayers] = useState(null);
  const [board, setBoard] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [myPlayerNum, setMyPlayerNum] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [disconnected, setDisconnected] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);

  // Refetch leaderboard data
  const refetchLeaderboard = async () => {
    try {
      const base = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(base + '/leaderboard');
      const data = await response.json();
      setLeaderboardData(data.leaderboard || []);
    } catch (err) {
      console.error('Error refetching leaderboard:', err);
    }
  };

  // Initialize socket
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    const joinedRef = { current: false };
    const pendingJoinRef = { current: false };

    function emitJoin(name) {
      if (!name) return;
      try {
        localStorage.setItem('connect4_username', name);
      } catch (e) {}

      if (newSocket && newSocket.connected) {
        newSocket.emit('join_game', { username: name });
        joinedRef.current = true;
        pendingJoinRef.current = false;
      } else {
        // mark pending; will emit on connect
        pendingJoinRef.current = true;
      }
    }

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setDisconnected(false);

      // If a username exists from a prior session, auto-join
      const stored = localStorage.getItem('connect4_username');
      if (stored && !joinedRef.current) {
        emitJoin(stored);
      }
    });

    // Also handle explicit reconnect events
    newSocket.on('reconnect', () => {
      const stored = localStorage.getItem('connect4_username');
      if (stored) {
        emitJoin(stored);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setDisconnected(true);
    });

    newSocket.on('queued', (data) => {
      console.log('Queued:', data);
    });

    newSocket.on('game_start', (data) => {
      console.log('Game started:', data);
      // Validate payload: must include players with both player1 and player2 and a full gameState
      if (!data || !data.players || !data.players.player1 || !data.players.player2 || !data.gameState || typeof data.playerNum !== 'number') {
        console.warn('Received invalid game_start payload, ignoring:', data);
        return;
      }
      setMyPlayerNum(data.playerNum);
      try { localStorage.setItem('connect4_playerNum', String(data.playerNum)); } catch (e) {}
      setGameId(data.gameId);
      setPlayers(data.players);
      setBoard(data.gameState.board);
      setCurrentTurn(data.gameState.currentTurn);
      setGameState('playing');
      // Persist username locally so reconnects will rejoin automatically
      try {
        localStorage.setItem('connect4_username', username);
      } catch (e) {}
    });

    newSocket.on('game_reconnected', (data) => {
      console.log('Game reconnected:', data);
      // Only transition to playing if we received a full resumed game state with players
      if (!data || !data.players || !data.players.player1 || !data.players.player2 || !data.gameState || typeof data.playerNum !== 'number') {
        console.warn('Received incomplete game_reconnected, staying in matchmaking:', data);
        return;
      }

      setGameId(data.gameId);
      setPlayers(data.players);
      setBoard(data.gameState.board);
      setCurrentTurn(data.gameState.currentTurn);
      setMyPlayerNum(data.playerNum);
      try { localStorage.setItem('connect4_playerNum', String(data.playerNum)); } catch (e) {}
      setGameState('playing');
    });

    newSocket.on('move_made', (data) => {
      console.log('Move made:', data);
      if (!data || !data.gameState) {
        console.warn('move_made missing gameState, ignoring:', data);
        return;
      }
      setBoard(data.gameState.board);
      setCurrentTurn(data.gameState.currentTurn);
    });

    newSocket.on('game_over', (data) => {
      console.log('Game over:', data);
      setGameResult(data);
      setGameState('gameOver');
      // Refetch leaderboard after game ends
      refetchLeaderboard();
    });

    newSocket.on('player_disconnected', (data) => {
      console.log('Player disconnected:', data);
    });

    newSocket.on('player_reconnected', (data) => {
      console.log('Player reconnected:', data);
      if (!data || !data.gameState) {
        console.warn('player_reconnected missing gameState, ignoring:', data);
        return;
      }
      setBoard(data.gameState.board);
      setCurrentTurn(data.gameState.currentTurn);
    });

    newSocket.on('error', (data) => {
      console.error('Socket error:', data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleUsernameSubmit = (name) => {
    setUsername(name);
    setGameState('matchmaking');

    try {
      localStorage.setItem('connect4_username', name);
    } catch (e) {}

    // Ensure socket exists and is connected; otherwise the connect handler will pick up
    if (socket && socket.connected) {
      socket.emit('join_game', { username: name });
    }
  };

  const handleMove = (col) => {
    if (currentTurn === myPlayerNum && socket) {
      socket.emit('make_move', { gameId, col });
    }
  };

  const handleForfeit = () => {
    if (socket) {
      socket.emit('game_forfeit', {});
    }
  };

  const handleShowLeaderboard = () => {
    setGameState('leaderboard');
  };

  const handleBackFromLeaderboard = () => {
    setGameState('gameOver');
  };

  const handlePlayAgain = () => {
    setGameId(null);
    setPlayers(null);
    setBoard(null);
    setGameResult(null);
    setGameState('matchmaking');
    setMyPlayerNum(null);
    try {
      localStorage.setItem('connect4_username', username);
    } catch (e) {}
    if (socket && socket.connected) {
      socket.emit('join_game', { username });
    }
  };

  return (
    <div className="app">
      <h1>Connect Four</h1>

      {disconnected && <div className="disconnect-warning">Disconnected from server</div>}

      {gameState === 'username' && <UsernameInput onSubmit={handleUsernameSubmit} />}

      {gameState === 'matchmaking' && <Matchmaking username={username} />}

      {gameState === 'playing' && players && players.player1 && players.player2 && board ? (
        <GameBoard
          board={board}
          players={players}
          currentTurn={currentTurn}
          myPlayerNum={myPlayerNum}
          onMove={handleMove}
          onForfeit={handleForfeit}
          username={username}
        />
      ) : gameState === 'playing' ? (
        // If we are marked as playing but lack full data, stay in matchmaking UI
        <Matchmaking username={username} />
      ) : null}

      {gameState === 'gameOver' && gameResult && (
        <GameOver
          result={gameResult}
          username={username}
          myPlayerNum={myPlayerNum}
          onPlayAgain={handlePlayAgain}
          onShowLeaderboard={handleShowLeaderboard}
        />
      )}

      {gameState === 'leaderboard' && (
        <Leaderboard leaderboardData={leaderboardData} onBack={handleBackFromLeaderboard} />
      )}
    </div>
  );
}

export default App;
