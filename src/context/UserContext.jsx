import React, { createContext, useState, useEffect } from 'react';
import Papa from 'papaparse';
//import jsonData from '../assets/data.json';
import nlp from 'compromise';

export const datacontext = createContext();

function UserContext({ children }) {
    const [speaking, setSpeaking] = useState(false);
    const [recogtext, setrecogtext] = useState("Listening...");
    const [response, setresponse] = useState(false);
    const [qaData, setQaData] = useState([]);  // Combined Data (JSON + CSV + DB)

    useEffect(() => {
        async function loadData() {
            try {
                // ✅ Fetch JSON file dynamically
                const jsonResponse = await fetch('/assets/data.json');
                if (!jsonResponse.ok) throw new Error("Failed to fetch data.json");
                const jsonData = await jsonResponse.json();

                console.log("✅ JSON Data Loaded:", jsonData);

                // ✅ Fetch CSV file dynamically
                const csvResponse = await fetch('/dialogs_expanded.csv');
                if (!csvResponse.ok) throw new Error("Failed to fetch CSV file");
                const csvText = await csvResponse.text();

                let csvData = [];
                Papa.parse(csvText, {
                    header: true,
                    complete: (results) => {
                        csvData = results.data;
                    }
                });

                // ✅ Fetch MongoDB Data
                const dbResponse = await fetch("http://localhost:5000/meetings");
                if (!dbResponse.ok) throw new Error("Failed to fetch MongoDB data");
                const dbData = await dbResponse.json();

                // ✅ Combine JSON + CSV + MongoDB Data
                const combinedData = [...jsonData, ...csvData, ...dbData];
                setQaData(combinedData);

                console.log("✅ All Data Loaded Successfully:", combinedData);

            } catch (error) {
                console.error("❌ Error loading data:", error);
            }
        }

        loadData();
    }, []);
    async function deleteMeeting(withWho) {
        try {
            const response = await fetch("http://localhost:5000/delete-meeting", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ withWho }),
            });
    
            const data = await response.json();
            console.log(data.response); // ✅ Log response from backend
            return data.response;
        } catch (error) {
            console.error("❌ Error deleting meeting:", error);
            return "⚠️ Failed to delete meeting!";
        }
    }


    function speak(text) {
        if (!text || typeof text !== "string") return;

        window.speechSynthesis.cancel();
        const ts = new SpeechSynthesisUtterance(text);
        ts.volume = 1;
        ts.rate = 1;
        ts.pitch = 1.2;
        ts.lang = "en-US";

        setSpeaking(true);
        ts.onend = () => setSpeaking(false);
        window.speechSynthesis.speak(ts);
    }

    function preprocessText(inputText) {
        let doc = nlp(inputText);
        return doc.sentences().out('text').toLowerCase().trim();
    }

    async function air(prompt) {
        setrecogtext("Thinking...");
        setresponse(false);
        setSpeaking(true);

        // 1️⃣ Check JSON + CSV + MongoDB first
        const match = qaData.find(qa => qa.question && prompt.toLowerCase().includes(qa.question.toLowerCase()));
        
        if (match) {
            const responseText = match.answer;
            setrecogtext(responseText);
            speak(responseText);
            setresponse(true);
            return;
        }

        // 2️⃣ If not found, query Ollama
        const timeout = setTimeout(() => {
            setrecogtext("Response taking too long. Please try again.");
            speak("Response taking too long. Please try again.");
            setresponse(true);
        }, 10000);

        try {
            const aiResponse = await fetch("http://localhost:5000/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt,
                    role: "You are Pheoni, a concise AI assistant."
                }),
            });

            const data = await aiResponse.json();
            clearTimeout(timeout);
            const responseText = data.response || "Sorry, I don't have an answer.";
            setrecogtext(responseText);
            speak(responseText);
            setresponse(true);

        } catch (error) {
            clearTimeout(timeout);
            console.error("❌ Error:", error);
            setrecogtext("An error occurred. Please try again.");
            speak("An error occurred. Please try again.");
            setresponse(true);
        }
    }

    function takeCommand(command) {
        if (command.includes("open") && command.includes("youtube")) {
            window.open("https://www.youtube.com/", "_blank");
            speak("Opening YouTube");
            setrecogtext("Opening YouTube...");
            setTimeout(() => setSpeaking(false), 3000);
        }
        else if (command.includes("delete all meetings with")) {
            const match = command.match(/delete all meetings with (.+)/);
            if (match) {
                const withWho = match[1].trim();
    
                deleteMeeting(withWho)
                    .then(response => {
                        setrecogtext(response);
                        speak(response);
                    })
                    .catch(error => {
                        setrecogtext("⚠️ Failed to delete meetings!");
                        speak("Failed to delete meetings.");
                    });
    
                return; // Stop further processing
            }
        }  
        else {
            air(command);
        }
    }

    const sr = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new sr();
    recog.onresult = (e) => {
        const trans = e.results[e.resultIndex][0].transcript;
        const cleanedText = preprocessText(trans);
        setrecogtext(cleanedText);
        takeCommand(cleanedText);
    };

    function handleTextInput(inputText) {
        if (inputText.trim() !== "") {
            let cleanedText = preprocessText(inputText);
            setrecogtext(cleanedText);
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
        handleTextInput,
    };

    return (
        <datacontext.Provider value={value}>
            {children}
        </datacontext.Provider>
    );
}

export default UserContext;
