import axios from "axios";
import {config} from "../config.ts";

export enum TestPhase {
    idle = "idle",
    countdown = "countdown",
    pull = "pull",
    rest = "rest",
    finished = "finished",
}

export enum TestPhaseEvent {
    TEST_START = "TEST_START",
    PULL_START = "PULL_START",
    REST_START = "REST_START",
    TEST_END = "TEST_END",
    TEST_ABORT = "TEST_ABORT",
}

export enum TestType {
    CRITICAL_FORCE_SUSTAINED = "CRITICAL_FORCE_SUSTAINED",
    CRITICAL_FORCE_REPEATERS = "CRITICAL_FORCE_REPEATERS",
}

export function generateTestId(prefix: string): string {
    const now = new Date();
    return `${prefix}${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
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
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Low volume

        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
            audioCtx.close();
        }, durationMs);
    } catch (e) {
        console.error("Audio Web API initialization blocked:", e);
    }
}


export function sendNewTest(test_id: string | null, test_type: TestType) {
    const timestamp = new Date().toISOString();
    axios.post(
        config.apiEndpoint + "/test/new",
        JSON.stringify({
            timestamp: timestamp,
            test_id: test_id,
            test_type: test_type,
        }),
        {
            headers: {"Content-Type": "application/json"},
        })
        .catch(e => console.error("Error creating new test: " + e));
}

export function sendPhaseSync (event: TestPhaseEvent, test_id: string | null) {
    if (test_id === null) {
        console.error("Test id is null");
        return;
    }

    const timestamp = new Date().toISOString();
    axios.post(
        config.apiEndpoint + "/test/event",
        JSON.stringify({
            test_id: test_id,
            timestamp: timestamp,
            event_type: event
        }),
        {
            headers: {"Content-Type": "application/json"},
        },
    )
    .catch(e => console.error("Error syncing test phase: " + e));
}

export function getPhaseStyles (phase: TestPhase) {
    switch (phase) {
        case TestPhase.countdown: return { bg: 'bg-warning text-dark', title: 'GET READY' };
        case TestPhase.pull: return { bg: 'bg-danger text-white animate-pulse', title: 'PULL HARD!' };
        case TestPhase.rest: return { bg: 'bg-primary text-white', title: 'REST' };
        case TestPhase.finished: return { bg: 'bg-success text-white', title: 'TEST COMPLETE' };
        case TestPhase.idle: default: return { bg: 'bg-dark border-secondary', title: 'CRITICAL FORCE TEST' };
    }
}

