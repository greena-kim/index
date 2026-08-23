import Foundation
import Combine

@MainActor
public final class PomodoroTimer: ObservableObject {
    public static let sessionsBeforeLongBreak = 4

    @Published public private(set) var phase: TimerPhase = .focus
    @Published public private(set) var remainingSeconds: TimeInterval = TimerPhase.focus.duration
    @Published public private(set) var isRunning = false
    @Published public private(set) var completedSessions: Int = 0

    public var progress: Double {
        1.0 - remainingSeconds / phase.duration
    }

    public var phaseIndicators: [Bool] {
        (0..<Self.sessionsBeforeLongBreak).map { $0 < completedSessions % Self.sessionsBeforeLongBreak }
    }

    public var onPhaseComplete: ((TimerPhase) -> Void)?

    private var timer: AnyCancellable?
    private var lastTick: Date?

    public init() {}

    // MARK: - Controls

    public func start() {
        guard !isRunning else { return }
        isRunning = true
        lastTick = Date()
        timer = Timer.publish(every: 0.1, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in self?.tick() }
    }

    public func pause() {
        isRunning = false
        timer?.cancel()
        timer = nil
        lastTick = nil
    }

    public func reset() {
        pause()
        remainingSeconds = phase.duration
    }

    public func skip() {
        pause()
        advancePhase()
    }

    // MARK: - Internals

    private func tick() {
        guard let lastTick else { return }
        let now = Date()
        let elapsed = now.timeIntervalSince(lastTick)
        self.lastTick = now

        remainingSeconds = max(0, remainingSeconds - elapsed)

        if remainingSeconds <= 0 {
            handlePhaseComplete()
        }
    }

    private func handlePhaseComplete() {
        pause()
        let completed = phase
        if phase == .focus {
            completedSessions += 1
        }
        onPhaseComplete?(completed)
        advancePhase()
    }

    private func advancePhase() {
        switch phase {
        case .focus:
            let cyclePosition = completedSessions % Self.sessionsBeforeLongBreak
            phase = cyclePosition == 0 ? .longBreak : .shortBreak
        case .shortBreak, .longBreak:
            phase = .focus
        }
        remainingSeconds = phase.duration
    }
}
