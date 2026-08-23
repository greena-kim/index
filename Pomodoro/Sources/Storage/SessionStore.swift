import Foundation

public final class SessionStore: ObservableObject {
    private static let key = "completedSessions"
    private static let dateKey = "lastSessionDate"

    @Published public private(set) var todayCount: Int

    public init() {
        if Self.isToday(Self.loadLastDate()) {
            todayCount = UserDefaults.standard.integer(forKey: Self.key)
        } else {
            todayCount = 0
        }
    }

    public func recordSession() {
        if !Self.isToday(Self.loadLastDate()) {
            todayCount = 0
        }
        todayCount += 1
        UserDefaults.standard.set(todayCount, forKey: Self.key)
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: Self.dateKey)
    }

    private static func loadLastDate() -> Date? {
        let ts = UserDefaults.standard.double(forKey: dateKey)
        return ts > 0 ? Date(timeIntervalSince1970: ts) : nil
    }

    private static func isToday(_ date: Date?) -> Bool {
        guard let date else { return false }
        return Calendar.current.isDateInToday(date)
    }
}
