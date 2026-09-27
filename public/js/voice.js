// public/js/voice.js
// Voice input (Speech Recognition) and Speech Synthesis utilities

export function initVoice() {
  // Initialize speech synthesis voices
  if ('speechSynthesis' in window) {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }
}

let voicesCache = [];

function loadVoices() {
  voicesCache = speechSynthesis.getVoices();
}

// Speech Recognition (Dictado)
export function startDictation(textarea, onResult, onError, onEnd) {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    onError?.('Tu navegador no soporta dictado por voz');
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  recognition.lang = 'es-ES';
  recognition.continuous = true;
  recognition.interimResults = true;

  let finalTranscript = '';

  recognition.onstart = () => {
    textarea.dataset.dictating = 'true';
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + ' ';
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    onResult?.(finalTranscript + interimTranscript, finalTranscript);
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed') {
      onError?.('Permiso de micrófono denegado. Habilita el micrófono en la configuración del navegador.');
    } else if (event.error === 'no-speech') {
      // Silencioso, común
    } else {
      onError?.(`Error de voz: ${event.error}`);
    }
  };

  recognition.onend = () => {
    textarea.dataset.dictating = 'false';
    onEnd?.(finalTranscript.trim());
  };

  recognition.start();
  return recognition;
}

export function stopDictation(recognition) {
  if (recognition) {
    recognition.stop();
  }
}

// Speech Synthesis (Leer en voz alta)
export function speakText(text, options = {}) {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech Synthesis no soportado');
    return Promise.reject(new Error('No soportado'));
  }

  return new Promise((resolve, reject) => {
    // Cancelar cualquier habla anterior
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang || 'es-ES';
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.0;
    utterance.voice = options.voice || null;
    utterance.volume = options.volume ?? 1.0;

    utterance.onstart = () => options.onStart?.();
    utterance.onend = () => {
      options.onEnd?.();
      resolve();
    };
    utterance.onerror = (event) => {
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        options.onError?.(event.error);
        reject(new Error(event.error));
      } else {
        resolve();
      }
    };

    speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
}

export function getVoices() {
  return voicesCache;
}

export function isSpeaking() {
  return speechSynthesis?.speaking ?? false;
}

// Helper para usar en app.js
export function setupDictationButton(btn, textarea) {
  let recognition = null;
  let isListening = false;

  btn.addEventListener('click', () => {
    if (isListening) {
      stopDictation(recognition);
      return;
    }

    recognition = startDictation(
      textarea,
      (fullText, finalText) => {
        textarea.value = fullText;
        textarea.dispatchEvent(new Event('input'));
      },
      (error) => {
        console.error('Dictation error:', error);
        // Mostrar toast via app.js global
        if (window.showToast) window.showToast(error, 'error');
      },
      (finalText) => {
        isListening = false;
        btn.classList.remove('listening');
        btn.textContent = '🎤';
      }
    );

    isListening = true;
    btn.classList.add('listening');
    btn.textContent = '⏹️';
  });
}