import Foundation

public enum TimeFormatting {
    public static func format(_ seconds: TimeInterval) -> String {
        let total = Int(ceil(seconds))
        let m = total / 60
        let s = total % 60
        return String(format: "%02d:%02d", m, s)
    }
}
