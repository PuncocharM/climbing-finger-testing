// app/routes/critical-force.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import {config} from "../config.ts";
import "../styles/common.scss"

type TestPhase = 'idle' | 'countdown' | 'pull' | 'rest' | 'finished';

export default function CriticalForceTest(): React.JSX.Element {
    const navigate = useNavigate();

    // --- Configuration Constants ---
    const PULL_DURATION = 7;
    const REST_DURATION = 3;
    // TODO: change to 24
    const TOTAL_SETS = 4; // 4 Minutes standard critical force test

    // --- Core State Machine ---
    const [phase, setPhase] = useState<TestPhase>('idle');
    const [currentSet, setCurrentSet] = useState<number>(1);
    const [timeLeft, setTimeLeft] = useState<number>(0);

    // Telemetry stream state
    const [liveWeight, setLiveWeight] = useState<number>(0.0);
    const [maxForceThisSet, setMaxForceThisSet] = useState<number>(0.0);

    // --- Refs ---
    const currentTestIdRef = useRef<string>("NONE");
    const wsRef = useRef<WebSocket | null>(null);
    const timerRef = useRef<number | null>(null);
    const phaseRef = useRef<TestPhase>('idle'); // Kept in sync with state for accurate interval scoping
    const currentSetRef = useRef<number>(1); // Kept in sync with state for accurate interval scoping
    const phaseEndTimeRef = useRef<number>(0);
    const lastTriggeredSecondRef = useRef<number>(-1);


    const generateTestId = (): string => {
        const now = new Date();
        return `TEST_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    };

    // --- Audio Engine (Synthesizes clean system alerts via browser) ---
    const playBeep = (frequency: number, durationMs: number) => {
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
    };

    // --- Telemetry Hookup ---
    useEffect(() => {
        const ws = new WebSocket(config.serverUrl);
        wsRef.current = ws;

        ws.onmessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                const currentForce = data.weight;
                setLiveWeight(currentForce);

                // Track peak generation strictly during active pull cycles
                if (phaseRef.current === 'pull') {
                    setMaxForceThisSet((prevMax) => (currentForce > prevMax ? currentForce : prevMax));
                }
            } catch (err) {
                console.error("Telemetry reading fault:", err);
            }
        };

        return () => {
            // ws.close();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startTestSequence = () => {
        // 1. Log the initiation of the global test layout loop
        currentTestIdRef.current = generateTestId();
        sendPhaseSync('CRITICAL_FORCE_START');

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ command: 'start' }));
        }

        const now = performance.now();
        phaseRef.current = 'countdown';
        setPhase('countdown');
        setCurrentSet(1);
        currentSetRef.current = 1
        setTimeLeft(10);

        phaseEndTimeRef.current = now + 10000;
        lastTriggeredSecondRef.current = 10;

        playBeep(600, 200);

        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = window.setInterval(checkHighPrecisionTimer, 50);
    };

    const sendPhaseSync = (markerType: 'CRITICAL_FORCE_START' | 'PULL_START' | 'REST_START' | 'TEST_END' | 'TEST_ABORT') => {
        const syncTimestamp = new Date().toISOString();
        try {
            fetch("http://localhost:8000/api/test/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    test_id: currentTestIdRef.current,
                    timestamp: syncTimestamp,
                    event_type: markerType
                }),
            });
        } catch (err) {
            console.error("Event routing sync failure:", err);
        }
    };

    const checkHighPrecisionTimer = () => {
        const now = performance.now();
        const msRemaining = phaseEndTimeRef.current - now;
        const secondsRemaining = Math.max(0, Math.ceil(msRemaining / 1000));

        if (secondsRemaining !== lastTriggeredSecondRef.current) {
            lastTriggeredSecondRef.current = secondsRemaining;
            setTimeLeft(secondsRemaining);

            if (secondsRemaining <= 3 && secondsRemaining > 0) {
                if (phaseRef.current === 'countdown' || phaseRef.current === 'rest') {
                    playBeep(440, 150);
                }
            }
        }

        // --- High Precision Transition Boundaries ---
        if (msRemaining <= 0) {
            if (phaseRef.current === 'countdown') {
                playBeep(880, 500);
                phaseRef.current = 'pull';
                setPhase('pull');
                setMaxForceThisSet(0);

                // LOG PHASE: First Pull Sequence
                sendPhaseSync('PULL_START');

                phaseEndTimeRef.current += PULL_DURATION * 1000;
                lastTriggeredSecondRef.current = PULL_DURATION;
                setTimeLeft(PULL_DURATION);
            }
            else if (phaseRef.current === 'pull') {
                if (currentSetRef.current >= TOTAL_SETS) {
                    playBeep(1200, 1000);
                    phaseRef.current = 'finished';
                    setPhase('finished');
                    sendPhaseSync('TEST_END');

                    if (timerRef.current) {
                        clearInterval(timerRef.current);
                        timerRef.current = null;
                    }
                } else {
                    playBeep(550, 400);
                    phaseRef.current = 'rest';
                    setPhase('rest');
                    sendPhaseSync('REST_START');

                    phaseEndTimeRef.current += REST_DURATION * 1000;
                    lastTriggeredSecondRef.current = REST_DURATION;
                    setTimeLeft(REST_DURATION);
                }
            }
            else if (phaseRef.current === 'rest') {
                playBeep(880, 500);
                phaseRef.current = 'pull';
                setPhase('pull');
                sendPhaseSync('PULL_START');

                setMaxForceThisSet(0);

                phaseEndTimeRef.current += PULL_DURATION * 1000;
                lastTriggeredSecondRef.current = PULL_DURATION;
                setTimeLeft(PULL_DURATION);
                currentSetRef.current += 1;
                setCurrentSet(currentSetRef.current);
            }
        }
    };

    const cancelTestSequence = () => {
        // LOG PHASE: Keep logging tracking consistent if dropped mid-way
        sendPhaseSync('TEST_ABORT');

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        phaseRef.current = 'idle';
        setPhase('idle');
        setTimeLeft(0);
    };

    // --- Dynamic Color Styles based on Engine Phase ---
    const getPhaseStyles = () => {
        switch (phase) {
            case 'countdown': return { bg: 'bg-warning text-dark', title: 'GET READY' };
            case 'pull': return { bg: 'bg-danger text-white animate-pulse', title: 'PULL HARD!' };
            case 'rest': return { bg: 'bg-primary text-white', title: 'REST' };
            case 'finished': return { bg: 'bg-success text-white', title: 'TEST COMPLETE' };
            case 'idle': default: return { bg: 'bg-dark border-secondary', title: 'CRITICAL FORCE TEST' };
        }
    };

    const uiTheme = getPhaseStyles();

    return (
        <div className="bg-dark text-light min-vh-screen d-flex flex-column align-items-center justify-content-center p-3">
            <button onClick={() => navigate("/")} className="btn btn-outline-secondary btn-sm mb-4 position-absolute top-0 start-0 m-3">
                ← Back to Scale Dashboard
            </button>

            <div className={`card shadow-lg p-4 w-100 ${uiTheme.bg}`} style={{ maxWidth: '450px', borderRadius: '1rem', transition: 'all 0.3s ease' }}>
                <div className="text-center mb-3">
                    <h1 className="h4 fw-bold mb-1">{uiTheme.title}</h1>
                    {phase !== 'idle' && phase !== 'finished' && (
                        <span className="badge bg-black px-3 py-2 font-monospace fs-6">Set {currentSet} / {TOTAL_SETS}</span>
                    )}
                </div>

                {phase !== 'idle' && phase !== 'finished' && (
                    <div className="text-center my-4">
                        <div className="display-1 font-monospace fw-bold">{timeLeft}s</div>
                    </div>
                )}

                {/* Finished State Results Prompt Indicator */}
                {phase === 'finished' && (
                    <div className="bg-black text-light border border-dark rounded-3 p-4 text-center my-4 shadow-sm animate-fade-in">
          <span className="text-uppercase tracking-wider text-success small fw-bold d-block mb-2">
            ✨ Calculations Complete
          </span>
                        <p className="small text-muted mb-3">
                            Your raw 80 Hz curve stream has been sliced and compiled on the backend database logs.
                        </p>
                        <button
                            onClick={() => navigate(`/test-results/${currentTestIdRef.current}`)}
                            className="btn btn-success fw-bold px-4 py-2 w-100 shadow-sm border-0"
                        >
                            📊 View Test Results & W' Graph
                        </button>
                    </div>
                )}

                {/* Force Readings Panel Display (Only show while active or idle) */}
                {phase !== 'finished' && (
                    <div className="bg-black text-light border border-dark rounded-3 p-3 text-center mb-4">
                        <div className="row">
                            <div className="col-6 border-end border-secondary">
                                <span className="text-uppercase tracking-wider text-muted small d-block mb-1">Live Load</span>
                                <div className="h4 font-monospace fw-bold text-success m-0">{liveWeight.toFixed(1)} kg</div>
                            </div>
                            <div className="col-6">
                                <span className="text-uppercase tracking-wider text-muted small d-block mb-1">Peak (This Set)</span>
                                <div className="h4 font-monospace fw-bold text-warning m-0">{maxForceThisSet.toFixed(1)} kg</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Lower Core Control Buttons */}
                <div className="d-grid gap-2">
                    {phase === 'idle' || phase === 'finished' ? (
                        <button onClick={startTestSequence} className="btn btn-light btn-lg py-3 fw-bold rounded-3 shadow-sm">
                            {phase === 'finished' ? 'Run New Assessment' : 'Begin 7:3 Test'}
                        </button>
                    ) : (
                        <button onClick={cancelTestSequence} className="btn btn-outline-light btn-lg py-3 fw-bold rounded-3">
                            Abort Test
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
