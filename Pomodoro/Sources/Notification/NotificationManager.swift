import Foundation
import UserNotifications

public final class NotificationManager: NSObject, Sendable {
    public static let shared = NotificationManager()

    public func requestPermission() async -> Bool {
        do {
            return try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            return false
        }
    }

    public func schedulePhaseEndNotification(phase: String, in seconds: TimeInterval) {
        let content = UNMutableNotificationContent()
        content.title = "\(phase) 완료"
        content.body = phase == "집중"
            ? "수고했어요! 휴식 시간입니다."
            : "휴식 끝! 다시 집중해 볼까요?"
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: max(1, seconds),
            repeats: false
        )

        let request = UNNotificationRequest(
            identifier: "phaseEnd",
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request)
    }

    public func cancelPending() {
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: ["phaseEnd"])
    }
}
