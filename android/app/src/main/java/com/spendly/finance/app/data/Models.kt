package com.spendly.finance.app.data

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import java.time.LocalDate
import java.time.YearMonth

object FlexibleDoubleSerializer : KSerializer<Double> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("FlexibleDouble", PrimitiveKind.DOUBLE)
    override fun deserialize(decoder: Decoder): Double {
        val value = (decoder as? JsonDecoder)?.decodeJsonElement() as? JsonPrimitive
        return value?.doubleOrNull ?: value?.content?.toDoubleOrNull() ?: 0.0
    }
    override fun serialize(encoder: Encoder, value: Double) = encoder.encodeDouble(value)
}

@Serializable
enum class CurrencyCode { USD, EUR, GBP, PKR, AED }

@Serializable
enum class AccountType {
    @SerialName("cash") CASH,
    @SerialName("bank") BANK,
    @SerialName("credit-card") CREDIT_CARD,
    @SerialName("savings") SAVINGS;
    val title get() = name.lowercase().replace('_', ' ').replaceFirstChar(Char::uppercase)
}

@Serializable
enum class CategoryType { @SerialName("income") INCOME, @SerialName("expense") EXPENSE }

@Serializable
enum class TransactionType {
    @SerialName("income") INCOME,
    @SerialName("expense") EXPENSE,
    @SerialName("transfer") TRANSFER;
    val title get() = name.lowercase().replaceFirstChar(Char::uppercase)
}

@Serializable
enum class RecurringFrequency {
    @SerialName("weekly") WEEKLY,
    @SerialName("monthly") MONTHLY,
    @SerialName("yearly") YEARLY;
    val title get() = name.lowercase().replaceFirstChar(Char::uppercase)
}

@Serializable
data class AuthIdentityProfile(
    val name: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
)

@Serializable
data class AuthUser(
    val id: String,
    val email: String,
    @SerialName("email_verified") val emailVerified: Boolean = false,
    val profile: AuthIdentityProfile? = null,
)

@Serializable
data class AuthSession(
    val user: AuthUser,
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String? = null,
)

@Serializable
data class SignUpResponse(
    val user: AuthUser? = null,
    @SerialName("access_token") val accessToken: String? = null,
    @SerialName("refresh_token") val refreshToken: String? = null,
)

@Serializable
data class AuthConfig(
    @SerialName("require_email_verification") val requireEmailVerification: Boolean = true,
    @SerialName("password_min_length") val passwordMinLength: Int = 8,
)

@Serializable
data class CurrentUserResponse(val user: AuthUser)

@Serializable
data class ResetTokenResponse(val token: String)

@Serializable
data class Profile(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("full_name") val fullName: String? = null,
    val currency: CurrencyCode = CurrencyCode.USD,
    @SerialName("reminder_days_before") val reminderDaysBefore: Int = 3,
    @SerialName("reminder_in_app_enabled") val reminderInAppEnabled: Boolean = true,
    @SerialName("reminder_email_enabled") val reminderEmailEnabled: Boolean = false,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = "",
)

@Serializable
data class Account(
    val id: String,
    @SerialName("user_id") val userId: String,
    val name: String,
    val type: AccountType,
    @Serializable(with = FlexibleDoubleSerializer::class) val balance: Double,
    val currency: CurrencyCode,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = "",
)

@Serializable
data class Category(
    val id: String,
    @SerialName("user_id") val userId: String,
    val name: String,
    val type: CategoryType,
    val color: String,
    val icon: String,
    @SerialName("is_default") val isDefault: Boolean = false,
    @SerialName("created_at") val createdAt: String = "",
)

@Serializable
data class Transaction(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("account_id") val accountId: String,
    @SerialName("transfer_account_id") val transferAccountId: String? = null,
    @SerialName("category_id") val categoryId: String? = null,
    val type: TransactionType,
    @Serializable(with = FlexibleDoubleSerializer::class) val amount: Double,
    val description: String,
    val notes: String? = null,
    @SerialName("transaction_date") val transactionDate: String,
    @SerialName("is_recurring") val isRecurring: Boolean = false,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = "",
)

@Serializable
data class Budget(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("category_id") val categoryId: String,
    @Serializable(with = FlexibleDoubleSerializer::class) val amount: Double,
    val month: Int,
    val year: Int,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = "",
)

