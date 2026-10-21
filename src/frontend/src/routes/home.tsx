import {useNavigate} from "react-router";
import "bootstrap/dist/js/bootstrap.bundle.min.js"
import {resetMaxWeight, Scale, sendCalibrate, sendCommand} from "../components/Scale.tsx";
import React from "react";
import "../../styles/common.scss"
import {PageContainer, ScaleContainer} from "../components/utilComponents.tsx";

export default function Home(): React.JSX.Element {
  const navigate = useNavigate();



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

            <Scale displayMaxWeight={true} />

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
              <div className="col-12">
                <button
                    onClick={() => navigate("/history")}
                    className="btn btn-outline-light w-100 py-2 fw-bold rounded-3"
                >View past tests
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
