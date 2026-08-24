package com.spendly.finance.app.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import com.spendly.finance.app.data.Appearance

val SpendlyTeal = Color(0xFF14B8A6)
val SpendlyNavy = Color(0xFF051F52)
val SpendlyBlue = Color(0xFF08B3C7)
val IncomeGreen = Color(0xFF21C45E)
val ExpenseRed = Color(0xFFF5415E)
val WarningAmber = Color(0xFFF59E0B)

private val LightColors = lightColorScheme(
    primary = SpendlyTeal,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD3F6F5),
    onPrimaryContainer = SpendlyNavy,
    secondary = SpendlyNavy,
    tertiary = SpendlyBlue,
    background = Color(0xFFF2F2F7),
    surface = Color(0xFFF8F8FC),
    surfaceContainer = Color(0xDDF9F9FC),
    outline = Color(0xFFD8D8DE),
    error = ExpenseRed,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF43D5D0),
    onPrimary = Color(0xFF003735),
    primaryContainer = Color(0xFF00504E),
    onPrimaryContainer = Color(0xFF9CF2EF),
    secondary = Color(0xFF9EC5FF),
    tertiary = Color(0xFF88BFFF),
    background = Color(0xFF040F16),
    surface = Color(0xFF0A1821),
    surfaceContainer = Color(0xDD172731),
    outline = Color(0xFF3A4C57),
    error = Color(0xFFFF8FA1),
)

@Composable
fun SpendlyTheme(appearance: Appearance, content: @Composable () -> Unit) {
    val dark = when (appearance) {
        Appearance.SYSTEM -> isSystemInDarkTheme()
        Appearance.DARK -> true
        Appearance.LIGHT -> false
    }
    val colors: ColorScheme = if (dark) DarkColors else LightColors
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = Color.Transparent.toArgb()
            window.navigationBarColor = Color.Transparent.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !dark
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = !dark
            }
        }
    }
    MaterialTheme(colorScheme = colors, typography = androidx.compose.material3.Typography(), content = content)
}
