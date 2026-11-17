package com.velmora.vic.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.graphics.Color

val VictorBackground = Color(0xFF0B0D13)
val VictorSurface = Color(0xFF111520)
val VictorSurfaceVariant = Color(0xFF181E2E)
val VictorBorder = Color(0xFF1E2638)
val VictorBorderBright = Color(0xFF2E3852)

val VictorCyan = Color(0xFF00E5FF)
val VictorPurple = Color(0xFFA855F7)
val VictorEmerald = Color(0xFF10B981)
val VictorRose = Color(0xFFF43F5E)

val VictorTextPrimary = Color(0xFFF8FAFC)
val VictorTextSecondary = Color(0xFF94A3B8)
val VictorTextTertiary = Color(0xFF64748B)

val VictorDarkColorScheme = darkColorScheme(
    primary = VictorCyan,
    onPrimary = Color.Black,
    secondary = VictorPurple,
    onSecondary = Color.White,
    tertiary = VictorEmerald,
    background = VictorBackground,
    onBackground = VictorTextPrimary,
    surface = VictorSurface,
    onSurface = VictorTextPrimary,
    surfaceVariant = VictorSurfaceVariant,
    onSurfaceVariant = VictorTextSecondary,
    outline = VictorBorder,
    error = VictorRose,
    onError = Color.White
)
