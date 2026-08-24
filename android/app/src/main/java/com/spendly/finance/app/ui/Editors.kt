package com.spendly.finance.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.spendly.finance.app.data.AccountDraft
import com.spendly.finance.app.data.AccountType
import com.spendly.finance.app.data.BudgetDraft
import com.spendly.finance.app.data.CategoryType
import com.spendly.finance.app.data.CategoryDraft
import com.spendly.finance.app.data.CurrencyCode
import com.spendly.finance.app.data.GoalDraft
import com.spendly.finance.app.data.RecurringDraft
import com.spendly.finance.app.data.RecurringFrequency
import com.spendly.finance.app.data.TransactionDraft
import com.spendly.finance.app.data.TransactionType
import java.time.LocalDate

@Composable
fun AccountEditor(viewModel: SpendlyViewModel, initial: AccountDraft, onDismiss: () -> Unit) {
    var name by remember { mutableStateOf(initial.name) }
    var type by remember { mutableStateOf(initial.type) }
    var balance by remember { mutableStateOf(if (initial.balance == 0.0) "" else initial.balance.toString()) }
    var currency by remember { mutableStateOf(initial.currency) }
    EditorDialog(if (initial.id == null) "Add account" else "Edit account", onDismiss, onSave = {
        viewModel.saveAccount(initial.copy(name = name, type = type, balance = balance.toDoubleOrNull() ?: 0.0, currency = currency), onDismiss)
    }) {
        OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        EnumSelector("Type", type, AccountType.entries, { it.title }) { type = it }
        OutlinedTextField(
            balance, { balance = it }, label = { Text("Current balance") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth(),
        )
        EnumSelector("Currency", currency, CurrencyCode.entries, { it.name }) { currency = it }
    }
}

@Composable
fun TransactionEditor(viewModel: SpendlyViewModel, initial: TransactionDraft, onDismiss: () -> Unit) {
    var type by remember { mutableStateOf(initial.type) }
    var accountId by remember { mutableStateOf(initial.accountId.ifBlank { viewModel.workspace.accounts.firstOrNull()?.id.orEmpty() }) }
    var destinationId by remember { mutableStateOf(initial.transferAccountId.orEmpty()) }
    var categoryId by remember { mutableStateOf(initial.categoryId.orEmpty()) }
    var amount by remember { mutableStateOf(if (initial.amount == 0.0) "" else initial.amount.toString()) }
    var description by remember { mutableStateOf(initial.description) }
    var notes by remember { mutableStateOf(initial.notes) }
    var date by remember { mutableStateOf(initial.transactionDate.toString()) }
    var recurring by remember { mutableStateOf(initial.isRecurring) }
    val categoryOptions = viewModel.workspace.categories.filter {
        (type == TransactionType.INCOME && it.type == CategoryType.INCOME) ||
            (type == TransactionType.EXPENSE && it.type == CategoryType.EXPENSE)
    }

    EditorDialog(if (initial.id == null) "Add transaction" else "Edit transaction", onDismiss, onSave = {
        viewModel.saveTransaction(
            initial.copy(
                accountId = accountId,
                transferAccountId = destinationId.takeIf { type == TransactionType.TRANSFER },
                categoryId = categoryId.takeIf { type != TransactionType.TRANSFER },
                type = type, amount = amount.toDoubleOrNull() ?: 0.0,
                description = description, notes = notes,
                transactionDate = runCatching { LocalDate.parse(date) }.getOrDefault(LocalDate.now()),
                isRecurring = recurring,
            ), onDismiss
        )
    }) {
        EnumSelector("Type", type, TransactionType.entries, { it.title }) {
            type = it
            if (it != TransactionType.TRANSFER && categoryOptions.none { category -> category.id == categoryId }) {
                categoryId = viewModel.workspace.categories.firstOrNull { category ->
                    (it == TransactionType.INCOME && category.type == CategoryType.INCOME) ||
                        (it == TransactionType.EXPENSE && category.type == CategoryType.EXPENSE)
                }?.id.orEmpty()
            }
        }
        ValueSelector("Account", accountId, viewModel.workspace.accounts.map { it.id to it.name }) { accountId = it }
        if (type == TransactionType.TRANSFER) {
            ValueSelector(
                "Destination", destinationId,
                viewModel.workspace.accounts.filter { it.id != accountId }.map { it.id to it.name },
            ) { destinationId = it }
        } else ValueSelector("Category", categoryId, categoryOptions.map { it.id to it.name }) { categoryId = it }
        OutlinedTextField(
            amount, { amount = it }, label = { Text("Amount") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(description, { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(notes, { notes = it }, label = { Text("Notes (optional)") }, modifier = Modifier.fillMaxWidth())
        DateField("Date", date) { date = it }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(recurring, { recurring = it })
            Text("Recurring cadence")
        }
    }
}

@Composable
fun BudgetEditor(viewModel: SpendlyViewModel, initial: BudgetDraft, onDismiss: () -> Unit) {
    var categoryId by remember { mutableStateOf(initial.categoryId) }
    var amount by remember { mutableStateOf(if (initial.amount == 0.0) "" else initial.amount.toString()) }
    var month by remember { mutableStateOf(initial.month.toString()) }
    var year by remember { mutableStateOf(initial.year.toString()) }
    EditorDialog(if (initial.id == null) "Create budget" else "Edit budget", onDismiss, onSave = {
        viewModel.saveBudget(initial.copy(categoryId = categoryId, amount = amount.toDoubleOrNull() ?: 0.0, month = month.toIntOrNull() ?: 0, year = year.toIntOrNull() ?: 0), onDismiss)
    }) {
        ValueSelector(
            "Expense category", categoryId,
            viewModel.workspace.categories.filter { it.type == CategoryType.EXPENSE }.map { it.id to it.name },
        ) { categoryId = it }
        NumberField("Amount", amount) { amount = it }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(month, { month = it }, label = { Text("Month") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f))
            OutlinedTextField(year, { year = it }, label = { Text("Year") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f))
        }
    }
}

@Composable
fun GoalEditor(viewModel: SpendlyViewModel, initial: GoalDraft, onDismiss: () -> Unit) {
    var name by remember { mutableStateOf(initial.name) }
    var target by remember { mutableStateOf(if (initial.targetAmount == 0.0) "" else initial.targetAmount.toString()) }
    var current by remember { mutableStateOf(if (initial.currentAmount == 0.0) "" else initial.currentAmount.toString()) }
    var deadline by remember { mutableStateOf(initial.deadline?.toString().orEmpty()) }
    EditorDialog(if (initial.id == null) "Create goal" else "Edit goal", onDismiss, onSave = {
        viewModel.saveGoal(
            initial.copy(
                name = name, targetAmount = target.toDoubleOrNull() ?: 0.0, currentAmount = current.toDoubleOrNull() ?: 0.0,
                deadline = deadline.takeIf(String::isNotBlank)?.let { runCatching { LocalDate.parse(it) }.getOrNull() },
            ), onDismiss
        )
    }) {
        OutlinedTextField(name, { name = it }, label = { Text("Goal name") }, modifier = Modifier.fillMaxWidth())
        NumberField("Target amount", target) { target = it }
        NumberField("Current amount", current) { current = it }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(deadline.isNotBlank(), { enabled -> deadline = if (enabled) LocalDate.now().toString() else "" })
            Text("Set a deadline")
        }
        if (deadline.isNotBlank()) DateField("Deadline", deadline) { deadline = it }
    }
}

@Composable
fun RecurringEditor(viewModel: SpendlyViewModel, initial: RecurringDraft, onDismiss: () -> Unit) {
    var type by remember { mutableStateOf(initial.type.takeIf { it != TransactionType.TRANSFER } ?: TransactionType.EXPENSE) }
    var accountId by remember { mutableStateOf(initial.accountId) }
    var categoryId by remember { mutableStateOf(initial.categoryId.orEmpty()) }
    var amount by remember { mutableStateOf(if (initial.amount == 0.0) "" else initial.amount.toString()) }
    var description by remember { mutableStateOf(initial.description) }
    var frequency by remember { mutableStateOf(initial.frequency) }
    var dueDate by remember { mutableStateOf(initial.nextDueDate.toString()) }
    var active by remember { mutableStateOf(initial.active) }
    val categories = viewModel.workspace.categories.filter {
        (type == TransactionType.INCOME && it.type == CategoryType.INCOME) ||
            (type == TransactionType.EXPENSE && it.type == CategoryType.EXPENSE)
    }
    EditorDialog(if (initial.id == null) "Create recurring item" else "Edit recurring item", onDismiss, onSave = {
        viewModel.saveRecurring(
            initial.copy(
                accountId = accountId, categoryId = categoryId, type = type,
                amount = amount.toDoubleOrNull() ?: 0.0, description = description,
                frequency = frequency, nextDueDate = runCatching { LocalDate.parse(dueDate) }.getOrDefault(LocalDate.now()),
                active = active,
            ), onDismiss
        )
    }) {
        EnumSelector("Type", type, listOf(TransactionType.EXPENSE, TransactionType.INCOME), { it.title }) { type = it }
        ValueSelector("Account", accountId, viewModel.workspace.accounts.map { it.id to it.name }) { accountId = it }
        ValueSelector("Category", categoryId, categories.map { it.id to it.name }) { categoryId = it }
        NumberField("Amount", amount) { amount = it }
        OutlinedTextField(description, { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
        EnumSelector("Frequency", frequency, RecurringFrequency.entries, { it.title }) { frequency = it }
        DateField("Next due date", dueDate) { dueDate = it }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(active, { active = it }); Text("Active")
        }
    }
}

@Composable
fun CategoryEditor(viewModel: SpendlyViewModel, initial: CategoryDraft, onDismiss: () -> Unit) {
    var name by remember { mutableStateOf(initial.name) }
    var type by remember { mutableStateOf(initial.type) }
    var color by remember { mutableStateOf(initial.color) }
    var icon by remember { mutableStateOf(initial.icon) }
    val colors = listOf("#14B8A6", "#22C55E", "#0EA5E9", "#F97316", "#F43F5E", "#A855F7", "#EAB308", "#06B6D4", "#8B5CF6", "#FB7185")
    val icons = listOf("piggy-bank", "utensils-crossed", "house", "car-taxi-front", "shopping-bag", "heart-pulse", "receipt", "briefcase-business", "wallet-cards", "plane")
    EditorDialog(if (initial.id == null) "Add category" else "Edit category", onDismiss, onSave = {
        viewModel.saveCategory(initial.copy(name = name, type = type, color = color, icon = icon), onDismiss)
    }) {
        OutlinedTextField(name, { name = it }, label = { Text("Category name") }, modifier = Modifier.fillMaxWidth())
        EnumSelector("Type", type, CategoryType.entries, { it.name.lowercase().replaceFirstChar(Char::uppercase) }) { type = it }
        ValueSelector("Color", color, colors.map { it to it }) { color = it }
        ValueSelector("Icon", icon, icons.map { it to it.replace('-', ' ').replaceFirstChar(Char::uppercase) }) { icon = it }
    }
}

@Composable
private fun EditorDialog(title: String, onDismiss: () -> Unit, onSave: () -> Unit, content: @Composable () -> Unit) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            Modifier.fillMaxWidth().fillMaxHeight(.94f).padding(top = 18.dp),
            shape = androidx.compose.foundation.shape.RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
            color = androidx.compose.material3.MaterialTheme.colorScheme.background,
        ) {
            Column {
                Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Text(
                        title, Modifier.weight(1f),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                    )
                    TextButton(onClick = onSave) { Text("Save", fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold) }
                }
                Column(
                    Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) { content() }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateField(label: String, value: String, onChange: (String) -> Unit) {
    var showsPicker by remember { mutableStateOf(false) }
    OutlinedTextField(
        value, {}, readOnly = true, label = { Text(label) }, modifier = Modifier.fillMaxWidth(),
        trailingIcon = { TextButton(onClick = { showsPicker = true }) { Text("Choose") } },
    )
    if (showsPicker) {
        val initial = runCatching { LocalDate.parse(value).toEpochDay() * 86_400_000L }.getOrNull()
        val state = androidx.compose.material3.rememberDatePickerState(initialSelectedDateMillis = initial)
        DatePickerDialog(
            onDismissRequest = { showsPicker = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { onChange(LocalDate.ofEpochDay(it / 86_400_000L).toString()) }
                    showsPicker = false
                }) { Text("Done") }
            },
            dismissButton = { TextButton(onClick = { showsPicker = false }) { Text("Cancel") } },
        ) { DatePicker(state) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun <T> EnumSelector(label: String, selected: T, options: List<T>, title: (T) -> String, onSelected: (T) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded, { expanded = !expanded }) {
        OutlinedTextField(
            title(selected), {}, readOnly = true, label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier.menuAnchor(androidx.compose.material3.MenuAnchorType.PrimaryNotEditable).fillMaxWidth(),
        )
        ExposedDropdownMenu(expanded, { expanded = false }) {
            options.forEach { option ->
                DropdownMenuItem(text = { Text(title(option)) }, onClick = { onSelected(option); expanded = false })
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ValueSelector(label: String, selected: String, options: List<Pair<String, String>>, onSelected: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    val title = options.firstOrNull { it.first == selected }?.second ?: "Choose"
    ExposedDropdownMenuBox(expanded, { expanded = !expanded }) {
        OutlinedTextField(
            title, {}, readOnly = true, label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier.menuAnchor(androidx.compose.material3.MenuAnchorType.PrimaryNotEditable).fillMaxWidth(),
        )
        ExposedDropdownMenu(expanded, { expanded = false }) {
            options.forEach { (id, name) ->
                DropdownMenuItem(text = { Text(name) }, onClick = { onSelected(id); expanded = false })
            }
        }
    }
}

@Composable
private fun NumberField(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value, onChange, label = { Text(label) }, singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth(),
    )
}
