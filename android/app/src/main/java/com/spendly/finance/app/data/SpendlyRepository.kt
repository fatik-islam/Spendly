package com.spendly.finance.app.data

import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

data class Workspace(
    val profile: Profile? = null,
    val accounts: List<Account> = emptyList(),
    val categories: List<Category> = emptyList(),
    val transactions: List<Transaction> = emptyList(),
    val budgets: List<Budget> = emptyList(),
    val goals: List<SavingsGoal> = emptyList(),
    val recurring: List<RecurringTransaction> = emptyList(),
    val reminders: List<RecurringReminder> = emptyList(),
)

class SpendlyRepository(val api: SpendlyApi) {
    suspend fun bootstrapAndLoad(user: AuthUser): Workspace {
        api.rpcUnit(
            "bootstrap_spendly_user",
            buildJsonObject {
                put("p_full_name", user.profile?.name ?: "")
                put("p_currency", "USD")
            },
        )
        generateReminders()
        return loadWorkspace()
    }

    suspend fun loadWorkspace(): Workspace = coroutineScope {
        val profile = async { api.fetchRows<Profile>("profiles", order = "created_at.asc") }
        val accounts = async { api.fetchRows<Account>("accounts", order = "created_at.asc") }
        val categories = async { api.fetchRows<Category>("categories", order = "type.asc,name.asc") }
        val transactions = async { api.fetchRows<Transaction>("transactions", order = "transaction_date.desc,created_at.desc") }
        val budgets = async { api.fetchRows<Budget>("budgets", order = "year.desc,month.desc") }
        val goals = async { api.fetchRows<SavingsGoal>("savings_goals", order = "created_at.desc") }
        val recurring = async { api.fetchRows<RecurringTransaction>("recurring_transactions", order = "next_due_date.asc") }
        val reminders = async {
            api.fetchRows<RecurringReminder>(
                "recurring_reminders", order = "remind_on.asc,due_date.asc",
                filters = listOf("dismissed_at" to SpendlyApi.isNull()),
            )
        }
        Workspace(
            profile.await().firstOrNull(), accounts.await(), categories.await(), transactions.await(),
            budgets.await(), goals.await(), recurring.await(), reminders.await(),
        )
    }

    suspend fun saveAccount(userId: String, draft: AccountDraft) {
        require(draft.name.trim().length >= 2) { "Account name must be at least 2 characters." }
        val values = buildJsonObject {
            put("name", draft.name.trim()); put("type", draft.type.serialized)
            put("balance", draft.balance); put("currency", draft.currency.name)
            if (draft.id == null) put("user_id", userId)
        }
        save("accounts", draft.id, values)
    }

    suspend fun deleteAccount(item: Account, workspace: Workspace) {
        require(workspace.transactions.none { it.accountId == item.id || it.transferAccountId == item.id }) {
            "Accounts with transaction history cannot be deleted."
        }
        require(workspace.recurring.none { it.accountId == item.id }) { "Remove recurring items from this account first." }
        delete("accounts", item.id)
    }

    suspend fun saveTransaction(userId: String, draft: TransactionDraft) {
        require(draft.accountId.isNotBlank()) { "Choose an account." }
        require(draft.amount > 0) { "Amount must be greater than zero." }
        require(draft.description.trim().length >= 2) { "Description must be at least 2 characters." }
        if (draft.type == TransactionType.TRANSFER) {
            require(!draft.transferAccountId.isNullOrBlank() && draft.transferAccountId != draft.accountId) {
                "Choose a different destination account."
            }
        } else require(!draft.categoryId.isNullOrBlank()) { "Choose a category." }
        val values = buildJsonObject {
            put("account_id", draft.accountId)
            put("transfer_account_id", draft.transferAccountId?.takeIf { draft.type == TransactionType.TRANSFER }?.let(::JsonPrimitive) ?: JsonNull)
            put("category_id", draft.categoryId?.takeIf { draft.type != TransactionType.TRANSFER }?.let(::JsonPrimitive) ?: JsonNull)
            put("type", draft.type.serialized); put("amount", draft.amount)
            put("description", draft.description.trim())
            put("notes", draft.notes.trim().takeIf(String::isNotEmpty)?.let(::JsonPrimitive) ?: JsonNull)
            put("transaction_date", draft.transactionDate.toString()); put("is_recurring", draft.isRecurring)
            if (draft.id == null) put("user_id", userId)
        }
        save("transactions", draft.id, values)
    }

