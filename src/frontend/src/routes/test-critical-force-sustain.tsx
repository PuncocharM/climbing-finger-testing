import "../../styles/common.scss"
import {Workout} from "../components/Workout.tsx";
import {WorkoutType} from "../components/workout-commons.ts";


export default function CriticalForceTestRepeatersRoute() {
    return <Workout workoutType={WorkoutType.CRITICAL_FORCE_TEST_SUSTAINED}/>
}
