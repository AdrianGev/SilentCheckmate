import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Chess } from 'chess.js';
import '../styles/ChessBoard.css';

const ChessBoard = forwardRef(({ 
  position = 'start', 
  orientation = 'white', 
  onMove, 
  gameId,
  socket,
  disabled = false
}, ref) => {
  const [board, setBoard] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [highlightedSquares, setHighlightedSquares] = useState({});
  const [lastMove, setLastMove] = useState(null);
  const [draggedPiece, setDraggedPiece] = useState(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const boardRef = useRef(null);
  const chessRef = useRef(new Chess(position === 'start' ? undefined : position));
  const dragOffsetRef = useRef({ x: 0, y: 0 });

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

  // Mouse event handlers for drag and drop
  const handleMouseDown = (e, square, piece) => {
    if (disabled) return;
    
    const chess = chessRef.current;
    if (!piece) return;
    
    // Check if it's the player's turn
    const pieceObj = chess.get(square);
    const isPlayersTurn = pieceObj && (
      (pieceObj.color === 'w' && chess.turn() === 'w') || 
      (pieceObj.color === 'b' && chess.turn() === 'b')
    );
    
    if (!isPlayersTurn) return;
    
    // Get legal moves for this piece
    const moves = chess.moves({ square, verbose: true });
    const legalSquares = moves.map(move => move.to);
    
    // Highlight the selected square and legal moves
    const highlights = {};
    highlights[square] = 'selected';
    legalSquares.forEach(sq => {
      highlights[sq] = chess.get(sq) ? 'capture' : 'legal';
    });
    
    // Calculate offset from the cursor to the piece center
    const pieceElement = e.currentTarget;
    const rect = pieceElement.getBoundingClientRect();
    const offsetX = e.clientX - (rect.left + rect.width / 2);
    const offsetY = e.clientY - (rect.top + rect.height / 2);
    
    // Store drag information
    setSelectedSquare(square);
    setLegalMoves(legalSquares);
    setHighlightedSquares(highlights);
    setDraggedPiece({ square, piece });
    setDragPosition({ x: e.clientX, y: e.clientY });
    dragOffsetRef.current = { x: offsetX, y: offsetY };
    
    // Add event listeners for drag and drop
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Prevent default behavior
    e.preventDefault();
  };
  
  const handleMouseMove = (e) => {
    if (draggedPiece) {
      setDragPosition({ 
        x: e.clientX - dragOffsetRef.current.x, 
        y: e.clientY - dragOffsetRef.current.y 
      });
    }
  };
  
  const handleMouseUp = (e) => {
    if (!draggedPiece || !selectedSquare) {
      cleanup();
      return;
    }
    
    // Find the square under the cursor
    const boardRect = boardRef.current.getBoundingClientRect();
    const squareSize = boardRect.width / 8;
    
    // Calculate board-relative coordinates
    const boardX = e.clientX - boardRect.left;
    const boardY = e.clientY - boardRect.top;
    
    // Check if the cursor is within the board
    if (boardX >= 0 && boardX < boardRect.width && boardY >= 0 && boardY < boardRect.height) {
      // Convert to square coordinates
      let col, row;
      
      if (orientation === 'white') {
        col = Math.floor(boardX / squareSize);
        row = 7 - Math.floor(boardY / squareSize);
      } else {
        col = 7 - Math.floor(boardX / squareSize);
        row = Math.floor(boardY / squareSize);
      }
      
      // Convert to algebraic notation
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const targetSquare = files[col] + (row + 1);
      
      // Try to make the move
      if (legalMoves.includes(targetSquare)) {
        makeMove(selectedSquare, targetSquare);
      }
    }
    
    // Clean up
    cleanup();
  };
  
  const cleanup = () => {
    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Reset state
    setDraggedPiece(null);
    setSelectedSquare(null);
    setLegalMoves([]);
    setHighlightedSquares({});
  };
  
  // Make a move
  const makeMove = (fromSquare, toSquare) => {
    const chess = chessRef.current;
    
    // Try to make the move
    const move = {
      from: fromSquare,
      to: toSquare,
      promotion: 'q' // Always promote to queen for simplicity
    };
    
    try {
      const result = chess.move(move);
      
      if (result) {
        // Move was legal
        setLastMove({ from: fromSquare, to: toSquare });
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
            from: fromSquare,
            to: toSquare,
            promo: 'q'
          }));
        }
      }
    } catch (e) {
      console.error('Invalid move:', e);
    }
  };
  
  // Handle square click (fallback for non-drag interaction)
  const handleSquareClick = (square) => {
    if (disabled || draggedPiece) return;
    
    const chess = chessRef.current;
    
    // If a square is already selected
    if (selectedSquare) {
      // Try to make a move
      if (legalMoves.includes(square)) {
        makeMove(selectedSquare, square);
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
  useImperativeHandle(ref, () => ({
    updatePosition,
    getFen
  }), []);

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
            ${draggedPiece && draggedPiece.square === square ? 'dragging' : ''}
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
          {piece && (!draggedPiece || draggedPiece.square !== square) && (
            <div 
              className={`piece ${piece}`}
              style={{ 
                backgroundImage: `url(pieces-basic-png/${piece[0] === 'w' ? 'white' : 'black'}-${getPieceType(piece[1])}.png)` 
              }}
              onMouseDown={(e) => handleMouseDown(e, square, piece)}
            />
          )}
        </div>
      ))}
      
      {/* Dragged piece */}
      {draggedPiece && (
        <div 
          className={`piece ${draggedPiece.piece} dragged`}
          style={{
            backgroundImage: `url(pieces-basic-png/${draggedPiece.piece[0] === 'w' ? 'white' : 'black'}-${getPieceType(draggedPiece.piece[1])}.png)`,
            position: 'fixed',
            left: `${dragPosition.x}px`,
            top: `${dragPosition.y}px`,
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            pointerEvents: 'none',
            width: '12.5%',
            height: '12.5%'
          }}
        />
      )}
    </div>
  );
});

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
