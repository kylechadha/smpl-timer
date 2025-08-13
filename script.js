// Sound and haptic feedback system
class TactileFeedback {
    constructor() {
        this.audioContext = null;
        this.initAudio();
    }
    
    initAudio() {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }
    
    playClickSound(type = 'default') {
        // Sounds removed - were annoying
        return;
    }
    
    vibrate(pattern = 10) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }
    
    trigger(type = 'default') {
        // Only haptic feedback, no sounds
        switch(type) {
            case 'start':
                this.vibrate(15);
                break;
            case 'lap':
                this.vibrate([5, 5, 5]);
                break;
            case 'reset':
                this.vibrate(20);
                break;
            default:
                this.vibrate(10);
        }
    }
}

// Wake Lock API to prevent screen sleep
class WakeLockManager {
    constructor() {
        this.wakeLock = null;
    }
    
    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake lock acquired');
                
                // Re-acquire wake lock if page becomes visible again
                document.addEventListener('visibilitychange', async () => {
                    if (this.wakeLock && document.visibilityState === 'visible') {
                        await this.requestWakeLock();
                    }
                });
            } catch (err) {
                console.log(`Wake lock error: ${err.message}`);
            }
        }
    }
    
    async releaseWakeLock() {
        if (this.wakeLock) {
            try {
                await this.wakeLock.release();
                this.wakeLock = null;
                console.log('Wake lock released');
            } catch (err) {
                console.log(`Wake lock release error: ${err.message}`);
            }
        }
    }
}

const tactileFeedback = new TactileFeedback();
const wakeLockManager = new WakeLockManager();

// Theme management
const themes = ['biscay', 'sky-blue', 'tangerine', 'gin', 'slate', 'charcoal', 'frost'];
const themeNames = ['Biscay', 'Sky Blue', 'Tangerine', 'Gin', 'Slate', 'Charcoal', 'Frost'];
let currentThemeIndex = 1; // Default to sky-blue
let themePillTimeout = null;

// Storage helpers with Chrome storage priority and localStorage fallback
function saveTheme(index, showPill = false) {
    currentThemeIndex = index;
    document.body.className = themes[currentThemeIndex];
    
    // Show theme pill when switching
    if (showPill) {
        const themePill = document.getElementById('themePill');
        const themeName = document.getElementById('themeName');
        themeName.textContent = themeNames[currentThemeIndex];
        
        // Clear any existing timeout
        if (themePillTimeout) {
            clearTimeout(themePillTimeout);
        }
        
        // Show pill
        themePill.classList.add('visible');
        
        // Hide after 1.5 seconds
        themePillTimeout = setTimeout(() => {
            themePill.classList.remove('visible');
        }, 1500);
    }
    
    // Try Chrome storage first
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ 'smpl-stopwatch-theme': index });
    }
    // Always save to localStorage as fallback
    localStorage.setItem('smpl-stopwatch-theme', index);
}

function loadTheme() {
    // Try Chrome storage first
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['smpl-stopwatch-theme'], function(result) {
            if (result['smpl-stopwatch-theme'] !== undefined) {
                currentThemeIndex = result['smpl-stopwatch-theme'];
                document.body.className = themes[currentThemeIndex];
            } else {
                // Fall back to localStorage
                const stored = localStorage.getItem('smpl-stopwatch-theme');
                if (stored !== null) {
                    currentThemeIndex = parseInt(stored);
                    document.body.className = themes[currentThemeIndex];
                } else {
                    document.body.className = themes[currentThemeIndex];
                }
            }
        });
    } else {
        // No Chrome storage, use localStorage
        const stored = localStorage.getItem('smpl-stopwatch-theme');
        if (stored !== null) {
            currentThemeIndex = parseInt(stored);
        }
        document.body.className = themes[currentThemeIndex];
    }
}

// Initialize theme
loadTheme();

// Stopwatch state
let stopwatchStartTime = 0;
let lapStartTime = 0;
let stopwatchElapsedTime = 0;
let lapElapsedTime = 0;
let animationFrame = null;
let isRunning = false;
let laps = [];

// DOM elements
const lapTimeEl = document.getElementById('lapTime');
const totalTimeEl = document.getElementById('totalTime');
const startPauseBtn = document.getElementById('startPauseBtn');
const lapBtn = document.getElementById('lapBtn');
const stopBtn = document.getElementById('stopBtn');
const splitsSection = document.getElementById('splitsSection');
const splitsList = document.getElementById('splitsList');
const helpBtn = document.getElementById('helpBtn');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeModal = document.getElementById('closeModal');

// Format time - always show mm:ss
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Update display using requestAnimationFrame for smooth performance
function updateDisplay() {
    if (isRunning) {
        const now = Date.now();
        stopwatchElapsedTime = now - stopwatchStartTime;
        lapElapsedTime = now - lapStartTime;
        
        // Update both displays with the same calculated values
        const lapText = formatTime(lapElapsedTime);
        const totalText = `Total: ${formatTime(stopwatchElapsedTime)}`;
        
        // Update DOM only if values changed to prevent unnecessary repaints
        if (lapTimeEl.textContent !== lapText) {
            lapTimeEl.textContent = lapText;
        }
        if (totalTimeEl.textContent !== totalText) {
            totalTimeEl.textContent = totalText;
        }
        
        animationFrame = requestAnimationFrame(updateDisplay);
    }
}

