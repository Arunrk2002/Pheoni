import React, { createContext, useState, useEffect } from 'react';
import Papa from 'papaparse';
import jsonData from '../assets/data.json';

export const datacontext = createContext();

function UserContext({ children }) {
    const [speaking, setSpeaking] = useState(false);
    const [recogtext, setrecogtext] = useState("listening...");
    const [response, setresponse] = useState(false);
    const [qaData, setQaData] = useState([]);  // Store combined data

    useEffect(() => {
        // Fetch CSV file from the public folder
        fetch('/dialogs_expanded.csv')
            .then(response => response.text())
            .then(csvText => {
                Papa.parse(csvText, {
                    header: true,
                    complete: (results) => {
                        const combinedData = [...jsonData, ...results.data];
                        setQaData(combinedData);
                    }
                });
            })
            .catch(error => console.error("Error loading CSV:", error));
    }, []);

    function speak(text) {
        const ts = new SpeechSynthesisUtterance(text);
        ts.volume = 1;
        ts.rate = 1;
        ts.pitch = 2;
        ts.lang = "en-US";
        window.speechSynthesis.speak(ts);
    }

    function air(prompt) {
        const match = qaData.find(qa => qa.question && prompt.includes(qa.question.toLowerCase()));
        const responseText = match ? match.answer : "Sorry, I don't have an answer for that.";
        setrecogtext(responseText);
        speak(responseText);
        setresponse(true);
        setTimeout(() => setSpeaking(false), 5000);
    }

    function takeCommand(command) {
        if (command.includes("open") && command.includes("youtube")) {
            window.open("https://www.youtube.com/", "_blank");
            speak("Opening YouTube");
            setrecogtext("Opening YouTube...");
            setTimeout(() => setSpeaking(false), 5000);
        } else {
            air(command);
        }
    }
    

    const sr = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new sr();
    recog.onresult = (e) => {
        const trans = e.results[e.resultIndex][0].transcript;
        setrecogtext(trans);
        takeCommand(trans.toLowerCase());  // Correct function call
    };
    

    const value = {
        recog,
        speaking,
        setSpeaking,
        recogtext,
        setrecogtext,
        response,
        setresponse
    };

    return (
        <datacontext.Provider value={value}>
            {children}
        </datacontext.Provider>
    );
}

export default UserContext;
