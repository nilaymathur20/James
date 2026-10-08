package com.civicai.app.core.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = CivicBluePrimary,
    onPrimary = CivicOnPrimary,
    primaryContainer = CivicBlueContainer,
    secondary = CivicTealSecondary,
    background = CivicBackground,
    surface = CivicSurface,
    onBackground = CivicOnBackground,
    onSurface = CivicOnSurface,
    error = CivicError
)

@Composable
fun CivicAITheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        content = content
    )
}
