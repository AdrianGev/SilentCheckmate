/*!
 * chessboard.js v1.0.0
 * A lightweight JavaScript chessboard library
 * https://github.com/oakmac/chessboardjs/
 * (c) 2019 Chris Oakman
 * License: MIT
 */

(function (global) {
  'use strict'

  // constants
  const COLUMNS = 'abcdefgh'.split('')
  const ROWS = '12345678'.split('')
  
  // default configuration
  const DEFAULT_CONFIG = {
    position: 'start',
    orientation: 'white',
    showNotation: true,
    draggable: false,
    dropOffBoard: 'snapback',
    pieceTheme: function(piece) {
      const color = piece.charAt(0) === 'w' ? 'white' : 'black';
      const pieceType = getPieceType(piece.charAt(1));
      return `../pieces-basic-png/${color}-${pieceType}.png`;
    },
    onDragStart: null,
    onDrop: null,
    onSnapEnd: null,
    onMoveEnd: null
  }
  
  // fen starting position
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'
  
  // piece codes
  const PIECE_TYPES = {
    'k': 'king',
    'q': 'queen',
    'r': 'rook',
    'b': 'bishop',
    'n': 'knight',
    'p': 'pawn'
  }
  
  // utility functions
  function getPieceType(pieceCode) {
    switch(pieceCode.toLowerCase()) {
      case 'k': return 'king';
      case 'q': return 'queen';
      case 'r': return 'rook';
      case 'b': return 'bishop';
      case 'n': return 'knight';
      case 'p': return 'pawn';
      default: return 'pawn';
    }
  }
  
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
  
  // convert fen to position object
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
  
  // convert position object to fen
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
  
  // create the chessboard
  function createBoard(containerEl, config) {
    // create board container
    const boardContainer = document.createElement('div')
    boardContainer.className = 'chessboard-container'
    
    // create board
    const boardEl = document.createElement('div')
    boardEl.className = 'chessboard'
    boardContainer.appendChild(boardEl)
    
    // create squares
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
  
  // create a piece element
  function createPiece(piece, square) {
    const pieceEl = document.createElement('div')
    pieceEl.className = 'piece ' + piece
    pieceEl.dataset.piece = piece
    pieceEl.dataset.square = square
    return pieceEl
  }
  
  // main chessboard constructor
  function ChessBoard(containerElOrId, config) {
    // dom elements
    let containerEl
    let boardEl
    
    // state
    let currentOrientation = 'white'
    let currentPosition = {}
    let draggedPiece = null
    let draggedPieceSource = null
    let isDragging = false
    
    // config
    const cfg = Object.assign({}, DEFAULT_CONFIG, config)
    
    // methods
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
      // get position as object
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
      
      // set position
      currentPosition = pos
      
      // clear board
      boardEl.querySelectorAll('.piece').forEach(piece => {
        piece.remove()
      })
      
      // add pieces
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
      // implement resize logic if needed
    }
    
    // initialize
    function init() {
      // get container
      if (typeof containerElOrId === 'string') {
        containerEl = document.getElementById(containerElOrId)
      } else {
        containerEl = containerElOrId
      }
      
      if (!containerEl) {
        throw new Error('Container element not found')
      }
      
      // create board
      boardEl = createBoard(containerEl, cfg)
      
      // set orientation
      setOrientation(cfg.orientation)
      
      // set position
      position(cfg.position)
      
      // set up drag and drop if enabled
      if (cfg.draggable) {
        setupDragAndDrop()
      }
    }
    
    // drag and drop functionality
    function setupDragAndDrop() {
      // mouse down on piece
      boardEl.addEventListener('mousedown', function(e) {
        const pieceEl = e.target.closest('.piece')
        if (!pieceEl) return
        
        const square = pieceEl.dataset.square
        const piece = pieceEl.dataset.piece
        
        // check if drag is allowed
        if (typeof cfg.onDragStart === 'function') {
          const result = cfg.onDragStart(square, piece, deepCopy(currentPosition), currentOrientation)
          if (result === false) return
        }
        
        // start dragging
        isDragging = true
        draggedPiece = pieceEl
        draggedPieceSource = square
        
        // style the piece
        pieceEl.classList.add('dragging')
        
        // prevent default to avoid text selection
        e.preventDefault()
      })
      
      // mouse move
      document.addEventListener('mousemove', function(e) {
        if (!isDragging || !draggedPiece) return
        
        // move the piece
        const boardRect = boardEl.getBoundingClientRect()
        const squareSize = boardRect.width / 8
        
        const left = e.clientX - boardRect.left - squareSize / 2
        const top = e.clientY - boardRect.top - squareSize / 2
        
        draggedPiece.style.position = 'absolute'
        draggedPiece.style.left = left + 'px'
        draggedPiece.style.top = top + 'px'
        draggedPiece.style.zIndex = 1000
      })
      
      // mouse up
      document.addEventListener('mouseup', function(e) {
        if (!isDragging || !draggedPiece) return
        
        // reset dragging state
        isDragging = false
        
        // get the target square
        const boardRect = boardEl.getBoundingClientRect()
        const squareSize = boardRect.width / 8
        
        const col = Math.floor((e.clientX - boardRect.left) / squareSize)
        const row = 7 - Math.floor((e.clientY - boardRect.top) / squareSize)
        
        let targetSquare = null
        
        if (col >= 0 && col < 8 && row >= 0 && row < 8) {
          targetSquare = COLUMNS[col] + (row + 1)
        }
        
        // handle the drop
        if (targetSquare) {
          // call onDrop callback
          if (typeof cfg.onDrop === 'function') {
            const result = cfg.onDrop(draggedPieceSource, targetSquare, draggedPiece.dataset.piece)
            
            if (result === 'snapback') {
              // snap back to source square
              snapbackDraggedPiece()
            } else {
              // move was accepted
              dropDraggedPieceOnSquare(targetSquare)
            }
          } else {
            // default behavior: move the piece
            dropDraggedPieceOnSquare(targetSquare)
          }
        } else {
          // dropped off the board
          if (cfg.dropOffBoard === 'snapback') {
            snapbackDraggedPiece()
          } else {
            // remove the piece
            draggedPiece.remove()
            draggedPiece = null
            
            // update position
            delete currentPosition[draggedPieceSource]
          }
        }
      })
    }
    
    function snapbackDraggedPiece() {
      // reset the piece position
      draggedPiece.classList.remove('dragging')
      draggedPiece.style.position = ''
      draggedPiece.style.left = ''
      draggedPiece.style.top = ''
      draggedPiece.style.zIndex = ''
      
      // call onSnapEnd callback
      if (typeof cfg.onSnapEnd === 'function') {
        cfg.onSnapEnd(draggedPieceSource, draggedPieceSource, draggedPiece.dataset.piece)
      }
      
      draggedPiece = null
    }
    
    function dropDraggedPieceOnSquare(square) {
      // update position
      const piece = draggedPiece.dataset.piece
      delete currentPosition[draggedPieceSource]
      currentPosition[square] = piece
      
      // update the dom
      position(currentPosition)
      
      // call onSnapEnd callback
      if (typeof cfg.onSnapEnd === 'function') {
        cfg.onSnapEnd(draggedPieceSource, square, piece)
      }
      
      draggedPiece = null
    }
    
    // initialize the board
    init()
    
    // public api
    return {
      position: position,
      orientation: setOrientation,
      clear: clear,
      fen: fen,
      resize: resize
    }
  }
  
  // export
  if (typeof window !== 'undefined') {
    window.Chessboard = ChessBoard
  }
  
  // for CommonJS/Node.js
  if (typeof exports !== 'undefined') {
    exports.Chessboard = ChessBoard
  }
  
})(this);
