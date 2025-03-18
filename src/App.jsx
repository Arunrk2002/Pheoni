import React, { useContext, useState } from "react";
import "./App.css";
import va from "./assets/pheoni.gif";
import { TiMicrophone } from "react-icons/ti";
import { IoMdSend } from "react-icons/io";
import { datacontext } from "./context/UserContext";
import speakimg from "./assets/speak.gif";
import speakingimg from "./assets/aiVoice.gif";
import Sidebar from "./components/Sidebar";  
import { FiMenu } from "react-icons/fi"; // Import menu icon

function App() {
  const { recog, speaking, setSpeaking, recogtext, response, setrecogtext, setresponse, handleTextInput } = useContext(datacontext);
  const [userInput, setUserInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false); // Sidebar toggle state

  return (
    <div className="app-container">
      {/* Hamburger Button to Open Sidebar
      {!sidebarOpen && (
        <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
          <FiMenu size={24} />
        </button>
      )} */}

      {/* Sidebar (visible when sidebarOpen is true) */}
      <Sidebar isOpen={sidebarOpen} closeSidebar={() => setSidebarOpen(false)} />

      {/* Main content */}
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
        </div>

        {speaking ? (
          <div className="response">
            {!response ? <img src={speakimg} alt="Listening" id="speakimg" /> : <img src={speakingimg} alt="AI Response" id="aigif" />}
            <p>{recogtext}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default App;
