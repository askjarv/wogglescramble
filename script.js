class BoggleGame {
    constructor() {
        this.grid = [];
        this.size = 5;
        this.selectedCells = [];
        this.words = new Map(); // Map to store words by length
        this.timeLeft = 60; // 1 minute
        this.roundTwoTimeLeft = 60; // 1 minute for round two
        this.timer = null;
        this.roundTwoTimer = null;
        this.isGameActive = false;
        this.dictionary = new Set(); // Set to store valid words
        this.roundTwoWords = new Map(); // Map to store words for round two
        this.isRoundTwo = false;
        this.totalWordsFound = 0;
        this.invalidWords = new Set(); // Add this line to track invalid words
        this.debugMode = new URLSearchParams(window.location.search).has('debug');
        
        // First initialize all elements
        this.initializeElements();
        // Then add event listeners
        this.addEventListeners();
        this.initializeGameOverModal();
        this.checkDailyPlay();
        // Load dictionary
        this.loadDictionary();
    }

    initializeElements() {
        this.gridElement = document.getElementById('grid');
        this.timeElement = document.getElementById('time');
        this.startButton = document.getElementById('startGame');
        this.wordInput = document.getElementById('wordInput');
        this.submitButton = document.getElementById('submitWord');
        this.wordsListElement = document.getElementById('wordsList');
        this.messageArea = document.getElementById('messageArea');
        this.clearButton = document.getElementById('clearSelection');
        this.gameOverModal = document.getElementById('gameOverModal');
        this.shareButton = document.getElementById('shareResults');
        this.playAgainButton = document.getElementById('playAgain');
        this.finalScoreElement = document.getElementById('finalScore');
        this.topWordsElement = document.getElementById('topWords');
        this.gridContainer = document.querySelector('.grid-container');
        this.splashModal = document.getElementById('splashModal');
    }

    addEventListeners() {
        this.startButton.addEventListener('click', () => this.startGame());
        this.submitButton.addEventListener('click', () => this.submitWord());
        this.clearButton.addEventListener('click', () => this.clearSelection());
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Add enter key listener for word input
        this.wordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.isRoundTwo) {
                    this.submitUnscrambledWord();
                } else {
                    this.submitWord();
                }
            }
        });
    }

    initializeGameOverModal() {
        this.shareButton.addEventListener('click', () => this.shareResults());
        this.playAgainButton.addEventListener('click', () => {
            this.gameOverModal.classList.remove('show');
            this.startGame();
        });
    }

    checkDailyPlay() {
        const today = new Date().toLocaleDateString();
        const lastPlayed = getCookie('lastPlayed');
        
        if (!this.debugMode && lastPlayed === today) {
            // Get last game results
            const lastScore = getCookie('lastScore');
            const lastWords = JSON.parse(getCookie('lastWords') || '[]');
            const wordsKept = parseInt(getCookie('wordsKept') || '0');
            
            // Update splash modal content for returning players
            const splashContent = this.splashModal.querySelector('.splash-content');
            splashContent.innerHTML = `
                <h1>Daily 📆 Boggle 🎲 Scramble 🏃</h1>
                <div class="already-played-message">
                    <h2>You've Already Played Today!</h2>
                    <div class="last-score">
                        <h3>Your Last Score</h3>
                        <div>Score: ${lastScore} points</div>
                        <div>Words Kept: ${wordsKept}</div>
                    </div>
                    <div class="countdown" id="nextGameCountdown"></div>
                </div>
            `;
            
            // Hide the start button
            this.startButton.style.display = 'none';
            
            // Hide game elements
            this.gridContainer.classList.add('hidden');
            this.wordInput.parentElement.classList.add('hidden');
            this.wordsListElement.parentElement.classList.add('hidden');
            
            // Show splash modal and update countdown
            this.splashModal.classList.add('show');
            this.updateCountdown();
        } else {
            // Show splash screen for new players
            this.splashModal.classList.add('show');
            // Hide all game elements except start button
            this.gridContainer.classList.add('hidden');
            this.wordInput.parentElement.classList.add('hidden');
            this.wordsListElement.parentElement.classList.add('hidden');
        }
    }

    startGame() {
        if (this.hasPlayedToday()) {
            this.showMessage('Please come back tomorrow for a new puzzle!');
            return;
        }
        
        // Hide splash screen and start button
        this.splashModal.classList.remove('show');
        this.startButton.style.display = 'none';
        
        this.resetGame();
        this.generateGrid();
        this.renderGrid();
        
        // Show game elements
        this.gridContainer.classList.remove('hidden');
        this.wordInput.parentElement.classList.remove('hidden');
        this.wordsListElement.parentElement.classList.remove('hidden');
        
        this.startTimer();
        this.isGameActive = true;
    }

    resetGame() {
        this.grid = [];
        this.words.clear();
        this.timeLeft = 60;
        this.wordsListElement.innerHTML = '';
        this.wordInput.value = '';
        this.selectedCells = [];
        this.messageArea.textContent = '';  // Clear any existing messages
    }

    generateGrid() {
        const seed = this.getTodaysSeed();
        const rng = new SeededRNG(seed);
        
        const dice = [
            'AAEEGN', 'ABBJOO', 'ACHOPS', 'AFFKPS',
            'AOOTTW', 'CIMOTU', 'DEILRX', 'DELRVY',
            'DISTTY', 'EEGHNW', 'EEINSU', 'EHRTVW',
            'EIOSST', 'ELRTTY', 'HIMNQU', 'HLNNRZ',
            'AAAFRS', 'AAEEEE', 'AAFIRS', 'ADENNN',
            'AEEEEM', 'AEEGMU', 'AEGMNN', 'AFIRSY', 'BJKQXZ'
        ];

        // Shuffle dice using seeded RNG
        for (let i = dice.length - 1; i > 0; i--) {
            const j = Math.floor(rng.random() * (i + 1));
            [dice[i], dice[j]] = [dice[j], dice[i]];
        }

        // Create grid
        for (let i = 0; i < this.size; i++) {
            this.grid[i] = [];
            for (let j = 0; j < this.size; j++) {
                const die = dice[i * this.size + j];
                const randomFace = die.charAt(Math.floor(rng.random() * die.length));
                this.grid[i][j] = randomFace;
            }
        }
    }

    getTodaysSeed() {
        const date = new Date();
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }

    renderGrid() {
        this.gridElement.innerHTML = '';
        const vowels = new Set(['A', 'E', 'I', 'O', 'U']);
        
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                const cell = document.createElement('div');
                const letter = this.grid[i][j];
                cell.className = 'cell';
                if (vowels.has(letter)) {
                    cell.classList.add('vowel');
                }
                cell.dataset.row = i;
                cell.dataset.col = j;
                cell.textContent = letter;
                cell.addEventListener('click', () => this.handleCellClick(i, j));
                this.gridElement.appendChild(cell);
            }
        }
    }

    handleCellClick(row, col) {
        if (!this.isGameActive) return;

        const cell = this.gridElement.children[row * this.size + col];
        const letter = this.grid[row][col];

        if (!this.isValidSelection(row, col)) return;

        this.selectedCells.push({row, col});
        cell.classList.add('selected');
        this.wordInput.value += letter;
    }

    isValidSelection(row, col) {
        if (this.selectedCells.length === 0) return true;

        const lastCell = this.selectedCells[this.selectedCells.length - 1];
        const rowDiff = Math.abs(row - lastCell.row);
        const colDiff = Math.abs(col - lastCell.col);

        return rowDiff <= 1 && colDiff <= 1 && 
               !this.selectedCells.some(cell => cell.row === row && cell.col === col);
    }

    handleKeyPress(e) {
        if (!this.isGameActive) return;

        const letter = e.key.toUpperCase();
        if (letter.length === 1 && letter.match(/[A-Z]/)) {
            for (let i = 0; i < this.size; i++) {
                for (let j = 0; j < this.size; j++) {
                    if (this.grid[i][j] === letter && this.isValidSelection(i, j)) {
                        this.handleCellClick(i, j);
                        return;
                    }
                }
            }
        }
    }

    submitWord() {
        if (!this.isGameActive) return;

        const word = this.wordInput.value;
        if (word.length < 3) {
            this.messageArea.textContent = 'Words must be at least 3 letters long!';
            setTimeout(() => {
                this.messageArea.textContent = '';
            }, 2000);
        } else if (this.isValidWord(word)) {
            const length = word.length;
            if (!this.words.has(length)) {
                this.words.set(length, new Set());
            }
            this.words.get(length).add(word);
            this.updateWordsList();
            this.messageArea.textContent = '';  // Clear success message
        }

        this.clearSelection();
    }

    clearSelection() {
        this.selectedCells.forEach(({row, col}) => {
            const cell = this.gridElement.children[row * this.size + col];
            cell.classList.remove('selected');
        });
        this.selectedCells = [];
        this.wordInput.value = '';
        this.messageArea.textContent = '';  // Clear any existing messages
    }

    isValidWord(word) {
        // In a real implementation, you would check against a dictionary
        // For now, we'll just verify it's not already found
        const length = word.length;
        return !this.words.has(length) || !this.words.get(length).has(word);
    }

    updateWordsList() {
        this.wordsListElement.innerHTML = '';
        
        // Sort lengths in descending order
        const lengths = Array.from(this.words.keys()).sort((a, b) => b - a);
        
        lengths.forEach(length => {
            const wordGroup = document.createElement('div');
            wordGroup.className = 'word-group';
            
            const header = document.createElement('h4');
            header.textContent = `${length} Letters (${this.words.get(length).size})`;
            
            const wordList = document.createElement('div');
            wordList.className = 'word-list';
            
            this.words.get(length).forEach(word => {
                const wordItem = document.createElement('span');
                wordItem.className = 'word-item';
                wordItem.textContent = word;
                wordList.appendChild(wordItem);
            });
            
            wordGroup.appendChild(header);
            wordGroup.appendChild(wordList);
            this.wordsListElement.appendChild(wordGroup);
        });
    }

    startTimer() {
        this.timer = setInterval(() => {
            this.timeLeft--;
            const minutes = Math.floor(this.timeLeft / 60);
            const seconds = this.timeLeft % 60;
            this.timeElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            if (this.timeLeft <= 0) {
                this.endGame();
            }
        }, 1000);
    }

    endGame() {
        clearInterval(this.timer);
        this.isGameActive = false;
        this.startButton.disabled = true;
        this.timeElement.classList.add('time-up');
        setTimeout(() => this.timeElement.classList.remove('time-up'), 1000);
        
        // Validate words against dictionary
        const validWords = new Map();
        this.invalidWords.clear(); // Clear previous invalid words
        
        this.words.forEach((words, length) => {
            const validWordsForLength = new Set();
            words.forEach(word => {
                if (this.dictionary.has(word)) {
                    validWordsForLength.add(word);
                } else {
                    this.invalidWords.add(word);
                }
            });
            if (validWordsForLength.size > 0) {
                validWords.set(length, validWordsForLength);
            }
        });
        
        // Update words with only valid ones
        this.words = validWords;
        
        // Start countdown to round two immediately
        const countdownOverlay = document.createElement('div');
        countdownOverlay.className = 'countdown-overlay';
        document.body.appendChild(countdownOverlay);
        
        let count = 5;
        const countdownNumber = document.createElement('div');
        countdownNumber.className = 'countdown-number';
        countdownNumber.textContent = count;
        countdownOverlay.appendChild(countdownNumber);
        
        const countdownInterval = setInterval(() => {
            count--;
            countdownNumber.textContent = count;
            
            if (count <= 0) {
                clearInterval(countdownInterval);
                countdownOverlay.remove();
                this.startRoundTwo();
            }
        }, 1000);
    }

    startRoundTwo() {
        this.isRoundTwo = true;
        this.roundTwoWords.clear();
        
        // Calculate total words found
        this.totalWordsFound = 0;
        this.words.forEach(words => {
            this.totalWordsFound += words.size;
        });
        
        // Prepare scrambled words for round two
        this.words.forEach((words, length) => {
            const scrambledWords = new Set();
            words.forEach(word => {
                const scrambled = this.scrambleWord(word);
                scrambledWords.add({
                    original: word,
                    scrambled: scrambled,
                    solved: false
                });
            });
            if (scrambledWords.size > 0) {
                this.roundTwoWords.set(length, scrambledWords);
            }
        });

        // Update UI for round two
        this.updateRoundTwoUI();
        // Start round two timer
        this.startRoundTwoTimer();
    }

    scrambleWord(word) {
        let scrambled;
        do {
            scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
        } while (scrambled === word); // Keep scrambling until it's different from the original
        return scrambled;
    }

    startRoundTwoTimer() {
        this.roundTwoTimer = setInterval(() => {
            this.roundTwoTimeLeft--;
            const minutes = Math.floor(this.roundTwoTimeLeft / 60);
            const seconds = this.roundTwoTimeLeft % 60;
            this.timeElement.textContent = `Round 2: ${minutes}:${seconds.toString().padStart(2, '0')}`;

            if (this.roundTwoTimeLeft <= 0) {
                clearInterval(this.roundTwoTimer);
                this.finishRoundTwo();
            }
        }, 1000);
    }

    updateRoundTwoUI() {
        // Hide the grid container and show round two interface
        this.gridContainer.classList.add('hidden');
        this.wordInput.readOnly = false;
        this.wordInput.placeholder = 'Type the unscrambled word';
        this.submitButton.textContent = 'Unscramble';
        this.messageArea.textContent = 'Round 2: Unscramble your words to keep your points!';
        
        // Update words list to show scrambled words
        this.wordsListElement.innerHTML = '<h3>Unscramble Your Words</h3>';
        
        // Sort lengths in descending order
        const lengths = Array.from(this.roundTwoWords.keys()).sort((a, b) => b - a);
        
        lengths.forEach(length => {
            const wordGroup = document.createElement('div');
            wordGroup.className = 'word-group';
            
            const header = document.createElement('h4');
            header.textContent = `${length} Letters`;
            
            const wordList = document.createElement('div');
            wordList.className = 'word-list';
            
            this.roundTwoWords.get(length).forEach(wordObj => {
                if (!wordObj.solved) { // Only show unsolved words
                    const wordItem = document.createElement('div');
                    wordItem.className = 'word-item';
                    wordItem.innerHTML = `
                        <span class="scrambled">${wordObj.scrambled}</span>
                        <span class="unsolved">(unsolved)</span>
                    `;
                    wordList.appendChild(wordItem);
                }
            });
            
            if (wordList.children.length > 0) { // Only add groups with unsolved words
                wordGroup.appendChild(header);
                wordGroup.appendChild(wordList);
                this.wordsListElement.appendChild(wordGroup);
            }
        });

        // Add event listener for word submission
        this.submitButton.onclick = () => this.submitUnscrambledWord();
        
        // Set focus to the input field
        setTimeout(() => {
            this.wordInput.focus();
        }, 100);
    }

    submitUnscrambledWord() {
        const submittedWord = this.wordInput.value.toUpperCase();
        
        // Check each word group for a match
        this.roundTwoWords.forEach((words, length) => {
            words.forEach(wordObj => {
                if (!wordObj.solved && wordObj.original === submittedWord) {
                    wordObj.solved = true;
                    this.showMessage('Correct! Word unscrambled!', true);
                    this.updateRoundTwoUI(); // Update UI to remove solved word
                    this.checkRoundTwoComplete();
                }
            });
        });

        this.wordInput.value = '';
    }

    checkRoundTwoComplete() {
        let allSolved = true;
        this.roundTwoWords.forEach(words => {
            words.forEach(wordObj => {
                if (!wordObj.solved) allSolved = false;
            });
        });

        if (allSolved) {
            this.finishRoundTwo();
        }
    }

    finishRoundTwo() {
        clearInterval(this.roundTwoTimer);
        
        // Update words map to only include solved words
        const solvedWords = new Map();
        this.roundTwoWords.forEach((words, length) => {
            const solvedWordsForLength = new Set();
            words.forEach(wordObj => {
                if (wordObj.solved) {
                    solvedWordsForLength.add(wordObj.original);
                }
            });
            if (solvedWordsForLength.size > 0) {
                solvedWords.set(length, solvedWordsForLength);
            }
        });
        
        this.words = solvedWords;
        
        // Calculate final results
        const score = this.calculateTotalScore();
        const topWords = this.getTopWords(5);
        const wordsKept = this.calculateTotalWords();
        
        // Save today's play only if not in debug mode
        if (!this.debugMode) {
            const today = new Date().toLocaleDateString();
            setCookie('lastPlayed', today, 2);
            setCookie('lastScore', score.toString(), 2);
            setCookie('lastWords', JSON.stringify(topWords), 2);
            setCookie('wordsKept', wordsKept.toString(), 2);
        }
        
        // Show final game over screen
        this.showGameOverScreen(score, topWords, wordsKept, true);
    }

    calculateTotalWords() {
        let total = 0;
        this.words.forEach(words => {
            total += words.size;
        });
        return total;
    }

    showGameOverScreen(score, topWords, wordsKept, isNewGame = true) {
        // Get a random invalid word if any exist
        const invalidWordsArray = Array.from(this.invalidWords);
        const randomInvalidWord = invalidWordsArray.length > 0 ? 
            invalidWordsArray[Math.floor(Math.random() * invalidWordsArray.length)] : null;

        // Update modal content
        this.finalScoreElement.innerHTML = `
            <div>Final Score: ${score} points</div>
            <div>Words Found: ${this.totalWordsFound}</div>
            <div>Words Kept: ${wordsKept}</div>
            ${randomInvalidWord ? `<div class="invalid-word">Not a word: ${randomInvalidWord}</div>` : ''}
        `;
        
        this.topWordsElement.innerHTML = '<h3>Your Top Words:</h3>' +
            (topWords && topWords.length > 0 ? 
                topWords.map(word => `<div>${word} (${word.length} letters)</div>`).join('') :
                '<div>No words found</div>');

        if (!isNewGame) {
            this.topWordsElement.innerHTML += `
                <div class="comeback-message">
                    <p>Come back tomorrow for a new puzzle!</p>
                    <p class="countdown" id="nextGameCountdown"></p>
                </div>`;
            this.updateCountdown();
        }

        // Show modal
        this.gameOverModal.classList.add('show');
        
        // Add confetti animation
        this.createConfetti();
    }

    createConfetti() {
        const colors = ['#f00', '#0f0', '#00f', '#ff0', '#f0f', '#0ff'];
        const body = document.body;
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = `${Math.random() * 100}%`;
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = `${Math.random() * 2}s`;
            body.appendChild(confetti);
            
            // Remove confetti after animation
            setTimeout(() => confetti.remove(), 3000);
        }
    }

    updateCountdown() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const timeUntil = tomorrow - now;
        const hours = Math.floor(timeUntil / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
        
        const countdownElement = document.getElementById('nextGameCountdown');
        if (countdownElement) {
            countdownElement.textContent = `Next puzzle available in: ${hours}h ${minutes}m`;
            if (!this.isGameActive) {
                setTimeout(() => this.updateCountdown(), 60000); // Update every minute
            }
        }
    }

    calculateTotalScore() {
        let score = 0;
        this.words.forEach((words, length) => {
            score += words.size * length;
        });
        return score;
    }

    getTopWords(count) {
        const allWords = [];
        this.words.forEach((words, length) => {
            words.forEach(word => allWords.push(word));
        });
        
        return allWords.sort((a, b) => b.length - a.length || a.localeCompare(b))
                      .slice(0, count);
    }

    async shareResults() {
        const topWords = this.getTopWords(5);
        const score = this.calculateTotalScore();
        const wordsKept = this.calculateTotalWords();
        const invalidWordsArray = Array.from(this.invalidWords);
        const randomInvalidWord = invalidWordsArray.length > 0 ? 
            invalidWordsArray[Math.floor(Math.random() * invalidWordsArray.length)] : null;
        
        const shareText = `🎲 Boggle Scramble Results 🏃\n` +
            // Todays date
            `for ${new Date().toLocaleDateString()}\n` +
            `Score: ${score} points\n` +
            `Words Found 💵: ${this.totalWordsFound}\n` +
            `Words Kept 💸: ${wordsKept}\n` +
            (randomInvalidWord ? `Not a word ❌: ${randomInvalidWord}\n` : '') +
            `\nTop Words 💰:\n${topWords.map(word => `• ${word} (${word.length} letters)`).join('\n')}`;

        try {
            // Try to use the Web Share API first
            if (navigator.share) {
                await navigator.share({
                    title: 'Woggle Scramble Results',
                    text: shareText
                });
            } else {
                // Fallback to clipboard
                await navigator.clipboard.writeText(shareText);
                this.showMessage('Results copied to clipboard!');
            }
        } catch (error) {
            console.error('Error sharing:', error);
            this.showMessage('Error sharing results');
        }
    }

    showMessage(message, autoHide = true) {
        this.messageArea.textContent = message;
        if (autoHide) {
            setTimeout(() => {
                this.messageArea.textContent = '';
            }, 2000);
        }
    }

    hasPlayedToday() {
        const today = new Date().toLocaleDateString();
        return getCookie('lastPlayed') === today;
    }

    async loadDictionary() {
        try {
            const response = await fetch('dictionary.txt');
            const text = await response.text();
            const words = text.split('\n').map(word => word.trim());
            this.dictionary = new Set(words);
        } catch (error) {
            console.error('Error loading dictionary:', error);
            this.showMessage('Error loading dictionary. Words will not be validated.', false);
        }
    }
}

// Utility functions for cookies
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// Seeded Random Number Generator
class SeededRNG {
    constructor(seed) {
        this.seed = this.hash(seed);
    }

    hash(seed) {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }

    random() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
}

// Initialize game only after DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    new BoggleGame();
}); 