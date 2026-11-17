package com.velmora.vic

import android.app.Application
import com.velmora.vic.core.VicSupabase
import com.velmora.vic.voice.VoiceOutputManager

class VicApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        VicSupabase.initialize(this)
        VoiceOutputManager.initialize(this)
    }
}
