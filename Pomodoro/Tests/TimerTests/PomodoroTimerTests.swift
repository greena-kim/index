import XCTest
@testable import PomodoroTimer

@MainActor
final class PomodoroTimerTests: XCTestCase {

    func testInitialState() {
        let timer = PomodoroTimer()
        XCTAssertEqual(timer.phase, .focus)
        XCTAssertEqual(timer.remainingSeconds, 25 * 60)
        XCTAssertFalse(timer.isRunning)
        XCTAssertEqual(timer.completedSessions, 0)
    }

    func testStartAndPause() {
        let timer = PomodoroTimer()
        timer.start()
        XCTAssertTrue(timer.isRunning)
        timer.pause()
        XCTAssertFalse(timer.isRunning)
    }

    func testReset() {
        let timer = PomodoroTimer()
        timer.start()
        timer.pause()
        timer.reset()
        XCTAssertEqual(timer.remainingSeconds, 25 * 60)
        XCTAssertFalse(timer.isRunning)
    }

    func testSkipAdvancesPhase() {
        let timer = PomodoroTimer()
        XCTAssertEqual(timer.phase, .focus)
        timer.skip()
        XCTAssertEqual(timer.phase, .shortBreak)
        XCTAssertEqual(timer.remainingSeconds, 5 * 60)
    }

    func testPhaseIndicators() {
        let timer = PomodoroTimer()
        let indicators = timer.phaseIndicators
        XCTAssertEqual(indicators.count, 4)
        XCTAssertTrue(indicators.allSatisfy { !$0 })
    }

    func testProgressStartsAtZero() {
        let timer = PomodoroTimer()
        XCTAssertEqual(timer.progress, 0.0)
    }

    func testTimePhaseDurations() {
        XCTAssertEqual(TimerPhase.focus.duration, 1500)
        XCTAssertEqual(TimerPhase.shortBreak.duration, 300)
        XCTAssertEqual(TimerPhase.longBreak.duration, 900)
    }

    func testTimeFormatting() {
        XCTAssertEqual(TimeFormatting.format(1500), "25:00")
        XCTAssertEqual(TimeFormatting.format(300), "05:00")
        XCTAssertEqual(TimeFormatting.format(61), "01:01")
        XCTAssertEqual(TimeFormatting.format(0), "00:00")
    }
}
