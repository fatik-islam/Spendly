package com.spendly.finance.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.ArrowDownward
import androidx.compose.material.icons.outlined.ArrowUpward
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.Savings
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.spendly.finance.app.data.Transaction
import com.spendly.finance.app.data.TransactionType
import com.spendly.finance.app.ui.theme.ExpenseRed
import com.spendly.finance.app.ui.theme.IncomeGreen
import com.spendly.finance.app.ui.theme.SpendlyBlue
import com.spendly.finance.app.ui.theme.SpendlyTeal
import java.time.LocalDate

@Composable
fun DashboardScreen(viewModel: SpendlyViewModel, modifier: Modifier = Modifier, openLedger: () -> Unit) {
    var confirmsDemo by remember { mutableStateOf(false) }
    val firstName = viewModel.workspace.profile?.fullName?.substringBefore(' ')?.takeIf(String::isNotBlank)
    val upcoming = viewModel.workspace.recurring.filter { item ->
        val due = runCatching { LocalDate.parse(item.nextDueDate) }.getOrNull()
        item.active && due != null && !due.isAfter(LocalDate.now().plusDays(30))
    }

    LazyColumn(
        modifier.fillMaxSize().padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        item { SectionHeading(firstName?.let { "Welcome, $it" } ?: "Dashboard", "Balances, cash flow, budgets, goals, and upcoming bills.") }
        if (viewModel.canLoadDemoData) item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("Explore a complete workspace", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("Load Spendly’s safe demo dataset or create your first ledger entry.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Button(onClick = { confirmsDemo = true }) { Text("Load demo workspace") }
            }
        }
        item {
            BoxWithConstraints {
                if (maxWidth >= 680.dp) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        MetricCard("Total balance", currency(viewModel.totalBalance, viewModel.currency), "Across all accounts", Icons.Outlined.AccountBalanceWallet, SpendlyTeal, Modifier.weight(1f))
                        MetricCard("Monthly income", currency(viewModel.monthlyIncome, viewModel.currency), "Current month inflow", Icons.Outlined.ArrowDownward, IncomeGreen, Modifier.weight(1f))
                        MetricCard("Monthly expenses", currency(viewModel.monthlyExpenses, viewModel.currency), "Current month outflow", Icons.Outlined.ArrowUpward, ExpenseRed, Modifier.weight(1f))
                        MetricCard("Net savings", currency(viewModel.netSavings, viewModel.currency), "${viewModel.savingsRate.toInt()}% savings rate", Icons.Outlined.Savings, if (viewModel.netSavings >= 0) IncomeGreen else ExpenseRed, Modifier.weight(1f))
                    }
                } else Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        MetricCard("Total balance", currency(viewModel.totalBalance, viewModel.currency), "Across all accounts", Icons.Outlined.AccountBalanceWallet, SpendlyTeal, Modifier.weight(1f))
                        MetricCard("Monthly income", currency(viewModel.monthlyIncome, viewModel.currency), "Current month inflow", Icons.Outlined.ArrowDownward, IncomeGreen, Modifier.weight(1f))
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        MetricCard("Monthly expenses", currency(viewModel.monthlyExpenses, viewModel.currency), "Current month outflow", Icons.Outlined.ArrowUpward, ExpenseRed, Modifier.weight(1f))
                        MetricCard("Net savings", currency(viewModel.netSavings, viewModel.currency), "${viewModel.savingsRate.toInt()}% savings rate", Icons.Outlined.Savings, if (viewModel.netSavings >= 0) IncomeGreen else ExpenseRed, Modifier.weight(1f))
                    }
                }
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                SectionHeading("Spending trend", "Income and expenses across the last six months.")
                CashFlowLineChart(viewModel.sixMonthCashFlow, Modifier.fillMaxWidth().padding(top = 14.dp))
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                SectionHeading("Category breakdown", "Current month expense mix.")
                if (viewModel.categorySpending.isEmpty()) {
                    Text("Add expenses to unlock this view.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp))
                } else {
                    CategoryDonut(viewModel.categorySpending, Modifier.fillMaxWidth().height(190.dp))
                    viewModel.categorySpending.take(5).forEach { item ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(10.dp).background(spendlyColor(item.color), CircleShape))
                            Text(item.name, Modifier.padding(start = 9.dp).weight(1f), fontWeight = FontWeight.Medium)
                            Text(currency(item.amount, viewModel.currency), color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SectionHeading("Recent transactions", "The latest movement across your accounts.")
                if (viewModel.workspace.transactions.isEmpty()) {
                    EmptyFeature(Icons.AutoMirrored.Outlined.ReceiptLong, "No transactions yet", "Add income, expenses, or transfers from the Ledger tab.", Modifier.fillMaxWidth())
                } else viewModel.workspace.transactions.take(6).forEach { transaction ->
                    GlassCard(Modifier.fillMaxWidth()) { TransactionRow(transaction, viewModel) }
                }
                if (viewModel.workspace.transactions.isNotEmpty()) TextButton(onClick = openLedger, modifier = Modifier.align(Alignment.End)) { Text("View all") }
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                SectionHeading("Budgets & goals", "Current progress at a glance.")
                viewModel.currentBudgetProgress.take(4).forEach { item ->
                    val percent = item.progress * 100
                    Row(Modifier.fillMaxWidth().padding(top = 12.dp)) {
                        Text(item.category?.name ?: "Budget", Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                        Text("${percent.toInt()}%", color = if (percent >= 100) ExpenseRed else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    LinearProgressIndicator(
                        progress = { item.progress.toFloat().coerceAtMost(1f) },
                        modifier = Modifier.fillMaxWidth().padding(top = 7.dp), color = if (percent >= 100) ExpenseRed else SpendlyTeal,
                    )
                }
                if (viewModel.currentBudgetProgress.isNotEmpty() && viewModel.workspace.goals.isNotEmpty()) HorizontalDivider(Modifier.padding(vertical = 14.dp))
                viewModel.workspace.goals.take(3).forEach { goal ->
                    val progress = if (goal.targetAmount > 0) (goal.currentAmount / goal.targetAmount).coerceIn(0.0, 1.0) else 0.0
                    Row(Modifier.fillMaxWidth().padding(top = 10.dp)) {
                        Text(goal.name, Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                        Text("${(progress * 100).toInt()}%")
                    }
                    LinearProgressIndicator(progress = { progress.toFloat() }, modifier = Modifier.fillMaxWidth().padding(top = 7.dp), color = SpendlyBlue)
                }
                if (viewModel.currentBudgetProgress.isEmpty() && viewModel.workspace.goals.isEmpty()) {
                    Text("Create a budget or savings goal to track progress here.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp))
                }
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SectionHeading("Upcoming", "Active recurring items due within 30 days.")
                if (upcoming.isEmpty()) {
                    EmptyFeature(Icons.Outlined.CalendarMonth, "Nothing due soon", "Recurring bills and income will appear here.", Modifier.fillMaxWidth())
                } else upcoming.take(5).forEach { item ->
                    GlassCard(Modifier.fillMaxWidth()) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Box(Modifier.size(42.dp).background(SpendlyTeal.copy(.12f), RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
                                Icon(Icons.Outlined.Repeat, null, tint = SpendlyTeal)
                            }
                            Column(Modifier.weight(1f)) {
                                Text(item.description, fontWeight = FontWeight.Bold)
                                Text("Due ${displayDate(item.nextDueDate)} · ${item.frequency.title}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Text(
                                (if (item.type == TransactionType.EXPENSE) "−" else "+") + currency(item.amount, viewModel.currency),
                                color = if (item.type == TransactionType.EXPENSE) ExpenseRed else IncomeGreen, fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
            }
        }
    }

    if (confirmsDemo) AlertDialog(
        onDismissRequest = { confirmsDemo = false },
        title = { Text("Load demo workspace?") },
        text = { Text("This adds sample transactions, budgets, goals, and recurring items. It only works while the workspace is empty.") },
        confirmButton = { TextButton(onClick = { confirmsDemo = false; viewModel.loadDemoWorkspace() }) { Text("Load demo workspace") } },
        dismissButton = { TextButton(onClick = { confirmsDemo = false }) { Text("Cancel") } },
    )
}

@Composable
fun TransactionRow(item: Transaction, viewModel: SpendlyViewModel) {
    val color = when (item.type) {
        TransactionType.INCOME -> IncomeGreen
        TransactionType.EXPENSE -> ExpenseRed
        TransactionType.TRANSFER -> SpendlyBlue
    }
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.background(color.copy(alpha = .14f), RoundedCornerShape(14.dp)).padding(10.dp)) {
            Icon(
                when (item.type) {
                    TransactionType.INCOME -> Icons.Outlined.ArrowDownward
                    TransactionType.EXPENSE -> Icons.Outlined.ArrowUpward
                    TransactionType.TRANSFER -> Icons.Outlined.SwapHoriz
                }, null, tint = color,
            )
        }
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text(item.description, fontWeight = FontWeight.Bold, maxLines = 1)
            val source = viewModel.account(item.accountId)?.name ?: "Account"
            val detail = viewModel.account(item.transferAccountId)?.name?.let { "$source → $it" }
                ?: "$source · ${viewModel.category(item.categoryId)?.name ?: "Transfer"}"
            Text(detail, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
            if (!item.notes.isNullOrBlank()) Text(item.notes, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                (if (item.type == TransactionType.EXPENSE) "−" else if (item.type == TransactionType.INCOME) "+" else "") + currency(item.amount, viewModel.currency),
                color = if (item.type == TransactionType.EXPENSE) ExpenseRed else IncomeGreen, fontWeight = FontWeight.Bold, maxLines = 1,
            )
            Text(displayDate(item.transactionDate), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
