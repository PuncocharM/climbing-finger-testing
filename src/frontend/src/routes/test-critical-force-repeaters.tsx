import "../../styles/common.scss"
import {Test} from "../components/Test.tsx";
import {TestType} from "../components/test-commons.ts";


export default function CriticalForceTestRepeatersRoute() {
    return <Test testType={TestType.CRITICAL_FORCE_REPEATERS}/>
}
