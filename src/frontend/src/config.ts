import {TestType} from "./components/test-commons.ts";

export const config = {
    webSocketEndpoint: 'ws://localhost:8000/ws',
    apiEndpoint: 'http://localhost:8000/api',
    SERVER_RECONNECT_TIMEOUT: 3000,  // milliseconds before re-try to reconnect
    CRITICAL_FORCE_SUSTAIN_DURATION: 60, // seconds of pull time 60
    COUNTDOWN: 10, // seconds countdown before test
    TIMER_REFRESH_RATE: 50, // milliseconds to refresh the timer
    REPEATER_PULL_DURATION: 7, // seconds of pulling
    REPEATER_REST_DURATION: 3, // seconds of resting
    REPEATERS_SETS: 24, // 4 minutes 24
    PEAK_FORCE_PULL_DURATION: 4,
    PEAK_FORCE_REST_DURATION: 60, // 3
    PEAK_FORCE_NUMBER_SETS: 3, // 3
}

export interface TestParams {
    testIdPrefix: string;
    testTitle: string;
    testSubtitle?: string;
    testDescription?: string;
    pullDuration: number;
    restDuration: number;
    numberSets: number;
}

export function testTypeParams(testType: TestType): TestParams {
    switch (testType) {
        case TestType.CRITICAL_FORCE_REPEATERS:
            return {
                testIdPrefix: 'TEST_CF_S_',
                testTitle: 'Critical Force Test',
                testSubtitle: '7:3 repeaters',
                pullDuration: config.REPEATER_PULL_DURATION,
                restDuration: config.REPEATER_REST_DURATION,
                numberSets: config.REPEATERS_SETS,
            }
        case TestType.CRITICAL_FORCE_SUSTAINED:
            return {
                testIdPrefix: 'TEST_CF_R_',
                testTitle: 'Critical Force Test',
                testSubtitle: 'Sustained pull',
                pullDuration: config.CRITICAL_FORCE_SUSTAIN_DURATION,
                restDuration: 0,
                numberSets: 1,
            }
        case TestType.PEAK_FORCE:
            return {
                testIdPrefix: 'TEST_PF_',
                testTitle: 'Peak Force Test',
                testDescription: "Warm up to ~80% of expected maximum and take 3-5 minutes rest. Each pull build force over 1-2 seconds.",
                pullDuration: config.PEAK_FORCE_PULL_DURATION,
                restDuration: config.PEAK_FORCE_REST_DURATION,
                numberSets: config.PEAK_FORCE_NUMBER_SETS,
            }
    }
}