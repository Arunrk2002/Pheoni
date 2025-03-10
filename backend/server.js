require("dotenv").config({ path: __dirname + "/mongo.env" });
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { spawn } = require("child_process");


const app = express();
app.use(express.json());
app.use(cors());

console.log("🔍 MONGO_URI:", process.env.MONGO_URI); // Debugging

if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is not defined! Check your .env file.");
    process.exit(1);
}



// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB!"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));


const meetingSchema = new mongoose.Schema({
    date: String,  // Format: YYYY-MM-DD
    time: String, 
    withWho: String, // Format: HH:MM AM/PM
    description: String,
});

const Meeting = mongoose.model("Meeting", meetingSchema);

// Route to schedule a meeting
app.post("/schedule", async (req, res) => {
    try {
        const userInput = req.body.message; // Ensure the request contains a message

        const match = userInput.match(/arrange a meeting on (.*?) at (.*)/);
        if (match) {
            const date = match[1].trim();
            const time = match[2].trim();
            const description = "Meeting";

            const meeting = new Meeting({ date, time, description });

            await meeting.save(); // Ensure save() is awaited inside an async function

            return res.json({ response: "✅ Meeting scheduled successfully!" });
        } else {
            return res.status(400).json({ error: "⚠️ Invalid meeting format. Try: 'arrange a meeting on 2025-03-10 at 15:30'" });
        }
    } catch (error) {
        console.error("❌ Error saving meeting:", error);
        return res.status(500).json({ error: "❌ Failed to schedule meeting" });
    }
});


// Route to fetch all meetings
app.get("/meetings", async (req, res) => {
    const meetings = await Meeting.find();
    res.json(meetings);
});

// Process user input and detect meeting-related queries
app.post("/ask", async (req, res) => {
    const userInput = req.body.prompt.toLowerCase().trim();

    // Check if the user is asking about meetings
    if (userInput.includes("what meetings do i have")) {
        const meetings = await Meeting.find();
        if (meetings.length === 0) {
            return res.json({ response: "📭 You have no scheduled meetings." });
        }

        const meetingText = meetings.map(m => `📅 ${m.date} at ${m.time}`).join(". ");
        return res.json({ response: meetingText });
    }

    // Check if the user is scheduling a meeting
    const match = userInput.match("arrange a meeting on (.*?) at (.*) with (.*)");
    if (match) {
        const date = match[1].trim();
        const time = match[2].trim();
        const withWho = match[3].trim();
        const description = "Meeting";

        const meeting = new Meeting({ date, time, withWho, description });
        await meeting.save();

        return res.json({ response: "✅ Meeting scheduled successfully!" });
    }

    app.delete("/delete-meetings", async (req, res) => {
        const { withWho, date } = req.body;
    
        // Build dynamic query based on user input
        let query = {};
        if (withWho) query.withWho = withWho;
        if (date) query.date = date;
    
        const deletedMeetings = await Meeting.deleteMany(query);
    
        if (deletedMeetings.deletedCount > 0) {
            return res.json({ response: `🗑️ ${deletedMeetings.deletedCount} meeting(s) deleted!` });
        } else {
            return res.json({ response: `⚠️ No matching meetings found!` });
        }
    });
    

    // Default: Query Ollama
    const ollamaProcess = spawn("ollama", ["run", "qwen:1.8b"], { shell: true });

    let responseText = "";

    ollamaProcess.stdout.on("data", (data) => {
        responseText += data.toString();
    });

    ollamaProcess.stderr.on("data", (data) => {
        console.error(`Error: ${data}`);
    });

    ollamaProcess.on("close", (code) => {
        console.log(`Ollama process exited with code ${code}`);
        res.json({ response: responseText.trim() });
    });

    // Send user input to Ollama
    ollamaProcess.stdin.write(userInput + "\n");
    ollamaProcess.stdin.end();
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => console.log(`🔥 Server running on http://localhost:${PORT}`));
