package com.spendly.finance.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.spendly.finance.app.ui.theme.ExpenseRed
import com.spendly.finance.app.ui.theme.SpendlyTeal

@Composable
fun ReminderCenter(viewModel: SpendlyViewModel, onDismiss: () -> Unit) {
    val active = viewModel.workspace.reminders.filter { it.dismissedAt == null }
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            Modifier.fillMaxWidth().fillMaxHeight(.92f).padding(top = 24.dp),
            shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
            color = MaterialTheme.colorScheme.background,
        ) {
            Column {
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Reminder center", Modifier.weight(1f), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    TextButton(onClick = onDismiss) { Text("Done") }
                }
                LazyColumn(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    item {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            ReminderMetric("Unread", viewModel.unreadReminders.size, MaterialTheme.colorScheme.onSurface, Modifier.weight(1f))
                            ReminderMetric("Upcoming", viewModel.unreadReminders.count { it.kind == "upcoming" }, SpendlyTeal, Modifier.weight(1f))
                            ReminderMetric("Overdue", viewModel.unreadReminders.count { it.kind == "overdue" }, ExpenseRed, Modifier.weight(1f))
                        }
                    }
                    item { Text("Active reminders", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
                    if (active.isEmpty()) item {
                        GlassCard(Modifier.fillMaxWidth()) {
                            Column(Modifier.fillMaxWidth().padding(vertical = 18.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(9.dp)) {
                                Icon(Icons.Outlined.NotificationsNone, null, tint = SpendlyTeal)
                                Text("No active reminders", fontWeight = FontWeight.Bold)
                                Text("Upcoming recurring items will appear here.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                    items(active, key = { it.id }) { reminder ->
                        GlassCard(Modifier.fillMaxWidth()) {
                            Row(Modifier.fillMaxWidth()) {
                                Text(reminder.title, Modifier.weight(1f), fontWeight = FontWeight.Bold)
                                Text(reminder.kind.replaceFirstChar(Char::uppercase), color = if (reminder.kind == "overdue") ExpenseRed else SpendlyTeal, style = MaterialTheme.typography.labelMedium)
                            }
                            Text(reminder.body, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("Due ${displayDate(reminder.dueDate)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                if (reminder.readAt == null) Button(onClick = { viewModel.markReminderRead(reminder) }) { Text("Mark read") }
                                TextButton(onClick = { viewModel.dismissReminder(reminder) }) { Text("Dismiss", color = MaterialTheme.colorScheme.error) }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReminderMetric(title: String, value: Int, color: androidx.compose.ui.graphics.Color, modifier: Modifier) {
    GlassCard(modifier) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(value.toString(), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = color)
            Text(title, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
