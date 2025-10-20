import { useState, useEffect } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import './App.css'

// Get API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
  const [selectedNumber, setSelectedNumber] = useState(5)
  const [currentRow, setCurrentRow] = useState(0)
  const [grid, setGrid] = useState<string[][]>([])
  const [roundOver, setRoundOver] = useState(false)
  const [scores, setScores] = useState<number[][]>([])
  const [knownLetters, setKnownLetters] = useState<string[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [keyboardStates, setKeyboardStates] = useState<Record<string, number>>({})
  const [showPopup, setShowPopup] = useState(false)
  const [gameResult, setGameResult] = useState<{won: boolean, correctWord?: string}>({won: false})
  const [showSettings, setShowSettings] = useState(false)
  const [toasts, setToasts] = useState<{id: number, message: string, type: 'error' | 'info'}[]>([])

  // Toast functions
  const showToast = (message: string, type: 'error' | 'info' = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id))
    }, 3000)
  }

  // Initialize grid when selectedNumber changes
  useEffect(() => {
    const rows = selectedNumber + 1
    const cols = selectedNumber
    const newGrid = Array(rows).fill(null).map(() => Array(cols).fill(''))
    setGrid(newGrid)
    setCurrentRow(0)
    setScores(Array(rows).fill(null).map(() => Array(cols).fill(0)))
    setRoundOver(false)
    setKnownLetters(Array(cols).fill(''))
  }, [selectedNumber])

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (currentRow >= grid.length || roundOver) return

      const currentRowData = grid[currentRow]
      if (!currentRowData) return // Safety check
      
      const currentPos = currentRowData.findIndex(cell => cell === '')

      if (event.key === 'Enter') {
        // Submit the current row
        if (currentRow < grid.length && !roundOver) {
          const currentRowContent = grid[currentRow].join('')
          if (currentRowContent.length === selectedNumber) {
            // Create a synthetic click on the virtual keyboard ENTER button
            const enterButton = document.querySelector('[data-key="ENTER"]') as HTMLButtonElement
            enterButton?.click()
          }
        }
      } else if (event.key === 'Backspace' && currentPos !== 0) {
        // Find last filled position and clear it
        const lastFilledPos = currentRowData.length - 1 - [...currentRowData].reverse().findIndex(cell => cell !== '')
        // Don't allow deletion of pre-hinted letters (position 0 when it has a known letter)
        if (lastFilledPos >= 0 && !(lastFilledPos === 0 && knownLetters[0] && knownLetters[0] !== '_')) {
          const newGrid = [...grid]
          newGrid[currentRow][lastFilledPos] = ''
          setGrid(newGrid)
          
          // If row was all red (error state), reset scores to white
          setScores((prevScores: number[][]) => {
            const newScores = [...prevScores]
            const currentRowScores = newScores[currentRow] || []
            if (currentRowScores.every(score => score === -1)) {
              newScores[currentRow] = Array(currentRowData.length).fill(0)
            }
            return newScores
          })
        }
      } else if (/^[a-zA-Z]$/.test(event.key) && currentPos !== -1) {
        // Don't allow typing over pre-hinted letters (position 0 when it has a known letter)
        if (!(currentPos === 0 && knownLetters[0] && knownLetters[0] !== '_')) {
          const newGrid = [...grid]
          newGrid[currentRow][currentPos] = event.key.toUpperCase()
          setGrid(newGrid)
        }
      }

    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [grid, currentRow, roundOver, knownLetters])

  // Update grid with known letters from guess_state (only first letter as hint)
  const updateGridWithKnownLetters = (guessState: string, targetRow: number) => {
    setKnownLetters(Array.from(guessState))
    
    // Update the target row in the grid to include only the first letter as hint
    if (targetRow < grid.length) {
      const newGrid = [...grid]
      // Only show the first letter if it's known
      if (guessState[0] && guessState[0] !== '_') {
        newGrid[targetRow][0] = guessState[0].toUpperCase()
      }
      setGrid(newGrid)
    }
  }

  return (
    <div style={{ 
      maxWidth: '100vw', 
      padding: '10px', 
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100vh',
      position: 'relative'
    }}>
      {/* Settings button in top right */}
      <button
        onClick={() => setShowSettings(true)}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          width: '40px',
          height: '40px',
          backgroundColor: '#3d3d3dff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px'
        }}
      >
        ⚙️
      </button>

      <ResetButton 
        wordLength={selectedNumber} 
        setGrid={setGrid}
        setCurrentRow={setCurrentRow}
        setScores={setScores}
        setRoundOver={setRoundOver}
        setKnownLetters={setKnownLetters}
        sessionId={sessionId}
        setSessionId={setSessionId}
        setKeyboardStates={setKeyboardStates}
        setShowPopup={setShowPopup}
        showToast={showToast}
      />
      <GameGrid grid={grid} scores={scores} />
      <VirtualKeyboard 
        keyboardStates={keyboardStates}
        onKeyPress={(key) => {
          // Simulate keyboard event
          const event = new KeyboardEvent('keydown', { key });
          window.dispatchEvent(event);
        }}
        onEnter={() => {
          // Handle Enter button functionality
          if (currentRow >= grid.length || roundOver) return
          
          const currentRowContent = grid[currentRow].join('')
          
          // Only proceed if the row is completely filled
          if (currentRowContent.length !== selectedNumber) {
            showToast('Completa la riga prima di inviarla', 'error')
            return
          }
          
          if (!sessionId) {
            showToast('Nessun ID sessione. Resetta il gioco prima.', 'error')
            return
          }
          
          // Call the guess API
          fetch(`${API_URL}/guess`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              guess: currentRowContent,
              session_id: sessionId
            })
          })
          .then(response => response.json().then(data => ({ status: response.status, data })))
          .then(({ status, data }) => {
            if (status !== 200) {
              // Color all cells in the current row red (using score -1 as red indicator)
              setScores((prevScores: number[][]) => {
                const newScores = [...prevScores]
                newScores[currentRow] = Array(selectedNumber).fill(-1)
                return newScores
              })
              showToast(data.detail || 'Parola non valida', 'error')
              return
            }
            
            // Update scores with the returned score array
            if (data.score && Array.isArray(data.score)) {
              setScores((prevScores: number[][]) => {
                const newScores = [...prevScores]
                newScores[currentRow] = [...data.score] // Create a copy of the score array
                return newScores
              })
              
              // Update keyboard states based on the score
              const currentRowContent = grid[currentRow]
              setKeyboardStates(prevStates => {
                const newStates = { ...prevStates }
                currentRowContent.forEach((letter, index) => {
                  const score = data.score[index]
                  const currentState = newStates[letter]
                  
                  // If letter hasn't been tried yet (undefined) or new score is better
                  // Don't downgrade from positive scores (1 or 2) to 0
                  if (currentState === undefined || (score > currentState) || (score === 0 && (currentState === undefined || currentState < 0))) {
                    console.log(`Setting keyboard state for ${letter}: ${score} (was ${currentState})`)
                    newStates[letter] = score
                  }
                })
                console.log('New keyboard states:', newStates)
                return newStates
              })
            }
            
            // Handle guess_state if present in response
            if (data.guess_state) {
              updateGridWithKnownLetters(data.guess_state, currentRow + 1)
            }
            
            // Check if round is over and show popup with delay
            if (data.round_over) {
              setRoundOver(true)
              
              // Determine if player won (all letters in current guess are correct)
              const won = data.score && data.score.every((score: number) => score === 2)
              
              setTimeout(() => {
                setGameResult({
                  won,
                  correctWord: data.current_word || data.word || 'Unknown'
                })
                setShowPopup(true)
              }, 500) // 0.5 second delay
              
              return
            } else {
              setCurrentRow(currentRow + 1)
            }
          })
          .catch(error => {
            console.error('Guess failed:', error)
            showToast('Errore di connessione', 'error')
          })
        }}
        onBackspace={() => {
          const event = new KeyboardEvent('keydown', { key: 'Backspace' });
          window.dispatchEvent(event);
        }}
      />
      
      {/* Toast notifications */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              backgroundColor: toast.type === 'error' ? '#ef4444' : '#3b82f6',
              color: 'white',
              padding: '12px 20px',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              animation: 'slideIn 0.3s ease-out',
              minWidth: '200px',
              textAlign: 'center'
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
      
      {showPopup && (
        <GameResultPopup 
          won={gameResult.won}
          correctWord={gameResult.correctWord}
          onClose={() => setShowPopup(false)}
        />
      )}

      {showSettings && (
        <SettingsPopup 
          selectedNumber={selectedNumber}
          setSelectedNumber={setSelectedNumber}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

export function NumberDropdown({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {[5, 6, 7, 8, 9].map(num => (
        <option key={num} value={num}>
          {num}
        </option>
      ))}
    </select>
  )
}

export function ResetButton({ 
  wordLength,
  setGrid,
  setCurrentRow,
  setScores,
  setRoundOver,
  setKnownLetters,
  sessionId,
  setSessionId,
  setKeyboardStates,
  setShowPopup,
  showToast
}: { 
  wordLength: number,
  setGrid: (grid: string[][]) => void,
  setCurrentRow: (row: number) => void,
  setScores: (scores: number[][]) => void,
  setRoundOver: (roundOver: boolean) => void,
  setKnownLetters: (knownLetters: string[]) => void,
  sessionId: string | null,
  setSessionId: (sessionId: string) => void,
  setKeyboardStates: (states: Record<string, number>) => void,
  setShowPopup: (show: boolean) => void,
  showToast: (message: string, type?: 'error' | 'info') => void
}) {
  const handleReset = async () => {
    // Remove focus from the button to prevent accidental Enter key presses
    (document.activeElement as HTMLElement)?.blur()
    
    try {
      // Reset local state
      const rows = wordLength + 1
      const cols = wordLength
      const newGrid = Array(rows).fill(null).map(() => Array(cols).fill(''))
      setGrid(newGrid)
      setCurrentRow(0)
      setScores(Array(rows).fill(null).map(() => Array(cols).fill(0)))
      setRoundOver(false)
      setKnownLetters(Array(cols).fill(''))
      setKeyboardStates({})
      setShowPopup(false)
      
      // Call backend reset
      const response = await fetch(`${API_URL}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          word_length: wordLength,
          old_words: [],
          session_id: sessionId
        })
      })
      
      const data = await response.json()
      
      // Set session ID from response
      if (data.session_id) {
        setSessionId(data.session_id)
        showToast('Nuovo gioco iniziato!')
      }
      
      // Handle guess_state from reset response
      if (data.guess_state) {
        setKnownLetters(Array.from(data.guess_state))
        
        // Update the first row with only the first letter if it's known
        const newGridWithKnown = [...newGrid]
        if (data.guess_state[0] && data.guess_state[0] !== '_') {
          newGridWithKnown[0][0] = data.guess_state[0].toUpperCase()
        }
        setGrid(newGridWithKnown)
      }
    } catch (error) {
      console.error('Reset failed:', error)
      showToast('Errore nel reset del gioco', 'error')
    }
  }

  return (
    <button onClick={handleReset}
    style={{
      marginLeft: '10px',
      color: 'white',
      backgroundColor: '#3d3d3dff',
      border: '0px solid #9ca3af',
      borderRadius: '4px',
      padding: '6px 12px',
      cursor: 'pointer' 
    }}
    >RESET</button>
  )
}

export function GameGrid({ grid, scores }: { grid: string[][], scores: number[][] }) {
  const getCellBackgroundColor = (score: number) => {
    switch (score) {
      case 2: return '#39ad63ff' // green for correct position  
      case 1: return '#fbbf24' // yellow for correct letter, wrong position
      case -1: return '#ef4444' // red for error/invalid word
      default: return '#454545ff' // dark grey for incorrect/empty
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '20px', alignItems: 'center' }}>
      {grid.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: 'flex', gap: '5px' }}>
          {row.map((cell, colIndex) => (
            <div
              key={colIndex}
              style={{
                width: '50px',
                height: '50px',
                border: '0px solid #ccc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 'bold',
                backgroundColor: getCellBackgroundColor(scores[rowIndex]?.[colIndex] || 0),
                color: 'white',
              }}
            >
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function VirtualKeyboard({ 
  keyboardStates, 
  onKeyPress, 
  onEnter, 
  onBackspace 
}: { 
  keyboardStates: Record<string, number>
  onKeyPress: (key: string) => void
  onEnter: () => void
  onBackspace: () => void
}) {  
  const getKeyBackgroundColor = (letter: string) => {
    const state = keyboardStates[letter]
    console.log(`Getting color for ${letter}: state=${state}`)
    
    // If state is explicitly set
    if (state !== undefined) {
      switch (state) {
        case 2: return '#39ad63ff' // green for correct position
        case 1: return '#fbbf24' // yellow for correct letter, wrong position
        case 0: return '#272727ff' // dark gray for confirmed not in word
        case -1: return '#ef4444' // red for error/invalid word
        default: return '#646464ff' // light gray fallback
      }
    } 
    
    // Default for unused letters 
    return '#5c5c5cff' // light gray for unused
  }
  
  const keyRows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫']
  ]

  const handleKeyClick = (key: string) => {
    if (key === 'ENTER') {
      onEnter()
    } else if (key === '⌫') {
      onBackspace()
    } else {
      onKeyPress(key)
    }
  }

  return (
    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
      {keyRows.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: 'flex', gap: '3px', color: 'white' }}>
          {row.map((key) => (
            <button
              key={key}
              data-key={key}
              onClick={() => handleKeyClick(key)}
              style={{
                padding: key === 'ENTER' || key === '⌫' ? '8px 12px' : '8px 6px',
                fontSize: '14px',
                fontWeight: 'bold',
                border: '0px solid #9ca3af',
                borderRadius: '4px',
                backgroundColor: key === 'ENTER' || key === '⌫' ? '#3d3d3dff' : getKeyBackgroundColor(key),
                color: 'white',
                cursor: 'pointer',
                minWidth: key === 'ENTER' ? '60px' : key === '⌫' ? '40px' : '32px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

export function GameResultPopup({ 
  won, 
  correctWord, 
  onClose 
}: { 
  won: boolean
  correctWord?: string
  onClose: () => void 
}) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#2d2d2d',
        padding: '30px',
        borderRadius: '10px',
        textAlign: 'center',
        color: 'white',
        minWidth: '250px',
        border: '2px solid #454545'
      }}>
        <h2 style={{
          margin: '0 0 15px 0',
          color: won ? '#39ad63ff' : '#ef4444',
          fontSize: '24px'
        }}>
          {won ? '🎉 Congratulazioni!' : '😔 Game Over'}
        </h2>
        
        <p style={{
          margin: '0 0 20px 0',
          fontSize: '18px'
        }}>
          {won ? 'Hai indovinato!' : `La parola era:`}
        </p>
        
        {!won && correctWord && (
          <div style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#fbbf24',
            margin: '0 0 20px 0',
            letterSpacing: '2px'
          }}>
            {correctWord.toUpperCase()}
          </div>
        )}
        
        <button
          onClick={onClose}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#3d3d3dff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

export function SettingsPopup({ 
  selectedNumber, 
  setSelectedNumber, 
  onClose 
}: { 
  selectedNumber: number
  setSelectedNumber: (value: number) => void
  onClose: () => void 
}) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#2d2d2d',
        padding: '30px',
        borderRadius: '10px',
        color: 'white',
        minWidth: '300px',
        border: '2px solid #454545'
      }}>
        <h2 style={{
          margin: '0 0 20px 0',
          fontSize: '24px',
          textAlign: 'center'
        }}>
          ⚙️ Impostazioni
        </h2>
        
        <div style={{
          marginBottom: '20px'
        }}>
          <label style={{
            display: 'block',
            marginBottom: '10px',
            fontSize: '16px'
          }}>
            Lunghezza parola:
          </label>
          <select 
            value={selectedNumber} 
            onChange={(e) => setSelectedNumber(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '16px',
              backgroundColor: '#454545ff',
              color: 'white',
              border: '1px solid #646464ff',
              borderRadius: '4px'
            }}
          >
            {[5, 6, 7, 8, 9].map(num => (
              <option key={num} value={num}>
                {num} lettere
              </option>
            ))}
          </select>
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'center'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#3d3d3dff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
