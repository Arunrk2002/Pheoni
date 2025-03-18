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
    time: String,  // Format: HH:MM AM/PM
    withWho: String, 
    description: String,
});

const Meeting = mongoose.model("Meeting", meetingSchema);

// Route to schedule a meeting
app.post("/schedule", async (req, res) => {
    try {
        const userInput = req.body.message;

        const match = userInput.match(/arrange a meeting on (.*?) at (.*?) with (.*)/);
        if (match) {
            const date = match[1].trim();
            const time = match[2].trim();
            const withWho = match[3].trim(); 
            const description = "Meeting";

            const meeting = new Meeting({ date, time, withWho, description });

            await meeting.save();

            return res.json({ response: "✅ Meeting scheduled successfully!" });
        } else {
            return res.status(400).json({ error: "⚠️ Invalid format. Try: 'arrange a meeting on 2025-03-10 at 15:30 with John'" });
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

        const meetingText = meetings.map(m => `📅 ${m.date} at ${m.time} with ${m.withWho}`).join(". ");
        return res.json({ response: meetingText });
    }

    // Check if the user is scheduling a meeting
    const match = userInput.match(/arrange a meeting on (.*?) at (.*?) with (.*)/);
    if (match) {
        const date = match[1].trim();
        const time = match[2].trim();
        const withWho = match[3].trim();
        const description = "Meeting";

        const meeting = new Meeting({ date, time, withWho, description });
        await meeting.save();

        return res.json({ response: "✅ Meeting scheduled successfully!" });
    }

    // Check if the user wants to cancel a meeting
    // const cancelMatch = userInput.match(/meeting scheduled (?:for|on) (.*?) (?:with|by|involving) (.*?) has been cancelled/i);

    // if (cancelMatch) {
    //     let dateText = cancelMatch[1].trim();
    //     let withWho = cancelMatch[2].trim();

    //     // Convert common date formats (e.g., "11th March 2025" → "2025-03-11")
    //     let parsedDate = new Date(dateText);

    //     // Handle cases where Date() fails
    //     if (isNaN(parsedDate.getTime())) {
    //         const months = {
    //             "january": "01", "february": "02", "march": "03", "april": "04", "may": "05", "june": "06",
    //             "july": "07", "august": "08", "september": "09", "october": "10", "november": "11", "december": "12"
    //         };

    //         let dateParts = dateText.toLowerCase().match(/(\d+)(?:st|nd|rd|th)? (\w+) (\d{4})/);
    //         if (dateParts) {
    //             let day = dateParts[1].padStart(2, "0"); // Ensure two-digit day
    //             let month = months[dateParts[2]];  // Convert month name to number
    //             let year = dateParts[3];
    //             parsedDate = `${year}-${month}-${day}`;
    //         } else {
    //             return res.json({ response: `⚠️ Could not understand the date: "${dateText}". Please use YYYY-MM-DD format.` });
    //         }
    //     } else {
    //         parsedDate = parsedDate.toISOString().split("T")[0];
    //     }

    //     // Perform deletion
    //     const deletedMeetings = await Meeting.deleteMany({ date: parsedDate, withWho });

    //     if (deletedMeetings.deletedCount > 0) {
    //         return res.json({ response: `🗑️ Deleted ${deletedMeetings.deletedCount} meeting(s) on ${parsedDate} with ${withWho}.` });
    //     } else {
    //         return res.json({ response: `⚠️ No matching meetings found on ${parsedDate} with ${withWho}.` });
    //     }
    // }

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
app.post("/cancel", async (req, res) => {
    try {
        console.log("🔍 Cancel request received:", req.body.message);

        const userInput = req.body.message.toLowerCase();
        const match = userInput.match(/meeting scheduled (?:for|on) (.*?) (?:with|by|involving) (.*?) has been cancelled/i);

        if (!match) {
            console.log("⚠️ Regex didn't match the input.");
            return res.json({ response: "⚠️ Could not understand the cancellation request." });
        }

        let dateText = match[1].trim();
        let withWho = match[2].trim();

        console.log("🔍 Extracted Date:", dateText, "| WithWho:", withWho);

        let parsedDate = parseDate(dateText);
        if (!parsedDate) {
            console.log(`⚠️ Could not parse date: "${dateText}"`);
            return res.json({ response: `⚠️ Could not understand the date: "${dateText}". Use YYYY-MM-DD format.` });
        }

        console.log("🔍 Parsed Date:", parsedDate);

        // Try different ways to match `withWho`
        const deletedMeetings = await Meeting.deleteMany({
            date: parsedDate,
            withWho: { $regex: new RegExp(`^${withWho.trim()}$`, "i") } // Case-insensitive exact match
        });

        console.log("🗑️ Deletion Attempt:", deletedMeetings);

        if (deletedMeetings.deletedCount > 0) {
            return res.json({ response: `🗑️ Deleted ${deletedMeetings.deletedCount} meeting(s) on ${parsedDate} with ${withWho}.` });
        } else {
            return res.json({ response: `⚠️ No meetings found on ${parsedDate} with ${withWho}.` });
        }
    } catch (error) {
        console.error("❌ Error deleting meeting:", error);
        return res.status(500).json({ error: "❌ Failed to delete meeting" });
    }
});


// Start the server
const PORT = 5000;
app.listen(PORT, () => console.log(`🔥 Server running on http://localhost:${PORT}`));