    suspend fun saveBudget(userId: String, draft: BudgetDraft) {
        require(draft.categoryId.isNotBlank()) { "Choose a category." }
        require(draft.amount > 0) { "Amount must be greater than zero." }
        require(draft.month in 1..12 && draft.year in 2024..2100) { "Choose a valid budget month and year." }
        val values = buildJsonObject {
            put("category_id", draft.categoryId); put("amount", draft.amount)
            put("month", draft.month); put("year", draft.year)
            if (draft.id == null) put("user_id", userId)
        }
        save("budgets", draft.id, values)
    }

    suspend fun saveGoal(userId: String, draft: GoalDraft) {
        require(draft.name.trim().length >= 2) { "Goal name must be at least 2 characters." }
        require(draft.targetAmount > 0 && draft.currentAmount >= 0) { "Enter valid goal amounts." }
        val values = buildJsonObject {
            put("name", draft.name.trim()); put("target_amount", draft.targetAmount); put("current_amount", draft.currentAmount)
            put("deadline", draft.deadline?.toString()?.let(::JsonPrimitive) ?: JsonNull)
            if (draft.id == null) put("user_id", userId)
        }
        save("savings_goals", draft.id, values)
    }

    suspend fun saveRecurring(userId: String, draft: RecurringDraft) {
        require(draft.type != TransactionType.TRANSFER) { "Recurring transfers are not supported." }
        require(draft.accountId.isNotBlank() && !draft.categoryId.isNullOrBlank()) { "Choose an account and category." }
        require(draft.amount > 0 && draft.description.trim().length >= 2) { "Enter a description and positive amount." }
        val values = buildJsonObject {
            put("account_id", draft.accountId); put("category_id", draft.categoryId!!)
            put("type", draft.type.serialized); put("amount", draft.amount); put("description", draft.description.trim())
            put("frequency", draft.frequency.serialized); put("next_due_date", draft.nextDueDate.toString()); put("active", draft.active)
            if (draft.id == null) put("user_id", userId)
        }
        save("recurring_transactions", draft.id, values)
        if (draft.id != null) {
            api.delete(
                "recurring_reminders",
                listOf("recurring_transaction_id" to SpendlyApi.eq(draft.id), "dismissed_at" to SpendlyApi.isNull()),
            )
        }
        if (draft.active) generateReminders()
    }

    suspend fun toggleRecurring(item: RecurringTransaction) {
        api.update(
            "recurring_transactions", buildJsonObject { put("active", !item.active) },
            listOf("id" to SpendlyApi.eq(item.id)),
        )
        if (item.active) {
            api.delete(
                "recurring_reminders",
                listOf("recurring_transaction_id" to SpendlyApi.eq(item.id), "dismissed_at" to SpendlyApi.isNull()),
            )
        } else generateReminders()
    }

    suspend fun saveCategory(userId: String, draft: CategoryDraft, existing: Category?) {
        require(draft.name.trim().length >= 2) { "Category name must be at least 2 characters." }
        require(existing?.isDefault != true) { "Default categories cannot be edited." }
        val values = buildJsonObject {
            put("name", draft.name.trim()); put("type", draft.type.serialized)
            put("color", draft.color); put("icon", draft.icon)
            if (draft.id == null) { put("user_id", userId); put("is_default", false) }
        }
        save("categories", draft.id, values)
    }

    suspend fun deleteCategory(item: Category) {
        require(!item.isDefault) { "Default categories cannot be deleted." }
        delete("categories", item.id)
    }

    suspend fun updateProfile(userId: String, name: String, currency: CurrencyCode) {
        require(name.trim().length >= 2) { "Name must be at least 2 characters." }
        api.update(
            "profiles", buildJsonObject { put("full_name", name.trim()); put("currency", currency.name) },
            listOf("user_id" to SpendlyApi.eq(userId)),
        )
    }

    suspend fun updateReminderPreferences(userId: String, days: Int, inApp: Boolean, email: Boolean) {
        require(days in 0..30) { "Reminder lead time must be between 0 and 30 days." }
        api.update(
            "profiles",
            buildJsonObject {
                put("reminder_days_before", days); put("reminder_in_app_enabled", inApp)
                put("reminder_email_enabled", email)
            },
            listOf("user_id" to SpendlyApi.eq(userId)),
        )
        api.delete(
            "recurring_reminders",
            listOf(
                "user_id" to SpendlyApi.eq(userId), "dismissed_at" to SpendlyApi.isNull(),
                "read_at" to SpendlyApi.isNull(),
            ),
        )
        if (inApp) generateReminders()
    }

    suspend fun markReminderRead(item: RecurringReminder) =
        api.update(
            "recurring_reminders", buildJsonObject { put("read_at", java.time.Instant.now().toString()) },
            listOf("id" to SpendlyApi.eq(item.id), "dismissed_at" to SpendlyApi.isNull()),
        )

