import numpy as np
import pickle as pkl
import pandas as pd

class GameLogic:
    def __init__(
        self,
        word_length: int,
    ):
        self.word_length = word_length
        self.initialize_game()


    def initialize_game(self):
        self.words_database = pd.read_csv(f"resources/ready/words{self.word_length}.csv",header=None).loc[:,0].to_numpy()
        self.initialize_round() #TODO: might be that initialization is on command, not on game init

    def initialize_round(self, old_words: list[str] = []):
        self.current_word = np.random.choice(
            self.words_database[~np.isin(self.words_database, old_words)]
        ).lower()

        self.attempts = 0
        self.max_attempts = self.word_length + 1
        self.guesses = []
        # self.guess_state = [0]*self.word_length # 0=not guessed, 1=yellow, 2=green
        self.guess_state = ['_']*self.word_length # '_'=not guessed, letter=guessed correctly
        self.round_over = False
        self.round_won = False


    def _score_guess(self, guess: str):
        """
        Returns a list of scores, positionally aligned with the letters.
        2 = correct letter, correct position
        1 = correct letter, wrong position
        0 = incorrect letter
        """
        word_letters_count = {
            letter: self.current_word.count(letter) for letter in set(self.current_word)
        }
        # First pass: correct letters in correct positions
        score = [0]*self.word_length
        for i,c in enumerate(guess):
            if c == self.current_word[i]:
                score[i] = 2
                word_letters_count[c] -= 1

        # Second pass: correct letters in wrong positions
        # Why two passes? i need all the 2s to be sure to not overcount letters.
        #   I may put a yellow in position 0 while the letter should only give a green in position 4
        for i,c in enumerate(guess):
            if score[i] == 0 and c in word_letters_count and word_letters_count[c] > 0:
                score[i] = 1
                word_letters_count[c] -= 1
        
        return score


    def make_guess(self, guess: str):
        if len(guess) != self.word_length:
            raise ValueError(f"Guess must be {self.word_length} letters long.")
        guess = guess.lower()

        self.attempts += 1
        self.guesses.append(guess)

        self.round_won = guess == self.current_word
        # if self.round_won:
        #     self.guess_state = list(self.current_word)
        self.round_over = self.round_won or self.attempts>=self.max_attempts
        # if self.round_over:
        #     return self.guess_state
        
        score = self._score_guess(guess)

        for s_i, s in enumerate(score):
            if s == 2:
                self.guess_state[s_i] = self.current_word[s_i]

        # self.guess_state = [2*int(s1==2 or s2==2) for s1,s2 in zip(self.guess_state,score)]
        return score
        

