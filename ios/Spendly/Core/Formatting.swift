import Foundation

enum SpendlyFormat {
    static func currency(_ value: Double, code: CurrencyCode) -> String {
        value.formatted(.currency(code: code.rawValue).precision(.fractionLength(0...2)))
    }

    static func date(_ value: String) -> String {
        guard let date = value.spendlyDate else { return value }
        return DateFormatter.spendlyDisplay.string(from: date)
    }

    static func percent(_ value: Double) -> String { "\(Int(value.rounded()))%" }
}

enum CategorySymbol {
    static func systemName(for icon: String?) -> String {
        switch icon {
        case "utensils-crossed": "fork.knife"
        case "house": "house"
        case "car-taxi-front": "car"
        case "shopping-bag": "bag"
        case "heart-pulse": "heart.text.square"
        case "receipt": "receipt"
        case "briefcase-business": "briefcase"
        case "wallet-cards": "wallet.bifold"
        case "plane": "airplane"
        case "piggy-bank": "banknote"
        case "arrow-left-right": "arrow.left.arrow.right"
        case "credit-card": "creditcard"
        default: "dollarsign.circle"
        }
    }
}
