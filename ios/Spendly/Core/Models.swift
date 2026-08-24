import Foundation

@propertyWrapper
struct FlexibleDouble: Codable, Hashable, Sendable {
    var wrappedValue: Double

    init(wrappedValue: Double) {
        self.wrappedValue = wrappedValue
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let number = try? container.decode(Double.self) {
            wrappedValue = number
        } else if let text = try? container.decode(String.self), let number = Double(text) {
            wrappedValue = number
        } else {
            wrappedValue = 0
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(wrappedValue)
    }
}

enum JSONValue: Encodable, Sendable {
    case string(String)
    case number(Double)
    case integer(Int)
    case boolean(Bool)
    case null

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .integer(let value): try container.encode(value)
        case .boolean(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}

enum CurrencyCode: String, Codable, CaseIterable, Identifiable, Sendable {
    case usd = "USD", eur = "EUR", gbp = "GBP", cad = "CAD", aud = "AUD"
    case pkr = "PKR", aed = "AED", sar = "SAR"
    var id: String { rawValue }
}

enum AccountType: String, Codable, CaseIterable, Identifiable, Sendable {
    case cash, bank, creditCard = "credit-card", savings
    var id: String { rawValue }
    var title: String { rawValue.replacingOccurrences(of: "-", with: " ").capitalized }
    var symbol: String {
        switch self {
        case .cash: "banknote"
        case .bank: "building.columns"
        case .creditCard: "creditcard"
        case .savings: "building.columns.fill"
        }
    }
}

enum CategoryType: String, Codable, CaseIterable, Identifiable, Sendable {
    case income, expense
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

enum TransactionType: String, Codable, CaseIterable, Identifiable, Sendable {
    case income, expense, transfer
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
    var symbol: String {
        switch self {
        case .income: "arrow.down.left"
        case .expense: "arrow.up.right"
        case .transfer: "arrow.left.arrow.right"
        }
    }
}

enum RecurringFrequency: String, Codable, CaseIterable, Identifiable, Sendable {
    case weekly, monthly, yearly
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

struct AuthIdentityProfile: Codable, Hashable, Sendable {
    var name: String?
    var avatarURL: String?

    enum CodingKeys: String, CodingKey {
        case name
        case avatarURL = "avatar_url"
    }
}

struct AuthUser: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let email: String
    let emailVerified: Bool?
    let profile: AuthIdentityProfile?
}

struct AuthSession: Codable, Hashable, Sendable {
    let user: AuthUser
    let accessToken: String
    let refreshToken: String?
}

struct SignUpResponse: Codable, Sendable {
    let user: AuthUser?
    let accessToken: String?
    let refreshToken: String?
    let requireEmailVerification: Bool?
}

struct AuthConfig: Codable, Sendable {
    let requireEmailVerification: Bool
    let passwordMinLength: Int
    let requireNumber: Bool
    let requireLowercase: Bool
    let requireUppercase: Bool
    let requireSpecialChar: Bool
    let verifyEmailMethod: String
    let resetPasswordMethod: String
    let disableSignup: Bool

