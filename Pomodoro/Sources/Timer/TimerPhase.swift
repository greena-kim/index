import Foundation

public enum TimerPhase: Equatable, Sendable {
    case focus
    case shortBreak
    case longBreak

    public var duration: TimeInterval {
        switch self {
        case .focus: 25 * 60
        case .shortBreak: 5 * 60
        case .longBreak: 15 * 60
        }
    }

    public var label: String {
        switch self {
        case .focus: "집중"
        case .shortBreak: "짧은 휴식"
        case .longBreak: "긴 휴식"
        }
    }
}
