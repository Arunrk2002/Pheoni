import React, { createContext, useState, useEffect } from 'react';
import Papa from 'papaparse';
import jsonData from '../assets/data.json';
import nlp from 'compromise'; // Import NLP library

export const datacontext = createContext();

function UserContext({ children }) {
    const [speaking, setSpeaking] = useState(false);
    const [recogtext, setrecogtext] = useState("Listening...");
    const [response, setresponse] = useState(false);
    const [qaData, setQaData] = useState([]);  // Stores combined data (JSON + CSV)

    useEffect(() => {
        // Fetch CSV file and merge with JSON data
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
        if (!text || typeof text !== "string") return;

        // Stop any ongoing speech
        window.speechSynthesis.cancel();

        const ts = new SpeechSynthesisUtterance(text);
        ts.volume = 1;
        ts.rate = 1;
        ts.pitch = 1.2;
        ts.lang = "en-US";

        setSpeaking(true);

        ts.onend = () => {
            setSpeaking(false);
        };

        window.speechSynthesis.speak(ts);
    }

    function preprocessText(inputText) {
        let doc = nlp(inputText);
        let cleanedText = doc.sentences().out('text'); // Remove unnecessary characters
        return cleanedText.toLowerCase().trim();
    }

    function air(prompt) {
        setrecogtext("Thinking...");
        setresponse(false);
        setSpeaking(true);

        // **Search in combined JSON + CSV data**
        const match = qaData.find(qa => qa.question && prompt.toLowerCase().includes(qa.question.toLowerCase()));

        if (match) {
            const responseText = match.answer;
            setrecogtext(responseText);
            speak(responseText);
            setresponse(true);
        } else {
            // If not found, query Ollama (local AI)
            const timeout = setTimeout(() => {
                setrecogtext("Response taking too long. Please try again.");
                speak("Response taking too long. Please try again.");
                setresponse(true);
            }, 10000);

            fetch("http://localhost:5000/ask", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt,
                    role: "You are Pheoni, a concise AI assistant. Provide brief, easy-to-understand answers without unnecessary details."

                }),
            })
            .then(response => response.json())
            .then(data => {
                clearTimeout(timeout);
                const responseText = data.response || "Sorry, I don't have an answer.";
                setrecogtext(responseText);
                speak(responseText);
                setresponse(true);
            })
            .catch(error => {
                clearTimeout(timeout);
                console.error("Error:", error);
                setrecogtext("An error occurred. Please try again.");
                speak("An error occurred. Please try again.");
                setresponse(true);
            });
        }
    }

    function takeCommand(command) {
        if (command.includes("open") && command.includes("youtube")) {
            window.open("https://www.youtube.com/", "_blank");
            speak("Opening YouTube");
            setrecogtext("Opening YouTube...");
            setTimeout(() => setSpeaking(false), 3000);
        } else {
            air(command);
        }
    }

    // Speech Recognition Setup
    const sr = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new sr();
    recog.onresult = (e) => {
        const trans = e.results[e.resultIndex][0].transcript;
        let cleanedText = preprocessText(trans);
        setrecogtext(cleanedText);
        takeCommand(cleanedText);
    };

    // Enhanced text input handler with NLP
    function handleTextInput(inputText) {
        if (inputText.trim() !== "") {
            let cleanedText = preprocessText(inputText);  // Apply NLP cleaning
            setrecogtext(cleanedText);  // Display cleaned text
            setresponse(false);
            setTimeout(() => takeCommand(cleanedText), 0);
        }
    }

    const value = {
        recog,
        speaking,
        setSpeaking,
        recogtext,
        setrecogtext,
        response,
        setresponse,
        handleTextInput,  // Exposing text input function
    };

    return (
        <datacontext.Provider value={value}>
            {children}
        </datacontext.Provider>
    );
}

export default UserContext;
