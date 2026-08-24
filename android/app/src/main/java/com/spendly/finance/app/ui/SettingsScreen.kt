package com.spendly.finance.app.ui

import android.content.Intent
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CloudDownload
import androidx.compose.material.icons.outlined.CloudUpload
import androidx.compose.material.icons.outlined.DeleteForever
import androidx.compose.material.icons.outlined.Science
import androidx.compose.material.icons.outlined.Logout
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.PrivacyTip
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.app.NotificationManagerCompat
import com.spendly.finance.app.BuildConfig
import com.spendly.finance.app.data.Appearance
import com.spendly.finance.app.data.Category
import com.spendly.finance.app.data.CategoryDraft
import com.spendly.finance.app.data.CsvImportSummary
import com.spendly.finance.app.data.CurrencyCode
import com.spendly.finance.app.data.ExportDataset

@Composable
fun SettingsScreen(viewModel: SpendlyViewModel, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val uriHandler = LocalUriHandler.current
    var name by remember(viewModel.workspace.profile) { mutableStateOf(viewModel.workspace.profile?.fullName.orEmpty()) }
    var selectedCurrency by remember(viewModel.workspace.profile) { mutableStateOf(viewModel.currency) }
    var reminderDays by remember(viewModel.workspace.profile) { mutableIntStateOf(viewModel.workspace.profile?.reminderDaysBefore ?: 3) }
    var inApp by remember(viewModel.workspace.profile) { mutableStateOf(viewModel.workspace.profile?.reminderInAppEnabled ?: true) }
    var email by remember(viewModel.workspace.profile) { mutableStateOf(viewModel.workspace.profile?.reminderEmailEnabled ?: false) }
    var categoryEditor by remember { mutableStateOf<CategoryDraft?>(null) }
    var deleteCategory by remember { mutableStateOf<Category?>(null) }
    var showSignOut by remember { mutableStateOf(false) }
    var showDeleteAccount by remember { mutableStateOf(false) }
    var showDemoConfirmation by remember { mutableStateOf(false) }
    var exportMenu by remember { mutableStateOf(false) }
    var exportDataset by remember { mutableStateOf(ExportDataset.TRANSACTIONS) }
    var importSummary by remember { mutableStateOf<CsvImportSummary?>(null) }
    val notificationsEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled()

    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) runCatching {
            context.contentResolver.openOutputStream(uri)?.bufferedWriter()?.use { it.write(viewModel.exportCsv(exportDataset)) }
        }.onFailure { viewModel.showError("The CSV export could not be saved.") }
    }
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) runCatching {
            context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() } ?: error("Unable to read file")
        }.onSuccess { input -> viewModel.importCsv(input) { importSummary = it } }
            .onFailure { viewModel.showError("The selected CSV could not be read.") }
    }

    LazyColumn(
        modifier.fillMaxSize().padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            SettingsHeader("Profile")
            GlassCard(Modifier.fillMaxWidth()) {
                OutlinedTextField(name, { name = it }, label = { Text("Full name") }, modifier = Modifier.fillMaxWidth())
                LabeledValue("Email", viewModel.currentUser?.email.orEmpty())
                ChoiceRow("Currency", CurrencyCode.entries.map { it.name }, selectedCurrency.name) { selectedCurrency = CurrencyCode.valueOf(it) }
                Button(onClick = { viewModel.updateProfile(name, selectedCurrency) }) { Text("Save profile") }
            }
        }
        item {
            SettingsHeader("Appearance")
            GlassCard(Modifier.fillMaxWidth()) {
                ChoiceRow("Theme", Appearance.entries.map { it.name.lowercase().replaceFirstChar(Char::uppercase) }, viewModel.appearance.name.lowercase().replaceFirstChar(Char::uppercase)) {
                    viewModel.updateAppearance(Appearance.valueOf(it.uppercase()))
                }
            }
        }
        item {
            SettingsHeader("Recurring reminders")
            GlassCard(Modifier.fillMaxWidth()) {
                Text("Lead time: $reminderDays day${if (reminderDays == 1) "" else "s"}", fontWeight = FontWeight.SemiBold)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    OutlinedButton(onClick = { reminderDays = (reminderDays - 1).coerceAtLeast(0) }) { Text("−") }
                    OutlinedButton(onClick = { reminderDays = (reminderDays + 1).coerceAtMost(30) }) { Text("+") }
                }
                ToggleRow("App notifications", inApp) { inApp = it; if (!it) email = false }
                ToggleRow("Email alerts", email, enabled = inApp) { email = it }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    Icon(Icons.Outlined.Notifications, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(if (notificationsEnabled) "Android notifications are enabled" else "Android notifications are disabled", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (!notificationsEnabled) TextButton(onClick = {
                    context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
                }) { Text("Open Android notification settings") }
                Button(onClick = { viewModel.updateReminderPreferences(reminderDays, inApp, email) }) { Text("Save reminders") }
            }
        }
        item {
            SettingsHeader("Workspace data")
            GlassCard(Modifier.fillMaxWidth()) {
                Column {
                    OutlinedButton(onClick = { exportMenu = true }, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Outlined.CloudDownload, null); Text("Export CSV", Modifier.padding(start = 7.dp))
                    }
                    DropdownMenu(exportMenu, { exportMenu = false }) {
                        ExportDataset.entries.forEach { dataset ->
                            DropdownMenuItem(text = { Text(dataset.title) }, onClick = {
                                exportDataset = dataset; exportMenu = false
                                exportLauncher.launch("spendly-${dataset.name.lowercase()}-${LocalDateLabel.today()}.csv")
                            })
                        }
                    }
                }
                OutlinedButton(onClick = { importLauncher.launch(arrayOf("text/csv", "text/comma-separated-values", "text/plain")) }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Outlined.CloudUpload, null); Text("Import transactions CSV", Modifier.padding(start = 7.dp))
                }
                Text("Imports up to 5,000 rows, skips duplicates, and creates missing accounts and categories when safe.", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedButton(onClick = { showDemoConfirmation = true }, enabled = viewModel.canLoadDemoData, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Outlined.Science, null); Text("Load demo workspace", Modifier.padding(start = 7.dp))
                }
                Text(if (viewModel.canLoadDemoData) "Available while the workspace is empty." else "Locked because this workspace already contains finance data.", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        item {
            SettingsHeader("Custom categories")
            val custom = viewModel.workspace.categories.filter { !it.isDefault }
            GlassCard(Modifier.fillMaxWidth()) {
                if (custom.isEmpty()) Text("Default categories are ready. Add custom labels when you need more detail.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                custom.forEachIndexed { index, category ->
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(category.name, fontWeight = FontWeight.SemiBold)
                            Text(category.type.name.lowercase().replaceFirstChar(Char::uppercase), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        TextButton(onClick = { categoryEditor = CategoryDraft(category.id, category.name, category.type, category.color, category.icon) }) { Text("Edit") }
                        TextButton(onClick = { deleteCategory = category }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
                    }
                    if (index != custom.lastIndex) HorizontalDivider()
                }
                OutlinedButton(onClick = { categoryEditor = CategoryDraft() }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Outlined.Add, null); Text("Add custom category", Modifier.padding(start = 7.dp))
                }
            }
        }
        item {
            SettingsHeader("Account")
            GlassCard(Modifier.fillMaxWidth()) {
                Text("Password changes use the secure reset-code flow from the sign-in screen.", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                LinkRow(Icons.Outlined.PrivacyTip, "Privacy policy") { uriHandler.openUri("${BuildConfig.SPENDLY_APP_BASE_URL}/privacy") }
                LinkRow(Icons.Outlined.SupportAgent, "Support") { uriHandler.openUri("${BuildConfig.SPENDLY_APP_BASE_URL}/support") }
                OutlinedButton(onClick = { showSignOut = true }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Outlined.Logout, null); Text("Sign out", Modifier.padding(start = 7.dp))
                }
                OutlinedButton(onClick = { showDeleteAccount = true }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Outlined.DeleteForever, null, tint = MaterialTheme.colorScheme.error)
                    Text("Delete account and data", Modifier.padding(start = 7.dp), color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }

    categoryEditor?.let { CategoryEditor(viewModel, it) { categoryEditor = null } }
    deleteCategory?.let { category ->
        AlertDialog(
            onDismissRequest = { deleteCategory = null }, title = { Text("Delete category?") },
            confirmButton = { TextButton(onClick = { viewModel.deleteCategory(category); deleteCategory = null }) { Text("Delete category", color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton(onClick = { deleteCategory = null }) { Text("Cancel") } },
        )
    }
    if (showSignOut) AlertDialog(
        onDismissRequest = { showSignOut = false }, title = { Text("Sign out of Spendly?") },
        confirmButton = { TextButton(onClick = { showSignOut = false; viewModel.signOut() }) { Text("Sign out", color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton(onClick = { showSignOut = false }) { Text("Cancel") } },
    )
    if (showDemoConfirmation) AlertDialog(
        onDismissRequest = { showDemoConfirmation = false }, title = { Text("Load demo workspace?") },
        text = { Text("Demo data can only be loaded while the workspace is empty.") },
        confirmButton = { TextButton(onClick = { showDemoConfirmation = false; viewModel.loadDemoWorkspace() }) { Text("Load demo workspace") } },
        dismissButton = { TextButton(onClick = { showDemoConfirmation = false }) { Text("Cancel") } },
    )
    importSummary?.let { summary ->
        AlertDialog(
            onDismissRequest = { importSummary = null }, title = { Text("Import summary") },
            text = { Text("${summary.message} Processed ${summary.processed} rows. Created ${summary.createdAccounts.size} accounts and ${summary.createdCategories.size} categories.") },
            confirmButton = { TextButton(onClick = { importSummary = null }) { Text("Done") } },
        )
    }
    if (showDeleteAccount) DeleteAccountDialog(viewModel) { showDeleteAccount = false }
}

@Composable
private fun DeleteAccountDialog(viewModel: SpendlyViewModel, onDismiss: () -> Unit) {
    var confirmation by remember { mutableStateOf("") }
    var finalConfirmation by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Delete account") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("This cannot be undone", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
                Text("Your Spendly login and all associated profiles, accounts, transactions, budgets, goals, categories, recurring items, and reminders will be permanently deleted.")
                Text("Type DELETE to continue.", fontWeight = FontWeight.SemiBold)
                OutlinedTextField(confirmation, { confirmation = it.uppercase() }, label = { Text("DELETE") })
            }
        },
        confirmButton = { TextButton(enabled = confirmation.trim() == "DELETE", onClick = { finalConfirmation = true }) { Text("Continue", color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
    if (finalConfirmation) AlertDialog(
        onDismissRequest = { finalConfirmation = false }, title = { Text("Permanently delete your account?") },
        text = { Text("This immediately deletes your Spendly login and every item of financial data connected to it.") },
        confirmButton = { TextButton(onClick = { finalConfirmation = false; onDismiss(); viewModel.deleteCurrentUserAccount() }) { Text("Delete forever", color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton(onClick = { finalConfirmation = false }) { Text("Cancel") } },
    )
}

@Composable
private fun SettingsHeader(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp))
}

@Composable
private fun LabeledValue(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) { Text(label, Modifier.weight(1f)); Text(value, color = MaterialTheme.colorScheme.onSurfaceVariant) }
}

@Composable
private fun ToggleRow(label: String, value: Boolean, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f), color = if (enabled) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
        Switch(value, onChange, enabled = enabled)
    }
}

@Composable
private fun ChoiceRow(label: String, options: List<String>, selected: String, onSelected: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(label, fontWeight = FontWeight.SemiBold)
        LazyRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(options) { option -> OutlinedButton(onClick = { onSelected(option) }) { Text(if (option == selected) "✓ $option" else option) } }
        }
    }
}

@Composable
private fun LinkRow(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.primary)
        Text(text, Modifier.padding(start = 14.dp).weight(1f), fontWeight = FontWeight.SemiBold)
        Text("›", style = MaterialTheme.typography.titleLarge)
    }
}

private object LocalDateLabel { fun today(): String = java.time.LocalDate.now().toString() }
