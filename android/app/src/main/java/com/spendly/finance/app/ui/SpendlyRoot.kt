package com.spendly.finance.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.spendly.finance.app.data.SessionState
import com.spendly.finance.app.ui.theme.SpendlyTheme
import kotlinx.coroutines.delay

@Composable
fun SpendlyRoot(viewModel: SpendlyViewModel) {
    var launchFinished by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { delay(1650); launchFinished = true }

    SpendlyTheme(viewModel.appearance) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Box(Modifier.fillMaxSize()) {
                if (!launchFinished || viewModel.sessionState == SessionState.LAUNCHING) {
                    AnimatedLaunch()
                } else {
                    when (viewModel.sessionState) {
                        SessionState.LAUNCHING -> Unit
                        SessionState.SIGNED_OUT -> AuthScreen(viewModel)
                        SessionState.SIGNED_IN -> MainScreen(viewModel)
                    }
                }

                if (viewModel.isLoading && launchFinished && viewModel.sessionState != SessionState.LAUNCHING) {
                    Box(
                        Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Surface(shape = androidx.compose.foundation.shape.CircleShape, tonalElevation = 8.dp) {
                            CircularProgressIndicator(Modifier.padding(22.dp))
                        }
                    }
                }

                viewModel.noticeMessage?.let { message ->
                    Surface(
                        modifier = Modifier.align(Alignment.TopCenter).padding(top = 54.dp),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
                        tonalElevation = 8.dp,
                    ) { Text(message, Modifier.padding(horizontal = 18.dp, vertical = 12.dp)) }
                }
            }
        }
        viewModel.errorMessage?.let { message ->
            AlertDialog(
                onDismissRequest = viewModel::clearError,
                title = { Text("Spendly") },
                text = { Text(message) },
                confirmButton = { TextButton(onClick = viewModel::clearError) { Text("OK") } },
            )
        }
    }
}
