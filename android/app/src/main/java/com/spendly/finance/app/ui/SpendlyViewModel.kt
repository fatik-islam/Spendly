package com.spendly.finance.app.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.spendly.finance.app.data.Account
import com.spendly.finance.app.data.AccountDraft
import com.spendly.finance.app.data.Appearance
import com.spendly.finance.app.data.AuthConfig
import com.spendly.finance.app.data.AuthUser
import com.spendly.finance.app.data.Budget
import com.spendly.finance.app.data.BudgetDraft
import com.spendly.finance.app.data.BudgetProgress
import com.spendly.finance.app.data.Category
import com.spendly.finance.app.data.CategoryDraft
import com.spendly.finance.app.data.CategorySpend
import com.spendly.finance.app.data.CategoryType
import com.spendly.finance.app.data.CurrencyCode
import com.spendly.finance.app.data.CsvService
import com.spendly.finance.app.data.GoalDraft
import com.spendly.finance.app.data.ExportDataset
import com.spendly.finance.app.data.MonthlyCashFlow
import com.spendly.finance.app.data.previewWorkspace
import com.spendly.finance.app.data.RecurringDraft
import com.spendly.finance.app.data.RecurringReminder
import com.spendly.finance.app.data.RecurringTransaction
import com.spendly.finance.app.data.SavingsGoal
import com.spendly.finance.app.data.SessionState
import com.spendly.finance.app.data.SpendlyRepository
import com.spendly.finance.app.data.Transaction
import com.spendly.finance.app.data.TransactionDraft
import com.spendly.finance.app.data.TransactionType
import com.spendly.finance.app.data.Workspace
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

