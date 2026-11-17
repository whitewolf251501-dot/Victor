package com.velmora.vic

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.velmora.vic.device.DeviceManager
import com.velmora.vic.navigation.VicNavGraph
import com.velmora.vic.ui.theme.VictorTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val deviceManager by lazy { DeviceManager(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        setContent {
            VictorTheme {
                VicNavGraph()
            }
        }
    }

    override fun onStart() {
        super.onStart()
        lifecycleScope.launch {
            deviceManager.onAppStart()
        }
    }

    override fun onStop() {
        super.onStop()
        lifecycleScope.launch {
            deviceManager.onAppBackground()
        }
    }
}