    suspend fun dismissReminder(item: RecurringReminder) {
        val now = java.time.Instant.now().toString()
        api.update(
            "recurring_reminders", buildJsonObject { put("read_at", now); put("dismissed_at", now) },
            listOf("id" to SpendlyApi.eq(item.id)),
        )
    }

    suspend fun loadDemoWorkspace(): DemoSeedResult = api.rpc("seed_spendly_demo_data")

    suspend fun importTransactions(userId: String, input: String, current: Workspace): CsvImportSummary {
        val rows = CsvService.parse(input)
        require(rows.size >= 2) { "The CSV needs a header and at least one transaction row." }
        require(rows.size <= 5001) { "Import up to 5,000 transaction rows at a time." }
        val headers = rows.first().map(::normalizeHeader)
        fun column(vararg aliases: String) = headers.indexOfFirst { it in aliases }.takeIf { it >= 0 }
        val dateColumn = column("date", "transactiondate")
        val typeColumn = column("type", "transactiontype")
        val descriptionColumn = column("description", "details", "memo")
        val amountColumn = column("amount", "value")
        val accountColumn = column("account", "accountname", "sourceaccount")
        require(listOf(dateColumn, typeColumn, descriptionColumn, amountColumn, accountColumn).none { it == null }) {
            "Missing required CSV columns: date, type, description, amount, and account."
        }
        val destinationColumn = column("destinationaccount", "destinationaccountname", "transferaccount", "toaccount")
        val categoryColumn = column("category", "categoryname")
        val notesColumn = column("notes", "note")
        val recurringColumn = column("recurring", "isrecurring")
        val accountTypeColumn = column("accounttype", "sourceaccounttype")

        data class Parsed(
            val row: Int, val date: String, val type: TransactionType, val description: String, val amount: Double,
            val account: String, val accountType: AccountType, val destination: String?, val category: String?,
            val notes: String?, val recurring: Boolean,
        )
        val parsed = mutableListOf<Parsed>()
        val errors = mutableListOf<String>()
        rows.drop(1).forEachIndexed { offset, row ->
            fun field(index: Int?) = index?.takeIf(row.indices::contains)?.let(row::get)?.trim().orEmpty()
            val rowNumber = offset + 2
            val type = when (field(typeColumn).lowercase()) {
                "income" -> TransactionType.INCOME
                "expense" -> TransactionType.EXPENSE
                "transfer" -> TransactionType.TRANSFER
                else -> null
            }
            val amount = field(amountColumn).replace(Regex("[^0-9.-]"), "").toDoubleOrNull()
            val date = runCatching { java.time.LocalDate.parse(field(dateColumn)).toString() }.getOrNull()
            val account = field(accountColumn)
            val description = field(descriptionColumn)
            val destination = field(destinationColumn).takeIf(String::isNotBlank)
            val category = field(categoryColumn).takeIf(String::isNotBlank)
            if (type == null || amount == null || amount <= 0 || date == null || account.length < 2 ||
                description.length < 2 || (type == TransactionType.TRANSFER && destination == null) ||
                (type != TransactionType.TRANSFER && category == null)
            ) {
                errors += "Row $rowNumber: invalid or missing transaction details."
            } else {
                val explicit = when (field(accountTypeColumn).lowercase()) {
                    "cash" -> AccountType.CASH; "bank" -> AccountType.BANK
                    "credit-card", "credit card" -> AccountType.CREDIT_CARD; "savings" -> AccountType.SAVINGS
                    else -> null
                }
                parsed += Parsed(
                    rowNumber, date, type, description, amount, account, explicit ?: inferAccountType(account),
                    destination.takeIf { type == TransactionType.TRANSFER }, category.takeIf { type != TransactionType.TRANSFER },
                    field(notesColumn).takeIf(String::isNotBlank),
                    field(recurringColumn).lowercase() in setOf("yes", "true", "1", "y"),
                )
            }
        }

        val accountNames = current.accounts.map { it.name.lowercase() }.toSet()
        val missingAccounts = parsed.flatMap { listOfNotNull(it.account, it.destination) }
            .distinctBy(String::lowercase).filter { it.lowercase() !in accountNames }
        if (missingAccounts.isNotEmpty()) {
            api.insert("accounts", missingAccounts.map { name ->
                val parsedType = parsed.firstOrNull { it.account.equals(name, true) }?.accountType ?: inferAccountType(name)
                buildJsonObject {
                    put("user_id", userId); put("name", name); put("type", parsedType.serialized)
                    put("balance", 0); put("currency", current.profile?.currency?.name ?: "USD")
                }
            })
        }

        val categoryKeys = current.categories.map { "${it.type.name.lowercase()}:${it.name.lowercase()}" }.toSet()
        val missingCategories = parsed.mapNotNull { item ->
            item.category?.takeIf { "${item.type.serialized}:${it.lowercase()}" !in categoryKeys }?.let { item.type to it }
        }.distinctBy { "${it.first.serialized}:${it.second.lowercase()}" }
        val palette = listOf("#14B8A6", "#22C55E", "#0EA5E9", "#F97316", "#A855F7", "#F43F5E")
        if (missingCategories.isNotEmpty()) {
            api.insert("categories", missingCategories.mapIndexed { index, (type, name) ->
                buildJsonObject {
                    put("user_id", userId); put("name", name); put("type", type.serialized)
                    put("color", palette[index % palette.size])
                    put("icon", if (type == TransactionType.INCOME) "briefcase-business" else "piggy-bank")
                    put("is_default", false)
                }
            })
        }

        val refreshed = loadWorkspace()
        val accounts = refreshed.accounts.associateBy { it.name.lowercase() }
        val categories = refreshed.categories.associateBy { "${it.type.name.lowercase()}:${it.name.lowercase()}" }
        val fingerprints = refreshed.transactions.map(::fingerprint).toMutableSet()
        val payloads = mutableListOf<JsonObject>()
        var duplicates = 0
        parsed.forEach { item ->
            val account = accounts[item.account.lowercase()]
            val destination = item.destination?.let { accounts[it.lowercase()] }
            val category = item.category?.let { categories["${item.type.serialized}:${it.lowercase()}"] }
            if (account == null || (item.type == TransactionType.TRANSFER && destination == null) ||
                (item.type != TransactionType.TRANSFER && category == null)
            ) {
                errors += "Row ${item.row}: account or category could not be resolved."
                return@forEach
            }
            val key = listOf(
                account.id, destination?.id.orEmpty(), category?.id.orEmpty(), item.type.serialized,
                "%.2f".format(java.util.Locale.US, item.amount), item.description.lowercase(), item.date,
            ).joinToString("|")
            if (!fingerprints.add(key)) {
                duplicates++
                return@forEach
            }
            payloads += buildJsonObject {
                put("user_id", userId); put("account_id", account.id)
                put("transfer_account_id", destination?.id?.let(::JsonPrimitive) ?: JsonNull)
                put("category_id", category?.id?.let(::JsonPrimitive) ?: JsonNull)
                put("type", item.type.serialized); put("amount", item.amount); put("description", item.description)
                put("notes", item.notes?.let(::JsonPrimitive) ?: JsonNull); put("transaction_date", item.date)
                put("is_recurring", item.recurring)
            }
        }
        if (payloads.isNotEmpty()) api.insert("transactions", payloads)
        return CsvImportSummary(
            processed = rows.size - 1, imported = payloads.size, duplicates = duplicates, errors = errors,
            createdAccounts = missingAccounts.sorted(), createdCategories = missingCategories.map { it.second }.sorted(),
        )
    }

