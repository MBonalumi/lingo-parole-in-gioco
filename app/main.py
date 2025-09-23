from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict
from core.game_logic import GameLogic
import uuid
import logging
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("lingo_game")

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://mbonalumi.github.io",  # Replace with your GitHub Pages URL
        "http://localhost:5173",  # For local development
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session-based game instances
game_sessions: Dict[str, GameLogic] = {}

class GuessRequest(BaseModel):
    guess: str
    session_id: Optional[str] = None

class GuessResponse(BaseModel):
    score: list[int]
    attempts: int
    round_over: bool
    round_won: bool
    guess_state: list[str]
    current_word: Optional[str] = None  # Only revealed when round is over
    session_id: str

class ResetRequest(BaseModel):
    word_length: int = 5
    old_words: list[str] = []
    session_id: Optional[str] = None

class GameStatus(BaseModel):
    word_length: int
    attempts: int
    max_attempts: int
    guesses: list[str]
    guess_state: list[str]
    round_over: bool
    round_won: bool
    session_id: str

@app.get("/")
async def root():
    return {"message": "Lingo Game API", "status": "running"}

@app.post("/reset", response_model=GameStatus)
async def reset_game(request: ResetRequest):
    """Reset the game with a new word of specified length"""
    # Create new session ID if not provided
    session_id = request.session_id or str(uuid.uuid4())
    is_new_session = request.session_id is None
    
    logger.info(f"{'New' if is_new_session else 'Existing'} session reset - ID: {session_id}, word_length: {request.word_length}")
    
    try:
        game_instance = GameLogic(word_length=request.word_length)
        game_instance.initialize_round(old_words=request.old_words)
        
        # Store in sessions
        game_sessions[session_id] = game_instance
        
        logger.info(f"Game initialized for session {session_id} - target word set, first letter: {game_instance.guess_state[0] if game_instance.guess_state else 'None'}")
        
        return GameStatus(
            word_length=game_instance.word_length,
            attempts=game_instance.attempts,
            max_attempts=game_instance.max_attempts,
            guesses=game_instance.guesses,
            guess_state=game_instance.guess_state,
            round_over=game_instance.round_over,
            round_won=game_instance.round_won,
            session_id=session_id
        )
    except Exception as e:
        logger.error(f"Reset failed for session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reset game: {str(e)}")

@app.post("/guess", response_model=GuessResponse)
async def make_guess(request: GuessRequest):
    """Make a guess in the current game"""
    if not request.session_id:
        logger.warning("Guess attempt without session ID")
        raise HTTPException(status_code=400, detail="Session ID is required.")
    
    if request.session_id not in game_sessions:
        logger.warning(f"Guess attempt for unknown session: {request.session_id}")
        raise HTTPException(status_code=400, detail="No active game for this session. Please reset first.")
    
    game_instance = game_sessions[request.session_id]
    
    if game_instance.round_over:
        logger.info(f"Guess attempt on finished game - session: {request.session_id}")
        raise HTTPException(status_code=400, detail="Round is over. Please reset to start a new round.")
    
    logger.info(f"Session {request.session_id} - Guess #{game_instance.attempts + 1}: '{request.guess}'")
    
    try:
        score = game_instance.make_guess(request.guess)
        
        logger.info(f"Session {request.session_id} - Score: {score}, Round over: {game_instance.round_over}, Won: {game_instance.round_won}")
        
        if game_instance.round_over:
            logger.info(f"Session {request.session_id} - Game finished! Target word was: '{game_instance.current_word}'")
        
        return GuessResponse( 
            score=score,
            attempts=game_instance.attempts,
            round_over=game_instance.round_over,
            round_won=game_instance.round_won,
            guess_state=game_instance.guess_state,
            current_word=game_instance.current_word if game_instance.round_over else None,
            session_id=request.session_id
        )
    except ValueError as e:
        logger.warning(f"Session {request.session_id} - Invalid guess '{request.guess}': {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Session {request.session_id} - Guess processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process guess: {str(e)}")

@app.get("/status/{session_id}", response_model=GameStatus)
async def get_game_status(session_id: str):
    """Get current game status for a session"""
    if session_id not in game_sessions:
        logger.warning(f"Status request for unknown session: {session_id}")
        raise HTTPException(status_code=400, detail="No active game for this session. Please reset first.")
    
    logger.debug(f"Status request for session: {session_id}")
    game_instance = game_sessions[session_id]
    
    return GameStatus(
        word_length=game_instance.word_length,
        attempts=game_instance.attempts,
        max_attempts=game_instance.max_attempts,
        guesses=game_instance.guesses,
        guess_state=game_instance.guess_state,
        round_over=game_instance.round_over,
        round_won=game_instance.round_won,
        session_id=session_id
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)