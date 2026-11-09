import React, {useRef, useState} from "react";
import {useNavigate} from "react-router";
import {
    generateWorkoutId,
    getPhaseStyles,
    playBeep,
    sendNewWorkout,
    sendWorkoutPhase,
    WorkoutArm,
    WorkoutPhase,
    WorkoutPhaseEvent,
    WorkoutType
} from "./workout-commons.ts";
import {config, workoutTypeParams} from "../config.ts";
import {resetMaxWeight, Scale} from "./Scale.tsx";
import "../../styles/common.scss"
import {ButtonHome, PageContainer, ScaleContainer} from "./utilComponents.tsx";


function _Workout({workoutType, resetWorkout} : {
    workoutType: WorkoutType,
    resetWorkout: () => void,
}) {
    const navigate = useNavigate();

    const [phase, setPhase] = useState<WorkoutPhase>(WorkoutPhase.idle);
    const [currentSet, setCurrentSet] = useState<number>(1);
    const [timeLeft, setTimeLeft] = useState<number>(0);

    const currentWorkoutIdRef = useRef<string | null>(null);
    const timerRef = useRef<number | null>(null);
    const phaseRef = useRef<WorkoutPhase>(phase);
    const currentSetRef = useRef<number>(currentSet);
    const phaseEndTimeRef = useRef<number>(0);
    const lastTriggeredSecondRef = useRef<number>(-1);

    const workoutParams = workoutTypeParams(workoutType);


    const startWorkout = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const workoutArm = formData.get("arm") as WorkoutArm;


        currentWorkoutIdRef.current = generateWorkoutId(workoutParams.workoutIdPrefix);
        await sendNewWorkout(currentWorkoutIdRef.current, workoutType, workoutArm)
        sendWorkoutPhase(WorkoutPhaseEvent.WORKOUT_START, currentWorkoutIdRef.current);

        const now = performance.now();
        phaseRef.current = WorkoutPhase.countdown;
        setPhase(WorkoutPhase.countdown);
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
                case WorkoutPhase.countdown:
                    playBeep(880, 600);
                    resetMaxWeight()
                    phaseRef.current = WorkoutPhase.pull;
                    setPhase(WorkoutPhase.pull);
                    sendWorkoutPhase(WorkoutPhaseEvent.PULL_START, currentWorkoutIdRef.current);

                    phaseEndTimeRef.current += workoutParams.pullDuration * 1000;
                    lastTriggeredSecondRef.current = workoutParams.pullDuration;
                    setTimeLeft(workoutParams.pullDuration);
                    break;
                case WorkoutPhase.pull:
                    if (currentSetRef.current >= workoutParams.numberReps) {
                        playBeep(1200, 1000);
                        phaseRef.current = WorkoutPhase.finished;
                        setPhase(WorkoutPhase.finished);
                        sendWorkoutPhase(WorkoutPhaseEvent.WORKOUT_END, currentWorkoutIdRef.current);

                        if (timerRef.current) {
                            clearInterval(timerRef.current);
                            timerRef.current = null;
                        }
                    } else {
                        playBeep(550, 400);
                        phaseRef.current = WorkoutPhase.rest;
                        setPhase(WorkoutPhase.rest);
                        sendWorkoutPhase(WorkoutPhaseEvent.REST_START, currentWorkoutIdRef.current);

                        phaseEndTimeRef.current += workoutParams.restRepsDuration * 1000;
                        lastTriggeredSecondRef.current = workoutParams.restRepsDuration;
                        setTimeLeft(workoutParams.restRepsDuration);
                    }
                    break;
                case WorkoutPhase.rest:
                    playBeep(880, 500);
                    resetMaxWeight()
                    phaseRef.current = WorkoutPhase.pull;
                    setPhase(WorkoutPhase.pull);
                    sendWorkoutPhase(WorkoutPhaseEvent.PULL_START, currentWorkoutIdRef.current);

                    phaseEndTimeRef.current += workoutParams.pullDuration * 1000;
                    lastTriggeredSecondRef.current = workoutParams.pullDuration;
                    setTimeLeft(workoutParams.pullDuration);
                    currentSetRef.current += 1;
                    setCurrentSet(currentSetRef.current);
                    break;
                default:
                    console.error("Unrecognized phase:", phaseRef.current);
            }
        }
    };

    const abortWorkout = () => {
        sendWorkoutPhase(WorkoutPhaseEvent.WORKOUT_ABORT, currentWorkoutIdRef.current);

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        resetWorkout();
    };


    const phaseStyle = getPhaseStyles(phase);

    return (
        <ScaleContainer bgStyle={phaseStyle.bg} style={{transition: 'all 0.3s ease'}}>
            <div className="text-center mb-3">
                <h1 className="fw-bold text-light">{workoutParams.workoutTitle}</h1>
                {workoutParams.workoutSubtitle && <h2 className="text-light-emphasis">{workoutParams.workoutSubtitle}</h2>}
            </div>
            {phase != 'idle' && (
                <div className="text-center mb-3">
                    <h1 className="h4 fw-bold mb-1">{phaseStyle.title}</h1>
                    {phase !== 'finished' && workoutParams.numberReps > 1 && (
                        <span className="badge bg-black px-3 py-2 font-monospace fs-6">Set {currentSet} / {workoutParams.numberReps}</span>
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
                            onClick={() => navigate(`/test-results/${currentWorkoutIdRef.current}`)}
                            className="btn btn-primary fw-bold px-4 py-2 w-100 shadow-sm border-0"
                        >
                            View Test Results
                        </button>
                        <button
                            onClick={resetWorkout}
                            className="btn btn-light fw-bold px-4 py-2 w-100 shadow-sm border-0"
                        >
                            Restart the test
                        </button>
                    </div>
                </div>
            ) : (<>
                    <Scale displayMaxWeight={workoutType == WorkoutType.PEAK_FORCE_TEST} />
                    <div className="d-grid gap-2">
                        {phase === 'idle' ? (
                            <>
                                <div className="card card-body bg-dark-subtle">
                                    <p>{workoutParams.workoutDescription}</p>
                                    <form onSubmit={startWorkout} className="d-grid gap-3">
                                        <div className="mx-auto">
                                            <div className="input-group">
                                                <input type="radio" className="btn-check" name="arm" id="option1"
                                                       autoComplete="off" value={WorkoutArm.LEFT} defaultChecked={true}/>
                                                <label className="btn btn-outline-dark" style={{
                                                    borderTopLeftRadius: "0.375em",
                                                    borderBottomLeftRadius: "0.375em"
                                                }} htmlFor="option1">Left arm</label>

                                                <input type="radio" className="btn-check" name="arm" id="option2" autoComplete="off" value={WorkoutArm.RIGHT}/>
                                                <label className="btn btn-outline-dark" htmlFor="option2">Right arm</label>

                                                <input type="radio" className="btn-check" name="arm" id="option3" autoComplete="off" value={WorkoutArm.BOTH}/>
                                                <label className="btn btn-outline-dark" htmlFor="option3">Both arms</label>
                                            </div>
                                        </div>
                                        <button type="submit" className="btn btn-primary btn-lg py-3 fw-bold rounded-3 shadow-sm">
                                            Start Workout
                                        </button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <button onClick={abortWorkout}
                                    className="btn btn-outline-light btn-lg py-3 fw-bold rounded-3">
                                Abort Workout
                            </button>
                        )}
                    </div>
                </>
            )}
        </ScaleContainer>
    );
}

export function Workout({workoutType}:{ workoutType: WorkoutType }) {
    const [key, setKey] = useState<number>(0)

    const resetWorkout = () => {
        setKey(oldKey => oldKey + 1)
    }

    return (
        <PageContainer>
            <ButtonHome />
            <_Workout key={key} resetWorkout={resetWorkout} workoutType={workoutType}/>
        </PageContainer>
    );
}