    suspend fun generateReminders() = api.rpcUnit("generate_recurring_reminders", buildJsonObject { put("p_target_user_id", JsonNull) })
    suspend fun delete(table: String, id: String) = api.delete(table, listOf("id" to SpendlyApi.eq(id)))

    private suspend fun save(table: String, id: String?, values: JsonObject) {
        if (id == null) api.insert(table, listOf(values))
        else api.update(table, values, listOf("id" to SpendlyApi.eq(id)))
    }
}

private fun normalizeHeader(value: String) = value.lowercase().filter(Char::isLetter)
private fun inferAccountType(name: String): AccountType {
    val value = name.lowercase()
    return when {
        "credit" in value || "card" in value -> AccountType.CREDIT_CARD
        "saving" in value -> AccountType.SAVINGS
        "cash" in value -> AccountType.CASH
        else -> AccountType.BANK
    }
}
private fun fingerprint(item: Transaction) = listOf(
    item.accountId, item.transferAccountId.orEmpty(), item.categoryId.orEmpty(), item.type.serialized,
    "%.2f".format(java.util.Locale.US, item.amount), item.description.lowercase(), item.transactionDate,
).joinToString("|")

val AccountType.serialized get() = when (this) {
    AccountType.CASH -> "cash"; AccountType.BANK -> "bank"
    AccountType.CREDIT_CARD -> "credit-card"; AccountType.SAVINGS -> "savings"
}
val TransactionType.serialized get() = name.lowercase()
val RecurringFrequency.serialized get() = name.lowercase()
val CategoryType.serialized get() = name.lowercase()
