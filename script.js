let timers = [];
let intervalIds = [];
let pausedTimers = [];

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('equalPrepToggle').addEventListener('change', showEqualPrep);
    document.getElementById('usIntlToggle').addEventListener('change', showUSIntl);
    document.getElementById('speakerCount').addEventListener('change', updateSpeakerCount);
    document.getElementById('resetAllBtn').addEventListener('click', openResetModal);
    document.getElementById('confirmReset').addEventListener('click', resetAllTimers);
    document.getElementById('cancelReset').addEventListener('click', closeResetModal);

    createTimers();
});

function showEqualPrep() {
    document.getElementById('equalPrepSpeakers').style.display = 'block';
    document.getElementById('usIntlSpeakers').style.display = 'none';
    createTimers();
}

function showUSIntl() {
    document.getElementById('equalPrepSpeakers').style.display = 'none';
    document.getElementById('usIntlSpeakers').style.display = 'block';
    createTimers();
}

function updateSpeakerCount() {
    createTimers();
}

function createTimers() {
    const count = parseInt(document.getElementById('speakerCount').value);
    const equalSpeakers = document.getElementById('equalSpeakers');
    const usSpeakers = document.getElementById('usSpeakers');
    const intlSpeakers = document.getElementById('intlSpeakers');

    equalSpeakers.innerHTML = '';
    usSpeakers.innerHTML = '';
    intlSpeakers.innerHTML = '';
    timers = [];
    intervalIds.forEach(clearInterval);
    intervalIds = [];

    for (let i = 0; i < count; i++) {
        createTimer(equalSpeakers, `Equal Prep Speaker ${i + 1}`, 30);
        createTimer(usSpeakers, `US Speaker ${i + 1}`, 30);
        createTimer(intlSpeakers, `Intl Speaker ${i + 1}`, 30);
    }
}

function createTimer(container, title, duration) {
    const speakerDiv = document.createElement('div');
    speakerDiv.classList.add('speaker');

    const titleElem = document.createElement('span');
    titleElem.textContent = title;

    const timerElem = document.createElement('span');
    timerElem.classList.add('timer');
    timerElem.textContent = formatTime(duration * 60);
    
    const timeInput = document.createElement('input');
    timeInput.type = 'number';
    timeInput.value = duration;
    timeInput.min = 1;
    timeInput.style.width = '60px';
    timeInput.addEventListener('change', () => {
        duration = parseInt(timeInput.value);
        timerElem.textContent = formatTime(duration * 60);
    });
    
    const startBtn = document.createElement('button');
    startBtn.textContent = 'Start';
    startBtn.onclick = () => startTimer(timerElem, duration * 60);
    
    const pauseBtn = document.createElement('button');
    pauseBtn.textContent = 'Pause';
    pauseBtn.onclick = () => pauseTimer(timerElem);
    
    speakerDiv.appendChild(titleElem);
    speakerDiv.appendChild(timerElem);
    speakerDiv.appendChild(timeInput);
    speakerDiv.appendChild(startBtn);
    speakerDiv.appendChild(pauseBtn);
    container.appendChild(speakerDiv);
    timers.push({ title, duration });
}

function startTimer(timerElem, duration) {
    let timeRemaining = duration;
    const intervalId = setInterval(() => {
        timeRemaining--;
        timerElem.textContent = formatTime(timeRemaining);
        changeTimerColor(timerElem, timeRemaining);

        if (timeRemaining <= 0) {
            clearInterval(intervalId);
        }
    }, 1000);
    intervalIds.push(intervalId);
}

function pauseTimer(timerElem) {
    const index = Array.from(document.querySelectorAll('.timer')).indexOf(timerElem);
    if (index !== -1) {
        clearInterval(intervalIds[index]);
        intervalIds[index] = null;
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function changeTimerColor(timerElem, timeRemaining) {
    if (timeRemaining <= 0) {
        timerElem.style.backgroundColor = 'red';
    } else if (timeRemaining <= 60) {
        timerElem.style.backgroundColor = 'PaleVioletRed';
    } else if (timeRemaining <= 300) {
        timerElem.style.backgroundColor = 'orange';
    } else if (timeRemaining <= 600) {
        timerElem.style.backgroundColor = 'gold';
    } else if (timeRemaining <= 900) {
        timerElem.style.backgroundColor = 'yellow';
    } else {
        timerElem.style.backgroundColor = 'lightgreen';
    }
}

function openResetModal() {
    document.getElementById('resetModal').style.display = 'flex';
}

function closeResetModal() {
    document.getElementById('resetModal').style.display = 'none';
}

function resetAllTimers() {
    const input = document.getElementById('resetInput').value;
    if (input === 'RESET') {
        clearAllTimers();
        closeResetModal();
    } else {
        alert('Please type "RESET" to confirm.');
    }
}

function clearAllTimers() {
    intervalIds.forEach(clearInterval);
    intervalIds = [];
    const speakerElems = document.querySelectorAll('.timer');
    speakerElems.forEach(elem => {
        elem.textContent = formatTime(30 * 60);
        elem.style.backgroundColor = 'white';
    });
}
