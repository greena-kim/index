import SwiftUI
import PomodoroTimer

public struct TimerView: View {
    @ObservedObject var timer: PomodoroTimer

    public init(timer: PomodoroTimer) {
        self.timer = timer
    }

    public var body: some View {
        VStack(spacing: 32) {
            phaseLabel
            timerRing
            controls
            sessionIndicators
        }
        .padding(40)
    }

    // MARK: - Components

    private var phaseLabel: some View {
        Text(timer.phase.label)
            .font(.title2)
            .fontWeight(.medium)
            .foregroundStyle(phaseColor.opacity(0.8))
    }

    private var timerRing: some View {
        ZStack {
            Circle()
                .stroke(phaseColor.opacity(0.15), lineWidth: 12)

            Circle()
                .trim(from: 0, to: timer.progress)
                .stroke(phaseColor, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.linear(duration: 0.1), value: timer.progress)

            Text(TimeFormatting.format(timer.remainingSeconds))
                .font(.system(size: 64, weight: .light, design: .monospaced))
                .contentTransition(.numericText())
        }
        .frame(width: 280, height: 280)
    }

    private var controls: some View {
        HStack(spacing: 24) {
            Button { timer.reset() } label: {
                Image(systemName: "arrow.counterclockwise")
                    .font(.title2)
                    .frame(width: 52, height: 52)
            }
            .buttonStyle(.bordered)
            .tint(.secondary)

            Button { timer.isRunning ? timer.pause() : timer.start() } label: {
                Image(systemName: timer.isRunning ? "pause.fill" : "play.fill")
                    .font(.title)
                    .frame(width: 72, height: 72)
            }
            .buttonStyle(.borderedProminent)
            .tint(phaseColor)

            Button { timer.skip() } label: {
                Image(systemName: "forward.fill")
                    .font(.title2)
                    .frame(width: 52, height: 52)
            }
            .buttonStyle(.bordered)
            .tint(.secondary)
        }
    }

    private var sessionIndicators: some View {
        HStack(spacing: 8) {
            ForEach(Array(timer.phaseIndicators.enumerated()), id: \.offset) { _, done in
                Circle()
                    .fill(done ? phaseColor : phaseColor.opacity(0.2))
                    .frame(width: 10, height: 10)
            }
        }
    }

    private var phaseColor: Color {
        switch timer.phase {
        case .focus: .red
        case .shortBreak: .green
        case .longBreak: .blue
        }
    }
}
