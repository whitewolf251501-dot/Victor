package com.velmora.vic.voice

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import com.velmora.vic.core.dataStore
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.map
import java.util.Locale

object VoiceOutputManager : TextToSpeech.OnInitListener {
    private var tts: TextToSpeech? = null
    private var isInitialized = false
    private val TTS_ENABLED_KEY = booleanPreferencesKey("tts_enabled")

    fun initialize(context: Context) {
        if (tts == null) {
            tts = TextToSpeech(context.applicationContext, this)
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            tts?.let { engine ->
                val result = engine.setLanguage(Locale.US)
                if (result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED) {
                    engine.setPitch(0.85f)
                    engine.setSpeechRate(0.90f)
                    isInitialized = true
                }
            }
        }
    }

    fun speak(text: String) {
        if (!isInitialized || tts == null) return
        val cleaned = cleanTextForSpeech(text)
        if (cleaned.isBlank()) return

        tts?.speak(cleaned, TextToSpeech.QUEUE_FLUSH, null, "vic_tts_output")
    }

    fun stop() {
        if (isInitialized) {
            tts?.stop()
        }
    }

    suspend fun isTtsEnabled(context: Context): Boolean {
        return context.dataStore.data.map { it[TTS_ENABLED_KEY] }.firstOrNull() ?: true
    }

    suspend fun setTtsEnabled(context: Context, enabled: Boolean) {
        context.dataStore.edit { prefs ->
            prefs[TTS_ENABLED_KEY] = enabled
        }
    }

    private fun cleanTextForSpeech(raw: String): String {
        return raw
            .replace(Regex("\\[([^\\]]+)\\]\\([^)]+\\)"), "$1")
            .replace(Regex("[*_#`~>]"), "")
            .replace("•", ", ")
            .replace(Regex("\\n+"), ". ")
            .trim()
    }

    fun shutdown() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        isInitialized = false
    }
}
