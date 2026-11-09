import React, {useRef, useState} from "react";
import {useNavigate} from "react-router";
import {
    generateWorkoutId,
    getPhaseStyles,
    playBeep, type RepeaterStructure,
    sendNewWorkout,
    sendWorkoutPhase,
    WorkoutArm,
    WorkoutPhase,
    WorkoutPhaseEvent,
    WorkoutType
} from "./workout-commons.ts";
import {defaultRepeaterStructure, workoutParamsPresets} from "../config.ts";
import {resetMaxWeight, Scale} from "./Scale.tsx";
import "../../styles/common.scss"
import {ButtonHome, PageContainer, ScaleContainer} from "./utilComponents.tsx";
import {capFirst} from "../utils.ts";


function InputWorkoutArm() {
    return (
        <div className="mx-auto">
            <div className="input-group">
                <input type="radio" className="btn-check" name="arm" id="option1"
                       autoComplete="off" value={WorkoutArm.LEFT} defaultChecked={true}/>
                <label className="btn btn-outline-dark" style={{
                    borderTopLeftRadius: "0.375em",
                    borderBottomLeftRadius: "0.375em"
                }} htmlFor="option1">Left arm</label>

                <input type="radio" className="btn-check" name="arm" id="option2" autoComplete="off"
                       value={WorkoutArm.RIGHT}/>
                <label className="btn btn-outline-dark" htmlFor="option2">Right arm</label>

                <input type="radio" className="btn-check" name="arm" id="option3" autoComplete="off"
                       value={WorkoutArm.BOTH}/>
                <label className="btn btn-outline-dark" htmlFor="option3">Both arms</label>
            </div>
        </div>
    )
}


function NumberInputRow({field_id, field_name, defaultValue}: {field_id: string, field_name: string, defaultValue: number}) {
    return (
        <div className="row g-3">
            <div className="col-6">
                <label htmlFor={field_id} className="form-label">{field_name}:</label>
            </div>
            <div className="col-6">
                <input type="number" className="form-control" name={field_id} id={field_id} min={1}
                       defaultValue={defaultValue}/>
            </div>
        </div>
    )
}

function RepeaterStructureInput({repeaterStructure}: { repeaterStructure: RepeaterStructure }) {
    return <>
        <NumberInputRow field_id="numberSets" field_name="Number of sets" defaultValue={repeaterStructure.numberSets}/>
        <NumberInputRow field_id="numberReps" field_name="Number of reps" defaultValue={repeaterStructure.numberReps}/>
        <NumberInputRow field_id="countdown" field_name="Countdown [s]" defaultValue={repeaterStructure.countdown}/>
        <NumberInputRow field_id="pullDuration" field_name="Pull duration [s]" defaultValue={repeaterStructure.pullDuration}/>
        <NumberInputRow field_id="restRepsDuration" field_name="Rest between reps [s]" defaultValue={repeaterStructure.restRepsDuration}/>
        <NumberInputRow field_id="restSetsDuration" field_name="Rest between sets [s]" defaultValue={repeaterStructure.restSetsDuration}/>
    </>;
}

function TargetWeightInput() {
    const [targetWeight, setTargetWeight] = useState<boolean>(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.currentTarget.value == "targetWeight") {
            setTargetWeight(true)
        } else if (e.currentTarget.value == "maxPull") {
            setTargetWeight(false)
        } else {
            console.error("Unrecognized radio value")
        }
    }

    return <>
        <div className="mx-auto">
            <div className="input-group">
                <input type="radio" className="btn-check" name="targetWeightOrMaxPull" id="maxPull" autoComplete="off"
                       value="maxPull" onChange={handleChange} defaultChecked={!targetWeight} />
                <label className="btn btn-outline-dark" htmlFor="maxPull" style={{
                    borderTopLeftRadius: "0.375em",
                    borderBottomLeftRadius: "0.375em"
                }}>Max pull</label>

                <input type="radio" className="btn-check" name="targetWeightOrMaxPull" id="targetWeight"
                       autoComplete="off" value="targetWeight" defaultChecked={targetWeight} onChange={handleChange}/>
                <label className="btn btn-outline-dark" htmlFor="targetWeight">Target weight</label>
            </div>
        </div>
        {targetWeight && (
            <NumberInputRow field_id="targetWeightValue" field_name="Target weight [kg]" defaultValue={10} />
        )}
    </>
}

