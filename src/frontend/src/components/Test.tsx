import React, {useRef, useState} from "react";
import {useNavigate} from "react-router";
import {
    generateTestId,
    getPhaseStyles,
    playBeep,
    sendNewTest,
    sendTestPhase,
    TestArm,
    TestPhase,
    TestPhaseEvent,
    TestType
} from "./test-commons.ts";
import {config, testTypeParams} from "../config.ts";
import {resetMaxWeight, Scale} from "./Scale.tsx";
import "../../styles/common.scss"


function _Test({testType, resetTest}:{
    testType:TestType,
    resetTest: () => void,
}) {
    const navigate = useNavigate();

    const [phase, setPhase] = useState<TestPhase>(TestPhase.idle);
    const [currentSet, setCurrentSet] = useState<number>(1);
    const [timeLeft, setTimeLeft] = useState<number>(0);

    const currentTestIdRef = useRef<string | null>(null);
    const timerRef = useRef<number | null>(null);
    const phaseRef = useRef<TestPhase>(phase);
    const currentSetRef = useRef<number>(currentSet);
    const phaseEndTimeRef = useRef<number>(0);
    const lastTriggeredSecondRef = useRef<number>(-1);

    const testParams = testTypeParams(testType);


    const startTest = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const testArm = formData.get("arm") as TestArm;


        currentTestIdRef.current = generateTestId(testParams.testIdPrefix);
        await sendNewTest(currentTestIdRef.current, testType, testArm)
        sendTestPhase(TestPhaseEvent.TEST_START, currentTestIdRef.current);

        const now = performance.now();
        phaseRef.current = TestPhase.countdown;
        setPhase(TestPhase.countdown);
        setCurrentSet(1);
        currentSetRef.current = 1

        setTimeLeft(config.COUNTDOWN);
        phaseEndTimeRef.current = now + config.COUNTDOWN * 1000;
        lastTriggeredSecondRef.current = config.COUNTDOWN;

        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
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
                if (phaseRef.current === 'countdown' || phaseRef.current === 'rest') {
                    playBeep(440, 200);
                }
            }
        }

        if (msRemaining <= 0) {
            switch (phaseRef.current) {
                case TestPhase.countdown:
                    playBeep(880, 600);
                    resetMaxWeight()
                    phaseRef.current = TestPhase.pull;
                    setPhase(TestPhase.pull);
                    sendTestPhase(TestPhaseEvent.PULL_START, currentTestIdRef.current);

                    phaseEndTimeRef.current += testParams.pullDuration * 1000;
                    lastTriggeredSecondRef.current = testParams.pullDuration;
                    setTimeLeft(testParams.pullDuration);
                    break;
                case TestPhase.pull:
                    if (currentSetRef.current >= testParams.numberSets) {
                        playBeep(1200, 1000);
                        phaseRef.current = TestPhase.finished;
                        setPhase(TestPhase.finished);
                        sendTestPhase(TestPhaseEvent.TEST_END, currentTestIdRef.current);

                        if (timerRef.current) {
                            clearInterval(timerRef.current);
                            timerRef.current = null;
                        }
                    } else {
                        playBeep(550, 400);
                        phaseRef.current = TestPhase.rest;
                        setPhase(TestPhase.rest);
                        sendTestPhase(TestPhaseEvent.REST_START, currentTestIdRef.current);

                        phaseEndTimeRef.current += testParams.restDuration * 1000;
                        lastTriggeredSecondRef.current = testParams.restDuration;
                        setTimeLeft(testParams.restDuration);
                    }
                    break;
                case TestPhase.rest:
                    playBeep(880, 500);
                    resetMaxWeight()
                    phaseRef.current = TestPhase.pull;
                    setPhase(TestPhase.pull);
                    sendTestPhase(TestPhaseEvent.PULL_START, currentTestIdRef.current);

                    phaseEndTimeRef.current += testParams.pullDuration * 1000;
                    lastTriggeredSecondRef.current = testParams.pullDuration;
                    setTimeLeft(testParams.pullDuration);
                    currentSetRef.current += 1;
                    setCurrentSet(currentSetRef.current);
                    break;
                default:
                    console.error("Unrecognized phase:", phaseRef.current);
            }
        }
    };

    const abortTest = () => {
        sendTestPhase(TestPhaseEvent.TEST_ABORT, currentTestIdRef.current);

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        resetTest();
    };


    const uiTheme = getPhaseStyles(phase);

    return (
        <div className={`card shadow-lg p-4 w-100 ${uiTheme.bg}`}
                 style={{maxWidth: '450px', borderRadius: '1rem', transition: 'all 0.3s ease'}}>
            <div className="text-center mb-3">
                <h1 className="fw-bold text-light">{testParams.testTitle}</h1>
                {testParams.testSubtitle && <h2 className="text-light-emphasis">{testParams.testSubtitle}</h2>}
            </div>
            {phase != 'idle' && (
                <div className="text-center mb-3">
                    <h1 className="h4 fw-bold mb-1">{uiTheme.title}</h1>
                    {phase !== 'finished' && testParams.numberSets > 1 && (
                        <span className="badge bg-black px-3 py-2 font-monospace fs-6">Set {currentSet} / {testParams.numberSets}</span>
                    )}
                </div>
            )}

            {phase !== 'idle' && phase !== 'finished' && (
                <div className="text-center my-4">
                    <div className="display-1 font-monospace fw-bold">{timeLeft}s</div>
                </div>
            )}

            {phase === 'finished' ? (
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
                            onClick={resetTest}
                            className="btn btn-light fw-bold px-4 py-2 w-100 shadow-sm border-0"
                        >
                            Restart the test
                        </button>
                    </div>
                </div>
            ) : (<>
                    <Scale displayMaxWeight={testType == TestType.PEAK_FORCE} />
                    <div className="d-grid gap-2">
                        {phase === 'idle' ? (
                            <>
                                <div className="card card-body bg-secondary">
                                    <p>{testParams.testDescription}</p>
                                    <form onSubmit={startTest} className="d-grid gap-3">
                                        <div className="mx-auto">
                                            <div className="input-group">
                                                <input type="radio" className="btn-check" name="arm" id="option1"
                                                       autoComplete="off" value={TestArm.LEFT} defaultChecked={true}/>
                                                <label className="btn btn-outline-light" style={{
                                                    borderTopLeftRadius: "0.375em",
                                                    borderBottomLeftRadius: "0.375em"
                                                }} htmlFor="option1">Left arm</label>

                                                <input type="radio" className="btn-check" name="arm" id="option2" autoComplete="off" value={TestArm.RIGHT}/>
                                                <label className="btn btn-outline-light" htmlFor="option2">Right arm</label>

                                                <input type="radio" className="btn-check" name="arm" id="option3" autoComplete="off" value={TestArm.BOTH}/>
                                                <label className="btn btn-outline-light" htmlFor="option3">Both arms</label>
                                            </div>
                                        </div>
                                        <button type="submit" className="btn btn-light btn-lg py-3 fw-bold rounded-3 shadow-sm">
                                            Start Test
                                        </button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <button onClick={abortTest}
                                    className="btn btn-outline-light btn-lg py-3 fw-bold rounded-3">
                                Abort Test
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export function Test({testType}:{ testType: TestType }) {
    const navigate = useNavigate();
    const [key, setKey] = useState<number>(0)

    const resetTest = () => {
        setKey(oldKey => oldKey + 1)
    }

    return (
        <div className="bg-dark text-light min-vh-screen d-flex flex-column align-items-center justify-content-center p-3">
            <button onClick={() => navigate("/")}
                    className="btn btn-outline-secondary btn-sm mb-4 position-absolute top-0 start-0 m-3">
                ← Back to Scale Dashboard
            </button>
            <_Test key={key} resetTest={resetTest} testType={testType}/>
        </div>
    );
}