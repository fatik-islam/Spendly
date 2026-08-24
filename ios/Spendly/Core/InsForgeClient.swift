import Foundation

actor InsForgeClient {
    private struct APIErrorPayload: Decodable {
        let message: String?
        let error: String?
        let errorDescription: String?

        enum CodingKeys: String, CodingKey {
            case message, error
            case errorDescription = "error_description"
        }
    }

    private struct RefreshBody: Encodable {
        let refreshToken: String
        enum CodingKeys: String, CodingKey { case refreshToken = "refresh_token" }
    }

    private let configuration: AppConfiguration
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private var authSession: AuthSession?
    private var persistsSession = true

    init(configuration: AppConfiguration = .current, session: URLSession = .shared) {
        self.configuration = configuration
        self.session = session
    }

    func restoreSession() async throws -> AuthSession? {
        guard let saved = KeychainStore.load() else { return nil }
        authSession = saved

        do {
            let user: CurrentUserResponse = try await request(path: "/api/auth/sessions/current", method: "GET")
            let restored = AuthSession(user: user.user, accessToken: saved.accessToken, refreshToken: saved.refreshToken)
            try store(restored)
            return restored
        } catch {
            if saved.refreshToken != nil {
                do {
                    let refreshed = try await refresh()
                    return refreshed
                } catch {
                    clearSession()
                    return nil
                }
            }
            clearSession()
            return nil
        }
    }

    func publicAuthConfig() async throws -> AuthConfig {
        try await request(path: "/api/auth/public-config", method: "GET", requiresAuthentication: false)
    }

    func signIn(email: String, password: String, rememberMe: Bool) async throws -> AuthSession {
        try requireAnonKey()
        struct Body: Encodable { let email: String; let password: String }
        let response: AuthSession = try await request(
            path: "/api/auth/sessions?client_type=mobile",
            method: "POST",
            body: Body(email: email, password: password),
            requiresAuthentication: false
        )
        try store(response, persist: rememberMe)
        return response
    }

    func signUp(email: String, password: String, name: String) async throws -> SignUpResponse {
        try requireAnonKey()
        struct Body: Encodable { let email: String; let password: String; let name: String }
        let response: SignUpResponse = try await request(
            path: "/api/auth/users?client_type=mobile",
            method: "POST",
            body: Body(email: email, password: password, name: name),
            requiresAuthentication: false
        )
        if let user = response.user, let accessToken = response.accessToken {
            try store(AuthSession(user: user, accessToken: accessToken, refreshToken: response.refreshToken))
        }
        return response
    }

    func verifyEmail(email: String, code: String) async throws -> AuthSession {
        struct Body: Encodable { let email: String; let otp: String }
        let response: AuthSession = try await request(
            path: "/api/auth/email/verify?client_type=mobile",
            method: "POST",
            body: Body(email: email, otp: code),
            requiresAuthentication: false
        )
        try store(response)
        return response
    }

    func resendVerification(email: String) async throws {
        struct Body: Encodable { let email: String }
        try await requestVoid(
            path: "/api/auth/email/send-verification",
            method: "POST",
            body: Body(email: email),
            requiresAuthentication: false
        )
    }

    func sendPasswordReset(email: String) async throws {
        struct Body: Encodable { let email: String }
        try await requestVoid(
            path: "/api/auth/email/send-reset-password",
            method: "POST",
            body: Body(email: email),
            requiresAuthentication: false
        )
    }

    func resetPassword(email: String, code: String, newPassword: String) async throws {
        struct ExchangeBody: Encodable { let email: String; let code: String }
        let token: ResetTokenResponse = try await request(
            path: "/api/auth/email/exchange-reset-password-token",
            method: "POST",
            body: ExchangeBody(email: email, code: code),
            requiresAuthentication: false
        )
        struct ResetBody: Encodable { let newPassword: String; let otp: String }
        try await requestVoid(
            path: "/api/auth/email/reset-password",
            method: "POST",
            body: ResetBody(newPassword: newPassword, otp: token.token),
            requiresAuthentication: false
        )
    }

    func signOut() async {
        try? await requestVoid(path: "/api/auth/logout?client_type=mobile", method: "POST")
        clearSession()
    }

    func deleteCurrentUserAccount() async throws {
        struct Body: Encodable { let confirmation: String }
        try await requestVoid(
            path: "/api/account/delete",
            method: "POST",
            body: Body(confirmation: "DELETE"),
            baseURL: configuration.appBaseURL
        )
        clearSession()
    }

    func fetchRows<T: Decodable & Sendable>(
        _ table: String,
        select: String = "*",
        order: String? = nil,
        filters: [URLQueryItem] = []
    ) async throws -> [T] {
        var components = URLComponents()
        components.path = "/api/database/records/\(table)"
        components.queryItems = [URLQueryItem(name: "select", value: select)] + filters
        if let order { components.queryItems?.append(URLQueryItem(name: "order", value: order)) }
        guard let path = components.string else { throw SpendlyError.invalidResponse }
        return try await request(path: path, method: "GET")
    }

    func insert(_ table: String, rows: [[String: JSONValue]]) async throws {
        try await requestVoid(
            path: "/api/database/records/\(table)",
            method: "POST",
            body: rows,
            headers: ["Prefer": "return=minimal"]
        )
    }

    func update(_ table: String, values: [String: JSONValue], filters: [URLQueryItem]) async throws {
        var components = URLComponents()
        components.path = "/api/database/records/\(table)"
        components.queryItems = filters
        guard let path = components.string else { throw SpendlyError.invalidResponse }
        try await requestVoid(path: path, method: "PATCH", body: values, headers: ["Prefer": "return=minimal"])
    }

    func delete(_ table: String, filters: [URLQueryItem]) async throws {
        var components = URLComponents()
        components.path = "/api/database/records/\(table)"
        components.queryItems = filters
        guard let path = components.string else { throw SpendlyError.invalidResponse }
        try await requestVoid(path: path, method: "DELETE", headers: ["Prefer": "return=minimal"])
    }

    func rpc<T: Decodable & Sendable>(_ function: String, arguments: [String: JSONValue] = [:]) async throws -> T {
        try await request(path: "/api/database/rpc/\(function)", method: "POST", body: arguments)
    }

    func rpcVoid(_ function: String, arguments: [String: JSONValue] = [:]) async throws {
        try await requestVoid(path: "/api/database/rpc/\(function)", method: "POST", body: arguments)
    }

    private struct CurrentUserResponse: Decodable { let user: AuthUser }

    private func refresh() async throws -> AuthSession {
        guard let current = authSession, let refreshToken = current.refreshToken else {
            throw SpendlyError.missingSession
        }
        let refreshed: AuthSession = try await request(
            path: "/api/auth/refresh?client_type=mobile",
            method: "POST",
            body: RefreshBody(refreshToken: refreshToken),
            requiresAuthentication: false,
            allowRefresh: false
        )
        let normalized = AuthSession(
            user: refreshed.user,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken ?? refreshToken
        )
        try store(normalized)
        return normalized
    }

    private func store(_ value: AuthSession, persist: Bool? = nil) throws {
        if let persist { persistsSession = persist }
        authSession = value
        if persistsSession {
            try KeychainStore.save(value)
        } else {
            KeychainStore.clear()
        }
    }

    private func clearSession() {
        authSession = nil
        persistsSession = true
        KeychainStore.clear()
    }

    private func requireAnonKey() throws {
        if configuration.anonKey.isEmpty {
            throw SpendlyError.configuration(
                "The iOS build is missing INSFORGE_ANON_KEY. Build with the local Spendly anon key to use the shared backend."
            )
        }
    }

    private func request<Response: Decodable, Body: Encodable>(
        path: String,
        method: String,
        body: Body? = nil,
        requiresAuthentication: Bool = true,
        headers: [String: String] = [:],
        allowRefresh: Bool = true
    ) async throws -> Response {
        let data = try await perform(
            path: path,
            method: method,
            body: body,
            requiresAuthentication: requiresAuthentication,
            headers: headers,
            allowRefresh: allowRefresh
        )
        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw SpendlyError.invalidResponse
        }
    }

    private func request<Response: Decodable>(
        path: String,
        method: String,
        requiresAuthentication: Bool = true
    ) async throws -> Response {
        try await request(path: path, method: method, body: Optional<String>.none, requiresAuthentication: requiresAuthentication)
    }

    private func requestVoid<Body: Encodable>(
        path: String,
        method: String,
        body: Body? = nil,
        requiresAuthentication: Bool = true,
        headers: [String: String] = [:],
        baseURL: URL? = nil
    ) async throws {
        _ = try await perform(
            path: path,
            method: method,
            body: body,
            requiresAuthentication: requiresAuthentication,
            headers: headers,
            baseURL: baseURL
        )
    }

    private func requestVoid(
        path: String,
        method: String,
        requiresAuthentication: Bool = true,
        headers: [String: String] = [:]
    ) async throws {
        try await requestVoid(
            path: path,
            method: method,
            body: Optional<String>.none,
            requiresAuthentication: requiresAuthentication,
            headers: headers
        )
    }

    private func perform<Body: Encodable>(
        path: String,
        method: String,
        body: Body?,
        requiresAuthentication: Bool,
        headers: [String: String],
        allowRefresh: Bool = true,
        baseURL: URL? = nil
    ) async throws -> Data {
        guard let url = URL(string: path, relativeTo: baseURL ?? configuration.baseURL) else {
            throw SpendlyError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        headers.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }

        if requiresAuthentication {
            guard let accessToken = authSession?.accessToken else { throw SpendlyError.missingSession }
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        } else if !configuration.anonKey.isEmpty {
            request.setValue("Bearer \(configuration.anonKey)", forHTTPHeaderField: "Authorization")
        }

        if let body { request.httpBody = try encoder.encode(body) }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw SpendlyError.invalidResponse }

        if http.statusCode == 401, requiresAuthentication, allowRefresh, authSession?.refreshToken != nil {
            _ = try await refresh()
            return try await perform(
                path: path,
                method: method,
                body: body,
                requiresAuthentication: requiresAuthentication,
                headers: headers,
                allowRefresh: false,
                baseURL: baseURL
            )
        }

        guard (200..<300).contains(http.statusCode) else {
            let payload = try? decoder.decode(APIErrorPayload.self, from: data)
            let message = payload?.message ?? payload?.errorDescription ?? payload?.error ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
            throw SpendlyError.api(status: http.statusCode, message: message)
        }
        return data.isEmpty ? Data("{}".utf8) : data
    }
}
