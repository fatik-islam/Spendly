package com.spendly.finance.app.ui

import android.graphics.BitmapFactory
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spendly.finance.app.data.CurrencyCode
import com.spendly.finance.app.ui.theme.SpendlyNavy
import com.spendly.finance.app.ui.theme.SpendlyBlue
import com.spendly.finance.app.ui.theme.SpendlyTeal
import java.text.NumberFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Currency
import java.util.Locale

@Composable
fun SpendlyBackground(content: @Composable () -> Unit) {
    val dark = MaterialTheme.colorScheme.background.luminanceValue < 0.25f
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Box(
            Modifier.fillMaxSize().background(
                Brush.radialGradient(
                    listOf(SpendlyTeal.copy(alpha = if (dark) .18f else .16f), Color.Transparent),
                    radius = 1050f,
                )
            )
        )
        Box(
            Modifier.fillMaxSize().background(
                Brush.radialGradient(
                    listOf(SpendlyBlue.copy(alpha = if (dark) .13f else .10f), Color.Transparent),
                    radius = 1450f,
                )
            )
        )
        content()
    }
}

private val Color.luminanceValue get() = (red + green + blue) / 3f

@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer.copy(alpha = 0.84f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.07f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) { Column(Modifier.padding(18.dp), content = content) }
}

@Composable
fun BrandIcon(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val bitmap = remember {
        context.assets.open("spendly-icon.png").use(BitmapFactory::decodeStream).asImageBitmap()
    }
    androidx.compose.foundation.Image(
        bitmap = bitmap, contentDescription = "Spendly logo",
        modifier = modifier.clip(RoundedCornerShape(17.dp)),
    )
}

@Composable
fun BrandLockup(compact: Boolean = false) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        BrandIcon(Modifier.size(if (compact) 38.dp else 52.dp).shadow(10.dp, RoundedCornerShape(if (compact) 12.dp else 17.dp)))
        Text(
            "Spendly", color = if (MaterialTheme.colorScheme.background.luminanceValue < .25f) Color(0xFFE7F0FF) else SpendlyNavy,
            fontWeight = FontWeight.Bold, fontSize = if (compact) 18.sp else 24.sp,
        )
    }
}

@Composable
fun AnimatedLaunch() {
    val transition = rememberInfiniteTransition(label = "launch")
    val breath by transition.animateFloat(
        initialValue = .98f, targetValue = 1.08f,
        animationSpec = infiniteRepeatable(tween(2300), RepeatMode.Reverse), label = "breath",
    )
    val dotPulse by transition.animateFloat(
        initialValue = .45f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(680), RepeatMode.Reverse), label = "dots",
    )
    var revealed by remember { mutableStateOf(false) }
    val reveal by animateFloatAsState(if (revealed) 1f else .74f, spring(dampingRatio = .76f), label = "reveal")
    LaunchedEffect(Unit) { revealed = true }
    val dark = MaterialTheme.colorScheme.background.luminanceValue < .25f
    Box(
        Modifier.fillMaxSize().background(
            Brush.linearGradient(
                if (dark) listOf(Color(0xFF040E13), Color(0xFF04181B), Color(0xFF050C16))
                else listOf(Color(0xFFF5FAFC), Color(0xFFE8F7F7), Color(0xFFF2F7FC))
            )
        )
    ) {
        Column(
            Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Box(
                Modifier.size(132.dp).scale(reveal)
                    .border(1.dp, if (dark) Color.White.copy(.14f) else SpendlyNavy.copy(.10f), RoundedCornerShape(31.dp))
                    .scale(breath),
                contentAlignment = Alignment.Center,
            ) { BrandIcon(Modifier.size(116.dp).shadow(24.dp, RoundedCornerShape(27.dp))) }
            Spacer(Modifier.height(22.dp))
            Text(
                "Spendly",
                color = if (MaterialTheme.colorScheme.background.luminanceValue < .25f) Color(0xFFE7F0FF) else SpendlyNavy,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 34.sp,
            )
            Spacer(Modifier.height(22.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                repeat(3) { index ->
                    Box(
                        Modifier.size(7.dp).scale((dotPulse + index * .08f).coerceAtMost(1f))
                            .background(if (index == 1) SpendlyBlue else SpendlyTeal, CircleShape)
                    )
                }
            }
        }
    }
}

@Composable
fun MetricCard(title: String, value: String, note: String, icon: ImageVector, tint: Color, modifier: Modifier = Modifier) {
    GlassCard(modifier.heightIn(min = 128.dp)) {
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(title, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1)
                Text(note, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2)
            }
            Box(Modifier.size(42.dp).background(tint.copy(alpha = .13f), RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = tint)
            }
        }
    }
}

@Composable
fun SectionHeading(title: String, subtitle: String? = null, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun EmptyFeature(icon: ImageVector, title: String, message: String, modifier: Modifier = Modifier) {
    GlassCard(modifier) {
        Column(Modifier.fillMaxWidth().padding(vertical = 18.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(58.dp).background(SpendlyTeal.copy(.12f), RoundedCornerShape(18.dp)), contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = SpendlyTeal)
            }
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

fun currency(value: Double, code: CurrencyCode): String {
    val formatted = NumberFormat.getCurrencyInstance().apply {
        currency = Currency.getInstance(code.name)
        maximumFractionDigits = if (value % 1.0 == 0.0) 0 else 2
    }.format(value)
    return if (formatted.startsWith(code.name) && formatted.getOrNull(code.name.length)?.isWhitespace() == false) {
        formatted.replaceFirst(code.name, "${code.name}\u00A0")
    } else formatted
}

fun displayDate(value: String): String = runCatching {
    LocalDate.parse(value).format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(Locale.getDefault()))
}.getOrDefault(value)
