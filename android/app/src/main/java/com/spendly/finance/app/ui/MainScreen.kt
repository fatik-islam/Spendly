package com.spendly.finance.app.ui

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.spendly.finance.app.ui.theme.SpendlyTeal

enum class AppRoute(val title: String, val icon: ImageVector) {
    DASHBOARD("Overview", Icons.Default.GridView),
    TRANSACTIONS("Ledger", Icons.Default.ReceiptLong),
    ACCOUNTS("Accounts", Icons.Default.AccountBalanceWallet),
    BUDGETS("Budgets", Icons.Default.BarChart),
    MORE("More", Icons.Default.MoreHoriz),
    GOALS("Goals", Icons.Outlined.Flag),
    RECURRING("Recurring", Icons.Outlined.Repeat),
    INSIGHTS("Insights", Icons.Outlined.Insights),
    SETTINGS("Settings", Icons.Outlined.Settings),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(viewModel: SpendlyViewModel) {
    var route by remember { mutableStateOf(AppRoute.DASHBOARD) }
    var showReminders by remember { mutableStateOf(false) }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    LaunchedEffect(Unit) { if (Build.VERSION.SDK_INT >= 33) permission.launch(Manifest.permission.POST_NOTIFICATIONS) }
    val primaryRoutes = listOf(AppRoute.DASHBOARD, AppRoute.TRANSACTIONS, AppRoute.ACCOUNTS, AppRoute.BUDGETS, AppRoute.MORE)

    SpendlyBackground {
        Scaffold(
            containerColor = androidx.compose.ui.graphics.Color.Transparent,
            topBar = {
                CenterAlignedTopAppBar(
                    title = { Text(route.title, fontWeight = FontWeight.SemiBold) },
                    navigationIcon = {
                        if (route in primaryRoutes) BrandIcon(Modifier.padding(start = 12.dp).size(38.dp))
                        else IconButton(onClick = { route = AppRoute.MORE }) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") }
                    },
                    actions = {
                        IconButton(onClick = { showReminders = true }) {
                            BadgedBox(badge = {
                                if (viewModel.unreadReminders.isNotEmpty()) Badge { Text(viewModel.unreadReminders.size.toString()) }
                            }) { Icon(Icons.Outlined.Notifications, "Reminder center") }
                        }
                    },
                    colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = .54f)),
                )
            },
            bottomBar = {
                if (route in primaryRoutes) {
                    NavigationBar(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = .88f)) {
                        primaryRoutes.forEach { item ->
                            NavigationBarItem(
                                selected = route == item,
                                onClick = { route = item },
                                icon = { Icon(item.icon, item.title) },
                                label = { Text(item.title, maxLines = 1) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = SpendlyTeal,
                                    selectedTextColor = SpendlyTeal,
                                    indicatorColor = MaterialTheme.colorScheme.onSurface.copy(alpha = .08f),
                                ),
                            )
                        }
                    }
                }
            },
        ) { insets ->
            when (route) {
                AppRoute.DASHBOARD -> DashboardScreen(viewModel, Modifier.padding(insets)) { route = AppRoute.TRANSACTIONS }
                AppRoute.TRANSACTIONS -> TransactionsScreen(viewModel, Modifier.padding(insets))
                AppRoute.ACCOUNTS -> AccountsScreen(viewModel, Modifier.padding(insets))
                AppRoute.BUDGETS -> BudgetsScreen(viewModel, Modifier.padding(insets))
                AppRoute.MORE -> MoreScreen(Modifier.padding(insets), onRoute = { route = it })
                AppRoute.GOALS -> GoalsScreen(viewModel, Modifier.padding(insets))
                AppRoute.RECURRING -> RecurringScreen(viewModel, Modifier.padding(insets))
                AppRoute.INSIGHTS -> InsightsScreen(viewModel, Modifier.padding(insets))
                AppRoute.SETTINGS -> SettingsScreen(viewModel, Modifier.padding(insets))
            }
        }
    }
    if (showReminders) ReminderCenter(viewModel) { showReminders = false }
}

@Composable
private fun MoreScreen(modifier: Modifier, onRoute: (AppRoute) -> Unit) {
    LazyColumn(
        modifier.fillMaxSize().padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { MoreSection("Plan and track", listOf(AppRoute.GOALS, AppRoute.RECURRING, AppRoute.INSIGHTS), onRoute) }
        item { MoreSection("Workspace", listOf(AppRoute.SETTINGS), onRoute) }
    }
}

@Composable
private fun MoreSection(title: String, entries: List<AppRoute>, onRoute: (AppRoute) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 4.dp))
        GlassCard(Modifier.fillMaxWidth()) {
            entries.forEachIndexed { index, target ->
                Row(
                    Modifier.fillMaxWidth().clickable { onRoute(target) }.padding(vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Icon(target.icon, null, tint = MaterialTheme.colorScheme.primary)
                    Text(if (target == AppRoute.GOALS) "Savings goals" else target.title, Modifier.weight(1f), fontWeight = FontWeight.Medium)
                    Icon(Icons.Outlined.ChevronRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (index != entries.lastIndex) HorizontalDivider(color = MaterialTheme.colorScheme.onSurface.copy(.08f))
            }
        }
    }
}
