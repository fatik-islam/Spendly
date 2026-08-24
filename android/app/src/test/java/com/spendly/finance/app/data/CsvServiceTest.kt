package com.spendly.finance.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CsvServiceTest {
    @Test
    fun parsesQuotedCommasAndEscapedQuotes() {
        val rows = CsvService.parse(
            "date,type,description,amount,account\n" +
                "2026-08-22,expense,\"Dinner, family\",1200,Cash\n" +
                "2026-08-23,income,\"Client \"\"A\"\"\",5000,Bank"
        )
        assertEquals(3, rows.size)
        assertEquals("Dinner, family", rows[1][2])
        assertEquals("Client \"A\"", rows[2][2])
    }

    @Test
    fun exportContainsAllFinanceSections() {
        val csv = CsvService.export(Workspace(), CurrencyCode.USD)
        assertTrue(csv.contains("Accounts"))
        assertTrue(csv.contains("Transactions"))
        assertTrue(csv.contains("Budgets"))
        assertTrue(csv.contains("Savings Goals"))
        assertTrue(csv.contains("Recurring"))
    }

    @Test
    fun datasetExportMatchesTheSelectedWorkspaceSection() {
        val csv = CsvService.export(ExportDataset.TRANSACTIONS, Workspace(), CurrencyCode.USD, "alex@spendly.app")
        assertTrue(csv.startsWith("Date,Type,Description,Amount"))
        assertTrue(!csv.contains("Savings Goals"))
    }
}
