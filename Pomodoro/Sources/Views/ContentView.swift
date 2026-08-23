import SwiftUI
import PomodoroTimer
import PomodoroNotification

public struct ContentView: View {
    @StateObject private var timer = PomodoroTimer()
    @StateObject private var sessionStore = SessionStore()
    @State private var notificationGranted = false

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            Spacer()
            TimerView(timer: timer)
            Spacer()
            SessionCountView(store: sessionStore)
                .padding(.bottom, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
        .task {
            notificationGranted = await NotificationManager.shared.requestPermission()
            timer.onPhaseComplete = handlePhaseComplete
        }
        .onChange(of: timer.isRunning) { _, running in
            if running {
                NotificationManager.shared.schedulePhaseEndNotification(
                    phase: timer.phase.label,
                    in: timer.remainingSeconds
                )
            } else {
                NotificationManager.shared.cancelPending()
            }
        }
    }

    private func handlePhaseComplete(_ phase: TimerPhase) {
        if phase == .focus {
            sessionStore.recordSession()
        }
    }
}
