/*!
 * chessboard.js v1.0.0
 * A lightweight JavaScript chessboard library
 * https://github.com/oakmac/chessboardjs/
 * (c) 2019 Chris Oakman
 * License: MIT
 */

// This is a simplified version of chessboard.js for our Electron app
(function (global) {
  'use strict'

  // Constants
  const COLUMNS = 'abcdefgh'.split('')
  const ROWS = '12345678'.split('')
  
  // Default configuration
  const DEFAULT_CONFIG = {
    position: 'start',
    orientation: 'white',
    showNotation: true,
    draggable: false,
    dropOffBoard: 'snapback',
    pieceTheme: './img/chesspieces/wikipedia/{piece}.png',
    onDragStart: null,
    onDrop: null,
    onSnapEnd: null,
    onMoveEnd: null
  }
  
  // FEN starting position
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'
  
  // Piece codes
  const PIECE_TYPES = {
    'k': 'king',
    'q': 'queen',
    'r': 'rook',
    'b': 'bishop',
    'n': 'knight',
    'p': 'pawn'
  }
  
  // Utility functions
  function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj))
  }
  
  function validFen(fen) {
    return typeof fen === 'string'
  }
  
  function validPositionObject(pos) {
    return typeof pos === 'object'
  }
  
  function validSquare(square) {
    return typeof square === 'string' && square.length === 2 && 
           COLUMNS.includes(square[0]) && ROWS.includes(square[1])
  }
  
  // Convert FEN to position object
  function fenToObj(fen) {
    if (!validFen(fen)) return false
    
    const position = {}
    let row = 8
    let col = 0
    
    for (let i = 0; i < fen.length; i++) {
      const piece = fen[i]
      
      if (piece === '/') {
        row--
        col = 0
        continue
      }
      
      // Handle number (empty squares)
      if ('12345678'.includes(piece)) {
        col += parseInt(piece, 10)
        continue
      }
      
      // Handle piece
      const color = piece.toLowerCase() === piece ? 'b' : 'w'
      const pieceType = piece.toLowerCase()
      
      position[COLUMNS[col] + row] = color + pieceType
      col++
      
      // Stop at the end of the position part of the FEN string
      if (col === 8 && row === 1) break
    }
    
    return position
  }
  
  // Convert position object to FEN
  function objToFen(obj) {
    if (!validPositionObject(obj)) return false
    
    let fen = ''
    
    for (let row = 8; row > 0; row--) {
      let emptyCount = 0
      
      for (let col = 0; col < 8; col++) {
        const square = COLUMNS[col] + row
        
        if (obj[square]) {
          if (emptyCount > 0) {
            fen += emptyCount
            emptyCount = 0
          }
          fen += obj[square][0] === 'w' ? obj[square][1].toUpperCase() : obj[square][1]
        } else {
          emptyCount++
        }
      }
      
      if (emptyCount > 0) {
        fen += emptyCount
      }
      
      if (row > 1) {
        fen += '/'
      }
    }
    
    return fen
  }
  
  // Create the chessboard
  function createBoard(containerEl, config) {
    // Create board container
    const boardContainer = document.createElement('div')
    boardContainer.className = 'chessboard-container'
    
    // Create board
    const boardEl = document.createElement('div')
    boardEl.className = 'chessboard'
    boardContainer.appendChild(boardEl)
    
    // Create squares
    for (let row = 8; row > 0; row--) {
      for (let col = 0; col < 8; col++) {
        const square = document.createElement('div')
        square.className = 'square ' + ((row + col) % 2 === 0 ? 'white' : 'black')
        square.dataset.square = COLUMNS[col] + row
        
        if (config.showNotation) {
          // Add notation
          if (col === 0) {
            const rowNotation = document.createElement('div')
            rowNotation.className = 'notation row'
            rowNotation.textContent = row
            square.appendChild(rowNotation)
          }
          
          if (row === 1) {
            const colNotation = document.createElement('div')
            colNotation.className = 'notation col'
            colNotation.textContent = COLUMNS[col]
            square.appendChild(colNotation)
          }
        }
        
        boardEl.appendChild(square)
      }
    }
    
    // Add to container
    containerEl.appendChild(boardContainer)
    
    return boardEl
  }
  
  // Create a piece element
  function createPiece(piece, square) {
    const pieceEl = document.createElement('div')
    pieceEl.className = 'piece ' + piece
    pieceEl.dataset.piece = piece
    pieceEl.dataset.square = square
    return pieceEl
  }
  
  // Main Chessboard constructor
  function ChessBoard(containerElOrId, config) {
    // DOM elements
    let containerEl
    let boardEl
    
    // State
    let currentOrientation = 'white'
    let currentPosition = {}
    let draggedPiece = null
    let draggedPieceSource = null
    let isDragging = false
    
    // Config
    const cfg = Object.assign({}, DEFAULT_CONFIG, config)
    
    // Methods
    function setOrientation(orientation) {
      if (orientation === 'black') {
        currentOrientation = 'black'
        boardEl.classList.add('black-orientation')
      } else {
        currentOrientation = 'white'
        boardEl.classList.remove('black-orientation')
      }
    }
    
    function position(position, useAnimation) {
      // Get position as object
      let pos
      
      if (position === 'start') {
        pos = fenToObj(START_FEN)
      } else if (validFen(position)) {
        pos = fenToObj(position)
      } else if (validPositionObject(position)) {
        pos = deepCopy(position)
      } else {
        return currentPosition
      }
      
      // Set position
      currentPosition = pos
      
      // Clear board
      boardEl.querySelectorAll('.piece').forEach(piece => {
        piece.remove()
      })
      
      // Add pieces
      for (const square in pos) {
        if (validSquare(square)) {
          const piece = pos[square]
          const squareEl = boardEl.querySelector(`.square[data-square="${square}"]`)
          
          if (squareEl) {
            squareEl.appendChild(createPiece(piece, square))
          }
        }
      }
      
      return currentPosition
    }
    
    function fen() {
      return objToFen(currentPosition)
    }
    
    function clear() {
      position({})
    }
    
    function resize() {
      // Implement resize logic if needed
    }
    
    // Initialize
    function init() {
      // Get container
      if (typeof containerElOrId === 'string') {
        containerEl = document.getElementById(containerElOrId)
      } else {
        containerEl = containerElOrId
      }
      
      if (!containerEl) {
        throw new Error('Container element not found')
      }
      
      // Create board
      boardEl = createBoard(containerEl, cfg)
      
      // Set orientation
      setOrientation(cfg.orientation)
      
      // Set position
      position(cfg.position)
      
      // Set up drag and drop if enabled
      if (cfg.draggable) {
        setupDragAndDrop()
      }
    }
    
    // Drag and drop functionality
    function setupDragAndDrop() {
      // Mouse down on piece
      boardEl.addEventListener('mousedown', function(e) {
        const pieceEl = e.target.closest('.piece')
        if (!pieceEl) return
        
        const square = pieceEl.dataset.square
        const piece = pieceEl.dataset.piece
        
        // Check if drag is allowed
        if (typeof cfg.onDragStart === 'function') {
          const result = cfg.onDragStart(square, piece, deepCopy(currentPosition), currentOrientation)
          if (result === false) return
        }
        
        // Start dragging
        isDragging = true
        draggedPiece = pieceEl
        draggedPieceSource = square
        
        // Style the piece
        pieceEl.classList.add('dragging')
        
        // Prevent default to avoid text selection
        e.preventDefault()
      })
      
      // Mouse move
      document.addEventListener('mousemove', function(e) {
        if (!isDragging || !draggedPiece) return
        
        // Move the piece
        const boardRect = boardEl.getBoundingClientRect()
        const squareSize = boardRect.width / 8
        
        const left = e.clientX - boardRect.left - squareSize / 2
        const top = e.clientY - boardRect.top - squareSize / 2
        
        draggedPiece.style.position = 'absolute'
        draggedPiece.style.left = left + 'px'
        draggedPiece.style.top = top + 'px'
        draggedPiece.style.zIndex = 1000
      })
      
      // Mouse up
      document.addEventListener('mouseup', function(e) {
        if (!isDragging || !draggedPiece) return
        
        // Reset dragging state
        isDragging = false
        
        // Get the target square
        const boardRect = boardEl.getBoundingClientRect()
        const squareSize = boardRect.width / 8
        
        const col = Math.floor((e.clientX - boardRect.left) / squareSize)
        const row = 7 - Math.floor((e.clientY - boardRect.top) / squareSize)
        
        let targetSquare = null
        
        if (col >= 0 && col < 8 && row >= 0 && row < 8) {
          targetSquare = COLUMNS[col] + (row + 1)
        }
        
        // Handle the drop
        if (targetSquare) {
          // Call onDrop callback
          if (typeof cfg.onDrop === 'function') {
            const result = cfg.onDrop(draggedPieceSource, targetSquare, draggedPiece.dataset.piece)
            
            if (result === 'snapback') {
              // Snap back to source square
              snapbackDraggedPiece()
            } else {
              // Move was accepted
              dropDraggedPieceOnSquare(targetSquare)
            }
          } else {
            // Default behavior: move the piece
            dropDraggedPieceOnSquare(targetSquare)
          }
        } else {
          // Dropped off the board
          if (cfg.dropOffBoard === 'snapback') {
            snapbackDraggedPiece()
          } else {
            // Remove the piece
            draggedPiece.remove()
            draggedPiece = null
            
            // Update position
            delete currentPosition[draggedPieceSource]
          }
        }
      })
    }
    
    function snapbackDraggedPiece() {
      // Reset the piece position
      draggedPiece.classList.remove('dragging')
      draggedPiece.style.position = ''
      draggedPiece.style.left = ''
      draggedPiece.style.top = ''
      draggedPiece.style.zIndex = ''
      
      // Call onSnapEnd callback
      if (typeof cfg.onSnapEnd === 'function') {
        cfg.onSnapEnd(draggedPieceSource, draggedPieceSource, draggedPiece.dataset.piece)
      }
      
      draggedPiece = null
    }
    
    function dropDraggedPieceOnSquare(square) {
      // Update position
      const piece = draggedPiece.dataset.piece
      delete currentPosition[draggedPieceSource]
      currentPosition[square] = piece
      
      // Update the DOM
      position(currentPosition)
      
      // Call onSnapEnd callback
      if (typeof cfg.onSnapEnd === 'function') {
        cfg.onSnapEnd(draggedPieceSource, square, piece)
      }
      
      draggedPiece = null
    }
    
    // Initialize the board
    init()
    
    // Public API
    return {
      position: position,
      orientation: setOrientation,
      clear: clear,
      fen: fen,
      resize: resize
    }
  }
  
  // Export
  if (typeof window !== 'undefined') {
    window.Chessboard = ChessBoard
  }
  
  // For CommonJS/Node.js
  if (typeof exports !== 'undefined') {
    exports.Chessboard = ChessBoard
  }
  
})(this);
