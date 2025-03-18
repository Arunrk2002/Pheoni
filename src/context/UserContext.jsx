import React, { createContext, useState, useEffect } from "react";
import Papa from "papaparse";
import nlp from "compromise";

export const datacontext = createContext();

function UserContext({ children }) {
    const [speaking, setSpeaking] = useState(false);
    const [recogtext, setrecogtext] = useState("Listening...");
    const [response, setresponse] = useState(false);
    const [qaData, setQaData] = useState([]);  // Combined Data (JSON + CSV + DB)
    const [savedLinks, setSavedLinks] = useState([]);  // Store user links

    useEffect(() => {
        async function loadData() {
            try {
                // ✅ Fetch JSON file
                const jsonResponse = await fetch('/assets/data.json');
                if (!jsonResponse.ok) throw new Error("Failed to fetch data.json");
                const jsonData = await jsonResponse.json();
    
                // ✅ Fetch CSV file
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
    
        // ✅ Ensure LocalStorage is fetched correctly
        const storedLinks = JSON.parse(localStorage.getItem("userLinks")) || [];
        console.log("📂 Loaded Links from Storage:", storedLinks); // ✅ Debugging
    
        if (storedLinks.length > 0) {
            setSavedLinks(storedLinks);
        }
    
        loadData();
    }, []);
    
    

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

        // ✅ Check JSON + CSV + MongoDB first
        const match = qaData.find(qa => qa.question && prompt.toLowerCase().includes(qa.question.toLowerCase()));
        
        if (match) {
            const responseText = match.answer;
            setrecogtext(responseText);
            speak(responseText);
            setresponse(true);
            return;
        }

        // ✅ If not found, query Ollama
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
        const cleanedCommand = command.toLowerCase().trim();
    
        if (cleanedCommand.startsWith("open ")) {
            const linkName = cleanedCommand.substring(5).trim();
            
            console.log("🔎 Searching for:", linkName);
            console.log("📁 Available Links:", savedLinks);
    
            const foundLink = savedLinks.find(link => 
                link.name.toLowerCase().trim() === linkName
            );
    
            if (foundLink && foundLink.url) {
                console.log("✅ Found link:", foundLink);
                window.open(foundLink.url, "_blank");
                setrecogtext(`Opening ${foundLink.name}...`);
                speak(`Opening ${foundLink.name}`);
            } else {
                console.warn("❌ Link not found!");
                setrecogtext("Sorry, I couldn't find that link.");
                speak("Sorry, I couldn't find that link.");
            }
            return;
        }
    
        air(cleanedCommand);
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
            if (cleanedText.toLowerCase().startsWith("open ")) {
                let linkName = cleanedText.substring(5).trim().toLowerCase();
                let foundLink = savedLinks.find(link => link.name.toLowerCase() === linkName);
    
                if (foundLink) {
                    window.open(foundLink.url, "_blank");
                    setrecogtext(`Opening ${foundLink.name}...`);
                    setresponse(true);
                    return;
                } else {
                    setrecogtext("Sorry, I couldn't find that link.");
                    setresponse(true);
                    return;
                }
            }
            setTimeout(() => takeCommand(cleanedText), 0);
        }
    }

    // ✅ Add a new link (Prevents duplicates)
    function addLink(name, url) {
        // ✅ Check if the link already exists
        const exists = savedLinks.some(link => link.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            setrecogtext(`${name} is already saved.`);
            speak(`${name} is already saved.`);
            return;
        }
    
        // ✅ Create a new updated array
        const updatedLinks = [...savedLinks, { name, url }];
    
        // ✅ Update localStorage first
        localStorage.setItem("userLinks", JSON.stringify(updatedLinks));
    
        // ✅ Ensure the state updates properly
        setSavedLinks([...updatedLinks]); // Force a re-render
    
        console.log("🔗 Updated Saved Links:", updatedLinks); // ✅ Debugging
        setrecogtext(`${name} saved successfully.`);
        speak(`${name} saved successfully.`);
    }
    
    

    // ✅ Remove a saved link
    function removeLink(name) {
        const updatedLinks = savedLinks.filter(link => link.name.toLowerCase() !== name.toLowerCase());
        setSavedLinks(updatedLinks);
        localStorage.setItem("savedLinks", JSON.stringify(updatedLinks));
        setrecogtext(`${name} has been removed.`);
        speak(`${name} has been removed.`);
    }

    // ✅ Delete a meeting from MongoDB
    async function deleteMeeting(withWho) {
        try {
            const response = await fetch("http://localhost:5000/delete-meeting", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ withWho }),
            });

            const data = await response.json();
            setrecogtext(data.response);
            speak(data.response);

        } catch (error) {
            console.error("❌ Error deleting meeting:", error);
            setrecogtext("⚠️ Failed to delete meetings!");
            speak("Failed to delete meetings.");
        }
    }

    const value = { recog, speaking, setSpeaking, recogtext, setrecogtext, response, setresponse, handleTextInput, savedLinks, addLink, removeLink };

    return <datacontext.Provider value={value}>{children}</datacontext.Provider>;
}

export default UserContext;