function _Workout({workoutType, resetWorkout} : {
    workoutType: WorkoutType,
    resetWorkout: () => void,
}) {
    const navigate = useNavigate();

    const [phase, setPhase] = useState<WorkoutPhase>(WorkoutPhase.idle);
    const [currentRep, setCurrentRep] = useState<number>(1);
    const [currentSet, setCurrentSet] = useState<number>(1);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isTargetWeight, setIsTargetWeight] = useState<boolean>(false);
    const [targetWeight, setTargetWeight] = useState<number>(0);

    const currentWorkoutIdRef = useRef<string | null>(null);
    const timerRef = useRef<number | null>(null);
    const phaseRef = useRef<WorkoutPhase>(phase);
    const currentRepRef = useRef<number>(currentRep);
    const currentSetRef = useRef<number>(currentSet);
    const phaseEndTimeRef = useRef<number>(0);
    const lastTriggeredSecondRef = useRef<number>(-1);

    const workoutParams = workoutParamsPresets(workoutType);
    const [repeaterStructure, setRepeaterStructure] = useState<RepeaterStructure>(workoutParams.repeaterStructure || defaultRepeaterStructure);
    const repeaterStructureRef = useRef<RepeaterStructure>(repeaterStructure);
    const testOrWorkout = workoutParams.isAssessment ? "test" : "workout"


    const startWorkout = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const workoutArm = formData.get("arm") as WorkoutArm;

        if (!workoutParams.isAssessment) {
            repeaterStructureRef.current = {
                numberSets: Number(formData.get("numberSets")),
                numberReps: Number(formData.get("numberReps")),
                countdown: Number(formData.get("countdown")),
                pullDuration: Number(formData.get("pullDuration")),
                restRepsDuration: Number(formData.get("restRepsDuration")),
                restSetsDuration: Number(formData.get("restSetsDuration")),
            };
            setRepeaterStructure(repeaterStructureRef.current)

            if (formData.get("targetWeightOrMaxPull") == "targetWeight") {
                setIsTargetWeight(true);
                setTargetWeight(Number(formData.get("targetWeightValue")))
            } else {
                setIsTargetWeight(false);
            }
        }


        currentWorkoutIdRef.current = generateWorkoutId(workoutParams.workoutIdPrefix);
        await sendNewWorkout(currentWorkoutIdRef.current, workoutType, workoutArm)
        sendWorkoutPhase(WorkoutPhaseEvent.WORKOUT_START, currentWorkoutIdRef.current);

        const now = performance.now();
        phaseRef.current = WorkoutPhase.countdown;
        setPhase(WorkoutPhase.countdown);
        setCurrentRep(1);
        setCurrentSet(1);
        currentRepRef.current = 1
        currentSetRef.current = 1

        setTimeLeft(repeaterStructureRef.current.countdown);
        phaseEndTimeRef.current = now + repeaterStructureRef.current.countdown * 1000;
        lastTriggeredSecondRef.current = repeaterStructureRef.current.countdown;

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

                    phaseEndTimeRef.current += repeaterStructureRef.current.pullDuration * 1000;
                    lastTriggeredSecondRef.current = repeaterStructureRef.current.pullDuration;
                    setTimeLeft(repeaterStructureRef.current.pullDuration);
                    break;
                case WorkoutPhase.pull:
                    if (currentRepRef.current >= repeaterStructureRef.current.numberReps) {
                        // finished all reps in a set
                        playBeep(1200, 1000);
                        if (currentSetRef.current >= repeaterStructureRef.current.numberSets) {
                            // finished all sets
                            phaseRef.current = WorkoutPhase.finished;
                            setPhase(WorkoutPhase.finished);
                            sendWorkoutPhase(WorkoutPhaseEvent.WORKOUT_END, currentWorkoutIdRef.current);

                            if (timerRef.current) {
                                clearInterval(timerRef.current);
                                timerRef.current = null;
                            }
                        } else {
                            // move to the next set
                            currentRepRef.current = 0;
                            setCurrentRep(currentRepRef.current);
                            currentSetRef.current += 1;
                            setCurrentSet(currentSetRef.current);

                            phaseRef.current = WorkoutPhase.rest;
                            setPhase(WorkoutPhase.rest);
                            sendWorkoutPhase(WorkoutPhaseEvent.REST_START, currentWorkoutIdRef.current);

                            phaseEndTimeRef.current += repeaterStructureRef.current.restSetsDuration * 1000;
                            lastTriggeredSecondRef.current = repeaterStructureRef.current.restSetsDuration;
                            setTimeLeft(repeaterStructureRef.current.restSetsDuration);
                        }
                    } else {
                        // move to next rep
                        playBeep(550, 400);
                        phaseRef.current = WorkoutPhase.rest;
                        setPhase(WorkoutPhase.rest);
                        sendWorkoutPhase(WorkoutPhaseEvent.REST_START, currentWorkoutIdRef.current);

                        phaseEndTimeRef.current += repeaterStructureRef.current.restRepsDuration * 1000;
                        lastTriggeredSecondRef.current = repeaterStructureRef.current.restRepsDuration;
                        setTimeLeft(repeaterStructureRef.current.restRepsDuration);
                    }
                    break;
                case WorkoutPhase.rest:
                    playBeep(880, 500);
                    resetMaxWeight()
                    phaseRef.current = WorkoutPhase.pull;
                    setPhase(WorkoutPhase.pull);
                    sendWorkoutPhase(WorkoutPhaseEvent.PULL_START, currentWorkoutIdRef.current);

                    phaseEndTimeRef.current += repeaterStructureRef.current.pullDuration * 1000;
                    lastTriggeredSecondRef.current = repeaterStructureRef.current.pullDuration;
                    setTimeLeft(repeaterStructureRef.current.pullDuration);
                    currentRepRef.current += 1;
                    setCurrentRep(currentRepRef.current);
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
                    {phase !== 'finished' && repeaterStructure.numberSets > 1 && (
                        <div><div className="badge bg-black px-3 py-2 font-monospace fs-6">Set {currentSet} / {repeaterStructure.numberSets}</div></div>
                    )}
                    {phase !== 'finished' && repeaterStructure.numberReps > 1 && (
                        <div><div className="badge bg-black px-3 py-2 font-monospace fs-6">Rep {currentRep} / {repeaterStructure.numberReps}</div></div>
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
                            Restart the {testOrWorkout}
                        </button>
                    </div>
                </div>
            ) : (<>
                    <Scale displayMaxWeight={workoutType == WorkoutType.PEAK_FORCE_TEST} isTargetWeight={isTargetWeight} targetWeight={targetWeight}/>
                    <div className="d-grid gap-2">
                        {phase === 'idle' ? (
                            <>
                                <div className="card card-body bg-dark-subtle">
                                    <p>{workoutParams.workoutDescription}</p>
                                    <form onSubmit={startWorkout} className="d-grid gap-2">
                                        <InputWorkoutArm />
                                        {workoutParams.isAssessment ||
                                            <RepeaterStructureInput repeaterStructure={repeaterStructure}/>}
                                        {workoutParams.isAssessment || <TargetWeightInput/>}
                                        <button type="submit"
                                                className="btn btn-primary btn-lg py-3 fw-bold rounded-3 shadow-sm">
                                            Start {capFirst(testOrWorkout)}
                                        </button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <button onClick={abortWorkout}
                                    className="btn btn-outline-light btn-lg py-3 fw-bold rounded-3">
                                Abort {capFirst(testOrWorkout)}
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