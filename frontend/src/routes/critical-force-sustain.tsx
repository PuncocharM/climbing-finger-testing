import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import "../../styles/common.scss"
import {
    generateTestId,
    getPhaseStyles,
    playBeep,
    sendPhaseSync,
    type TestPhase,
} from "./test-commons.ts";
import {Scale} from "../components/Scale.tsx";



export default function CriticalForceTestSustain(): React.JSX.Element {
    const resetWeightRef = useRef<() => void>(null);
    const navigate = useNavigate();

    const PULL_DURATION = 60;


    const [phase, setPhase] = useState<TestPhase>('idle');
    const [timeLeft, setTimeLeft] = useState<number>(0);

    const currentTestIdRef = useRef<string>("NONE");
    const timerRef = useRef<number | null>(null);
    const phaseRef = useRef<TestPhase>('idle'); // Kept in sync with state for accurate interval scoping
    const phaseEndTimeRef = useRef<number>(0);
    const lastTriggeredSecondRef = useRef<number>(-1);


    const startTestSequence = () => {
        currentTestIdRef.current = generateTestId('TEST_CF_S_');
        sendPhaseSync('TEST_START', currentTestIdRef.current);

        const now = performance.now();
        phaseRef.current = 'countdown';
        setPhase('countdown');
        setTimeLeft(10);

        phaseEndTimeRef.current = now + 10000;
        lastTriggeredSecondRef.current = 10;

        playBeep(600, 200);

        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = window.setInterval(checkTimer, 50);
    };


    const checkTimer = () => {
        const now = performance.now();
        const msRemaining = phaseEndTimeRef.current - now;
        const secondsRemaining = Math.max(0, Math.ceil(msRemaining / 1000));

        if (secondsRemaining !== lastTriggeredSecondRef.current) {
            lastTriggeredSecondRef.current = secondsRemaining;
            setTimeLeft(secondsRemaining);

            if (secondsRemaining <= 3 && secondsRemaining > 0) {
                if (phaseRef.current === 'countdown') {
                    playBeep(440, 150);
                }
            }
        }

        if (msRemaining <= 0) {
            if (phaseRef.current === 'countdown') {
                playBeep(880, 500);
                phaseRef.current = 'pull';
                setPhase('pull');

                sendPhaseSync('PULL_START', currentTestIdRef.current);

                phaseEndTimeRef.current += PULL_DURATION * 1000;
                lastTriggeredSecondRef.current = PULL_DURATION;
                setTimeLeft(PULL_DURATION);
            }
            else if (phaseRef.current === 'pull') {
                playBeep(1200, 1000);
                phaseRef.current = 'finished';
                setPhase('finished');
                sendPhaseSync('TEST_END', currentTestIdRef.current);

                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }
            }
        }
    };

    const cancelTestSequence = () => {
        sendPhaseSync('TEST_ABORT', currentTestIdRef.current);

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        phaseRef.current = 'idle';
        setPhase('idle');
        setTimeLeft(0);
    };

    const uiTheme = getPhaseStyles(phase);

    return (
        <div className="bg-dark text-light min-vh-screen d-flex flex-column align-items-center justify-content-center p-3">
            <button onClick={() => navigate("/")} className="btn btn-outline-secondary btn-sm mb-4 position-absolute top-0 start-0 m-3">
                ← Back to Scale Dashboard
            </button>

            <div className={`card shadow-lg p-4 w-100 ${uiTheme.bg}`} style={{ maxWidth: '450px', borderRadius: '1rem', transition: 'all 0.3s ease' }}>
                <div className="text-center mb-3">
                    <h1 className="fw-bold text-light">Critical Force Test</h1>
                    <h2 className="text-light-emphasis">Sustained pull</h2>
                </div>
                {phase != 'idle' && (
                    <div className="text-center mb-3">
                        <h1 className="h4 fw-bold mb-1">{uiTheme.title}</h1>
                    </div>
                )}

                {phase !== 'idle' && phase !== 'finished' && (
                    <div className="text-center my-4">
                        <div className="display-1 font-monospace fw-bold">{timeLeft}s</div>
                    </div>
                )}

                {phase === 'finished' && (
                    <div className="card bg-dark border-secondary p-4 w-100"
                         style={{maxWidth: '450px', borderRadius: '1rem'}}>
                        <div className="row g-2 mb-2">
                            <button
                                onClick={() => navigate(`/test-results/${currentTestIdRef.current}`)}
                                className="btn btn-primary fw-bold px-4 py-2 w-100 shadow-sm border-0"
                            >
                                View Test Results
                            </button>
                            <button
                                onClick={startTestSequence}
                                className="btn btn-light fw-bold px-4 py-2 w-100 shadow-sm border-0"
                            >
                                Restart the test
                            </button>
                        </div>
                    </div>
                )}

                {phase != 'finished' && (
                    <>
                        <Scale displayMaxWeight={false} resetWeightRef={resetWeightRef}/>
                        <div className="d-grid gap-2">
                            {phase === 'idle' ? (
                                <button onClick={startTestSequence} className="btn btn-light btn-lg py-3 fw-bold rounded-3 shadow-sm">
                                    Begin Test
                                </button>
                            ) : (
                                <button onClick={cancelTestSequence} className="btn btn-outline-light btn-lg py-3 fw-bold rounded-3">
                                    Abort Test
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
