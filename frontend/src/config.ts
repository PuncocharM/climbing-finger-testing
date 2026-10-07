export const config = {
    webSocketEndpoint: 'ws://localhost:8000/ws',
    apiEndpoint: 'http://localhost:8000/api',
    SERVER_RECONNECT_TIMEOUT: 3000,  // milliseconds before re-try to reconnect
    CRITICAL_FORCE_SUSTAIN_DURATION: 60, // seconds of pull time 60
    COUNTDOWN: 10, // seconds countdown before test
    TIMER_REFRESH_RATE: 50, // milliseconds to refresh the timer
    REPEATER_PULL: 7, // seconds of pulling
    REPEATER_REST: 3, // seconds of resting
    REPEATERS_SETS: 24, // 4 minutes 24
}