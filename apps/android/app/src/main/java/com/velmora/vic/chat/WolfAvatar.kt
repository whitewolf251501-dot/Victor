package com.velmora.vic.chat

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.velmora.vic.ui.theme.*

@Composable
fun WolfAvatar(
    isThinking: Boolean = false,
    isListening: Boolean = false,
    modifier: Modifier = Modifier
) {
    val targetColor = if (isThinking) VictorPurple else VictorCyan
    val ringColor by animateColorAsState(
        targetValue = targetColor,
        animationSpec = tween(durationMillis = 500),
        label = "wolf_ring_color"
    )

    val isFastPulse = isThinking || isListening

    // Breathing pulse animation
    val infiniteTransition = rememberInfiniteTransition(label = "wolf_pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = if (isFastPulse) 0.94f else 0.98f,
        targetValue = if (isFastPulse) 1.10f else 1.03f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = if (isFastPulse) 650 else 2200,
                easing = FastOutSlowInEasing
            ),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_scale"
    )

    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = if (isFastPulse) 0.6f else 0.3f,
        targetValue = if (isFastPulse) 1.0f else 0.7f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = if (isFastPulse) 650 else 2200,
                easing = FastOutSlowInEasing
            ),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_alpha"
    )

    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier.size(72.dp),
            contentAlignment = Alignment.Center
        ) {
            // Outer glowing pulse ring
            Canvas(
                modifier = Modifier
                    .size(72.dp * pulseScale)
            ) {
                drawCircle(
                    color = ringColor.copy(alpha = pulseAlpha * 0.4f),
                    style = Stroke(width = 3.dp.toPx())
                )
            }

            // Inner core avatar circle
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(VictorSurface)
                    .border(2.dp, ringColor, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                // Geometric HUD Wolf Head
                Canvas(modifier = Modifier.size(32.dp)) {
                    val w = size.width
                    val h = size.height

                    // Stylized wolf muzzle & ears
                    val path = Path().apply {
                        // Left ear tip
                        moveTo(w * 0.22f, h * 0.18f)
                        // Forehead center
                        lineTo(w * 0.50f, h * 0.32f)
                        // Right ear tip
                        lineTo(w * 0.78f, h * 0.18f)
                        // Right cheek
                        lineTo(w * 0.76f, h * 0.55f)
                        // Muzzle right
                        lineTo(w * 0.62f, h * 0.75f)
                        // Nose tip
                        lineTo(w * 0.50f, h * 0.88f)
                        // Muzzle left
                        lineTo(w * 0.38f, h * 0.75f)
                        // Left cheek
                        lineTo(w * 0.24f, h * 0.55f)
                        close()
                    }

                    drawPath(
                        path = path,
                        color = ringColor,
                        style = Stroke(width = 2.dp.toPx())
                    )

                    // Left eye
                    drawCircle(
                        color = ringColor,
                        radius = 2.dp.toPx(),
                        center = androidx.compose.ui.geometry.Offset(w * 0.40f, h * 0.48f)
                    )

                    // Right eye
                    drawCircle(
                        color = ringColor,
                        radius = 2.dp.toPx(),
                        center = androidx.compose.ui.geometry.Offset(w * 0.60f, h * 0.48f)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        // State indicator HUD text
        Text(
            text = when {
                isThinking -> "VICTOR • PROCESSING DIRECTIVE..."
                isListening -> "VICTOR • LISTENING TO DIRECTIVE..."
                else -> "VICTOR NOCTIS • READY"
            },
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            fontFamily = FontFamily.Monospace,
            color = if (isThinking) VictorPurple else VictorCyan,
            letterSpacing = 1.sp
        )
    }
}