    static let fallback = AuthConfig(
        requireEmailVerification: true,
        passwordMinLength: 6,
        requireNumber: false,
        requireLowercase: false,
        requireUppercase: false,
        requireSpecialChar: false,
        verifyEmailMethod: "code",
        resetPasswordMethod: "code",
        disableSignup: false
    )
}

struct Profile: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let userID: String
    var fullName: String?
    var currency: CurrencyCode
    var reminderDaysBefore: Int
    var reminderInAppEnabled: Bool
    var reminderEmailEnabled: Bool
    let createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case fullName = "full_name"
        case currency
        case reminderDaysBefore = "reminder_days_before"
        case reminderInAppEnabled = "reminder_in_app_enabled"
        case reminderEmailEnabled = "reminder_email_enabled"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct Account: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let userID: String
    var name: String
    var type: AccountType
    @FlexibleDouble var balance: Double
    var currency: CurrencyCode
    let createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case name, type, balance, currency
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct Category: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let userID: String
    var name: String
    var type: CategoryType
    var color: String
    var icon: String
    let isDefault: Bool
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case name, type, color, icon
        case isDefault = "is_default"
        case createdAt = "created_at"
    }
}

struct Transaction: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let userID: String
    var accountID: String
    var transferAccountID: String?
    var categoryID: String?
    var type: TransactionType
    @FlexibleDouble var amount: Double
    var description: String
    var notes: String?
    var transactionDate: String
    var isRecurring: Bool
    let createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case accountID = "account_id"
        case transferAccountID = "transfer_account_id"
        case categoryID = "category_id"
        case type, amount, description, notes
        case transactionDate = "transaction_date"
        case isRecurring = "is_recurring"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct Budget: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let userID: String
    var categoryID: String
    @FlexibleDouble var amount: Double
    var month: Int
    var year: Int
    let createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case categoryID = "category_id"
        case amount, month, year
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct SavingsGoal: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let userID: String
    var name: String
    @FlexibleDouble var targetAmount: Double
    @FlexibleDouble var currentAmount: Double
    var deadline: String?
    let createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case name
        case targetAmount = "target_amount"
        case currentAmount = "current_amount"
        case deadline
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct RecurringTransaction: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let userID: String
    var accountID: String
    var categoryID: String?
    var type: TransactionType
    @FlexibleDouble var amount: Double
    var description: String
    var frequency: RecurringFrequency
    var nextDueDate: String
    var active: Bool
    let createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case accountID = "account_id"
        case categoryID = "category_id"
        case type, amount, description, frequency
        case nextDueDate = "next_due_date"
        case active
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct RecurringReminder: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let userID: String
    let recurringTransactionID: String
    let kind: String
    let title: String
    let body: String
    let dueDate: String
    let remindOn: String
    let emailSentAt: String?
    let emailLastError: String?
    var readAt: String?
    var dismissedAt: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case recurringTransactionID = "recurring_transaction_id"
        case kind, title, body
        case dueDate = "due_date"
        case remindOn = "remind_on"
        case emailSentAt = "email_sent_at"
        case emailLastError = "email_last_error"
        case readAt = "read_at"
        case dismissedAt = "dismissed_at"
        case createdAt = "created_at"
    }
}

struct AccountDraft: Identifiable, Sendable {
    var id: String?
    var name = ""
    var type: AccountType = .cash
    var balance = 0.0
    var currency: CurrencyCode = .usd
}

struct TransactionDraft: Identifiable, Sendable {
    var id: String?
    var accountID = ""
    var transferAccountID: String?
    var categoryID: String?
    var type: TransactionType = .expense
    var amount = 0.0
    var description = ""
    var notes = ""
    var transactionDate = Date()
    var isRecurring = false
}

struct BudgetDraft: Identifiable, Sendable {
    var id: String?
    var categoryID = ""
    var amount = 0.0
    var month = Calendar.current.component(.month, from: Date())
    var year = Calendar.current.component(.year, from: Date())
}

struct GoalDraft: Identifiable, Sendable {
    var id: String?
    var name = ""
    var targetAmount = 0.0
    var currentAmount = 0.0
    var deadline: Date?
}

struct RecurringDraft: Identifiable, Sendable {
    var id: String?
    var accountID = ""
    var categoryID: String?
    var type: TransactionType = .expense
    var amount = 0.0
    var description = ""
    var frequency: RecurringFrequency = .monthly
    var nextDueDate = Date()
    var active = true
}

struct CategoryDraft: Identifiable, Sendable {
    var id: String?
    var name = ""
    var type: CategoryType = .expense
    var color = "#14B8A6"
    var icon = "piggy-bank"
}

struct BudgetProgress: Identifiable, Hashable, Sendable {
    let id: String
    let budget: Budget
    let category: Category?
    let spent: Double
    let progress: Double
    var remaining: Double { budget.amount - spent }
}

struct CategorySpend: Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let color: String
    let amount: Double
}

struct MonthlyCashFlow: Identifiable, Hashable, Sendable {
    let id: String
    let label: String
    let income: Double
    let expense: Double
    var savings: Double { income - expense }
}

struct DemoSeedResult: Codable, Sendable {
    let transactions: Int
    let budgets: Int
    let goals: Int
    let recurringTransactions: Int
}

struct ResetTokenResponse: Codable, Sendable {
    let token: String
}

struct MessageResponse: Codable, Sendable {
    let success: Bool?
    let message: String?
}

enum AppSessionState: Equatable, Sendable {
    case launching
    case signedOut
    case signedIn
}

enum SignUpOutcome: Sendable {
    case authenticated
    case verificationRequired(email: String)
}
