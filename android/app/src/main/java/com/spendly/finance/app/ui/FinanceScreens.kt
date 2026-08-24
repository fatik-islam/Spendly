package com.spendly.finance.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.FilterAlt
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.PauseCircle
import androidx.compose.material.icons.outlined.PieChart
import androidx.compose.material.icons.outlined.PlayCircle
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.Savings
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.spendly.finance.app.data.Account
import com.spendly.finance.app.data.AccountDraft
import com.spendly.finance.app.data.Budget
import com.spendly.finance.app.data.BudgetDraft
import com.spendly.finance.app.data.BudgetProgress
import com.spendly.finance.app.data.GoalDraft
import com.spendly.finance.app.data.RecurringDraft
import com.spendly.finance.app.data.RecurringTransaction
import com.spendly.finance.app.data.SavingsGoal
import com.spendly.finance.app.data.Transaction
import com.spendly.finance.app.data.TransactionDraft
import com.spendly.finance.app.data.TransactionType
import com.spendly.finance.app.ui.theme.ExpenseRed
import com.spendly.finance.app.ui.theme.IncomeGreen
import com.spendly.finance.app.ui.theme.SpendlyBlue
import com.spendly.finance.app.ui.theme.SpendlyTeal
import com.spendly.finance.app.ui.theme.WarningAmber
import java.time.LocalDate
import java.time.YearMonth

@Composable
fun TransactionsScreen(viewModel: SpendlyViewModel, modifier: Modifier = Modifier) {
    var search by remember { mutableStateOf("") }
    var typeFilter by remember { mutableStateOf<TransactionType?>(null) }
    var accountFilter by remember { mutableStateOf<String?>(null) }
    var categoryFilter by remember { mutableStateOf<String?>(null) }
    var dateFilter by remember { mutableStateOf<String?>(null) }
    var showFilters by remember { mutableStateOf(false) }
    var editor by remember { mutableStateOf<TransactionDraft?>(null) }
    var deleteTarget by remember { mutableStateOf<Transaction?>(null) }
    val hasFilters = typeFilter != null || accountFilter != null || categoryFilter != null || dateFilter != null
    val filtered = viewModel.workspace.transactions.filter { transaction ->
        val termMatch = search.isBlank() || transaction.description.contains(search, true) ||
            transaction.notes.orEmpty().contains(search, true) || viewModel.category(transaction.categoryId)?.name.orEmpty().contains(search, true)
        val typeMatch = typeFilter == null || transaction.type == typeFilter
        val accountMatch = accountFilter == null || transaction.accountId == accountFilter || transaction.transferAccountId == accountFilter
        val categoryMatch = categoryFilter == null || transaction.categoryId == categoryFilter
        val dateMatch = dateFilter == null || transaction.transactionDate == dateFilter
        termMatch && typeMatch && accountMatch && categoryMatch && dateMatch
    }
    fun clearFilters() { typeFilter = null; accountFilter = null; categoryFilter = null; dateFilter = null }

    Box(modifier.fillMaxSize()) {
        LazyColumn(
            Modifier.fillMaxSize().padding(horizontal = 16.dp),
            contentPadding = PaddingValues(top = 12.dp, bottom = 82.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                OutlinedTextField(
                    search, { search = it }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                    placeholder = { Text("Description, notes, or category") }, leadingIcon = { Icon(Icons.Outlined.Search, null) },
                    shape = RoundedCornerShape(16.dp),
                )
            }
            if (hasFilters) item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.FilterAlt, null, tint = SpendlyTeal)
                    Text("Filters active", Modifier.padding(start = 8.dp).weight(1f), color = SpendlyTeal, fontWeight = FontWeight.SemiBold)
                    TextButton(onClick = ::clearFilters) { Text("Clear") }
                }
            }
            if (filtered.isEmpty()) item {
                EmptyFeature(
                    Icons.AutoMirrored.Outlined.ReceiptLong,
                    if (search.isBlank()) "No transactions yet" else "No matching transactions",
                    "Add income, expenses, or transfers, then narrow them with search and filters.",
                    Modifier.fillMaxWidth(),
                )
            }
            items(filtered, key = { it.id }) { item ->
                GlassCard(Modifier.fillMaxWidth().clickable { editor = transactionDraft(item) }) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.weight(1f)) { TransactionRow(item, viewModel) }
                        RecordMenu(
                            edit = { editor = transactionDraft(item) },
                            delete = { deleteTarget = item },
                        )
                    }
                }
            }
        }
        ScreenActions(
            Modifier.align(Alignment.BottomCenter),
            listOf(
                ActionSpec("Filters", Icons.Outlined.FilterAlt) { showFilters = true },
                ActionSpec("Add transaction", Icons.Default.AddCircle) {
                    editor = TransactionDraft(accountId = viewModel.workspace.accounts.firstOrNull()?.id.orEmpty())
                },
            ),
        )
    }
    editor?.let { TransactionEditor(viewModel, it) { editor = null } }
    if (showFilters) TransactionFiltersDialog(
        viewModel, typeFilter, accountFilter, categoryFilter, dateFilter,
        onApply = { type, account, category, date -> typeFilter = type; accountFilter = account; categoryFilter = category; dateFilter = date; showFilters = false },
        onClear = { clearFilters(); showFilters = false }, onDismiss = { showFilters = false },
    )
    deleteTarget?.let { target ->
        ConfirmDelete("Delete transaction?", "Affected account balances will be recalculated automatically.", {
            viewModel.deleteTransaction(target); deleteTarget = null
        }) { deleteTarget = null }
    }
}