class SpendlyViewModel(
    val repository: SpendlyRepository,
    application: Application,
) : AndroidViewModel(application) {
    var sessionState by mutableStateOf(SessionState.LAUNCHING); private set
    var currentUser by mutableStateOf<AuthUser?>(null); private set
    var authConfig by mutableStateOf(AuthConfig()); private set
    var workspace by mutableStateOf(Workspace()); private set
    var isLoading by mutableStateOf(false); private set
    var errorMessage by mutableStateOf<String?>(null); private set
    var noticeMessage by mutableStateOf<String?>(null); private set
    var appearance by mutableStateOf(loadAppearance()); private set
    var started = false
    private var demoMode = false

    val currency get() = workspace.profile?.currency ?: CurrencyCode.USD
    val totalBalance get() = workspace.accounts.sumOf(Account::balance)
    val currentMonthTransactions get() = workspace.transactions.filter {
        val date = runCatching { LocalDate.parse(it.transactionDate) }.getOrNull()
        date?.year == LocalDate.now().year && date.month == LocalDate.now().month
    }
    val monthlyIncome get() = currentMonthTransactions.filter { it.type == TransactionType.INCOME }.sumOf(Transaction::amount)
    val monthlyExpenses get() = currentMonthTransactions.filter { it.type == TransactionType.EXPENSE }.sumOf(Transaction::amount)
    val netSavings get() = monthlyIncome - monthlyExpenses
    val savingsRate get() = if (monthlyIncome > 0) (netSavings / monthlyIncome * 100).coerceIn(0.0, 100.0) else 0.0
    val unreadReminders get() = workspace.reminders.filter { it.readAt == null && it.dismissedAt == null }
    val canLoadDemoData get() = workspace.transactions.isEmpty() && workspace.budgets.isEmpty() &&
        workspace.goals.isEmpty() && workspace.recurring.isEmpty()

    val currentBudgetProgress: List<BudgetProgress> get() {
        val now = YearMonth.now()
        return workspace.budgets.filter { it.month == now.monthValue && it.year == now.year }.map { budget ->
            val spent = currentMonthTransactions.filter {
                it.type == TransactionType.EXPENSE && it.categoryId == budget.categoryId
            }.sumOf(Transaction::amount)
            BudgetProgress(budget, category(budget.categoryId), spent)
        }
    }

    val categorySpending: List<CategorySpend> get() = currentMonthTransactions
        .filter { it.type == TransactionType.EXPENSE && it.categoryId != null }
        .groupBy { it.categoryId!! }
        .map { (id, values) ->
            val category = category(id)
            CategorySpend(id, category?.name ?: "Other", category?.color ?: "#64748B", values.sumOf(Transaction::amount))
        }.sortedByDescending(CategorySpend::amount)

    val sixMonthCashFlow get() = cashFlow(6)
    val twelveMonthCashFlow get() = cashFlow(12)
    val financialHealthScore get(): Int {
        var score = 35
        if (netSavings > 0) score += 20
        if (savingsRate >= 20) score += 15 else if (savingsRate >= 10) score += 8
        if (currentBudgetProgress.none { it.progress > 1 }) score += 15
        if (workspace.goals.any { it.currentAmount > 0 }) score += 10
        if (totalBalance > 0) score += 5
        return score.coerceIn(0, 100)
    }

    fun start(demoUi: Boolean = false) {
        if (started) return
        started = true
        if (demoUi) {
            demoMode = true
            currentUser = AuthUser(
                "00000000-0000-0000-0000-000000000001", "alex@spendly.app", true,
                com.spendly.finance.app.data.AuthIdentityProfile("Alex Morgan"),
            )
            workspace = previewWorkspace(currentUser!!.id)
            sessionState = SessionState.SIGNED_IN
            return
        }
        viewModelScope.launch {
            authConfig = runCatching { repository.api.publicAuthConfig() }.getOrDefault(AuthConfig())
            val restored = runCatching { repository.api.restoreSession() }.getOrNull()
            if (restored == null) sessionState = SessionState.SIGNED_OUT
            else {
                currentUser = restored.user
                sessionState = SessionState.SIGNED_IN
                runAction(showSuccess = false) { workspace = repository.bootstrapAndLoad(restored.user); registerPushToken() }
            }
        }
    }

    fun signIn(email: String, password: String, rememberMe: Boolean) = runAction("Welcome back.") {
        val session = repository.api.signIn(email.trim(), password, rememberMe)
        currentUser = session.user
        sessionState = SessionState.SIGNED_IN
        workspace = repository.bootstrapAndLoad(session.user)
        registerPushToken()
    }

    fun signUp(name: String, email: String, password: String, onVerification: (String) -> Unit) =
        runAction {
            validateName(name); validateEmail(email); validatePassword(password)
            val result = repository.api.signUp(email.trim(), password, name.trim())
            if (result.user != null && result.accessToken != null) {
                currentUser = result.user
                sessionState = SessionState.SIGNED_IN
                workspace = repository.bootstrapAndLoad(result.user)
                notice("Account created.")
            } else onVerification(email.trim())
        }

    fun verifyEmail(email: String, code: String) = runAction("Email verified.") {
        require(code.length == 6) { "Enter the 6-digit verification code." }
        val session = repository.api.verifyEmail(email, code)
        currentUser = session.user
        sessionState = SessionState.SIGNED_IN
        workspace = repository.bootstrapAndLoad(session.user)
        registerPushToken()
    }

    fun resendVerification(email: String) = runAction("Verification code sent.") { repository.api.resendVerification(email) }
    fun sendPasswordReset(email: String, onSent: () -> Unit) = runAction("Reset code sent.") {
        validateEmail(email); repository.api.sendPasswordReset(email.trim()); onSent()
    }
    fun resetPassword(email: String, code: String, password: String, onDone: () -> Unit) =
        runAction("Password updated. Sign in with your new password.") {
            require(code.length == 6) { "Enter the 6-digit reset code." }
            validatePassword(password); repository.api.resetPassword(email, code, password); onDone()
        }

    fun signOut() = runAction {
        unregisterPushToken()
        repository.api.signOut(); currentUser = null; workspace = Workspace(); sessionState = SessionState.SIGNED_OUT
    }

    fun deleteCurrentUserAccount() = runAction("Your Spendly account and data were permanently deleted.") {
        repository.api.deleteCurrentUserAccount()
        currentUser = null; workspace = Workspace(); sessionState = SessionState.SIGNED_OUT
    }

    fun refresh() = runAction(showSuccess = false) { workspace = repository.loadWorkspace() }

    fun saveAccount(draft: AccountDraft, onSuccess: () -> Unit = {}) = mutate(if (draft.id == null) "Account created." else "Account updated.", onSuccess) {
        repository.saveAccount(requireUser(), draft)
    }
    fun deleteAccount(item: Account) = mutate("Account deleted.") { repository.deleteAccount(item, workspace) }
    fun saveTransaction(draft: TransactionDraft, onSuccess: () -> Unit = {}) = mutate(if (draft.id == null) "Transaction saved." else "Transaction updated.", onSuccess) {
        repository.saveTransaction(requireUser(), draft)
    }
    fun deleteTransaction(item: Transaction) = mutate("Transaction deleted.") { repository.delete("transactions", item.id) }
    fun saveBudget(draft: BudgetDraft, onSuccess: () -> Unit = {}) = mutate(if (draft.id == null) "Budget created." else "Budget updated.", onSuccess) {
        repository.saveBudget(requireUser(), draft)
    }
    fun deleteBudget(item: Budget) = mutate("Budget deleted.") { repository.delete("budgets", item.id) }
    fun saveGoal(draft: GoalDraft, onSuccess: () -> Unit = {}) = mutate(if (draft.id == null) "Goal created." else "Goal updated.", onSuccess) {
        repository.saveGoal(requireUser(), draft)
    }
    fun deleteGoal(item: SavingsGoal) = mutate("Goal deleted.") { repository.delete("savings_goals", item.id) }
    fun saveRecurring(draft: RecurringDraft, onSuccess: () -> Unit = {}) = mutate(if (draft.id == null) "Recurring item created." else "Recurring item updated.", onSuccess) {
        repository.saveRecurring(requireUser(), draft)
    }
    fun toggleRecurring(item: RecurringTransaction) = mutate(if (item.active) "Recurring item paused." else "Recurring item resumed.") {
        repository.toggleRecurring(item)
    }
    fun deleteRecurring(item: RecurringTransaction) = mutate("Recurring item deleted.") {
        repository.delete("recurring_transactions", item.id)
    }
    fun saveCategory(draft: CategoryDraft, onSuccess: () -> Unit = {}) = mutate(if (draft.id == null) "Category created." else "Category updated.", onSuccess) {
        repository.saveCategory(requireUser(), draft, workspace.categories.firstOrNull { it.id == draft.id })
    }
    fun deleteCategory(item: Category) = mutate("Category deleted.") { repository.deleteCategory(item) }
    fun updateProfile(name: String, currency: CurrencyCode) = mutate("Profile updated.") {
        repository.updateProfile(requireUser(), name, currency)
    }
    fun updateReminderPreferences(days: Int, inApp: Boolean, email: Boolean) = mutate("Reminder preferences updated.") {
        repository.updateReminderPreferences(requireUser(), days, inApp, email)
    }
    fun markReminderRead(item: RecurringReminder) = mutate("Reminder marked as read.") { repository.markReminderRead(item) }
    fun dismissReminder(item: RecurringReminder) = mutate("Reminder dismissed.") { repository.dismissReminder(item) }
    fun loadDemoWorkspace() = mutate("Demo workspace added.") { repository.loadDemoWorkspace() }
    fun exportCsv(): String = CsvService.export(workspace, currency)
    fun exportCsv(dataset: ExportDataset): String = CsvService.export(dataset, workspace, currency, currentUser?.email.orEmpty())
    fun importCsv(input: String, onSummary: (com.spendly.finance.app.data.CsvImportSummary) -> Unit = {}) = runAction {
        val summary = repository.importTransactions(requireUser(), input, workspace)
        workspace = repository.loadWorkspace()
        onSummary(summary)
        notice(summary.message)
    }

    fun updateAppearance(value: Appearance) {
        appearance = value
        getApplication<Application>().getSharedPreferences("spendly_settings", 0).edit().putString("appearance", value.name).apply()
    }

    fun clearError() { errorMessage = null }
    fun clearNotice() { noticeMessage = null }
    fun showError(message: String) { errorMessage = message }
    fun account(id: String?) = workspace.accounts.firstOrNull { it.id == id }
    fun category(id: String?) = workspace.categories.firstOrNull { it.id == id }
    fun onAppResumed() {
        if (!demoMode && sessionState == SessionState.SIGNED_IN && !isLoading) refresh()
    }

    private fun mutate(message: String, onSuccess: () -> Unit = {}, block: suspend () -> Unit) = runAction(message, onSuccess = onSuccess) {
        block(); workspace = repository.loadWorkspace()
    }

    private fun runAction(success: String? = null, showSuccess: Boolean = true, onSuccess: () -> Unit = {}, block: suspend () -> Unit) =
        viewModelScope.launch {
            isLoading = true
            try {
                block()
                if (showSuccess && success != null) notice(success)
                onSuccess()
            } catch (error: Throwable) {
                errorMessage = error.message ?: "Something went wrong."
            } finally { isLoading = false }
        }

    private fun notice(message: String) {
        noticeMessage = message
        viewModelScope.launch { delay(2400); if (noticeMessage == message) noticeMessage = null }
    }

    private fun requireUser() = currentUser?.id ?: throw IllegalStateException("Your session has expired. Sign in again.")
    private fun validateName(name: String) = require(name.trim().length >= 2) { "Full name must be at least 2 characters." }
    private fun validateEmail(email: String) = require(android.util.Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches()) { "Enter a valid email address." }
    private fun validatePassword(password: String) {
        require(password.length >= 8 && password.any(Char::isUpperCase) && password.any(Char::isLowerCase) && password.any(Char::isDigit)) {
            "Password must be at least 8 characters with uppercase, lowercase, and a number."
        }
    }

    private fun loadAppearance(): Appearance = runCatching {
        Appearance.valueOf(getApplication<Application>().getSharedPreferences("spendly_settings", 0).getString("appearance", "SYSTEM")!!)
    }.getOrDefault(Appearance.SYSTEM)

    private fun cashFlow(months: Int): List<MonthlyCashFlow> = (months - 1 downTo 0).map { offset ->
        val month = YearMonth.now().minusMonths(offset.toLong())
        val items = workspace.transactions.filter { runCatching { YearMonth.from(LocalDate.parse(it.transactionDate)) }.getOrNull() == month }
        MonthlyCashFlow(
            month.toString(), month.month.getDisplayName(TextStyle.SHORT, Locale.getDefault()),
            items.filter { it.type == TransactionType.INCOME }.sumOf(Transaction::amount),
            items.filter { it.type == TransactionType.EXPENSE }.sumOf(Transaction::amount),
        )
    }

    private fun registerPushToken() {
        val app = getApplication<Application>()
        val pending = app.getSharedPreferences("spendly_push", 0).getString("pending_token", null)
        if (pending != null) viewModelScope.launch {
            runCatching { repository.api.registerFcmToken(pending) }
                .onSuccess { app.getSharedPreferences("spendly_push", 0).edit().remove("pending_token").apply() }
        }
        if (FirebaseApp.getApps(app).isNotEmpty()) {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                app.getSharedPreferences("spendly_push", 0).edit().putString("active_token", token).apply()
                viewModelScope.launch { runCatching { repository.api.registerFcmToken(token) } }
            }
        }
    }

    private suspend fun unregisterPushToken() {
        val preferences = getApplication<Application>().getSharedPreferences("spendly_push", 0)
        preferences.getString("active_token", null)?.let { runCatching { repository.api.unregisterFcmToken(it) } }
        preferences.edit().clear().apply()
    }
}

class SpendlyViewModelFactory(
    private val repository: SpendlyRepository,
    private val application: Application,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        SpendlyViewModel(repository, application) as T
}
