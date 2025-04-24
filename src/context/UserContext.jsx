import React, { createContext, useState, useEffect, useCallback } from "react";
import Papa from "papaparse";
import nlp from "compromise";
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

export const datacontext = createContext();

function UserContext({ children }) {
    const [speaking, setSpeaking] = useState(false);
    const [recogtext, setrecogtext] = useState("Listening...");
    const [response, setresponse] = useState(false);
    const [qaData, setQaData] = useState([]);
    const [savedLinks, setSavedLinks] = useState([]);
    const [stream, setStream] = useState(null);
    const [model, setModel] = useState(null);

    useEffect(() => {
        async function loadData() {
            try {
                const jsonResponse = await fetch('/assets/data.json');
                if (!jsonResponse.ok) throw new Error("Failed to fetch data.json");
                const jsonData = await jsonResponse.json();
    
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
    
                const dbResponse = await fetch("http://localhost:5000/meetings");
                if (!dbResponse.ok) throw new Error("Failed to fetch MongoDB data");
                const dbData = await dbResponse.json();
    
                const combinedData = [...jsonData, ...csvData, ...dbData];
                setQaData(combinedData);
                console.log("✅ All Data Loaded Successfully:", combinedData);
            } catch (error) {
                console.error("❌ Error loading data:", error);
            }
        }
    
        const storedLinks = JSON.parse(localStorage.getItem("userLinks")) || [];
        console.log("📂 Loaded Links from Storage:", storedLinks);
        if (storedLinks.length > 0) {
            setSavedLinks(storedLinks);
        }
    
        loadData();
    }, []);

    useEffect(() => {
        async function loadModel() {
            try {
                await tf.ready();
                const loadedModel = await mobilenet.load();
                setModel(loadedModel);
                console.log("MobileNet model loaded");
            } catch (error) {
                console.error("Error loading model:", error);
            }
        }
        loadModel();
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

        const match = qaData.find(qa => qa.question && prompt.toLowerCase().includes(qa.question.toLowerCase()));
        
        if (match) {
            const responseText = match.answer;
            setrecogtext(responseText);
            speak(responseText);
            setresponse(true);
            return;
        }

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

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStream(stream);
            setrecogtext("Camera started. Click 'Capture' to identify an object.");
            speak("Camera started. Click Capture to identify an object.");
        } catch (error) {
            console.error("Error accessing camera:", error);
            setrecogtext("Failed to access camera.");
            speak("Failed to access camera.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
            setrecogtext("Camera stopped.");
            speak("Camera stopped.");
        }
    };

    const processImage = useCallback(async (imageData) => {
        if (!model) {
            setrecogtext("Model not loaded yet.");
            speak("Model not loaded yet.");
            return;
        }
        try {
            const img = new Image();
            img.src = imageData;
            await img.decode();
            const predictions = await model.classify(img);
            if (predictions.length > 0) {
                const objectLabel = predictions[0].className;
                setrecogtext(`Identified object: ${objectLabel}. Fetching information...`);
                speak(`Identified object: ${objectLabel}. Fetching information...`);
                const prompt = `Tell me about ${objectLabel}`;
                await air(prompt);
            } else {
                setrecogtext("No object detected.");
                speak("No object detected.");
            }
        } catch (error) {
            console.error("Error processing image:", error);
            setrecogtext("Failed to process image.");
            speak("Failed to process image.");
        }
    }, [model, air, setrecogtext, speak]);

    function takeCommand(command) {
        const cleanedCommand = command.toLowerCase().trim();
    
        if (cleanedCommand === "start camera") {
            startCamera();
            return;
        } else if (cleanedCommand === "stop camera") {
            stopCamera();
            return;
        } else if (cleanedCommand.startsWith("open ")) {
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
        } else if (cleanedCommand.match(/(?:cancel|delete|remove)\s+(?:the|a)?\s*meeting\s*(?:on|for)?\s*([\w\s-]+?)(?:\s*with|for|involving)\s*([\w\s]+)/i)) {
            setrecogtext("Processing cancellation...");
            setSpeaking(true);
            setresponse(false);
    
            fetch("http://localhost:5000/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: cleanedCommand }),
            })
                .then(res => res.json())
                .then(data => {
                    setrecogtext(data.response);
                    speak(data.response);
                    setresponse(true);
                })
                .catch(error => {
                    console.error("❌ Error cancelling meeting:", error);
                    setrecogtext("Failed to cancel the meeting.");
                    speak("Failed to cancel the meeting.");
                    setresponse(true);
                });
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

    function addLink(name, url) {
        const exists = savedLinks.some(link => link.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            setrecogtext(`${name} is already saved.`);
            speak(`${name} is already saved.`);
            return;
        }
        const updatedLinks = [...savedLinks, { name, url }];
        localStorage.setItem("userLinks", JSON.stringify(updatedLinks));
        setSavedLinks([...updatedLinks]);
        console.log("🔗 Updated Saved Links:", updatedLinks);
        setrecogtext(`${name} saved successfully.`);
        speak(`${name} saved successfully.`);
    }

    function removeLink(name) {
        const updatedLinks = savedLinks.filter(link => link.name.toLowerCase() !== name.toLowerCase());
        setSavedLinks(updatedLinks);
        localStorage.setItem("userLinks", JSON.stringify(updatedLinks));
        setrecogtext(`${name} has been removed.`);
        speak(`${name} has been removed.`);
    }

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

    const value = {
        recog,
        speaking,
        setSpeaking,
        recogtext,
        setrecogtext,
        response,
        setresponse,
        handleTextInput,
        savedLinks,
        addLink,
        removeLink,
        stream,
        startCamera,
        stopCamera,
        processImage,
    };

    return <datacontext.Provider value={value}>{children}</datacontext.Provider>;
}

export default UserContext;
