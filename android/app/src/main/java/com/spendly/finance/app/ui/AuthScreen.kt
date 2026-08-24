package com.spendly.finance.app.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.Pin
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.spendly.finance.app.ui.theme.SpendlyBlue
import com.spendly.finance.app.ui.theme.SpendlyNavy
import com.spendly.finance.app.ui.theme.SpendlyTeal

private enum class AuthMode { LOGIN, SIGN_UP, VERIFY, FORGOT, RESET }

@Composable
fun AuthScreen(viewModel: SpendlyViewModel) {
    val context = LocalContext.current
    val preferences = remember { context.getSharedPreferences("spendly_settings", Context.MODE_PRIVATE) }
    var mode by remember { mutableStateOf(AuthMode.LOGIN) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmation by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var showConfirmation by remember { mutableStateOf(false) }
    var rememberMe by remember { mutableStateOf(preferences.getBoolean("remember_me", true)) }

    fun clearSecrets() {
        password = ""
        confirmation = ""
        code = ""
        showPassword = false
        showConfirmation = false
    }

    SpendlyBackground {
        Column(
            Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 38.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            BrandLockup()
            Spacer(Modifier.height(26.dp))
            GlassCard(Modifier.widthIn(max = 560.dp).fillMaxWidth()) {
                Text(title(mode), style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Text(subtitle(mode, email), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(22.dp))

                if (mode == AuthMode.SIGN_UP) {
                    AuthField("Full name", name, { name = it }, Icons.Default.Person, "Alex Morgan")
                    Spacer(Modifier.height(16.dp))
                }
                if (mode != AuthMode.VERIFY && mode != AuthMode.RESET) {
                    AuthField("Email", email, { email = it }, Icons.Default.Email, "you@example.com", KeyboardType.Email)
                    Spacer(Modifier.height(16.dp))
                }
                if (mode == AuthMode.VERIFY || mode == AuthMode.RESET) {
                    AuthField(
                        if (mode == AuthMode.VERIFY) "Verification code" else "Reset code",
                        code, { code = it.filter(Char::isDigit).take(6) }, Icons.Outlined.Pin, "123456", KeyboardType.NumberPassword,
                    )
                    Spacer(Modifier.height(16.dp))
                }
                if (mode == AuthMode.LOGIN || mode == AuthMode.SIGN_UP || mode == AuthMode.RESET) {
                    AuthField(
                        if (mode == AuthMode.RESET) "New password" else "Password",
                        password, { password = it }, Icons.Default.Lock,
                        if (mode == AuthMode.SIGN_UP) "At least ${viewModel.authConfig.passwordMinLength} characters" else "••••••••",
                        KeyboardType.Password, true, showPassword, { showPassword = !showPassword },
                    )
                    Spacer(Modifier.height(16.dp))
                }
                if (mode == AuthMode.SIGN_UP || mode == AuthMode.RESET) {
                    AuthField(
                        if (mode == AuthMode.RESET) "Confirm new password" else "Confirm password",
                        confirmation, { confirmation = it }, Icons.Default.Lock, "••••••••", KeyboardType.Password,
                        true, showConfirmation, { showConfirmation = !showConfirmation },
                    )
                    Spacer(Modifier.height(16.dp))
                }
                if (mode == AuthMode.LOGIN) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Row(
                            Modifier.clickable {
                                rememberMe = !rememberMe
                                preferences.edit().putBoolean("remember_me", rememberMe).apply()
                            },
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Switch(
                                checked = rememberMe,
                                onCheckedChange = {
                                    rememberMe = it
                                    preferences.edit().putBoolean("remember_me", it).apply()
                                },
                            )
                            Text("Remember me", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                        }
                        Spacer(Modifier.weight(1f))
                        TextButton(
                            onClick = { clearSecrets(); mode = AuthMode.FORGOT },
                            contentPadding = PaddingValues(horizontal = 4.dp),
                        ) { Text("Forgot password?", fontWeight = FontWeight.SemiBold, maxLines = 1) }
                    }
                }
                Spacer(Modifier.height(10.dp))
                PrimaryAuthButton(
                    text = actionTitle(mode),
                    enabled = formEnabled(mode, name, email, password, confirmation, code) && !viewModel.isLoading,
                    onClick = {
                        when (mode) {
                            AuthMode.LOGIN -> viewModel.signIn(email, password, rememberMe)
                            AuthMode.SIGN_UP -> {
                                if (password != confirmation) viewModel.showError("Passwords do not match.")
                                else viewModel.signUp(name, email, password) { verifiedEmail -> email = verifiedEmail; code = ""; mode = AuthMode.VERIFY }
                            }
                            AuthMode.VERIFY -> viewModel.verifyEmail(email, code)
                            AuthMode.FORGOT -> viewModel.sendPasswordReset(email) { code = ""; password = ""; confirmation = ""; mode = AuthMode.RESET }
                            AuthMode.RESET -> {
                                if (password != confirmation) viewModel.showError("Passwords do not match.")
                                else viewModel.resetPassword(email, code, password) { clearSecrets(); mode = AuthMode.LOGIN }
                            }
                        }
                    },
                )
                if (mode == AuthMode.VERIFY) {
                    TextButton(onClick = { viewModel.resendVerification(email) }, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Resend code") }
                    TextButton(onClick = { clearSecrets(); mode = AuthMode.LOGIN }, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Back to sign in", fontWeight = FontWeight.SemiBold) }
                } else if (mode == AuthMode.FORGOT) {
                    TextButton(onClick = { clearSecrets(); mode = AuthMode.LOGIN }, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Back to sign in", fontWeight = FontWeight.SemiBold) }
                } else if (mode == AuthMode.RESET) {
                    TextButton(onClick = { viewModel.sendPasswordReset(email) {} }, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Send another code") }
                } else {
                    Row(Modifier.align(Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                        Text(if (mode == AuthMode.LOGIN) "New to Spendly?" else "Already have an account?", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        TextButton(onClick = { clearSecrets(); mode = if (mode == AuthMode.LOGIN) AuthMode.SIGN_UP else AuthMode.LOGIN }) {
                            Text(if (mode == AuthMode.LOGIN) "Create an account" else "Sign in", fontWeight = FontWeight.SemiBold, maxLines = 1)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AuthField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    icon: ImageVector,
    placeholder: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    password: Boolean = false,
    visible: Boolean = false,
    onToggle: () -> Unit = {},
) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(label, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
        TextField(
            value = value,
            onValueChange = onChange,
            placeholder = { Text(placeholder, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(.62f)) },
            leadingIcon = { Icon(icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant) },
            trailingIcon = if (password) ({
                IconButton(onClick = onToggle) {
                    Icon(if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, if (visible) "Hide ${label.lowercase()}" else "Show ${label.lowercase()}")
                }
            }) else null,
            visualTransformation = if (password && !visible) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            singleLine = true,
            shape = RoundedCornerShape(16.dp),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = MaterialTheme.colorScheme.surface,
                unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                focusedIndicatorColor = if (MaterialTheme.colorScheme.background.luminance() < .25f) Color.White.copy(.78f) else SpendlyNavy.copy(.72f),
                unfocusedIndicatorColor = MaterialTheme.colorScheme.onSurface.copy(.08f),
            ),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun PrimaryAuthButton(text: String, enabled: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = enabled,
        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent, disabledContainerColor = Color.Transparent),
        modifier = Modifier.fillMaxWidth().height(54.dp).clip(RoundedCornerShape(17.dp))
            .background(if (enabled) Brush.horizontalGradient(listOf(SpendlyTeal, SpendlyBlue)) else Brush.horizontalGradient(listOf(Color.Gray, Color.Gray))),
    ) { Text(text, color = Color.White, fontWeight = FontWeight.Bold) }
}

private fun title(mode: AuthMode) = when (mode) {
    AuthMode.LOGIN -> "Welcome back"
    AuthMode.SIGN_UP -> "Create your workspace"
    AuthMode.VERIFY -> "Verify your email"
    AuthMode.FORGOT -> "Reset your password"
    AuthMode.RESET -> "Choose a new password"
}

private fun subtitle(mode: AuthMode, email: String) = when (mode) {
    AuthMode.LOGIN -> "Sign in to your Spendly workspace."
    AuthMode.SIGN_UP -> "Use the same account on web and Android."
    AuthMode.VERIFY -> "Enter the 6-digit code sent to $email."
    AuthMode.FORGOT -> "We’ll email you a secure 6-digit reset code."
    AuthMode.RESET -> "Enter the code sent to $email, then set a new password."
}

private fun actionTitle(mode: AuthMode) = when (mode) {
    AuthMode.LOGIN -> "Sign in"
    AuthMode.SIGN_UP -> "Create account"
    AuthMode.VERIFY -> "Verify email"
    AuthMode.FORGOT -> "Send reset code"
    AuthMode.RESET -> "Update password"
}

private fun formEnabled(mode: AuthMode, name: String, email: String, password: String, confirmation: String, code: String) = when (mode) {
    AuthMode.LOGIN -> email.isNotBlank() && password.isNotBlank()
    AuthMode.SIGN_UP -> name.isNotBlank() && email.isNotBlank() && password.isNotBlank() && confirmation.isNotBlank()
    AuthMode.VERIFY -> code.length == 6
    AuthMode.FORGOT -> email.isNotBlank()
    AuthMode.RESET -> code.length == 6 && password.isNotBlank() && confirmation.isNotBlank()
}
