import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import '../styles/ChessBoard.css';

const ChessBoard = ({ 
  position = 'start', 
  orientation = 'white', 
  onMove, 
  gameId,
  socket,
  disabled = false
}) => {
  const [board, setBoard] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [highlightedSquares, setHighlightedSquares] = useState({});
  const [lastMove, setLastMove] = useState(null);
  const boardRef = useRef(null);
  const chessRef = useRef(new Chess(position === 'start' ? undefined : position));

  // Initialize the board
  useEffect(() => {
    if (position === 'start') {
      chessRef.current = new Chess();
    } else if (position) {
      try {
        chessRef.current = new Chess(position);
      } catch (e) {
        console.error('Invalid FEN position:', e);
        chessRef.current = new Chess();
      }
    }
    updateBoard();
  }, [position]);

  // Update the board when orientation changes
  useEffect(() => {
    updateBoard();
  }, [orientation]);

  // Create the board representation
  const updateBoard = () => {
    const newBoard = [];
    const chess = chessRef.current;
    
    // Determine the order of rows and columns based on orientation
    const rows = orientation === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    const cols = orientation === 'white' ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
    
    // Create the board
    for (const row of rows) {
      for (const col of cols) {
        const square = col + row;
        const piece = chess.get(square);
        
        newBoard.push({
          square,
          piece: piece ? `${piece.color}${piece.type}` : null,
        });
      }
    }
    
    setBoard(newBoard);
  };

  // Handle square click
  const handleSquareClick = (square) => {
    if (disabled) return;
    
    const chess = chessRef.current;
    
    // If a square is already selected
    if (selectedSquare) {
      // Try to make a move
      const move = {
        from: selectedSquare,
        to: square,
        promotion: 'q' // Always promote to queen for simplicity
      };
      
      try {
        const result = chess.move(move);
        
        if (result) {
          // Move was legal
          setLastMove({ from: selectedSquare, to: square });
          updateBoard();
          
          // Call the onMove callback
          if (onMove) {
            onMove(result, chess.fen());
          }
          
          // Send move to server if socket is provided
          if (socket && gameId) {
            socket.send(JSON.stringify({
              t: 'MOVE',
              gameId,
              from: selectedSquare,
              to: square,
              promo: 'q'
            }));
          }
        }
      } catch (e) {
        console.error('Invalid move:', e);
      }
      
      // Clear selection and legal moves
      setSelectedSquare(null);
      setLegalMoves([]);
      setHighlightedSquares({});
      return;
    }
    
    // If no square is selected, select this square if it has a piece
    const piece = chess.get(square);
    
    if (piece) {
      // Check if it's the player's turn
      const isPlayersTurn = (piece.color === 'w' && chess.turn() === 'w') || 
                           (piece.color === 'b' && chess.turn() === 'b');
      
      if (isPlayersTurn) {
        setSelectedSquare(square);
        
        // Get legal moves for this piece
        const moves = chess.moves({ square, verbose: true });
        const legalSquares = moves.map(move => move.to);
        setLegalMoves(legalSquares);
        
        // Highlight the selected square and legal moves
        const highlights = {};
        highlights[square] = 'selected';
        legalSquares.forEach(sq => {
          highlights[sq] = chess.get(sq) ? 'capture' : 'legal';
        });
        setHighlightedSquares(highlights);
      }
    }
  };

  // Update the board from external FEN position
  const updatePosition = (fen) => {
    try {
      chessRef.current = new Chess(fen);
      updateBoard();
    } catch (e) {
      console.error('Invalid FEN position:', e);
    }
  };

  // Get the current FEN position
  const getFen = () => {
    return chessRef.current.fen();
  };

  // Expose methods to parent component
  React.useImperativeHandle(
    ref,
    () => ({
      updatePosition,
      getFen
    }),
    []
  );

  // Render the board
  return (
    <div className="chess-board" ref={boardRef}>
      {board && board.map(({ square, piece }) => (
        <div
          key={square}
          className={`
            square 
            ${(parseInt(square[1]) + square.charCodeAt(0)) % 2 === 0 ? 'light' : 'dark'}
            ${highlightedSquares[square] ? `highlight-${highlightedSquares[square]}` : ''}
            ${lastMove && (square === lastMove.from || square === lastMove.to) ? 'last-move' : ''}
          `}
          data-square={square}
          onClick={() => handleSquareClick(square)}
        >
          {/* Square notation */}
          {(square[0] === (orientation === 'white' ? 'a' : 'h')) && (
            <div className="notation rank">{square[1]}</div>
          )}
          {(square[1] === (orientation === 'white' ? '1' : '8')) && (
            <div className="notation file">{square[0]}</div>
          )}
          
          {/* Chess piece */}
          {piece && (
            <div 
              className={`piece ${piece}`}
              style={{ 
                backgroundImage: `url(pieces-basic-png/${piece[0] === 'w' ? 'white' : 'black'}-${getPieceType(piece[1])}.png)` 
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

// Helper function to get piece type name
function getPieceType(type) {
  switch (type) {
    case 'p': return 'pawn';
    case 'n': return 'knight';
    case 'b': return 'bishop';
    case 'r': return 'rook';
    case 'q': return 'queen';
    case 'k': return 'king';
    default: return 'pawn';
  }
}

export default ChessBoard;
