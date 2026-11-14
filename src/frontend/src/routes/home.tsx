import {useNavigate} from "react-router";
import "bootstrap/dist/js/bootstrap.bundle.min.js"
import {resetMaxWeight, Scale, sendCalibrate, sendCommand} from "../components/Scale.tsx";
import React, {useRef, useState} from "react";
import "../../styles/common.scss"
import {PageContainer, ScaleContainer} from "../components/utilComponents.tsx";
import {playBeep} from "../components/workout-commons.ts";

export const MetronomeIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...props}>
      <path fill="currentColor" d="m12 1.75l-3.43.92l-4.51 16.86c-.03.15-.06.31-.06.47c0 1.11.89 2 2 2h12c1.11 0 2-.89 2-2c0-.16-.03-.32-.06-.47l-1.36-5.11L17 16l.2 1h-3.79l2.84-2.84l-1.41-1.41L10.59 17H6.8l3.49-13h3.42l1.46 5.43l1.63-1.64l-1.37-5.12zM11.25 5v9.75l1.5-1.5V5zm8.54 2.8l-2.83 2.83l-.71-.71l-1.41 1.42l2.82 2.82l1.42-1.41l-.71-.71l2.83-2.83z"/>
    </svg>
);

export default function Home(): React.JSX.Element {
  const navigate = useNavigate();
  const [useTargetWeight, setUseTargetWeight] = useState<boolean>(false);
  const [targetWeight, setTargetWeight] = useState<number>(1);
  const metronomeRef = useRef<number>(0)


  const stopMetronome = () => {
    if (metronomeRef.current > 0) {
      clearInterval(metronomeRef.current);
      metronomeRef.current = 0;
    }
  }

  const metronomeBeat = () => {
    playBeep(440, 200)
  }

  const handleToggleUseMetronome = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
        stopMetronome()
        metronomeBeat()
        metronomeRef.current = window.setInterval(metronomeBeat, 1000);
      } else {
        stopMetronome()
      }
  }


  const handleToggleUseTargetWeight = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUseTargetWeight(e.target.checked);
  }

  const handleChangeTargetWeight = (e: React.ChangeEvent<HTMLInputElement>)=> {
    setTargetWeight(Number(e.currentTarget.value));
  }



  function submitCalibrate(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const weight = formData.get("weight");
    if (weight == null) {
      alert("Please enter a weight");
      return null;
    }
    sendCalibrate(Number(weight));
  }



  return (
      <>
        <PageContainer>
          <ScaleContainer>

            <Scale displayMaxWeight={true} targetWeight={useTargetWeight ? targetWeight : null} />

            <div className="row g-2 mb-2">
              <div className="col-4">
                <button onClick={() => sendCommand('tare')}
                        className="btn btn-primary w-100 py-2 fw-bold rounded-3 h-100">Tare
                </button>
              </div>
              <div className="col-4">
                <button onClick={resetMaxWeight}
                        className="btn btn-warning w-100 py-2 fw-bold rounded-3 h-100">
                  Reset Max Weight
                </button>
              </div>
              <div className="col-4">
                <button
                    data-bs-toggle="modal" data-bs-target="#calibrateModal"
                    className="btn btn-dark w-100 py-2 fw-bold rounded-3 h-100"
                >Calibrate
                </button>
              </div>
            </div>

            <form onSubmit={(e) => e.preventDefault()}>
              <div className="row g-2 mt-2">
                <div className="col-6">
                  <input type="checkbox" className="btn-check" id="btn-target-weight" autoComplete="off"
                         name="useTargetWeight" onChange={handleToggleUseTargetWeight} />
                  <label className="btn btn-outline-light" htmlFor="btn-target-weight"><i className="bi bi-bullseye"></i> Use Target Weight</label>
                </div>
                {useTargetWeight &&
                  <div className="col-6">
                    <div className="input-group">
                      <input  type="number" className="form-control" name="targetWeight" id="targetWeight" min={0}
                            defaultValue={targetWeight} onChange={handleChangeTargetWeight}/>
                      <span className="input-group-text">kg</span>
                    </div>
                  </div>
                }
              </div>
            </form>

            <div className="row g-2 mt-2">
              <div className="col-6">
                <input type="checkbox" className="btn-check" id="btn-metronome" autoComplete="off"
                       name="useMetronome" onChange={handleToggleUseMetronome} />
                <label className="btn btn-outline-light" htmlFor="btn-metronome">
                  <MetronomeIcon /> Play Click</label>
              </div>
            </div>


            <div className="row g-2 mt-2">
              <div className="col-6">
                <button
                    onClick={() => navigate("/test-critical-force-repeaters")}
                    className="btn btn-outline-light w-100 py-2 fw-bold rounded-3"
                >Run Critical Force Test (repeaters)
                </button>
              </div>
              <div className="col-6">
                <button
                    onClick={() => navigate("/test-critical-force-sustain")}
                    className="btn btn-outline-light w-100 py-2 fw-bold rounded-3"
                >Run Critical Force Test (sustain)
                </button>
              </div>
              <div className="col-6">
                <button
                    onClick={() => navigate("/test-peak-force")}
                    className="btn btn-outline-light w-100 py-2 fw-bold rounded-3"
                >Run Peak Force Test (MVC)
                </button>
              </div>
            </div>
            <div className="row g-2 mt-2">
              <div className="col-6">
                <button
                    onClick={() => navigate("/workout-repeaters")}
                    className="btn btn-outline-light w-100 py-2 fw-bold rounded-3"
                >Repeater workout
                </button>
              </div>
            </div>
            <div className="row g-2 mt-2">
              <div className="col-12">
                <button
                    onClick={() => navigate("/history")}
                    className="btn btn-outline-light w-100 py-2 fw-bold rounded-3"
                ><i className="bi bi-journal-text"></i> View Past Tests & Workouts
                </button>
              </div>
            </div>
          </ScaleContainer>
        </PageContainer>

        <div className="modal fade" id="calibrateModal">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Scale Calibration</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div className="modal-body">
                <p>
                  Place a known weight on the scale. Make sure it is tared first.
                </p>
                <form onSubmit={e => submitCalibrate(e)}>
                  <div className="input-group">
                    <input className="form-control" type="text" name="weight" placeholder="Placed weight in kg"/>
                    <button className="btn btn-primary" type="submit">Calibrate</button>
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
      </>
  );
}
