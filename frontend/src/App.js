import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, getProvider } from './contract';
import './styles.css';

export default function App() {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [board, setBoard] = useState(Array(3).fill().map(() => Array(3).fill(0)));
  const [gameState, setGameState] = useState('waiting');
  const [currentTurn, setCurrentTurn] = useState('X');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Connect your wallet to play');
  const [stakeAmount, setStakeAmount] = useState('0');

  // Initialize contract and event listeners
  useEffect(() => {
    const init = async () => {
      try {
        const provider = getProvider();
        
        // Check if connected to Monad testnet
        const { chainId } = await provider.getNetwork();
        if (chainId !== 1234) { // Replace with Monad's testnet chain ID
          setMessage('Please switch to Monad Testnet in MetaMask');
        }

        const signer = provider.getSigner();
        const gameContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        setContract(gameContract);

        // Get stake amount
        const stake = await gameContract.stakeAmount();
        setStakeAmount(ethers.utils.formatEther(stake));

        // Set up event listeners
        gameContract.on("GameStarted", (playerX, playerO) => {
          setMessage(playerO === account ? 'Game started! You are O' : 'Game started! You are X');
          updateGameState();
        });

        gameContract.on("MoveMade", () => {
          updateGameState();
        });

        gameContract.on("GameEnded", (winner, isDraw) => {
          setMessage(isDraw ? "Game ended in a draw!" : 
            winner === account ? "You won!" : "You lost!");
          updateGameState();
        });

        // Check if wallet already connected
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setMessage('Connected to wallet');
          updateGameState();
        }

      } catch (err) {
        setMessage(err.message.includes('chain not supported') ? 
          'Please connect to Monad Testnet' : 
          err.message);
      }
    };

    init();
    return () => contract?.removeAllListeners();
  }, [account]);

  const updateGameState = async () => {
    try {
      const [boardState, turn, state] = await Promise.all([
        contract.getBoard(),
        contract.currentTurn(),
        contract.gameState()
      ]);
      
      setBoard(boardState.map(row => row.map(cell => cell === 0 ? 0 : cell === 1 ? 'X' : 'O'));
      setCurrentTurn(turn === 0 ? 'X' : 'O');
      setGameState(state === 0 ? 'waiting' : state === 1 ? 'playing' : 'completed');
    } catch (err) {
      setMessage(err.message);
    }
  };

  const connectWallet = async () => {
    try {
      setLoading(true);
      const provider = getProvider();
      const [account] = await provider.send("eth_requestAccounts", []);
      setAccount(account);
      setMessage('Connected to wallet');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async () => {
    try {
      setLoading(true);
      setMessage('Waiting for transaction...');
      const tx = await contract.joinGame({ value: await contract.stakeAmount() });
      await tx.wait();
    } catch (err) {
      setMessage(err.message.includes('user rejected') ? 
        'Transaction cancelled' : 
        err.message);
    } finally {
      setLoading(false);
    }
  };

  const makeMove = async (row, col) => {
    try {
      setLoading(true);
      setMessage('Processing your move...');
      const tx = await contract.makeMove(row, col);
      await tx.wait();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addMonadNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x4D2', // Monad testnet chain ID in hex (replace with actual)
          chainName: 'Monad Testnet',
          nativeCurrency: {
            name: 'Monad',
            symbol: 'MONAD',
            decimals: 18
          },
          rpcUrls: [process.env.REACT_APP_MONAD_RPC_URL],
          blockExplorerUrls: ['https://testnet.monadscan.xyz'] // Replace if available
        }]
      });
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div className="container">
      <h1>On-Chain Tic-Tac-Toe</h1>
      
      {!account ? (
        <>
          <button 
            className="wallet-btn"
            onClick={connectWallet}
            disabled={loading}
          >
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </button>
          <button 
            className="wallet-btn"
            onClick={addMonadNetwork}
            style={{ marginTop: '10px', background: '#4a148c' }}
          >
            Add Monad Network
          </button>
        </>
      ) : (
        <div>
          <p className="status">Connected: {account.slice(0,6)}...{account.slice(-4)}</p>
          <p className="status">Stake: {stakeAmount} MONAD</p>
          
          {gameState === 'waiting' && (
            <button 
              className="wallet-btn" 
              onClick={joinGame}
              disabled={loading}
            >
              {loading ? 'Joining...' : 'Join Game'}
            </button>
          )}

          {gameState === 'playing' && (
            <>
              <p className="status">Current Turn: {currentTurn}</p>
              <div className="board">
                {board.map((row, i) => 
                  row.map((cell, j) => (
                    <div 
                      key={`${i}-${j}`} 
                      className="cell"
                      onClick={() => !loading && cell === 0 && makeMove(i, j)}
                      style={{
                        color: cell === 'X' ? '#2196f3' : '#f44336',
                        opacity: cell === 0 ? 0.7 : 1
                      }}
                    >
                      {cell || ''}
                    </div>
                  ))
                }
              </div>
            </>
          )}

          {gameState === 'completed' && (
            <button 
              className="wallet-btn"
              onClick={() => window.location.reload()}
            >
              Play Again
            </button>
          )}
        </div>
      )}

      <p className="status" style={{ 
        minHeight: '50px',
        color: message.includes('Connect') ? '#888' : 
               message.includes('won') ? '#4caf50' :
               message.includes('lost') ? '#f44336' : '#fff'
      }}>
        {message}
      </p>
    </div>
  );
        }
