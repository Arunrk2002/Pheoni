const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");

const app = express();
app.use(express.json());
app.use(cors());

// Route to process user input and send to Ollama
app.post("/ask", async (req, res) => {
    const userInput = req.body.prompt;

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
