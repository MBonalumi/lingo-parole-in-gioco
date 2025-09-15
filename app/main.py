from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from core.game_logic import GameLogic

app = FastAPI(title="Lingo Game API", description="Word guessing game API")

# Global game instance cache
game_instance: Optional[GameLogic] = None

class GuessRequest(BaseModel):
    guess: str

class GuessResponse(BaseModel):
    score: list[int]
    attempts: int
    round_over: bool
    round_won: bool
    current_word: Optional[str] = None  # Only revealed when round is over

class ResetRequest(BaseModel):
    word_length: int = 5
    old_words: list[str] = []

class GameStatus(BaseModel):
    word_length: int
    attempts: int
    max_attempts: int
    guesses: list[str]
    guess_state: list[str]
    round_over: bool
    round_won: bool

@app.get("/")
async def root():
    return {"message": "Lingo Game API", "status": "running"}

@app.post("/reset", response_model=GameStatus)
async def reset_game(request: ResetRequest):
    """Reset the game with a new word of specified length"""
    global game_instance
    
    try:
        game_instance = GameLogic(word_length=request.word_length)
        game_instance.initialize_round(old_words=request.old_words)
        
        return GameStatus(
            word_length=game_instance.word_length,
            attempts=game_instance.attempts,
            max_attempts=game_instance.max_attempts,
            guesses=game_instance.guesses,
            guess_state=game_instance.guess_state,
            round_over=game_instance.round_over,
            round_won=game_instance.round_won
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset game: {str(e)}")

@app.post("/guess", response_model=GuessResponse)
async def make_guess(request: GuessRequest):
    """Make a guess in the current game"""
    global game_instance
    
    if game_instance is None:
        raise HTTPException(status_code=400, detail="No active game. Please reset first.")
    
    if game_instance.round_over:
        raise HTTPException(status_code=400, detail="Round is over. Please reset to start a new round.")
    
    try:
        score = game_instance.make_guess(request.guess)
        
        return GuessResponse(
            score=score,
            attempts=game_instance.attempts,
            round_over=game_instance.round_over,
            round_won=game_instance.round_won,
            current_word=game_instance.current_word if game_instance.round_over else None
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process guess: {str(e)}")

@app.get("/status", response_model=GameStatus)
async def get_game_status():
    """Get current game status"""
    global game_instance
    
    if game_instance is None:
        raise HTTPException(status_code=400, detail="No active game. Please reset first.")
    
    return GameStatus(
        word_length=game_instance.word_length,
        attempts=game_instance.attempts,
        max_attempts=game_instance.max_attempts,
        guesses=game_instance.guesses,
        guess_state=game_instance.guess_state,
        round_over=game_instance.round_over,
        round_won=game_instance.round_won
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 