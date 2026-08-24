import SwiftUI

enum SpendlyTheme {
    static let teal = Color(red: 0.08, green: 0.72, blue: 0.65)
    static let navy = Color(red: 0.02, green: 0.12, blue: 0.32)
    static let cyan = Color(red: 0.03, green: 0.70, blue: 0.78)
    static let income = Color(red: 0.13, green: 0.77, blue: 0.37)
    static let expense = Color(red: 0.96, green: 0.25, blue: 0.37)
    static let amber = Color(red: 0.96, green: 0.62, blue: 0.10)
    static let radius: CGFloat = 24

    static func color(hex: String) -> Color {
        let clean = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        guard let value = UInt64(clean, radix: 16) else { return teal }
        let red = Double((value >> 16) & 0xFF) / 255
        let green = Double((value >> 8) & 0xFF) / 255
        let blue = Double(value & 0xFF) / 255
        return Color(red: red, green: green, blue: blue)
    }
}

struct SpendlyBackground: View {
    var body: some View {
        ZStack {
            Color(.systemGroupedBackground)
            RadialGradient(
                colors: [SpendlyTheme.teal.opacity(0.16), .clear],
                center: .topLeading,
                startRadius: 10,
                endRadius: 420
            )
            RadialGradient(
                colors: [SpendlyTheme.cyan.opacity(0.12), .clear],
                center: .topTrailing,
                startRadius: 10,
                endRadius: 360
            )
        }
        .ignoresSafeArea()
    }
}

struct SurfaceCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: SpendlyTheme.radius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: SpendlyTheme.radius, style: .continuous)
                    .stroke(.primary.opacity(0.07), lineWidth: 1)
            }
    }
}

struct GlassAction<Content: View>: View {
    let tint: Color?
    let interactive: Bool
    let content: Content

    init(tint: Color? = nil, interactive: Bool = true, @ViewBuilder content: () -> Content) {
        self.tint = tint
        self.interactive = interactive
        self.content = content()
    }

    @ViewBuilder
    var body: some View {
        if #available(iOS 26.0, *) {
            content
                .glassEffect(
                    interactive
                        ? .regular.tint(tint).interactive()
                        : .regular.tint(tint),
                    in: .rect(cornerRadius: 18)
                )
        } else {
            content
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke((tint ?? .primary).opacity(0.16), lineWidth: 1)
                }
        }
    }
}

struct PrimaryActionButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundStyle(.white)
            .background(
                LinearGradient(colors: [SpendlyTheme.teal, SpendlyTheme.cyan], startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: 17, style: .continuous)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
    }
}

struct MetricTile: View {
    let title: String
    let value: String
    let note: String
    let symbol: String
    var tint: Color = SpendlyTheme.teal

    var body: some View {
        SurfaceCard {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(title).font(.subheadline).foregroundStyle(.secondary)
                    Text(value)
                        .font(.title3.bold())
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                        .allowsTightening(true)
                    Text(note).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                }
                Spacer(minLength: 4)
                Image(systemName: symbol)
                    .font(.headline)
                    .foregroundStyle(tint)
                    .padding(10)
                    .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }
}

struct SectionHeading: View {
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.title2.bold())
            if let subtitle { Text(subtitle).font(.subheadline).foregroundStyle(.secondary) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct EmptyFeatureView: View {
    let symbol: String
    let title: String
    let message: String

    var body: some View {
        SurfaceCard {
            VStack(spacing: 12) {
                Image(systemName: symbol)
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(SpendlyTheme.teal)
                    .padding(14)
                    .background(SpendlyTheme.teal.opacity(0.12), in: RoundedRectangle(cornerRadius: 18))
                Text(title).font(.headline)
                Text(message).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)
        }
    }
}

struct LoadingOverlay: View {
    var body: some View {
        ZStack {
            Color.black.opacity(0.12).ignoresSafeArea()
            ProgressView()
                .controlSize(.large)
                .padding(24)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
        .transition(.opacity)
    }
}

extension View {
    func spendlyPage() -> some View {
        scrollContentBackground(.hidden).background(SpendlyBackground())
    }
}
