import SwiftUI
import PomodoroTimer

public struct SessionCountView: View {
    @ObservedObject var store: SessionStore

    public init(store: SessionStore) {
        self.store = store
    }

    public var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
            Text("오늘 \(store.todayCount)세션 완료")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}
