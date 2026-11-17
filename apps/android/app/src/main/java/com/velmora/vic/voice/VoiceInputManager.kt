package com.velmora.vic.voice

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class VoiceInputState {
    IDLE,
    LISTENING,
    PROCESSING,
    ERROR
}

class VoiceInputManager(private val context: Context) {
    private var speechRecognizer: SpeechRecognizer? = null
    private val handler = Handler(Looper.getMainLooper())
    private var silenceRunnable: Runnable? = null
    private var currentTranscript: String = ""

    private val _state = MutableStateFlow(VoiceInputState.IDLE)
    val state: StateFlow<VoiceInputState> = _state.asStateFlow()

    private val _transcript = MutableStateFlow("")
    val transcript: StateFlow<String> = _transcript.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun isPermissionGranted(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun startListening(
        onPermissionNeeded: () -> Unit,
        onAutoSubmit: (String) -> Unit
    ) {
        if (!isPermissionGranted()) {
            onPermissionNeeded()
            return
        }

        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            _error.value = "Speech recognition is not available on this device."
            _state.value = VoiceInputState.ERROR
            return
        }

        stopListening()
        _error.value = null
        _transcript.value = ""
        currentTranscript = ""

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    _state.value = VoiceInputState.LISTENING
                }

                override fun onBeginningOfSpeech() {
                    cancelSilenceTimer()
                }

                override fun onRmsChanged(rmsdB: Float) {}

                override fun onBufferReceived(buffer: ByteArray?) {}

                override fun onEndOfSpeech() {
                    scheduleSilenceSubmit(onAutoSubmit)
                }

                override fun onError(errorCode: Int) {
                    cancelSilenceTimer()
                    val msg = when (errorCode) {
                        SpeechRecognizer.ERROR_AUDIO -> "Audio recording error."
                        SpeechRecognizer.ERROR_CLIENT -> "Client error."
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient microphone permissions."
                        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network communication error."
                        SpeechRecognizer.ERROR_NO_MATCH -> "No speech recognized."
                        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech service is busy."
                        SpeechRecognizer.ERROR_SERVER -> "Recognition server error."
                        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Speech timeout."
                        else -> "Speech recognition error: $errorCode"
                    }
                    _error.value = msg
                    _state.value = VoiceInputState.ERROR
                }

                override fun onResults(results: Bundle?) {
                    cancelSilenceTimer()
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val text = matches?.firstOrNull()?.trim() ?: currentTranscript
                    if (text.isNotBlank()) {
                        _transcript.value = text
                        _state.value = VoiceInputState.PROCESSING
                        onAutoSubmit(text)
                    }
                    _state.value = VoiceInputState.IDLE
                }

                override fun onPartialResults(partialResults: Bundle?) {
                    val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val partial = matches?.firstOrNull()?.trim() ?: ""
                    if (partial.isNotBlank()) {
                        currentTranscript = partial
                        _transcript.value = partial
                        scheduleSilenceSubmit(onAutoSubmit)
                    }
                }

                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
        }

        speechRecognizer?.startListening(intent)
    }

    private fun scheduleSilenceSubmit(onAutoSubmit: (String) -> Unit) {
        cancelSilenceTimer()
        silenceRunnable = Runnable {
            val text = currentTranscript.trim()
            if (text.isNotBlank() && _state.value == VoiceInputState.LISTENING) {
                _state.value = VoiceInputState.PROCESSING
                stopListening()
                onAutoSubmit(text)
            }
        }
        handler.postDelayed(silenceRunnable!!, 1500)
    }

    private fun cancelSilenceTimer() {
        silenceRunnable?.let { handler.removeCallbacks(it) }
        silenceRunnable = null
    }

    fun stopListening() {
        cancelSilenceTimer()
        try {
            speechRecognizer?.stopListening()
            speechRecognizer?.destroy()
        } catch (_: Exception) {}
        speechRecognizer = null
        if (_state.value == VoiceInputState.LISTENING) {
            _state.value = VoiceInputState.IDLE
        }
    }
}