@Serializable
data class SavingsGoal(
    val id: String,
    @SerialName("user_id") val userId: String,
    val name: String,
    @SerialName("target_amount") @Serializable(with = FlexibleDoubleSerializer::class) val targetAmount: Double,
    @SerialName("current_amount") @Serializable(with = FlexibleDoubleSerializer::class) val currentAmount: Double,
    val deadline: String? = null,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = "",
)

@Serializable
data class RecurringTransaction(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("account_id") val accountId: String,
    @SerialName("category_id") val categoryId: String? = null,
    val type: TransactionType,
    @Serializable(with = FlexibleDoubleSerializer::class) val amount: Double,
    val description: String,
    val frequency: RecurringFrequency,
    @SerialName("next_due_date") val nextDueDate: String,
    val active: Boolean,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = "",
)

@Serializable
data class RecurringReminder(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("recurring_transaction_id") val recurringTransactionId: String,
    val kind: String,
    val title: String,
    val body: String,
    @SerialName("due_date") val dueDate: String,
    @SerialName("remind_on") val remindOn: String,
    @SerialName("email_sent_at") val emailSentAt: String? = null,
    @SerialName("email_last_error") val emailLastError: String? = null,
    @SerialName("read_at") val readAt: String? = null,
    @SerialName("dismissed_at") val dismissedAt: String? = null,
    @SerialName("created_at") val createdAt: String = "",
)

data class AccountDraft(
    val id: String? = null, val name: String = "", val type: AccountType = AccountType.CASH,
    val balance: Double = 0.0, val currency: CurrencyCode = CurrencyCode.USD,
)

data class TransactionDraft(
    val id: String? = null, val accountId: String = "", val transferAccountId: String? = null,
    val categoryId: String? = null, val type: TransactionType = TransactionType.EXPENSE,
    val amount: Double = 0.0, val description: String = "", val notes: String = "",
    val transactionDate: LocalDate = LocalDate.now(), val isRecurring: Boolean = false,
)

data class BudgetDraft(
    val id: String? = null, val categoryId: String = "", val amount: Double = 0.0,
    val month: Int = YearMonth.now().monthValue, val year: Int = YearMonth.now().year,
)

data class GoalDraft(
    val id: String? = null, val name: String = "", val targetAmount: Double = 0.0,
    val currentAmount: Double = 0.0, val deadline: LocalDate? = null,
)

data class RecurringDraft(
    val id: String? = null, val accountId: String = "", val categoryId: String? = null,
    val type: TransactionType = TransactionType.EXPENSE, val amount: Double = 0.0,
    val description: String = "", val frequency: RecurringFrequency = RecurringFrequency.MONTHLY,
    val nextDueDate: LocalDate = LocalDate.now(), val active: Boolean = true,
)

data class CategoryDraft(
    val id: String? = null, val name: String = "", val type: CategoryType = CategoryType.EXPENSE,
    val color: String = "#14B8A6", val icon: String = "piggy-bank",
)

data class BudgetProgress(val budget: Budget, val category: Category?, val spent: Double) {
    val progress = if (budget.amount > 0) (spent / budget.amount).coerceIn(0.0, 2.0) else 0.0
    val remaining = budget.amount - spent
}

data class CategorySpend(val id: String, val name: String, val color: String, val amount: Double)
data class MonthlyCashFlow(val id: String, val label: String, val income: Double, val expense: Double) {
    val savings = income - expense
}

@Serializable
data class DemoSeedResult(
    val transactions: Int = 0, val budgets: Int = 0, val goals: Int = 0,
    @SerialName("recurring_transactions") val recurringTransactions: Int = 0,
)

enum class SessionState { LAUNCHING, SIGNED_OUT, SIGNED_IN }
enum class Appearance { SYSTEM, LIGHT, DARK }
enum class ExportDataset(val title: String) {
    PROFILE("Profile"), ACCOUNTS("Accounts"), CATEGORIES("Categories"), TRANSACTIONS("Transactions"),
    BUDGETS("Budgets"), GOALS("Savings goals"), RECURRING("Recurring")
}
class SpendlyException(message: String) : Exception(message)

data class CsvImportSummary(
    val processed: Int,
    val imported: Int,
    val duplicates: Int,
    val errors: List<String>,
    val createdAccounts: List<String>,
    val createdCategories: List<String>,
) {
    val message: String get() = "$imported imported, $duplicates skipped${if (errors.isEmpty()) "" else ", ${errors.size} errors"}."
}
