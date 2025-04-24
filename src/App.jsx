import React, { useContext, useState } from "react";
import "./App.css";
import va from "./assets/pheoni.gif";
import { TiMicrophone } from "react-icons/ti";
import { IoMdSend } from "react-icons/io";
import { FaCamera } from "react-icons/fa";
import { datacontext } from "./context/UserContext";
import speakimg from "./assets/speak.gif";
import speakingimg from "./assets/aiVoice.gif";
import Sidebar from "./components/Sidebar";  
import { FiMenu } from "react-icons/fi";
import CameraPopup from "./components/CameraPopup";

function App() {
  const { recog, speaking, setSpeaking, recogtext, response, setrecogtext, setresponse, handleTextInput, startCamera, stopCamera, stream, processImage } = useContext(datacontext);
  const [userInput, setUserInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handleCameraOpen = () => {
    setIsCameraOpen(true);
    startCamera();
  };

  const handleCameraClose = () => {
    stopCamera();
    setIsCameraOpen(false);
  };

  return (
    <div className="app-container">
      <Sidebar isOpen={sidebarOpen} closeSidebar={() => setSidebarOpen(false)} />

      <div className={`main ${sidebarOpen ? "shifted" : ""}`}>
        <img src={va} alt="Pheoni" id="pheoni" />
        <span>Hi, I'm Pheoni. How can I Help You?</span>

        <div className="input-container">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type your message..."
          />

          <button
            onClick={() => {
              if (userInput.trim() !== "") {
                handleTextInput(userInput);
                setUserInput("");
              } else {
                setrecogtext("Listening...");
                setSpeaking(true);
                setresponse(false);
                recog.start();
              }
            }}
          >
            {userInput.trim() !== "" ? <IoMdSend /> : <TiMicrophone />}
          </button>

          <button onClick={handleCameraOpen}>
            <FaCamera />
          </button>
        </div>

        {speaking ? (
          <div className="response">
            {!response ? <img src={speakimg} alt="Listening" id="speakimg" /> : <img src={speakingimg} alt="AI Response" id="aigif" />}
            <p>{recogtext}</p>
          </div>
        ) : null}

        {isCameraOpen && (
          <CameraPopup
            stream={stream}
            onCapture={processImage}
            onClose={handleCameraClose}
          />
        )}
      </div>
    </div>
  );
}

export default App;
