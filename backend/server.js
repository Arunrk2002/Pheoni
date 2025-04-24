require("dotenv").config({ path: __dirname + "/mongo.env" });
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { spawn } = require("child_process");
const schedule = require("node-schedule");

const app = express();
app.use(express.json());
app.use(cors());

console.log("🔍 MONGO_URI:", process.env.MONGO_URI);

if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is not defined! Check your .env file.");
    process.exit(1);
}

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB!"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

const meetingSchema = new mongoose.Schema({
    date: String, // Format: YYYY-MM-DD
    time: String, // Format: HH:MM AM/PM or "Not specified"
    withWho: String,
    description: String,
});

const Meeting = mongoose.model("Meeting", meetingSchema);

// Function to parse various date formats
function parseDate(dateText) {
    const today = new Date();
    dateText = dateText.toLowerCase().trim();

    // Handle natural language dates
    if (dateText === "today") {
        return today.toISOString().split("T")[0];
    } else if (dateText === "tomorrow") {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return tomorrow.toISOString().split("T")[0];
    } else if (dateText === "next week") {
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        return nextWeek.toISOString().split("T")[0];
    }

    // Handle specific date formats (e.g., YYYY-MM-DD, DD/MM/YYYY, or "10th March 2025")
    let parsedDate = new Date(dateText);
    if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split("T")[0];
    }

    // Handle formats like "10th March 2025" or "March 10 2025"
    const months = {
        january: "01", jan: "01", february: "02", feb: "02", march: "03", mar: "03",
        april: "04", apr: "04", may: "05", june: "06", jun: "06", july: "07", jul: "07",
        august: "08", aug: "08", september: "09", sep: "09", october: "10", oct: "10",
        november: "11", nov: "11", december: "12", dec: "12"
    };

    const dateParts = dateText.match(/(\d+)(?:st|nd|rd|th)?\s*(\w+)\s*(\d{4})/);
    if (dateParts) {
        const day = dateParts[1].padStart(2, "0");
        const month = months[dateParts[2].toLowerCase()];
        const year = dateParts[3];
        if (month) {
            return `${year}-${month}-${day}`;
        }
    }

    // Handle DD/MM/YYYY or DD-MM-YYYY
    const numericDate = dateText.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (numericDate) {
        const day = numericDate[1].padStart(2, "0");
        const month = numericDate[2].padStart(2, "0");
        const year = numericDate[3];
        return `${year}-${month}-${day}`;
    }

    return null; // Invalid date
}

// Function to delete past meetings
async function deletePastMeetings() {
    try {
        const now = new Date();
        const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
        const currentTime = now.toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "2-digit" }); // e.g., "3:30 PM"

        console.log(`🕒 Checking for past meetings at ${currentDate} ${currentTime}`);

        const meetings = await Meeting.find();
        let deletedCount = 0;

        for (const meeting of meetings) {
            if (meeting.time === "Not specified") {
                // Delete if the date is before today
                if (meeting.date < currentDate) {
                    await Meeting.deleteOne({ _id: meeting._id });
                    deletedCount++;
                }
            } else {
                // Parse meeting date and time
                const meetingDateTime = new Date(`${meeting.date} ${meeting.time}`);
                if (meetingDateTime < now) {
                    await Meeting.deleteOne({ _id: meeting._id });
                    deletedCount++;
                }
            }
        }

        if (deletedCount > 0) {
            console.log(`🗑️ Deleted ${deletedCount} past meeting(s).`);
        } else {
            console.log("✅ No past meetings to delete.");
        }
    } catch (error) {
        console.error("❌ Error deleting past meetings:", error);
    }
}

// Schedule the deletion job to run every hour
schedule.scheduleJob("0 * * * *", deletePastMeetings);

// Route to schedule a meeting
app.post("/schedule", async (req, res) => {
    try {
        const userInput = req.body.message.toLowerCase().trim();

        // Flexible regex to match various scheduling commands
        const match = userInput.match(/(?:arrange|schedule|set up|book)\s+a?\s*meeting\s*(?:on|for)?\s*([\w\s-]+?)(?:\s*at\s*([\d:]+(?:\s*[ap]m)?))?\s*(?:with|for)\s*([\w\s]+)/i);
        if (match) {
            let dateText = match[1].trim();
            let time = match[2] ? match[2].trim() : "Not specified"; // Default if time is not provided
            const withWho = match[3].trim();
            const description = "Meeting";

            // Parse the date
            let parsedDate = parseDate(dateText);
            if (!parsedDate) {
                return res.status(400).json({ error: `⚠️ Could not understand the date: "${dateText}". Try YYYY-MM-DD or natural formats like "tomorrow" or "10th March 2025".` });
            }

            const meeting = new Meeting({ date: parsedDate, time, withWho, description });

            await meeting.save();

            return res.json({ response: `✅ Meeting scheduled successfully on ${parsedDate} at ${time} with ${withWho}!` });
        } else {
            return res.status(400).json({ error: "⚠️ Invalid format. Try: 'schedule a meeting on 2025-03-10 at 3:30 PM with John' or 'book a meeting tomorrow with Alice'" });
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

// Route to cancel a meeting
app.post("/cancel", async (req, res) => {
    try {
        console.log("🔍 Cancel request received:", req.body.message);

        const userInput = req.body.message.toLowerCase().trim();
        // Flexible regex for cancellation commands
        const match = userInput.match(/(?:cancel|delete|remove)\s+(?:the|a)?\s*meeting\s*(?:on|for)?\s*([\w\s-]+?)(?:\s*with|for|involving)\s*([\w\s]+)/i);

        if (!match) {
            console.log("⚠️ Regex didn't match the input.");
            return res.json({ response: "⚠️ Could not understand the cancellation request. Try: 'cancel the meeting on 2025-03-10 with John'" });
        }

        let dateText = match[1].trim();
        let withWho = match[2].trim();

        console.log("🔍 Extracted Date:", dateText, "| WithWho:", withWho);

        let parsedDate = parseDate(dateText);
        if (!parsedDate) {
            console.log(`⚠️ Could not parse date: "${dateText}"`);
            return res.json({ response: `⚠️ Could not understand the date: "${dateText}". Use YYYY-MM-DD or natural formats like "tomorrow" or "10th March 2025".` });
        }

        console.log("🔍 Parsed Date:", parsedDate);

        // Delete meetings matching date and withWho
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
    const match = userInput.match(/(?:arrange|schedule|set up|book)\s+a?\s*meeting\s*(?:on|for)?\s*([\w\s-]+?)(?:\s*at\s*([\d:]+(?:\s*[ap]m)?))?\s*(?:with|for)\s*([\w\s]+)/i);
    if (match) {
        let dateText = match[1].trim();
        let time = match[2] ? match[2].trim() : "Not specified";
        const withWho = match[3].trim();
        const description = "Meeting";

        let parsedDate = parseDate(dateText);
        if (!parsedDate) {
            return res.json({ response: `⚠️ Could not understand the date: "${dateText}". Try YYYY-MM-DD or natural formats like "tomorrow" or "10th March 2025".` });
        }

        const meeting = new Meeting({ date: parsedDate, time, withWho, description });
        await meeting.save();

        return res.json({ response: `✅ Meeting scheduled successfully on ${parsedDate} at ${time} with ${withWho}!` });
    }

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

    ollamaProcess.stdin.write(userInput + "\n");
    ollamaProcess.stdin.end();
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => console.log(`🔥 Server running on http://localhost:${PORT}`));
