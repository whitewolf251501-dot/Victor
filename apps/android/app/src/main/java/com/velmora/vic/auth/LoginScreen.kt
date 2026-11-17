package com.velmora.vic.auth

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.velmora.vic.ui.theme.*

@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onLoginSuccess: () -> Unit,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val focusManager = LocalFocusManager.current

    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var isMagicLinkMode by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.isAuthenticated) {
        if (uiState.isAuthenticated) {
            onLoginSuccess()
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(VictorBackground)
            .padding(24.dp)
            .imePadding(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(VictorSurface)
                .border(1.dp, VictorBorder, RoundedCornerShape(16.dp))
                .padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header HUD
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "VICTOR NOCTIS",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = VictorCyan,
                    letterSpacing = 2.sp
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "SYSTEM 07 • SECURE COMPANION CLIENT",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = VictorTextTertiary
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Error Message Banner
            AnimatedVisibility(visible = uiState.error != null) {
                uiState.error?.let { err ->
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = VictorRose.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, VictorRose.copy(alpha = 0.5f))
                    ) {
                        Text(
                            text = err,
                            color = VictorRose,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            }

            // Magic Link Sent Banner
            AnimatedVisibility(visible = uiState.magicLinkSent) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = VictorEmerald.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, VictorEmerald.copy(alpha = 0.5f))
                ) {
                    Text(
                        text = "Authentication link dispatched to $email. Check your inbox to authorize this terminal.",
                        color = VictorEmerald,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            // Email Field
            OutlinedTextField(
                value = email,
                onValueChange = {
                    email = it
                    viewModel.clearError()
                },
                label = { Text("Owner Email", color = VictorTextSecondary) },
                leadingIcon = {
                    Icon(Icons.Default.Email, contentDescription = null, tint = VictorCyan)
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Email,
                    imeAction = if (isMagicLinkMode) ImeAction.Done else ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onDone = {
                        focusManager.clearFocus()
                        if (isMagicLinkMode) viewModel.signInWithMagicLink(email)
                    }
                ),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = VictorCyan,
                    unfocusedBorderColor = VictorBorder,
                    focusedTextColor = VictorTextPrimary,
                    unfocusedTextColor = VictorTextPrimary,
                    cursorColor = VictorCyan
                ),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp)
            )

            // Password Field (if not magic link mode)
            if (!isMagicLinkMode) {
                OutlinedTextField(
                    value = password,
                    onValueChange = {
                        password = it
                        viewModel.clearError()
                    },
                    label = { Text("Secret Key", color = VictorTextSecondary) },
                    leadingIcon = {
                        Icon(Icons.Default.Lock, contentDescription = null, tint = VictorCyan)
                    },
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(
                                if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = null,
                                tint = VictorTextSecondary
                            )
                        }
                    },
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = {
                            focusManager.clearFocus()
                            viewModel.signInWithPassword(email, password)
                        }
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = VictorCyan,
                        unfocusedBorderColor = VictorBorder,
                        focusedTextColor = VictorTextPrimary,
                        unfocusedTextColor = VictorTextPrimary,
                        cursorColor = VictorCyan
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
            }

            // Submit Button
            Button(
                onClick = {
                    focusManager.clearFocus()
                    if (isMagicLinkMode) {
                        viewModel.signInWithMagicLink(email)
                    } else {
                        viewModel.signInWithPassword(email, password)
                    }
                },
                enabled = !uiState.isLoading,
                colors = ButtonDefaults.buttonColors(
                    containerColor = VictorCyan,
                    contentColor = Color.Black
                ),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
            ) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = Color.Black
                    )
                } else {
                    Text(
                        text = if (isMagicLinkMode) "TRANSMIT MAGIC LINK" else "AUTHORIZE TERMINAL",
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 1.sp
                    )
                }
            }

            // Mode Toggle
            TextButton(
                onClick = {
                    isMagicLinkMode = !isMagicLinkMode
                    viewModel.clearError()
                }
            ) {
                Text(
                    text = if (isMagicLinkMode) "Use Password Authorization" else "Request Magic Link Authentication",
                    color = VictorTextSecondary,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
