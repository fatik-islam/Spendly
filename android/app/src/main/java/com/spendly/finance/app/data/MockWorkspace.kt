package com.spendly.finance.app.data

import java.time.LocalDate

fun previewWorkspace(userId: String): Workspace {
    val today = LocalDate.now()
    return Workspace(
        profile = Profile("profile", userId, "Alex Morgan", CurrencyCode.PKR, 3, true, false),
        accounts = listOf(
            Account("bank", userId, "Bank", AccountType.BANK, 214_500.0, CurrencyCode.PKR),
            Account("cash", userId, "Cash", AccountType.CASH, 18_200.0, CurrencyCode.PKR),
            Account("saving", userId, "Savings", AccountType.SAVINGS, 125_000.0, CurrencyCode.PKR),
        ),
        categories = listOf(
            Category("food", userId, "Food", CategoryType.EXPENSE, "#F97316", "utensils-crossed", true),
            Category("rent", userId, "Rent", CategoryType.EXPENSE, "#14B8A6", "house", true),
            Category("salary", userId, "Salary", CategoryType.INCOME, "#22C55E", "briefcase-business", true),
            Category("travel", userId, "Travel", CategoryType.EXPENSE, "#8B5CF6", "plane", true),
        ),
        transactions = listOf(
            Transaction("t1", userId, "bank", null, "salary", TransactionType.INCOME, 320_000.0, "Monthly Salary", "Primary deposit", today.toString(), true),
            Transaction("t2", userId, "bank", null, "rent", TransactionType.EXPENSE, 95_000.0, "Apartment Rent", null, today.toString(), true),
            Transaction("t3", userId, "cash", null, "food", TransactionType.EXPENSE, 12_800.0, "Dinner and pantry run", "Family dinner", today.toString(), false),
            Transaction("t4", userId, "bank", "saving", null, TransactionType.TRANSFER, 40_000.0, "Move money to savings", null, today.toString(), false),
        ),
        budgets = listOf(
            Budget("b1", userId, "rent", 95_000.0, today.monthValue, today.year),
            Budget("b2", userId, "food", 25_000.0, today.monthValue, today.year),
        ),
        goals = listOf(
            SavingsGoal("g1", userId, "Emergency Fund", 500_000.0, 125_000.0, today.plusDays(210).toString()),
        ),
        recurring = listOf(
            RecurringTransaction(
                "r1", userId, "bank", "food", TransactionType.EXPENSE, 4_500.0,
                "Internet Bill", RecurringFrequency.MONTHLY, today.plusDays(5).toString(), true,
            ),
        ),
        reminders = listOf(
            RecurringReminder(
                "n1", userId, "r1", "upcoming", "Internet Bill is due soon",
                "Internet Bill is due in five days.", today.plusDays(5).toString(), today.toString(),
            ),
        ),
    )
}
