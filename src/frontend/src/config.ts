import {type RepeaterStructure, WorkoutType} from "./components/workout-commons.ts";

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

export interface WorkoutParams {
    isAssessment: boolean
    isMaxPull: boolean
    workoutIdPrefix: string
    workoutTitle: string
    workoutSubtitle?: string
    workoutDescription?: string
    repeaterStructure?: RepeaterStructure
}

export const defaultRepeaterStructure: RepeaterStructure = {
    countdown: config.COUNTDOWN,
    pullDuration: config.REPEATER_PULL_DURATION,
    restRepsDuration: config.REPEATER_REST_DURATION,
    numberReps: 1,
    numberSets: 1,
    restSetsDuration: 60,
}

export function workoutParamsPresets(workoutType: WorkoutType): WorkoutParams {
    switch (workoutType) {
        case WorkoutType.CRITICAL_FORCE_TEST_REPEATERS:
            return {
                isAssessment: true,
                isMaxPull: true,
                workoutIdPrefix: 'TEST_CF_S_',
                workoutTitle: 'Critical Force Test',
                workoutSubtitle: '7:3 repeaters',
                repeaterStructure: {
                    countdown: config.COUNTDOWN,
                    pullDuration: config.REPEATER_PULL_DURATION,
                    restRepsDuration: config.REPEATER_REST_DURATION,
                    numberReps: config.REPEATERS_SETS,
                    numberSets: 1,
                    restSetsDuration: 0,
                },
            }
        case WorkoutType.CRITICAL_FORCE_TEST_SUSTAINED:
            return {
                isAssessment: true,
                isMaxPull: true,
                workoutIdPrefix: 'TEST_CF_R_',
                workoutTitle: 'Critical Force Test',
                workoutSubtitle: 'Sustained pull',
                repeaterStructure: {
                    countdown: config.COUNTDOWN,
                    pullDuration: config.CRITICAL_FORCE_SUSTAIN_DURATION,
                    numberReps: 1,
                    numberSets: 1,
                    restRepsDuration: 0,
                    restSetsDuration: 0,
                },
            }
        case WorkoutType.PEAK_FORCE_TEST:
            return {
                isAssessment: true,
                isMaxPull: true,
                workoutIdPrefix: 'TEST_PF_',
                workoutTitle: 'Peak Force Test',
                workoutDescription: "Warm up to ~80% of expected maximum and take 3-5 minutes rest. Each pull build force over 1-2 seconds.",
                repeaterStructure: {
                    countdown: config.COUNTDOWN,
                    pullDuration: config.PEAK_FORCE_PULL_DURATION,
                    restRepsDuration: config.PEAK_FORCE_REST_DURATION,
                    numberReps: config.PEAK_FORCE_NUMBER_SETS,
                    numberSets: 1,
                    restSetsDuration: 0,
                },
            }
        case WorkoutType.WORKOUT_REPEATERS:
            return {
                isAssessment: false,
                isMaxPull: false,
                workoutIdPrefix: 'WORKOUT_R_',
                workoutTitle: 'Repeaters Workout',
            }
        default:
            throw new Error(`Unknown workout type ${workoutType}`)
    }
}