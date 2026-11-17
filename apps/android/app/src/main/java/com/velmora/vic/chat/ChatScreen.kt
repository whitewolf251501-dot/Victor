package com.velmora.vic.chat

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.velmora.vic.core.NetworkMonitor
import com.velmora.vic.ui.theme.*
import com.velmora.vic.voice.VoiceInputManager
import com.velmora.vic.voice.VoiceInputState
import com.velmora.vic.voice.VoiceOutputManager
import kotlinx.coroutines.launch

@Composable
fun ChatScreen(
    viewModel: ChatViewModel,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    val voiceInputManager = remember { VoiceInputManager(context) }
    val networkMonitor = remember { NetworkMonitor(context) }
    val isOnline by networkMonitor.isOnline.collectAsState()
    val voiceState by voiceInputManager.state.collectAsState()
    val voiceTranscript by voiceInputManager.transcript.collectAsState()
    val voiceError by voiceInputManager.error.collectAsState()

    var inputText by remember { mutableStateOf("") }

    // Permission launcher for microphone
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            voiceInputManager.startListening(
                onPermissionNeeded = {},
                onAutoSubmit = { transcript ->
                    inputText = ""
                    viewModel.sendMessage(transcript)
                }
            )
        } else {
            coroutineScope.launch {
                snackbarHostState.showSnackbar("Microphone permission needed for voice")
            }
        }
    }

    // Keep inputText updated with live voice transcript
    LaunchedEffect(voiceTranscript) {
        if (voiceState == VoiceInputState.LISTENING && voiceTranscript.isNotBlank()) {
            inputText = voiceTranscript
        }
    }

    // Handle voice errors
    LaunchedEffect(voiceError) {
        voiceError?.let { err ->
            snackbarHostState.showSnackbar(err)
        }
    }

    // Auto-scroll to bottom when messages update
    LaunchedEffect(uiState.messages.size, uiState.isThinking) {
        if (uiState.messages.isNotEmpty()) {
            listState.animateScrollToItem(uiState.messages.size - 1)
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            voiceInputManager.stopListening()
            VoiceOutputManager.stop()
        }
    }

    Scaffold(
        modifier = modifier
            .fillMaxSize()
            .imePadding(),
        containerColor = VictorBackground,
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Wolf Avatar Status Header
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = VictorBackground,
                border = androidx.compose.foundation.BorderStroke(1.dp, VictorBorder)
            ) {
                WolfAvatar(
                    isThinking = uiState.isThinking,
                    isListening = voiceState == VoiceInputState.LISTENING,
                    modifier = Modifier.padding(vertical = 12.dp)
                )
            }

            // Offline Network Banner
            AnimatedVisibility(visible = !isOnline) {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    color = VictorRose.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, VictorRose.copy(alpha = 0.5f))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(VictorRose, CircleShape)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "NETWORK DISCONNECTED • DIRECTIVES QUEUED LOCALLY",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            color = VictorRose
                        )
                    }
                }
            }

            // Error Message Banner (if present)
            AnimatedVisibility(visible = uiState.error != null) {
                uiState.error?.let { err ->
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 6.dp),
                        color = VictorRose.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, VictorRose.copy(alpha = 0.5f))
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = err,
                                color = VictorRose,
                                fontSize = 12.sp,
                                modifier = Modifier.weight(1f)
                            )
                            TextButton(onClick = { viewModel.clearError() }) {
                                Text("Dismiss", color = VictorRose, fontSize = 11.sp)
                            }
                        }
                    }
                }
            }

            // Messages Stream
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                if (uiState.messages.isEmpty() && !uiState.isThinking) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Victor Noctis standing by.\nTransmit a directive or question via text or voice.",
                            color = VictorTextTertiary,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 13.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            lineHeight = 20.sp
                        )
                    }
                } else {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        contentPadding = PaddingValues(vertical = 16.dp)
                    ) {
                        items(uiState.messages, key = { it.id }) { msg ->
                            val isUser = msg.role == "user"
                            MessageBubble(
                                message = msg,
                                isUser = isUser
                            )
                        }

                        if (uiState.isThinking) {
                            item {
                                ThinkingBubble()
                            }
                        }
                    }
                }
            }

            // Bottom Input HUD Bar
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = VictorSurface,
                border = androidx.compose.foundation.BorderStroke(1.dp, VictorBorder)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Voice mic button
                    IconButton(
                        onClick = {
                            if (voiceState == VoiceInputState.LISTENING) {
                                voiceInputManager.stopListening()
                            } else {
                                VoiceOutputManager.stop()
                                voiceInputManager.startListening(
                                    onPermissionNeeded = {
                                        permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                                    },
                                    onAutoSubmit = { transcript ->
                                        inputText = ""
                                        viewModel.sendMessage(transcript)
                                    }
                                )
                            }
                        },
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(
                                if (voiceState == VoiceInputState.LISTENING) VictorCyan else VictorSurfaceVariant
                            )
                            .border(
                                1.dp,
                                if (voiceState == VoiceInputState.LISTENING) VictorCyan else VictorBorder,
                                CircleShape
                            )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Mic,
                            contentDescription = "Voice Directive",
                            tint = if (voiceState == VoiceInputState.LISTENING) Color.Black else VictorTextSecondary,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    // Text Input
                    OutlinedTextField(
                        value = inputText,
                        onValueChange = {
                            VoiceOutputManager.stop()
                            inputText = it
                        },
                        placeholder = {
                            Text(
                                if (voiceState == VoiceInputState.LISTENING) "Listening..." else "Directive or inquiry...",
                                color = VictorTextTertiary,
                                fontSize = 14.sp
                            )
                        },
                        singleLine = false,
                        maxLines = 4,
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(20.dp)),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = VictorCyan,
                            unfocusedBorderColor = VictorBorder,
                            focusedTextColor = VictorTextPrimary,
                            unfocusedTextColor = VictorTextPrimary,
                            cursorColor = VictorCyan
                        ),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                        keyboardActions = KeyboardActions(
                            onSend = {
                                if (inputText.isNotBlank() && !uiState.isThinking) {
                                    val text = inputText
                                    inputText = ""
                                    viewModel.sendMessage(text)
                                }
                            }
                        ),
                        shape = RoundedCornerShape(20.dp)
                    )

                    // Send Button
                    IconButton(
                        onClick = {
                            if (inputText.isNotBlank() && !uiState.isThinking) {
                                val text = inputText
                                inputText = ""
                                viewModel.sendMessage(text)
                            }
                        },
                        enabled = inputText.isNotBlank() && !uiState.isThinking,
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(if (inputText.isNotBlank() && !uiState.isThinking) VictorCyan else VictorSurfaceVariant)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Send,
                            contentDescription = "Send Directive",
                            tint = if (inputText.isNotBlank() && !uiState.isThinking) Color.Black else VictorTextTertiary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun MessageBubble(
    message: MessageRecord,
    isUser: Boolean,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 300.dp)
                .clip(
                    RoundedCornerShape(
                        topStart = 14.dp,
                        topEnd = 14.dp,
                        bottomStart = if (isUser) 14.dp else 2.dp,
                        bottomEnd = if (isUser) 2.dp else 14.dp
                    )
                )
                .background(if (isUser) VictorCyan.copy(alpha = 0.15f) else VictorSurfaceVariant)
                .border(
                    1.dp,
                    if (isUser) VictorCyan.copy(alpha = 0.5f) else VictorBorderBright,
                    RoundedCornerShape(
                        topStart = 14.dp,
                        topEnd = 14.dp,
                        bottomStart = if (isUser) 14.dp else 2.dp,
                        bottomEnd = if (isUser) 2.dp else 14.dp
                    )
                )
                .padding(12.dp)
        ) {
            Text(
                text = if (isUser) "OWNER" else "VICTOR NOCTIS",
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = if (isUser) VictorCyan else VictorPurple,
                letterSpacing = 1.sp
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = message.content,
                fontSize = 14.sp,
                color = VictorTextPrimary,
                lineHeight = 20.sp
            )
        }
    }
}

@Composable
fun ThinkingBubble() {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Start
    ) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(12.dp))
                .background(VictorSurfaceVariant)
                .border(1.dp, VictorPurple.copy(alpha = 0.6f), RoundedCornerShape(12.dp))
                .padding(horizontal = 14.dp, vertical = 10.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(14.dp),
                    strokeWidth = 2.dp,
                    color = VictorPurple
                )
                Text(
                    text = "Processing directive...",
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    color = VictorPurple
                )
            }
        }
    }
}
