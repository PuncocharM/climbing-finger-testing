import axios from "axios";
import {config} from "../config.ts";

export enum WorkoutPhase {
    idle = "idle",
    countdown = "countdown",
    pull = "pull",
    rest = "rest",
    finished = "finished",
}

export enum WorkoutPhaseEvent {
    WORKOUT_START = "WORKOUT_START",
    PULL_START = "PULL_START",
    REST_START = "REST_START",
    WORKOUT_END = "WORKOUT_END",
    WORKOUT_ABORT = "WORKOUT_ABORT",
}

export enum WorkoutType {
    CRITICAL_FORCE_TEST_SUSTAINED = "CRITICAL_FORCE_TEST_SUSTAINED",
    CRITICAL_FORCE_TEST_REPEATERS = "CRITICAL_FORCE_TEST_REPEATERS",
    PEAK_FORCE_TEST = "PEAK_FORCE_TEST",
    REPEATER_WORKOUT = "REPEATER_WORKOUT",
}

export enum WorkoutArm {
    LEFT = "left",
    RIGHT = "right",
    BOTH = "both",
}

export interface WorkoutSchema {
    timestamp: string,
    workout_id: string,
    workout_type: WorkoutType,
    workout_arm: WorkoutArm,
}

export function generateWorkoutId(prefix: string): string {
    const now = new Date();
    return `${prefix}${now.getFullYear()}` +
        `${String(now.getMonth() + 1).padStart(2, '0')}` +
        `${String(now.getDate()).padStart(2, '0')}` +
        `_${String(now.getHours()).padStart(2, '0')}` +
        `${String(now.getMinutes()).padStart(2, '0')}` +
        `_${String(now.getMilliseconds())}`;
}

export function playBeep(frequency: number, durationMs: number) {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;

        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
            audioCtx.close();
        }, durationMs);
    } catch (e) {
        console.error("Audio Web API initialization blocked:", e);
    }
}


export async function sendNewWorkout(workout_id: string, workout_type: WorkoutType, workoutArm: WorkoutArm) {
    const timestamp = new Date().toISOString();
    try {
        return await axios.post<WorkoutSchema>(
            config.apiEndpoint + "/workouts/new",
            {
                timestamp: timestamp,
                workout_id: workout_id,
                workout_type: workout_type,
                workout_arm: workoutArm,
            } as WorkoutSchema,
            {
                headers: {"Content-Type": "application/json"},
            });
    } catch (e) {
        return console.error("Error creating new workout: " + e);
    }
}

export function sendWorkoutPhase (event: WorkoutPhaseEvent, workout_id: string | null) {
    if (workout_id === null) {
        console.error("Workout id is null");
        return;
    }

    const timestamp = new Date().toISOString();
    axios.post(
        config.apiEndpoint + `/workouts/${workout_id}/workout-events/new`,
        JSON.stringify({
            timestamp: timestamp,
            event_type: event
        }),
        {
            headers: {"Content-Type": "application/json"},
        },
    )
    .catch(e => console.error("Error syncing workout phase: " + e));
}

export function getPhaseStyles (phase: WorkoutPhase) {
    switch (phase) {
        case WorkoutPhase.countdown: return { bg: 'bg-warning text-dark', title: 'GET READY' };
        case WorkoutPhase.pull: return { bg: 'bg-danger text-white animate-pulse', title: 'PULL HARD!' };
        case WorkoutPhase.rest: return { bg: 'bg-primary text-white', title: 'REST' };
        case WorkoutPhase.finished: return { bg: 'bg-success text-white', title: 'TEST COMPLETE' };
        case WorkoutPhase.idle: default: return { bg: 'bg-secondary border-secondary', title: '' };
    }
}

export interface WorkoutEventSchema {
    timestamp: string;
    event_type: WorkoutPhaseEvent;
}

export interface ScaleData {
    timestamps: string[];
    weights: number[];
    max_weights: number[];
}