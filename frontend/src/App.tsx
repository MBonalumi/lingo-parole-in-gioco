import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

// Get API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
  const [selectedNumber, setSelectedNumber] = useState(5)
  const [currentRow, setCurrentRow] = useState(0)
  const [grid, setGrid] = useState<string[][]>([])
  const [response, setResponse] = useState('')
  const [roundOver, setRoundOver] = useState(false)
  const [scores, setScores] = useState<number[][]>([])
  const [knownLetters, setKnownLetters] = useState<string[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)

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
        // Trigger enter button functionality
        const enterButton = document.querySelector('button[data-enter="true"]') as HTMLButtonElement
        enterButton?.click()
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
    <>
      <NumberDropdown 
        value={selectedNumber} 
        onChange={setSelectedNumber} 
      />
      <ResetButton 
        wordLength={selectedNumber} 
        setGrid={setGrid}
        setCurrentRow={setCurrentRow}
        setResponse={setResponse}
        setScores={setScores}
        setRoundOver={setRoundOver}
        setKnownLetters={setKnownLetters}
        sessionId={sessionId}
        setSessionId={setSessionId}
      />
      <GameGrid grid={grid} scores={scores} />
      <EnterButton 
        grid={grid} 
        currentRow={currentRow} 
        setCurrentRow={setCurrentRow} 
        setResponse={setResponse}
        wordLength={selectedNumber}
        roundOver={roundOver}
        setScores={setScores}
        setRoundOver={setRoundOver}
        updateGridWithKnownLetters={updateGridWithKnownLetters}
        sessionId={sessionId}
      />
      <div style={{ marginTop: '20px' }}>
        <textarea 
          value={response} 
          readOnly 
          rows={5}
          style={{ width: '400px', padding: '10px', resize: 'vertical' }}
          placeholder="Response will appear here..."
        />
      </div>
    </>
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
  setResponse,
  setScores,
  setRoundOver,
  setKnownLetters,
  sessionId,
  setSessionId
}: { 
  wordLength: number,
  setGrid: (grid: string[][]) => void,
  setCurrentRow: (row: number) => void,
  setResponse: (response: string) => void,
  setScores: (scores: number[][]) => void,
  setRoundOver: (roundOver: boolean) => void,
  setKnownLetters: (knownLetters: string[]) => void,
  sessionId: string | null,
  setSessionId: (sessionId: string) => void
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
      setResponse('')
      setScores(Array(rows).fill(null).map(() => Array(cols).fill(0)))
      setRoundOver(false)
      setKnownLetters(Array(cols).fill(''))
      
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
      setResponse('Reset failed: ' + error)
    }
  }

  return (
    <button onClick={handleReset}>RESET</button>
  )
}

export function GameGrid({ grid, scores }: { grid: string[][], scores: number[][] }) {
  const getCellBackgroundColor = (score: number) => {
    switch (score) {
      case 2: return '#4ade80' // green for correct position
      case 1: return '#fbbf24' // yellow for correct letter, wrong position
      case -1: return '#ef4444' // red for error/invalid word
      default: return '#fff' // white for incorrect
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
                width: '40px',
                height: '40px',
                border: '2px solid #ccc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 'bold',
                backgroundColor: getCellBackgroundColor(scores[rowIndex]?.[colIndex] || 0)
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

export function EnterButton({ 
  grid, 
  currentRow, 
  setCurrentRow, 
  setResponse,
  wordLength,
  roundOver,
  setScores,
  setRoundOver,
  updateGridWithKnownLetters,
  sessionId
}: { 
  grid: string[][], 
  currentRow: number, 
  setCurrentRow: (row: number) => void,
  setResponse: (response: string) => void,
  wordLength: number,
  roundOver: boolean,
  setScores: (scores: number[][] | ((prev: number[][]) => number[][])) => void,
  setRoundOver: (roundOver: boolean) => void,
  updateGridWithKnownLetters: (guessState: string, targetRow: number) => void,
  sessionId: string | null
}) {
  const handleEnter = async () => {
    // Remove focus from the button to prevent accidental Enter key presses
    (document.activeElement as HTMLElement)?.blur()
    
    if (currentRow >= grid.length || roundOver) return
    
    const currentRowContent = grid[currentRow].join('')
    
    // Only proceed if the row is completely filled
    if (currentRowContent.length !== wordLength) {
      setResponse('Please fill the entire row before submitting')
      return
    }
    
    if (!sessionId) {
      setResponse('No session ID. Please reset the game first.')
      return
    }
    
    try {
      const response = await fetch(`${API_URL}/guess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guess: currentRowContent,
          session_id: sessionId
        })
      })
      
      const data = await response.json()
      setResponse(JSON.stringify(data, null, 2))

      if (response.status !== 200) {
        // Color all cells in the current row red (using score -1 as red indicator)
        setScores((prevScores: number[][]) => {
          const newScores = [...prevScores]
          newScores[currentRow] = Array(wordLength).fill(-1)
          return newScores
        })
        return
      }
      
      // Update scores with the returned score array
      if (data.score && Array.isArray(data.score)) {
        setScores((prevScores: number[][]) => {
          const newScores = [...prevScores]
          newScores[currentRow] = [...data.score] // Create a copy of the score array
          return newScores
        })
      }
      
      // Handle guess_state if present in response
      if (data.guess_state) {
        updateGridWithKnownLetters(data.guess_state, currentRow + 1)
      }
      
      // Check if round is over and move to next row
      if (data.round_over) {
        setRoundOver(true)
        return
      } else {
        setCurrentRow(currentRow + 1)
      }
    } catch (error) {
      console.error('Guess failed:', error)
      setResponse('Error: ' + error)
    }
  }

  const currentRowContent = grid[currentRow]?.join('') || ''
  const isRowFull = currentRowContent.length === wordLength

  return (
    <div style={{ marginTop: '10px' }}>
      <button 
        onClick={handleEnter} 
        data-enter="true"
        disabled={!isRowFull || roundOver}
        style={{ 
          padding: '10px 20px', 
          fontSize: '16px',
          backgroundColor: (isRowFull && !roundOver) ? '#007bff' : '#ccc',
          color: (isRowFull && !roundOver) ? 'white' : '#666',
          cursor: (isRowFull && !roundOver) ? 'pointer' : 'not-allowed'
        }}
      >
        ENTER
      </button>
    </div>
  )
}

export default App
