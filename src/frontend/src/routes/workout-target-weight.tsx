import {ButtonHome, NumberInputRow, PageContainer, ScaleContainer} from "../components/utilComponents.tsx";
import React, {useState} from "react";
import {Scale} from "../components/Scale.tsx";


export default function WorkoutTargetWeight(){
    const [targetWeight, setTargetWeight] = useState<number>(1);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>)=> {
        setTargetWeight(Number(e.currentTarget.value));
    }

    return (
        <PageContainer>
            <ButtonHome />
            <ScaleContainer>
                <Scale displayMaxWeight={true} targetWeight={targetWeight}/>
                <div className="card card-body bg-dark-subtle">
                    <form>
                        <NumberInputRow field_id="targetWeight" field_name="Target weight" defaultValue={1} onChange={handleChange}/>
                    </form>
                </div>
            </ScaleContainer>
        </PageContainer>
    )
}