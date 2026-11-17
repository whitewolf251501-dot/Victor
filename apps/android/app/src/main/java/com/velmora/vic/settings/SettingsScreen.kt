package com.velmora.vic.settings

import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.velmora.vic.auth.AuthViewModel
import com.velmora.vic.core.VicConfig
import com.velmora.vic.core.VicSupabase
import com.velmora.vic.device.DeviceManager
import com.velmora.vic.ui.theme.*
import com.velmora.vic.voice.VoiceOutputManager
import io.github.jan.supabase.gotrue.auth
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(
    authViewModel: AuthViewModel,
    onSignedOut: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val deviceManager = remember { DeviceManager(context) }
    var deviceId by remember { mutableStateOf("Resolving...") }
    var ttsEnabled by remember { mutableStateOf(true) }
    val user = remember { VicSupabase.get().auth.currentUserOrNull() }

    LaunchedEffect(Unit) {
        deviceId = deviceManager.getOrCreateDeviceId()
        ttsEnabled = VoiceOutputManager.isTtsEnabled(context)
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = VictorBackground
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            Column {
                Text(
                    text = "TERMINAL CONFIGURATION",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = VictorCyan,
                    letterSpacing = 1.sp
                )
                Text(
                    text = "SYSTEM 07 • HARDWARE & AUTH STATUS",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = VictorTextTertiary
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Device Info Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = VictorSurface),
                border = androidx.compose.foundation.BorderStroke(1.dp, VictorBorder)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.PhoneAndroid, contentDescription = null, tint = VictorCyan, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("DEVICE PROFILE", fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = VictorCyan)
                    }

                    SettingsRow("Device Name", "${Build.MANUFACTURER} ${Build.MODEL}")
                    SettingsRow("Android Version", "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
                    SettingsRow("Device ID", deviceId.take(16) + "...")
                    SettingsRow("Status", "ONLINE", statusColor = VictorEmerald)
                }
            }

            // Security & VTE Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = VictorSurface),
                border = androidx.compose.foundation.BorderStroke(1.dp, VictorBorder)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Security, contentDescription = null, tint = VictorPurple, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("SECURITY & VTE ENGINE", fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = VictorPurple)
                    }

                    SettingsRow("Owner Email", user?.email ?: "Authorized Commander")
                    SettingsRow("Authority Policy", "L0–L4 ACTIVE", statusColor = VictorEmerald)
                    SettingsRow("Web API Gateway", VicConfig.webApiUrl)
                }
            }

            // Voice Output Settings Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = VictorSurface),
                border = androidx.compose.foundation.BorderStroke(1.dp, VictorBorder)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("VICTOR SPEAKS RESPONSES", fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = VictorCyan)
                        Text("Vocalizes incoming directives using synthesized audio", fontSize = 11.sp, color = VictorTextSecondary)
                    }
                    Switch(
                        checked = ttsEnabled,
                        onCheckedChange = { checked ->
                            ttsEnabled = checked
                            coroutineScope.launch {
                                VoiceOutputManager.setTtsEnabled(context, checked)
                            }
                        },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = VictorCyan,
                            checkedTrackColor = VictorCyan.copy(alpha = 0.3f),
                            uncheckedThumbColor = VictorTextTertiary,
                            uncheckedTrackColor = VictorSurfaceVariant
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Sign Out Button
            Button(
                onClick = {
                    authViewModel.signOut()
                    onSignedOut()
                },
                colors = ButtonDefaults.buttonColors(
                    containerColor = VictorRose.copy(alpha = 0.2f),
                    contentColor = VictorRose
                ),
                shape = RoundedCornerShape(10.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, VictorRose.copy(alpha = 0.5f)),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
            ) {
                Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "DE-AUTHORIZE TERMINAL (SIGN OUT)",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp
                )
            }
        }
    }
}

@Composable
fun SettingsRow(
    label: String,
    value: String,
    statusColor: androidx.compose.ui.graphics.Color = VictorTextPrimary
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, fontSize = 12.sp, color = VictorTextSecondary)
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace, color = statusColor)
    }
}
