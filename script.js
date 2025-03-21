class BoggleGame {
    constructor() {
        this.grid = [];
        this.size = 5;
        this.selectedCells = [];
        this.words = new Map(); // Map to store words by length
        this.timeLeft = this.getInitialTime(); // Get time from URL parameter or default to 60
        this.timer = null;
        this.isGameActive = false;
        this.dictionary = new Set(); // Set to store valid dictionary words
        this.bonusScore = 0;
        this.currentPuzzleIndex = 0;
        this.bonusTimer = null;
        this.isDebugMode = this.checkDebugMode();
        this.rejectedWords = new Set(); // Track rejected words
        this.currentPuzzle = null; // Add this line to store current puzzle
        this.bonusAnswers = []; // Add this line to store bonus round answers
        
        // First initialize all elements
        this.initializeElements();
        // Then add event listeners
        this.addEventListeners();
        this.initializeGameOverModal();
        if (!this.isDebugMode) {
            this.checkDailyPlay();
        }
        // Load dictionary
        this.loadDictionary();
        // Show splash screen
        this.showSplashScreen();
    }

    getInitialTime() {
        const urlParams = new URLSearchParams(window.location.search);
        const timeParam = urlParams.get('time');
        if (timeParam) {
            const time = parseInt(timeParam);
            return isNaN(time) ? 60 : Math.max(1, time); // Ensure at least 1 second
        }
        return 60; // Default time
    }

    checkDebugMode() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('debug') === 'true';
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
        this.bonusRoundModal = document.getElementById('bonusRoundModal');
        this.shareButton = document.getElementById('shareResults');
        this.playAgainButton = document.getElementById('playAgain');
        this.finalScoreElement = document.getElementById('finalScore');
        this.topWordsElement = document.getElementById('topWords');
        this.bonusTimerElement = document.getElementById('bonusTime');
        this.sentencePuzzleElement = document.getElementById('sentencePuzzle');
        this.sentenceOptionsElement = document.querySelector('.sentence-options');
        this.skipPuzzleButton = document.getElementById('skipPuzzle');
        this.bonusRoundIntroModal = document.getElementById('bonusRoundIntroModal');
        this.startBonusRoundButton = document.getElementById('startBonusRound');
        this.showBonusAnswersButton = document.getElementById('showBonusAnswers');
        this.bonusAnswersElement = document.getElementById('bonusAnswers');
        this.bonusAnswersListElement = document.getElementById('bonusAnswersList');
        this.splashModal = document.getElementById('splashModal');
        this.splashContent = document.getElementById('splashContent');

        // Disable the input box
        this.wordInput.disabled = true;
    }

    addEventListeners() {
        this.startButton.addEventListener('click', () => this.startGame());
        this.submitButton.addEventListener('click', () => this.submitWord());
        this.clearButton.addEventListener('click', () => this.clearSelection());
        this.skipPuzzleButton.addEventListener('click', () => this.skipCurrentPuzzle());
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        this.startBonusRoundButton.addEventListener('click', () => {
            this.bonusRoundIntroModal.classList.remove('show');
            this.startBonusRound();
        });
        this.showBonusAnswersButton.addEventListener('click', () => this.toggleBonusAnswers());
    }

    initializeGameOverModal() {
        this.shareButton.addEventListener('click', () => this.shareResults());
        this.playAgainButton.addEventListener('click', () => {
            this.gameOverModal.classList.remove('show');
            this.startGame();
        });
    }

    checkDailyPlay() {
        if (this.isDebugMode) return;
        const today = new Date().toLocaleDateString();
        const lastPlayed = getCookie('lastPlayed');
        
        if (lastPlayed === today) {
            this.startButton.disabled = true;
            
            // If they have played, show their last score
            const lastScore = getCookie('lastScore');
            const lastWords = JSON.parse(getCookie('lastWords') || '[]');
            const lastRejectedWords = JSON.parse(getCookie('lastRejectedWords') || '[]');
            const lastBonusScore = parseInt(getCookie('lastBonusScore') || '0');
            
            if (lastScore) {
                // Set the previous game's values
                this.words = new Map();
                // Group words by length
                lastWords.forEach(word => {
                    const length = word.length;
                    if (!this.words.has(length)) {
                        this.words.set(length, new Set());
                    }
                    this.words.get(length).add(word);
                });
                this.rejectedWords = new Set(lastRejectedWords);
                this.bonusScore = lastBonusScore;
                // Show the game over screen with previous values
                this.showGameOverScreen(parseInt(lastScore), lastWords, false);
            }
        }
    }

    startGame() {
        if (this.hasPlayedToday()) {
            this.showMessage('Please come back tomorrow for a new puzzle!');
            return;
        }
        
        this.splashModal.classList.remove('show');
        this.resetGame();
        this.generateGrid();
        this.renderGrid();
        this.startTimer();
        this.isGameActive = true;
        this.startButton.disabled = true;
    }

    resetGame() {
        this.grid = [];
        this.words.clear();
        this.timeLeft = this.getInitialTime();
        this.wordsListElement.innerHTML = '';
        this.wordInput.value = '';
        this.selectedCells = [];
        this.messageArea.textContent = '';  // Clear any existing messages
        this.bonusScore = 0;
        this.currentPuzzleIndex = 0;
        this.bonusAnswers = []; // Add this line to reset bonus answers
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
        const wordLength = word.length;
        
        // Check word length
        if (wordLength < 3) {
            this.showMessage('Words must be at least 3 letters long!', true);
            this.clearSelection();
            return;
        }

        // Check if word was already found
        const length = word.length;
        if (this.words.has(length) && this.words.get(length).has(word)) {
            this.showMessage('You already found this word!', true);
            this.clearSelection();
            return;
        }

        // Check if word is in dictionary
        if (!this.isValidWord(word)) {
            this.showMessage('This word is not in the dictionary!', true);
            this.rejectedWords.add(word);
            this.clearSelection();
            return;
        }

        // Word is valid, add it to found words
        if (!this.words.has(length)) {
            this.words.set(length, new Set());
        }
        this.words.get(length).add(word);
        this.updateWordsList();

        // Show special messages for longer words
        if (wordLength >= 7) {
            this.showMessage('Amazing! A 7+ letter word!', true);
        } else if (wordLength === 6) {
            this.showMessage('Excellent! A 6-letter word!', true);
        } else if (wordLength === 5) {
            this.showMessage('Great job! A 5-letter word!', true);
        } else {
            this.showMessage('Word found!', true);
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
    }

    isValidWord(word) {
        return this.dictionary.has(word.toUpperCase());
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
        this.startButton.disabled = false;
        
        // Validate all words against dictionary
        const validWords = new Map();
        this.words.forEach((words, length) => {
            const validWordsForLength = new Set();
            words.forEach(word => {
                if (this.isValidWord(word)) {
                    validWordsForLength.add(word);
                } else {
                    this.rejectedWords.add(word);
                }
            });
            if (validWordsForLength.size > 0) {
                validWords.set(length, validWordsForLength);
            }
        });
        
        // Update words with only valid dictionary words
        this.words = validWords;
        
        const score = this.calculateTotalScore();
        const topWords = this.getTopWords(5);
        
        // Show bonus round intro instead of starting bonus round directly
        this.bonusRoundIntroModal.classList.add('show');
    }

    startBonusRound() {
        this.currentPuzzleIndex = 0;
        this.bonusScore = 0;
        this.showNextPuzzle();
    }

    showNextPuzzle() {
        if (this.currentPuzzleIndex >= 5) {
            this.showGameOverScreen(this.calculateTotalScore(), this.getTopWords(5), true);
            return;
        }

        this.currentPuzzle = this.generateSentencePuzzle();
        
        // If no puzzle was generated (no words found), return
        if (!this.currentPuzzle) {
            return;
        }

        this.sentencePuzzleElement.textContent = this.currentPuzzle.sentence;
        
        // Clear previous options
        this.sentenceOptionsElement.innerHTML = '';
        
        // Add new options
        this.currentPuzzle.options.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'sentence-option';
            optionElement.textContent = option;
            optionElement.addEventListener('click', () => this.handlePuzzleSelection(index));
            this.sentenceOptionsElement.appendChild(optionElement);
        });

        // Show bonus round modal
        this.bonusRoundModal.classList.add('show');
        
        // Start timer
        this.startBonusTimer();
    }

    generateSentencePuzzle() {
        // Get a random word from the player's found words
        const allWords = [];
        this.words.forEach((words) => {
            words.forEach(word => allWords.push(word));
        });
        
        // If no words were found in the grid, end the bonus round
        if (allWords.length === 0) {
            this.showGameOverScreen(this.calculateTotalScore(), this.getTopWords(5), true);
            return null;
        }

        const selectedWord = allWords[Math.floor(Math.random() * allWords.length)];
        
        // Templates for the correct sentence (containing the found word)
        const correctTemplates = [
            `The ${selectedWord.toLowerCase()} was spotted near the mountain stream.`,
            `A gentle breeze carried the scent of ${selectedWord.toLowerCase()} through the forest.`,
            `The old oak tree provided shelter for the ${selectedWord.toLowerCase()}.`,
            `The ${selectedWord.toLowerCase()} caught everyone's attention in the busy square.`,
            `A mysterious ${selectedWord.toLowerCase()} appeared in the alleyway.`,
            `The street performer's act featured a ${selectedWord.toLowerCase()}.`,
            `The ${selectedWord.toLowerCase()} sat quietly on the windowsill.`,
            `Grandma's recipe called for a special ${selectedWord.toLowerCase()}.`,
            `The children discovered a ${selectedWord.toLowerCase()} in the attic.`,
            `The explorer's map led to a hidden ${selectedWord.toLowerCase()}.`
        ];

        // Templates for incorrect sentences (using random words)
        const incorrectTemplates = [
            `The butterfly was spotted near the mountain stream.`,
            `A gentle breeze carried the scent of roses through the forest.`,
            `The old oak tree provided shelter for the birds.`,
            `The street artist caught everyone's attention in the busy square.`,
            `A mysterious shadow appeared in the alleyway.`,
            `The street performer's act featured a juggling routine.`,
            `The cat sat quietly on the windowsill.`,
            `Grandma's recipe called for a special ingredient.`,
            `The children discovered a treasure in the attic.`,
            `The explorer's map led to a hidden cave.`,
            `The storm brought an unexpected visitor.`,
            `The morning fog revealed a strange shape.`,
            `The rainbow's end held a magical surprise.`,
            `The garden was filled with colorful flowers.`,
            `The library contained ancient manuscripts.`
        ];

        // Select a random correct template
        const correctTemplate = correctTemplates[Math.floor(Math.random() * correctTemplates.length)];
        
        // Select two random incorrect templates
        const incorrectSentences = [];
        const availableIncorrectTemplates = [...incorrectTemplates];
        
        for (let i = 0; i < 2; i++) {
            if (availableIncorrectTemplates.length === 0) break;
            const randomIndex = Math.floor(Math.random() * availableIncorrectTemplates.length);
            incorrectSentences.push(availableIncorrectTemplates[randomIndex]);
            availableIncorrectTemplates.splice(randomIndex, 1);
        }

        // If we don't have enough incorrect templates, return null to end the bonus round
        if (incorrectSentences.length < 2) {
            this.showGameOverScreen(this.calculateTotalScore(), this.getTopWords(5), true);
            return null;
        }

        // Combine all sentences
        const sentences = [correctTemplate, ...incorrectSentences];
        const options = [...sentences];
        
        // Shuffle the options
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }

        return {
            sentence: correctTemplate,
            options: options,
            correctIndex: options.indexOf(correctTemplate),
            word: selectedWord
        };
    }

    startBonusTimer() {
        let timeLeft = 10;
        this.bonusTimerElement.textContent = timeLeft;
        this.bonusTimerElement.className = '';
        
        this.bonusTimer = setInterval(() => {
            timeLeft--;
            this.bonusTimerElement.textContent = timeLeft;
            
            if (timeLeft <= 3) {
                this.bonusTimerElement.className = 'danger';
                this.bonusTimerElement.style.animation = 'pulse 0.5s infinite';
            } else if (timeLeft <= 5) {
                this.bonusTimerElement.className = 'warning';
                this.bonusTimerElement.style.animation = 'pulse 1s infinite';
            }

            if (timeLeft <= 0) {
                clearInterval(this.bonusTimer);
                this.skipCurrentPuzzle();
            }
        }, 1000);
    }

    handlePuzzleSelection(index) {
        clearInterval(this.bonusTimer);
        
        const options = this.sentenceOptionsElement.children;
        for (let i = 0; i < options.length; i++) {
            options[i].classList.remove('selected');
        }
        options[index].classList.add('selected');

        // Store the answer for later display
        this.bonusAnswers.push({
            sentence: this.currentPuzzle.sentence,
            word: this.currentPuzzle.word,
            wasCorrect: index === this.currentPuzzle.correctIndex,
            wasAttempted: true,
            selectedSentence: this.currentPuzzle.options[index] // Store the selected sentence
        });

        if (index === this.currentPuzzle.correctIndex) {
            this.bonusScore += 10;
            this.showMessage('Correct! +10 bonus points!', false);
        } else {
            this.showMessage('Incorrect!', false);
        }

        setTimeout(() => {
            this.currentPuzzleIndex++;
            this.showNextPuzzle();
        }, 1500);
    }

    skipCurrentPuzzle() {
        clearInterval(this.bonusTimer);
        // Don't store skipped puzzles
        this.currentPuzzleIndex++;
        this.showNextPuzzle();
    }

    calculateTotalScore() {
        let score = 0;
        this.words.forEach((words, length) => {
            score += words.size * length;
        });
        return score + this.bonusScore;
    }

    showGameOverScreen(score, topWords, isNewGame = true) {
        // Calculate statistics
        const totalWords = Array.from(this.words.values()).reduce((sum, words) => sum + words.size, 0);
        const rejectedCount = this.rejectedWords.size;
        const exampleRejectedWord = rejectedCount > 0 ? Array.from(this.rejectedWords)[0] : 'None';
        
        // Update modal content
        this.finalScoreElement.textContent = `Final Score: ${score} points`;
        this.topWordsElement.innerHTML = `
            <div class="score-stats">
                <p>Words Found: ${totalWords}</p>
                <p>Words Rejected: ${rejectedCount}</p>
                <p>Example Rejected Word: ${exampleRejectedWord}</p>
                <p>Bonus Points Earned: ${this.bonusScore}</p>
            </div>
            <h3>Your Valid Words:</h3>
            ${topWords.map(word => `<div>${word} (${word.length} letters)</div>`).join('')}`;

        if (!isNewGame && !this.isDebugMode) {
            this.topWordsElement.innerHTML += `
                <div class="comeback-message">
                    <p>You've already played today!</p>
                    <p>Come back tomorrow for a new puzzle!</p>
                    <p class="countdown" id="nextGameCountdown"></p>
                </div>`;
            this.updateCountdown();
        }

        // Hide bonus round modal if it's showing
        this.bonusRoundModal.classList.remove('show');
        // Show game over modal
        this.gameOverModal.classList.add('show');
        
        // Hide play again button unless in debug mode
        this.playAgainButton.style.display = this.isDebugMode ? 'inline-block' : 'none';
        
        // Hide show bonus answers button if not a new game
        this.showBonusAnswersButton.style.display = isNewGame ? 'inline-block' : 'none';

        // Store game results after bonus round is complete
        if (!this.isDebugMode && isNewGame) {
            const today = new Date().toLocaleDateString();
            setCookie('lastPlayed', today, 2); // 2 days expiry
            setCookie('lastScore', score.toString(), 2);
            setCookie('lastWords', JSON.stringify(Array.from(this.words.values()).flatMap(set => Array.from(set))), 2);
            setCookie('lastRejectedWords', JSON.stringify(Array.from(this.rejectedWords)), 2);
            setCookie('lastBonusScore', this.bonusScore.toString(), 2);
            
            // Trigger confetti for new game completion
            this.triggerConfetti();
        }
    }

    triggerConfetti() {
        // Create confetti elements
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
            confetti.style.opacity = Math.random();
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
            document.body.appendChild(confetti);
        }

        // Remove confetti after animation
        setTimeout(() => {
            const confettiElements = document.querySelectorAll('.confetti');
            confettiElements.forEach(el => el.remove());
        }, 5000);
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
            countdownElement.textContent = `Next puzzle in: ${hours}h ${minutes}m`;
            if (this.isGameActive) {
                setTimeout(() => this.updateCountdown(), 60000); // Update every minute
            }
        }
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
        const totalWords = Array.from(this.words.values()).reduce((sum, words) => sum + words.size, 0);
        const rejectedCount = this.rejectedWords.size;
        const exampleRejectedWord = rejectedCount > 0 ? Array.from(this.rejectedWords)[0] : 'None';
        
        const shareText = `🎮 GridWordRush 🎮\n\n` +
            `Score 💯: ${score} points\n` +
            `Words Found 🕵: ${totalWords}\n` +
            `Words Rejected 👿: ${rejectedCount}\n` +
            `Example Rejected Word 🤷: ${exampleRejectedWord}\n` +
            `Bonus Points Earned 💷: ${this.bonusScore}\n\n` // +
            // `Top Words:\n${topWords.map(word => `• ${word} (${word.length} letters)`).join('\n')}`;

        try {
            // Try to use the Web Share API first
            if (navigator.share) {
                await navigator.share({
                    title: 'Word Grid Game Results',
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
        // Clear any existing message first
        this.messageArea.textContent = '';
        this.messageArea.className = 'message-area';
        
        // Add appropriate styling based on message type
        if (message.includes('already found')) {
            this.messageArea.classList.add('warning');
        } else if (message.includes('not in the dictionary')) {
            this.messageArea.classList.add('error');
        } else if (message.includes('Word found')) {
            this.messageArea.classList.add('success');
        } else if (message.includes('too short') || message.includes('at least 3 letters')) {
            this.messageArea.classList.add('warning');
        }

        // Set the message text
        this.messageArea.textContent = message;

        if (autoHide) {
            setTimeout(() => {
                this.messageArea.textContent = '';
                this.messageArea.className = 'message-area';
            }, 2000);
        }
    }

    hasPlayedToday() {
        if (this.isDebugMode) return false;
        const today = new Date().toLocaleDateString();
        return getCookie('lastPlayed') === today;
    }

    async loadDictionary() {
        try {
            const response = await fetch('dictionary.txt');
            const text = await response.text();
            const words = text.split('\n').map(word => word.trim().toUpperCase());
            this.dictionary = new Set(words);
        } catch (error) {
            console.error('Error loading dictionary:', error);
            this.showMessage('Error loading dictionary. Words will not be validated.', false);
        }
    }

    toggleBonusAnswers() {
        const isVisible = this.bonusAnswersElement.style.display !== 'none';
        this.bonusAnswersElement.style.display = isVisible ? 'none' : 'block';
        this.showBonusAnswersButton.textContent = isVisible ? 'Show Bonus Round Answers' : 'Hide Bonus Round Answers';
        
        if (!isVisible) {
            this.displayBonusAnswers();
        }
    }

    displayBonusAnswers() {
        // Only show answers that were attempted
        const attemptedAnswers = this.bonusAnswers.filter(answer => answer.wasAttempted);
        
        this.bonusAnswersListElement.innerHTML = attemptedAnswers.map((answer, index) => `
            <div class="bonus-answer-item ${answer.wasCorrect ? 'correct' : 'incorrect'}">
                <div>Puzzle ${index + 1}:</div>
                ${answer.wasCorrect ? `
                    <div>${answer.sentence.replace(
                        answer.word.toLowerCase(),
                        `<span class="highlighted-word">${answer.word.toLowerCase()}</span>`
                    )}</div>
                    <div>✓ Correct</div>
                    <button class="share-sentence-button" data-index="${index}">Share This Sentence</button>
                ` : `
                    <div class="selected-answer">Your answer:</div>
                    <div>${answer.selectedSentence}</div>
                    <div class="correct-answer">Correct answer:</div>
                    <div>${answer.sentence.replace(
                        answer.word.toLowerCase(),
                        `<span class="highlighted-word">${answer.word.toLowerCase()}</span>`
                    )}</div>
                    <div>✗ Incorrect</div>
                    <button class="share-sentence-button" data-index="${index}">Share This Sentence</button>
                `}
            </div>
        `).join('');

        // Add event listeners to all share buttons
        this.bonusAnswersListElement.querySelectorAll('.share-sentence-button').forEach(button => {
            button.addEventListener('click', () => {
                const index = parseInt(button.dataset.index);
                this.shareBonusSentence(index);
            });
        });
    }

    async shareBonusSentence(index) {
        const answer = this.bonusAnswers[index];
        const shareText = `🎯 GridWordRushBonus Round Sentence 🎯\n\n` +
        // If correct, say correct answer, if incorrect, say the answer I gave, would you believe it was
        // and then say the correct answer
            `${answer.wasCorrect ? 'Correct Answer:' : 'The answer I gave, would you believe it, was:'}\n` +
            `${answer.selectedSentence}\n\n` +
            `${answer.wasCorrect ? '✓ Correct!' : '✗ Incorrect'}\n` +
            `The word was: ${answer.word}` +
            `and was in the sentence: ${answer.sentence}`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: 'Word Grid Game Bonus Round',
                    text: shareText
                });
            } else {
                await navigator.clipboard.writeText(shareText);
                this.showMessage('Sentence copied to clipboard!');
            }
        } catch (error) {
            console.error('Error sharing:', error);
            this.showMessage('Error sharing sentence');
        }
    }

    showSplashScreen() {
        const hasPlayedToday = this.hasPlayedToday();
        const lastScore = getCookie('lastScore');
        const lastWords = JSON.parse(getCookie('lastWords') || '[]');
        
        if (hasPlayedToday) {
            // Show previous score and next game time
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            const timeUntil = tomorrow - now;
            const hours = Math.floor(timeUntil / (1000 * 60 * 60));
            const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
            
            this.splashContent.innerHTML = `
                <div class="previous-score">
                    <h2>Welcome Back!</h2>
                    <div class="score">Your Score: ${lastScore}</div>
                    <div class="next-game">Next puzzle in: ${hours}h ${minutes}m</div>
                    <button class="share-button" id="shareScoreButton">Share Your Score</button>
                </div>
            `;
            
            // Add event listener for share button
            document.getElementById('shareScoreButton').addEventListener('click', () => this.shareResults());
        } else {
            // Show game rules
            this.splashContent.innerHTML = `
                <div class="game-rules">
                    <h2>How to Play</h2>
                    <ul>
                        <li>Find words by connecting adjacent letters in the grid</li>
                        <li>Letters can be connected horizontally, vertically, or diagonally</li>
                        <li>Words must be at least 3 letters long</li>
                        <li>Each letter can only be used once in a word</li>
                        <li>Words must be in the dictionary</li>
                        <li>Score points based on word length</li>
                        <li>After the main game, try the bonus round for extra points!</li>
                    </ul>
                </div>
                <button class="splash-button" id="startGameButton">Start Game</button>
            `;
            
            // Add event listener for start game button
            document.getElementById('startGameButton').addEventListener('click', () => this.startGame());
        }
        
        this.splashModal.classList.add('show');
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