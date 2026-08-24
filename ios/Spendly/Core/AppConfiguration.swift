import Foundation

struct AppConfiguration: Sendable {
    let baseURL: URL
    let appBaseURL: URL
    let anonKey: String

    static var current: AppConfiguration {
        let dictionary = Bundle.main.infoDictionary ?? [:]
        let rawURL = dictionary["INSFORGE_BASE_URL"] as? String ?? "https://8893aiqk.us-east.insforge.app"
        let rawAppURL = dictionary["SPENDLY_APP_BASE_URL"] as? String ?? "https://spendly.syedfatikislam.com"
        let rawKey = ProcessInfo.processInfo.environment["SPENDLY_INSFORGE_ANON_KEY"]
            ?? dictionary["INSFORGE_ANON_KEY"] as? String
            ?? ""

        guard let baseURL = URL(string: rawURL) else {
            preconditionFailure("INSFORGE_BASE_URL is invalid")
        }
        guard let appBaseURL = URL(string: rawAppURL) else {
            preconditionFailure("SPENDLY_APP_BASE_URL is invalid")
        }

        return AppConfiguration(baseURL: baseURL, appBaseURL: appBaseURL, anonKey: rawKey)
    }
}

enum SpendlyError: LocalizedError, Sendable {
    case configuration(String)
    case invalidResponse
    case api(status: Int, message: String)
    case validation(String)
    case missingSession

    var errorDescription: String? {
        switch self {
        case .configuration(let message), .validation(let message): message
        case .invalidResponse: "Spendly received an unexpected response."
        case .api(_, let message): message
        case .missingSession: "Your session has expired. Sign in again."
        }
    }
}

extension Date {
    var spendlyDateString: String {
        DateFormatter.spendlyDatabase.string(from: self)
    }
}

extension DateFormatter {
    static let spendlyDatabase: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static let spendlyDisplay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()
}

extension String {
    var spendlyDate: Date? { DateFormatter.spendlyDatabase.date(from: self) }
}
