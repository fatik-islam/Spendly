package com.spendly.finance.app.data

import java.util.Locale

object CsvService {
    fun parse(input: String): List<List<String>> {
        val rows = mutableListOf<List<String>>()
        var row = mutableListOf<String>()
        val field = StringBuilder()
        var quoted = false
        var index = 0
        while (index < input.length) {
            val char = input[index]
            when {
                char == '"' && quoted && index + 1 < input.length && input[index + 1] == '"' -> {
                    field.append('"'); index++
                }
                char == '"' -> quoted = !quoted
                char == ',' && !quoted -> { row.add(field.toString()); field.clear() }
                (char == '\n' || char == '\r') && !quoted -> {
                    if (char == '\r' && index + 1 < input.length && input[index + 1] == '\n') index++
                    row.add(field.toString()); field.clear()
                    if (row.any(String::isNotBlank)) rows.add(row)
                    row = mutableListOf()
                }
                else -> field.append(char)
            }
            index++
        }
        row.add(field.toString())
        if (row.any(String::isNotBlank)) rows.add(row)
        return rows
    }

    fun export(workspace: Workspace, currency: CurrencyCode): String {
        val rows = mutableListOf<List<String>>()
        fun section(name: String, header: List<String>, data: List<List<String>>) {
            if (rows.isNotEmpty()) rows.add(emptyList())
            rows += listOf(name); rows += header; rows += data
        }
        section("Accounts", listOf("Name", "Type", "Balance", "Currency"), workspace.accounts.map {
            listOf(it.name, it.type.serialized, "%.2f".format(Locale.US, it.balance), it.currency.name)
        })
        section(
            "Transactions",
            listOf("Date", "Type", "Description", "Amount", "Currency", "Account", "Destination Account", "Category", "Notes", "Recurring"),
            workspace.transactions.map {
                listOf(
                    it.transactionDate, it.type.serialized, it.description, "%.2f".format(Locale.US, it.amount), currency.name,
                    workspace.accounts.firstOrNull { account -> account.id == it.accountId }?.name.orEmpty(),
                    workspace.accounts.firstOrNull { account -> account.id == it.transferAccountId }?.name.orEmpty(),
                    workspace.categories.firstOrNull { category -> category.id == it.categoryId }?.name.orEmpty(),
                    it.notes.orEmpty(), if (it.isRecurring) "Yes" else "No",
                )
            },
        )
        section("Budgets", listOf("Category", "Amount", "Currency", "Month", "Year"), workspace.budgets.map {
            listOf(workspace.categories.firstOrNull { category -> category.id == it.categoryId }?.name.orEmpty(), "%.2f".format(Locale.US, it.amount), currency.name, it.month.toString(), it.year.toString())
        })
        section("Savings Goals", listOf("Name", "Target", "Current", "Currency", "Deadline"), workspace.goals.map {
            listOf(it.name, "%.2f".format(Locale.US, it.targetAmount), "%.2f".format(Locale.US, it.currentAmount), currency.name, it.deadline.orEmpty())
        })
        section("Recurring", listOf("Type", "Description", "Amount", "Currency", "Frequency", "Next Due Date", "Account", "Category", "Active"), workspace.recurring.map {
            listOf(
                it.type.serialized, it.description, "%.2f".format(Locale.US, it.amount), currency.name, it.frequency.serialized,
                it.nextDueDate, workspace.accounts.firstOrNull { account -> account.id == it.accountId }?.name.orEmpty(),
                workspace.categories.firstOrNull { category -> category.id == it.categoryId }?.name.orEmpty(), if (it.active) "Yes" else "No",
            )
        })
        return rows.joinToString("\n") { row -> row.joinToString(",") { escape(it) } }
    }

    fun export(dataset: ExportDataset, workspace: Workspace, currency: CurrencyCode, email: String): String {
        val rows: List<List<String>> = when (dataset) {
            ExportDataset.PROFILE -> listOf(
                listOf("Email", "Full Name", "Currency", "Reminder Days Before", "In-App Reminders", "Email Reminders"),
                listOf(
                    email, workspace.profile?.fullName.orEmpty(), currency.name,
                    (workspace.profile?.reminderDaysBefore ?: 3).toString(),
                    yesNo(workspace.profile?.reminderInAppEnabled ?: true), yesNo(workspace.profile?.reminderEmailEnabled ?: false),
                ),
            )
            ExportDataset.ACCOUNTS -> listOf(listOf("Name", "Type", "Balance", "Currency", "Created At", "Updated At")) + workspace.accounts.map {
                listOf(it.name, it.type.serialized, "%.2f".format(Locale.US, it.balance), it.currency.name, it.createdAt, it.updatedAt)
            }
            ExportDataset.CATEGORIES -> listOf(listOf("Name", "Type", "Color", "Icon", "Default", "Created At")) + workspace.categories.map {
                listOf(it.name, it.type.serialized, it.color, it.icon, yesNo(it.isDefault), it.createdAt)
            }
            ExportDataset.TRANSACTIONS -> listOf(listOf("Date", "Type", "Description", "Amount", "Currency", "Account", "Destination Account", "Category", "Notes", "Recurring", "Created At", "Updated At")) + workspace.transactions.map {
                listOf(
                    it.transactionDate, it.type.serialized, it.description, "%.2f".format(Locale.US, it.amount), currency.name,
                    workspace.accounts.firstOrNull { account -> account.id == it.accountId }?.name.orEmpty(),
                    workspace.accounts.firstOrNull { account -> account.id == it.transferAccountId }?.name.orEmpty(),
                    workspace.categories.firstOrNull { category -> category.id == it.categoryId }?.name.orEmpty(),
                    it.notes.orEmpty(), yesNo(it.isRecurring), it.createdAt, it.updatedAt,
                )
            }
            ExportDataset.BUDGETS -> listOf(listOf("Category", "Amount", "Currency", "Month", "Year", "Created At", "Updated At")) + workspace.budgets.map {
                listOf(workspace.categories.firstOrNull { category -> category.id == it.categoryId }?.name.orEmpty(), "%.2f".format(Locale.US, it.amount), currency.name, it.month.toString(), it.year.toString(), it.createdAt, it.updatedAt)
            }
            ExportDataset.GOALS -> listOf(listOf("Name", "Target Amount", "Current Amount", "Currency", "Deadline", "Created At", "Updated At")) + workspace.goals.map {
                listOf(it.name, "%.2f".format(Locale.US, it.targetAmount), "%.2f".format(Locale.US, it.currentAmount), currency.name, it.deadline.orEmpty(), it.createdAt, it.updatedAt)
            }
            ExportDataset.RECURRING -> listOf(listOf("Type", "Description", "Amount", "Currency", "Frequency", "Next Due Date", "Account", "Category", "Active", "Created At", "Updated At")) + workspace.recurring.map {
                listOf(
                    it.type.serialized, it.description, "%.2f".format(Locale.US, it.amount), currency.name, it.frequency.serialized,
                    it.nextDueDate, workspace.accounts.firstOrNull { account -> account.id == it.accountId }?.name.orEmpty(),
                    workspace.categories.firstOrNull { category -> category.id == it.categoryId }?.name.orEmpty(), yesNo(it.active), it.createdAt, it.updatedAt,
                )
            }
        }
        return rows.joinToString("\n") { row -> row.joinToString(",") { escape(it) } }
    }

    private fun escape(value: String): String =
        if (value.any { it == ',' || it == '"' || it == '\n' }) "\"${value.replace("\"", "\"\"")}\"" else value

    private fun yesNo(value: Boolean) = if (value) "Yes" else "No"
}
