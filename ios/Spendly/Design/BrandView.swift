import SwiftUI

struct BrandView: View {
    @Environment(\.colorScheme) private var colorScheme
    var compact = false

    var body: some View {
        HStack(spacing: 12) {
            Image("Brand")
                .resizable()
                .scaledToFill()
                .frame(width: compact ? 38 : 52, height: compact ? 38 : 52)
                .clipShape(RoundedRectangle(cornerRadius: compact ? 12 : 17, style: .continuous))
                .shadow(color: SpendlyTheme.navy.opacity(0.15), radius: 10, y: 5)
            Text("Spendly")
                .font(compact ? .headline : .title2.bold())
                .foregroundStyle(colorScheme == .dark ? Color.white : SpendlyTheme.navy)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Spendly")
    }
}

struct AnimatedLaunchView: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var isRevealed = false
    @State private var isBreathing = false
    @State private var dotsAreActive = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: launchBackgroundColors,
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            Circle()
                .fill(SpendlyTheme.teal.opacity(colorScheme == .dark ? 0.18 : 0.13))
                .frame(width: 330, height: 330)
                .blur(radius: 72)
                .offset(x: isBreathing ? 90 : 55, y: isBreathing ? -250 : -210)

            Circle()
                .fill(SpendlyTheme.cyan.opacity(colorScheme == .dark ? 0.14 : 0.10))
                .frame(width: 280, height: 280)
                .blur(radius: 68)
                .offset(x: isBreathing ? -90 : -55, y: isBreathing ? 285 : 245)

            VStack(spacing: 22) {
                ZStack {
                    RoundedRectangle(cornerRadius: 31, style: .continuous)
                        .stroke(
                            colorScheme == .dark ? Color.white.opacity(0.14) : SpendlyTheme.navy.opacity(0.10),
                            lineWidth: 1
                        )
                        .frame(width: 132, height: 132)
                        .scaleEffect(isBreathing ? 1.08 : 0.98)

                    Image("Brand")
                        .resizable()
                        .scaledToFill()
                        .frame(width: 116, height: 116)
                        .clipShape(RoundedRectangle(cornerRadius: 27, style: .continuous))
                        .shadow(
                            color: colorScheme == .dark ? Color.black.opacity(0.34) : SpendlyTheme.navy.opacity(0.17),
                            radius: 24,
                            y: 14
                        )
                }
                .scaleEffect(isRevealed ? 1 : 0.74)
                .opacity(isRevealed ? 1 : 0)

                Text("Spendly")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(colorScheme == .dark ? Color.white : SpendlyTheme.navy)
                    .tracking(isRevealed ? 0.2 : 2.5)
                    .opacity(isRevealed ? 1 : 0)
                    .offset(y: isRevealed ? 0 : 10)

                HStack(spacing: 7) {
                    ForEach(0..<3, id: \.self) { index in
                        Circle()
                            .fill(index == 1 ? SpendlyTheme.cyan : SpendlyTheme.teal)
                            .frame(width: 7, height: 7)
                            .scaleEffect(dotsAreActive ? 1 : 0.5)
                            .opacity(dotsAreActive ? 1 : 0.35)
                            .animation(
                                .easeInOut(duration: 0.68)
                                    .repeatForever(autoreverses: true)
                                    .delay(Double(index) * 0.16),
                                value: dotsAreActive
                            )
                    }
                }
                .padding(.top, 2)
                .opacity(isRevealed ? 1 : 0)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Spendly is loading")
        .onAppear {
            withAnimation(.spring(response: 0.72, dampingFraction: 0.76)) {
                isRevealed = true
            }
            withAnimation(.easeInOut(duration: 2.3).repeatForever(autoreverses: true)) {
                isBreathing = true
            }
            dotsAreActive = true
        }
    }

    private var launchBackgroundColors: [Color] {
        if colorScheme == .dark {
            return [
                Color(red: 0.015, green: 0.055, blue: 0.075),
                Color(red: 0.015, green: 0.095, blue: 0.105),
                Color(red: 0.018, green: 0.045, blue: 0.085)
            ]
        }
        return [
            Color(red: 0.96, green: 0.98, blue: 0.99),
            Color(red: 0.91, green: 0.97, blue: 0.97),
            Color(red: 0.95, green: 0.97, blue: 0.99)
        ]
    }
}