@Composable
fun AccountsScreen(viewModel: SpendlyViewModel, modifier: Modifier = Modifier) {
    var editor by remember { mutableStateOf<AccountDraft?>(null) }
    var transfer by remember { mutableStateOf<TransactionDraft?>(null) }
    var deleteTarget by remember { mutableStateOf<Account?>(null) }
    Box(modifier.fillMaxSize()) {
        LazyColumn(
            Modifier.fillMaxSize().padding(horizontal = 16.dp),
            contentPadding = PaddingValues(top = 16.dp, bottom = 82.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item { SectionHeading("Accounts", "Manage balances and move money between your accounts.") }
            item { MetricCard("Combined balance", currency(viewModel.totalBalance, viewModel.currency), "Across ${viewModel.workspace.accounts.size} accounts", Icons.Outlined.AccountBalance, SpendlyTeal, Modifier.fillMaxWidth()) }
            if (viewModel.workspace.accounts.isEmpty()) item { EmptyFeature(Icons.Outlined.AccountBalance, "No accounts yet", "Create your first account to start tracking balances.", Modifier.fillMaxWidth()) }
            items(viewModel.workspace.accounts, key = { it.id }) { account ->
                val activity = viewModel.workspace.transactions.count { it.accountId == account.id || it.transferAccountId == account.id }
                GlassCard(Modifier.fillMaxWidth().clickable { editor = accountDraft(account) }) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text(account.type.title, style = MaterialTheme.typography.labelMedium, color = SpendlyTeal, modifier = Modifier.weight(1f))
                        RecordMenu({ editor = accountDraft(account) }, { deleteTarget = account })
                    }
                    Text(account.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Column(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface, RoundedCornerShape(18.dp)).padding(14.dp)) {
                        Text("Current balance", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(currency(account.balance, viewModel.currency), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, maxLines = 1)
                    }
                    Text("$activity ledger event${if (activity == 1) "" else "s"}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        ScreenActions(
            Modifier.align(Alignment.BottomCenter),
            listOf(
                ActionSpec("Transfer", Icons.Outlined.SwapHoriz, enabled = viewModel.workspace.accounts.size >= 2) {
                    transfer = TransactionDraft(accountId = viewModel.workspace.accounts.firstOrNull()?.id.orEmpty(), type = TransactionType.TRANSFER, description = "Account transfer")
                },
                ActionSpec("Add account", Icons.Default.AddCircle) { editor = AccountDraft(currency = viewModel.currency) },
            ),
        )
    }
    editor?.let { AccountEditor(viewModel, it) { editor = null } }
    transfer?.let { TransactionEditor(viewModel, it) { transfer = null } }
    deleteTarget?.let { target -> ConfirmDelete("Delete account?", "Accounts with transaction or recurring history cannot be deleted.", { viewModel.deleteAccount(target); deleteTarget = null }) { deleteTarget = null } }
}

@Composable
fun BudgetsScreen(viewModel: SpendlyViewModel, modifier: Modifier = Modifier) {
    var editor by remember { mutableStateOf<BudgetDraft?>(null) }
    var deleteTarget by remember { mutableStateOf<Budget?>(null) }
    val allProgress = viewModel.workspace.budgets.map { budget ->
        val spent = viewModel.workspace.transactions.filter { transaction ->
            val month = runCatching { YearMonth.from(LocalDate.parse(transaction.transactionDate)) }.getOrNull()
            transaction.type == TransactionType.EXPENSE && transaction.categoryId == budget.categoryId && month?.monthValue == budget.month && month.year == budget.year
        }.sumOf(Transaction::amount)
        BudgetProgress(budget, viewModel.category(budget.categoryId), spent)
    }
    Box(modifier.fillMaxSize()) {
        LazyColumn(
            Modifier.fillMaxSize().padding(horizontal = 16.dp), contentPadding = PaddingValues(top = 16.dp, bottom = 82.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item { SectionHeading("Budgets", "Set monthly limits and watch category pace.") }
            if (allProgress.isEmpty()) item { EmptyFeature(Icons.Outlined.PieChart, "No budgets yet", "Create category budgets to watch spending pace.", Modifier.fillMaxWidth()) }
            items(allProgress, key = { it.budget.id }) { item ->
                val percent = item.progress * 100
                GlassCard(Modifier.fillMaxWidth().clickable { editor = budgetDraft(item.budget) }) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(11.dp).background(spendlyColor(item.category?.color ?: "#14B8A6"), CircleShape))
                        Text(item.category?.name ?: "Category", Modifier.padding(start = 9.dp).weight(1f), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        RecordMenu({ editor = budgetDraft(item.budget) }, { deleteTarget = item.budget })
                    }
                    Text("${item.budget.month}/${item.budget.year}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${percent.toInt()}%", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold, color = if (percent >= 100) ExpenseRed else MaterialTheme.colorScheme.onSurface)
                    LinearProgressIndicator(progress = { item.progress.toFloat().coerceAtMost(1f) }, modifier = Modifier.fillMaxWidth(), color = if (percent >= 100) ExpenseRed else SpendlyTeal)
                    Row(Modifier.fillMaxWidth()) {
                        ValuePair("Spent", currency(item.spent, viewModel.currency), Modifier.weight(1f))
                        ValuePair("Budget", currency(item.budget.amount, viewModel.currency), Modifier.weight(1f))
                    }
                    if (percent >= 80) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        Icon(Icons.Outlined.Warning, null, tint = if (percent >= 100) ExpenseRed else WarningAmber)
                        Text(if (percent >= 100) "Budget exceeded" else "Above the 80% warning threshold", style = MaterialTheme.typography.labelMedium, color = if (percent >= 100) ExpenseRed else WarningAmber)
                    }
                }
            }
        }
        ScreenActions(Modifier.align(Alignment.BottomCenter), listOf(ActionSpec("Add budget", Icons.Default.AddCircle) { editor = BudgetDraft() }))
    }
    editor?.let { BudgetEditor(viewModel, it) { editor = null } }
    deleteTarget?.let { target -> ConfirmDelete("Delete budget?", "The category and transactions remain unchanged.", { viewModel.deleteBudget(target); deleteTarget = null }) { deleteTarget = null } }
}

@Composable
fun GoalsScreen(viewModel: SpendlyViewModel, modifier: Modifier = Modifier) {
    var editor by remember { mutableStateOf<GoalDraft?>(null) }
    var deleteTarget by remember { mutableStateOf<SavingsGoal?>(null) }
    Box(modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), contentPadding = PaddingValues(top = 16.dp, bottom = 82.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item { SectionHeading("Savings goals", "Track target amounts and deadlines.") }
            if (viewModel.workspace.goals.isEmpty()) item { EmptyFeature(Icons.Outlined.Flag, "No savings goals yet", "Create a goal for an emergency fund, trip, device, or any milestone.", Modifier.fillMaxWidth()) }
            items(viewModel.workspace.goals, key = { it.id }) { goal ->
                val progress = if (goal.targetAmount > 0) (goal.currentAmount / goal.targetAmount).coerceIn(0.0, 1.0) else 0.0
                GlassCard(Modifier.fillMaxWidth().clickable { editor = goalDraft(goal) }) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                        Column(Modifier.weight(1f)) {
                            Text(goal.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                            Text(goal.deadline?.let { "Deadline ${displayDate(it)}" } ?: "No deadline", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        RecordMenu({ editor = goalDraft(goal) }, { deleteTarget = goal })
                    }
                    Text("${(progress * 100).toInt()}%", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                    LinearProgressIndicator(progress = { progress.toFloat() }, modifier = Modifier.fillMaxWidth(), color = SpendlyBlue)
                    Row(Modifier.fillMaxWidth()) {
                        ValuePair("Current", currency(goal.currentAmount, viewModel.currency), Modifier.weight(1f))
                        ValuePair("Target", currency(goal.targetAmount, viewModel.currency), Modifier.weight(1f))
                    }
                }
            }
        }
        ScreenActions(Modifier.align(Alignment.BottomCenter), listOf(ActionSpec("Add goal", Icons.Default.AddCircle) { editor = GoalDraft() }))
    }
    editor?.let { GoalEditor(viewModel, it) { editor = null } }
    deleteTarget?.let { target -> ConfirmDelete("Delete goal?", "This permanently removes the savings goal.", { viewModel.deleteGoal(target); deleteTarget = null }) { deleteTarget = null } }
}

@Composable
fun RecurringScreen(viewModel: SpendlyViewModel, modifier: Modifier = Modifier) {
    var editor by remember { mutableStateOf<RecurringDraft?>(null) }
    var deleteTarget by remember { mutableStateOf<RecurringTransaction?>(null) }
    Box(modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), contentPadding = PaddingValues(top = 16.dp, bottom = 82.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item { SectionHeading("Recurring", "Stay ahead of bills and repeating income.") }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SummaryTile("Unread", viewModel.unreadReminders.size.toString(), Modifier.weight(1f))
                    SummaryTile("Lead time", "${viewModel.workspace.profile?.reminderDaysBefore ?: 3}d", Modifier.weight(1f))
                    SummaryTile("Email", if (viewModel.workspace.profile?.reminderEmailEnabled == true) "On" else "Off", Modifier.weight(1f))
                }
            }
            if (viewModel.workspace.recurring.isEmpty()) item { EmptyFeature(Icons.Outlined.Repeat, "No recurring items yet", "Create reminders for subscriptions, bills, and repeating income.", Modifier.fillMaxWidth()) }
            items(viewModel.workspace.recurring, key = { it.id }) { item ->
                GlassCard(Modifier.fillMaxWidth().clickable { editor = recurringDraft(item) }) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                        Column(Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                                Text(item.description, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                                Text(if (item.active) "Active" else "Paused", style = MaterialTheme.typography.labelSmall, color = if (item.active) SpendlyTeal else MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Text("${viewModel.account(item.accountId)?.name ?: "Account"} · ${item.frequency.title}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        RecordMenu({ editor = recurringDraft(item) }, { deleteTarget = item })
                    }
                    Text((if (item.type == TransactionType.EXPENSE) "−" else "+") + currency(item.amount, viewModel.currency), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = if (item.type == TransactionType.EXPENSE) ExpenseRed else IncomeGreen)
                    Text("Due ${displayDate(item.nextDueDate)} · ${viewModel.category(item.categoryId)?.name ?: "No category"}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Button(onClick = { viewModel.toggleRecurring(item) }) {
                        Icon(if (item.active) Icons.Outlined.PauseCircle else Icons.Outlined.PlayCircle, null)
                        Text(if (item.active) "Pause reminders" else "Resume reminders", Modifier.padding(start = 7.dp))
                    }
                }
            }
        }
        ScreenActions(Modifier.align(Alignment.BottomCenter), listOf(ActionSpec("Add item", Icons.Default.AddCircle) {
            editor = RecurringDraft(accountId = viewModel.workspace.accounts.firstOrNull()?.id.orEmpty())
        }))
    }
    editor?.let { RecurringEditor(viewModel, it) { editor = null } }
    deleteTarget?.let { target -> ConfirmDelete("Delete recurring item?", "Future reminders for this item will also be removed.", { viewModel.deleteRecurring(target); deleteTarget = null }) { deleteTarget = null } }
}

@Composable
fun InsightsScreen(viewModel: SpendlyViewModel, modifier: Modifier = Modifier) {
    LazyColumn(modifier.fillMaxSize().padding(horizontal = 16.dp), contentPadding = PaddingValues(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item { SectionHeading("Insights", "Compare cash flow, category weight, and savings health.") }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    MetricCard("Health score", "${viewModel.financialHealthScore}", "Balance, budgets, savings", Icons.Outlined.AccountBalance, SpendlyTeal, Modifier.weight(1f))
                    MetricCard("Savings rate", "${viewModel.savingsRate.toInt()}%", "Share of this month’s income", Icons.Outlined.Savings, IncomeGreen, Modifier.weight(1f))
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    MetricCard("Income vs expense", currency(viewModel.netSavings, viewModel.currency), "This month’s spread", Icons.Outlined.SwapHoriz, if (viewModel.netSavings >= 0) IncomeGreen else ExpenseRed, Modifier.weight(1f))
                    MetricCard("Top spending", viewModel.categorySpending.firstOrNull()?.name ?: "No data", viewModel.categorySpending.firstOrNull()?.let { currency(it.amount, viewModel.currency) } ?: "Add expenses", Icons.AutoMirrored.Outlined.ReceiptLong, WarningAmber, Modifier.weight(1f))
                }
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                SectionHeading("Monthly comparison", "Income versus expenses for the last twelve months.")
                CashFlowBarChart(viewModel.twelveMonthCashFlow, Modifier.fillMaxWidth().height(260.dp).padding(top = 14.dp))
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                SectionHeading("Top spending categories", "Your largest categories across the current month.")
                if (viewModel.categorySpending.isEmpty()) Text("Add expenses to surface category leaders.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp))
                viewModel.categorySpending.take(5).forEachIndexed { index, item ->
                    Row(Modifier.fillMaxWidth().padding(top = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(36.dp).background(spendlyColor(item.color), CircleShape), contentAlignment = Alignment.Center) { Text("${index + 1}", color = androidx.compose.ui.graphics.Color.White, fontWeight = FontWeight.Bold) }
                        Text(item.name, Modifier.padding(start = 12.dp).weight(1f), fontWeight = FontWeight.Bold)
                        Text(currency(item.amount, viewModel.currency), color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

private data class ActionSpec(val title: String, val icon: androidx.compose.ui.graphics.vector.ImageVector, val enabled: Boolean = true, val action: () -> Unit)

@Composable
private fun ScreenActions(modifier: Modifier, actions: List<ActionSpec>) {
    Surface(
        modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surfaceContainer.copy(alpha = .96f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(.08f)),
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp), horizontalArrangement = Arrangement.SpaceAround) {
            actions.forEach { item ->
                TextButton(onClick = item.action, enabled = item.enabled) { Icon(item.icon, null); Text(item.title, Modifier.padding(start = 6.dp)) }
            }
        }
    }
}

@Composable
private fun RecordMenu(edit: () -> Unit, delete: () -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { expanded = true }) { Icon(Icons.Outlined.MoreHoriz, "More actions") }
        DropdownMenu(expanded, { expanded = false }) {
            DropdownMenuItem(text = { Text("Edit") }, leadingIcon = { Icon(Icons.Outlined.Edit, null) }, onClick = { expanded = false; edit() })
            DropdownMenuItem(text = { Text("Delete", color = MaterialTheme.colorScheme.error) }, leadingIcon = { Icon(Icons.Outlined.Delete, null, tint = MaterialTheme.colorScheme.error) }, onClick = { expanded = false; delete() })
        }
    }
}

@Composable
private fun ValuePair(title: String, value: String, modifier: Modifier) {
    Column(modifier.padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(title, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}

@Composable
private fun SummaryTile(title: String, value: String, modifier: Modifier) {
    GlassCard(modifier) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(title, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
        }
    }
}

@Composable
private fun TransactionFiltersDialog(
    viewModel: SpendlyViewModel,
    initialType: TransactionType?, initialAccount: String?, initialCategory: String?, initialDate: String?,
    onApply: (TransactionType?, String?, String?, String?) -> Unit,
    onClear: () -> Unit,
    onDismiss: () -> Unit,
) {
    var type by remember { mutableStateOf(initialType) }
    var account by remember { mutableStateOf(initialAccount) }
    var category by remember { mutableStateOf(initialCategory) }
    var date by remember { mutableStateOf(initialDate.orEmpty()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Ledger filters") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                NullableSelector("Type", type, TransactionType.entries, { it.title }) { type = it }
                NullableValueSelector("Account", account, viewModel.workspace.accounts.map { it.id to it.name }) { account = it }
                NullableValueSelector("Category", category, viewModel.workspace.categories.map { it.id to it.name }) { category = it }
                OutlinedTextField(date, { date = it }, label = { Text("Date (optional, YYYY-MM-DD)") }, modifier = Modifier.fillMaxWidth())
                TextButton(onClick = onClear) { Text("Clear filters", color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = { TextButton(onClick = { onApply(type, account, category, date.trim().takeIf(String::isNotEmpty)) }) { Text("Done") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun <T> NullableSelector(label: String, selected: T?, options: List<T>, title: (T) -> String, onSelected: (T?) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            selected?.let(title) ?: "All ${label.lowercase()}s", {}, readOnly = true, label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier.menuAnchor(androidx.compose.material3.ExposedDropdownMenuAnchorType.PrimaryNotEditable).fillMaxWidth(),
        )
        ExposedDropdownMenu(expanded, { expanded = false }) {
            DropdownMenuItem(text = { Text("All ${label.lowercase()}s") }, onClick = { onSelected(null); expanded = false })
            options.forEach { option -> DropdownMenuItem(text = { Text(title(option)) }, onClick = { onSelected(option); expanded = false }) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NullableValueSelector(label: String, selected: String?, options: List<Pair<String, String>>, onSelected: (String?) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            options.firstOrNull { it.first == selected }?.second ?: "All ${label.lowercase()}s", {}, readOnly = true, label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier.menuAnchor(androidx.compose.material3.ExposedDropdownMenuAnchorType.PrimaryNotEditable).fillMaxWidth(),
        )
        ExposedDropdownMenu(expanded, { expanded = false }) {
            DropdownMenuItem(text = { Text("All ${label.lowercase()}s") }, onClick = { onSelected(null); expanded = false })
            options.forEach { option -> DropdownMenuItem(text = { Text(option.second) }, onClick = { onSelected(option.first); expanded = false }) }
        }
    }
}

@Composable
private fun ConfirmDelete(title: String, body: String, confirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss, title = { Text(title) }, text = { Text(body) },
        confirmButton = { TextButton(onClick = confirm) { Text("Delete", color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

private fun transactionDraft(item: Transaction) = TransactionDraft(
    item.id, item.accountId, item.transferAccountId, item.categoryId, item.type, item.amount,
    item.description, item.notes.orEmpty(), runCatching { LocalDate.parse(item.transactionDate) }.getOrDefault(LocalDate.now()), item.isRecurring,
)
private fun accountDraft(item: Account) = AccountDraft(item.id, item.name, item.type, item.balance, item.currency)
private fun budgetDraft(item: Budget) = BudgetDraft(item.id, item.categoryId, item.amount, item.month, item.year)
private fun goalDraft(item: SavingsGoal) = GoalDraft(item.id, item.name, item.targetAmount, item.currentAmount, item.deadline?.let { runCatching { LocalDate.parse(it) }.getOrNull() })
private fun recurringDraft(item: RecurringTransaction) = RecurringDraft(
    item.id, item.accountId, item.categoryId, item.type, item.amount, item.description,
    item.frequency, runCatching { LocalDate.parse(item.nextDueDate) }.getOrDefault(LocalDate.now()), item.active,
)
