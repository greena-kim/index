// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Pomodoro",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(name: "PomodoroTimer", targets: ["PomodoroTimer"]),
        .library(name: "PomodoroViews", targets: ["PomodoroViews"]),
    ],
    targets: [
        .target(
            name: "PomodoroTimer",
            path: "Sources/Timer"
        ),
        .target(
            name: "PomodoroNotification",
            path: "Sources/Notification"
        ),
        .target(
            name: "PomodoroStorage",
            path: "Sources/Storage"
        ),
        .target(
            name: "PomodoroViews",
            dependencies: ["PomodoroTimer", "PomodoroNotification", "PomodoroStorage"],
            path: "Sources/Views"
        ),
        .executableTarget(
            name: "PomodoroApp",
            dependencies: ["PomodoroViews"],
            path: "Sources/App"
        ),
        .testTarget(
            name: "PomodoroTimerTests",
            dependencies: ["PomodoroTimer"],
            path: "Tests/TimerTests"
        ),
    ]
)
