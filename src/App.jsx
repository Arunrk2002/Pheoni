import React, { useContext, useState } from 'react';
import "./App.css";
import va from "./assets/pheoni.gif";
import { TiMicrophone } from "react-icons/ti";
import { IoMdSend } from "react-icons/io";  // Send icon
import { datacontext } from './context/UserContext';
import speakimg from './assets/speak.gif';
import speakingimg from './assets/aiVoice.gif';

function App() {
  let { recog, speaking, setSpeaking, recogtext, response, setrecogtext, setresponse, handleTextInput } = useContext(datacontext);

  const [userInput, setUserInput] = useState(""); // Store user input

  return (
    <div className='main'>
      <img src={va} alt='' id='pheoni'/>
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
              handleTextInput(userInput); // Send text to AI
              setUserInput(""); // Clear input
            } else {
              setrecogtext("Listening...");
              setSpeaking(true);
              setresponse(false);
              recog.start(); // Start voice recognition
            }
          }}
        >
          {userInput.trim() !== "" ? <IoMdSend />: <TiMicrophone />} {/* Toggle button */}
        </button>
      </div>
  
      {speaking ? (
        <div className='response'>
          {!response ? <img src={speakimg} alt='' id='speakimg' /> : <img src={speakingimg} alt='' id='aigif' />}
          <p>{recogtext}</p>
        </div>
      ) : null}
    </div>
  );
  
}

export default App;