// Start/Pause stopwatch
async function toggleStopwatch() {
    tactileFeedback.trigger('start');
    const playIcon = startPauseBtn.querySelector('.play');
    const pauseIcon = startPauseBtn.querySelector('.pause');
    const buttonText = startPauseBtn.querySelector('span');
    
    if (isRunning) {
        // Pause
        isRunning = false;
        cancelAnimationFrame(animationFrame);
        await wakeLockManager.releaseWakeLock();
        buttonText.textContent = 'RESUME';
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        lapBtn.disabled = true;
    } else {
        // Start/Resume
        const now = Date.now();
        stopwatchStartTime = now - stopwatchElapsedTime;
        lapStartTime = now - lapElapsedTime;
        isRunning = true;
        await wakeLockManager.requestWakeLock();
        updateDisplay();
        buttonText.textContent = 'PAUSE';
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        lapBtn.disabled = false;
        stopBtn.disabled = false;
    }
}

// Record lap
function recordLap() {
    if (!isRunning) return;
    
    tactileFeedback.trigger('lap');
    
    laps.push({
        number: laps.length + 1,
        duration: lapElapsedTime,
        total: stopwatchElapsedTime
    });
    
    // Reset lap time
    lapStartTime = Date.now();
    lapElapsedTime = 0;
    
    // Update display
    updateDisplay();
    updateSplits();
    
    // Show splits section
    if (laps.length === 1) {
        splitsSection.classList.add('visible');
    }
}

// Update splits display
function updateSplits() {
    // Show most recent lap at the top
    splitsList.innerHTML = laps.slice().reverse().map(lap => `
        <div class="split-row">
            <div>${lap.number}</div>
            <div>${formatTime(lap.duration)}</div>
            <div>${formatTime(lap.total)}</div>
        </div>
    `).join('');
}

// Stop/Reset stopwatch
async function stopStopwatch() {
    tactileFeedback.trigger('reset');
    
    isRunning = false;
    cancelAnimationFrame(animationFrame);
    await wakeLockManager.releaseWakeLock();
    stopwatchStartTime = 0;
    lapStartTime = 0;
    stopwatchElapsedTime = 0;
    lapElapsedTime = 0;
    laps = [];
    
    const playIcon = startPauseBtn.querySelector('.play');
    const pauseIcon = startPauseBtn.querySelector('.pause');
    const buttonText = startPauseBtn.querySelector('span');
    buttonText.textContent = 'START';
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    
    lapBtn.disabled = true;
    stopBtn.disabled = true;
    
    lapTimeEl.textContent = formatTime(0);
    totalTimeEl.textContent = `Total: ${formatTime(0)}`;
    splitsList.innerHTML = '';
    splitsSection.classList.remove('visible');
}

// Event listeners
startPauseBtn.addEventListener('click', toggleStopwatch);
lapBtn.addEventListener('click', recordLap);
stopBtn.addEventListener('click', stopStopwatch);

// Modal
helpBtn.addEventListener('click', () => {
    modalBackdrop.classList.add('visible');
});

closeModal.addEventListener('click', () => {
    modalBackdrop.classList.remove('visible');
});

modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) {
        modalBackdrop.classList.remove('visible');
    }
});

// Add visual feedback for button press
function pressButton(button) {
    if (!button) return;
    // Don't check disabled state for start/pause button since it's never disabled
    if (button !== startPauseBtn && button.disabled) return;
    
    // Force reflow to ensure the animation triggers
    button.classList.remove('pressed');
    void button.offsetWidth;
    button.classList.add('pressed');
    
    // Add a subtle bounce-back animation
    setTimeout(() => {
        button.classList.remove('pressed');
        button.style.transition = 'transform 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        button.style.transform = 'translateY(-1px) scale(1.02)';
        
        setTimeout(() => {
            button.style.transition = '';
            button.style.transform = '';
        }, 200);
    }, 100);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Handle modal-specific shortcuts
    if (modalBackdrop.classList.contains('visible')) {
        if (e.key === 'Escape' || e.key === '?') {
            modalBackdrop.classList.remove('visible');
        }
        return;
    }
    
    const key = e.key.toLowerCase();
    
    switch(key) {
        case ' ':
            e.preventDefault();
            pressButton(startPauseBtn);
            toggleStopwatch();
            break;
        case 's':
            e.preventDefault();
            pressButton(startPauseBtn);
            toggleStopwatch();
            break;
        case 'l':
            pressButton(lapBtn);
            recordLap();
            break;
        case 'r':
            pressButton(stopBtn);
            stopStopwatch();
            break;
        case 'arrowleft':
            saveTheme(currentThemeIndex === 0 ? themes.length - 1 : currentThemeIndex - 1, true);
            break;
        case 'arrowright':
            saveTheme(currentThemeIndex === themes.length - 1 ? 0 : currentThemeIndex + 1, true);
            break;
        case '?':
            modalBackdrop.classList.add('visible');
            break;
    }
});

// Initialize display
lapTimeEl.textContent = formatTime(0);
totalTimeEl.textContent = `Total: ${formatTime(0)}`;