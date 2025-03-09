const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static("uploads"));

// Sikrer, at users.json findes
const USERS_FILE = "users.json";
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, "[]", "utf8");
}
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function extractText(filePath) {
  if (filePath.endsWith(".pdf")) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } else if (filePath.endsWith(".docx")) {
    const dataBuffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer: dataBuffer });
    return result.value;
  }
  return "";
}


// Registreringsrute
app.post("/register", [
  body("email").isEmail(),
  body("password").isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;
  const users = JSON.parse(fs.readFileSync(USERS_FILE));

  if (users.find(user => user.email === email)) {
    return res.status(400).json({ message: "Brugeren findes allerede" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ email, password: hashedPassword });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

  res.json({ message: "Bruger registreret!" });
});

// Login-rute
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const users = JSON.parse(fs.readFileSync(USERS_FILE));

  const user = users.find(user => user.email === email);
  if (!user) {
    return res.status(400).json({ message: "Forkert email eller password" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: "Forkert email eller password" });
  }

  const token = jwt.sign({ email: user.email }, "hemmelig_nøgle", { expiresIn: "1h" });
  res.json({ token });
});

// AI spørgsmålshåndtering
app.post("/ask", (req, res) => {
  const { question } = req.body;
  res.json({ answer: `Backend modtog: ${question}` });
});

const multer = require("multer");

// Konfigurer multer til at gemme filer i uploads-mappen
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage: storage });

app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Ingen fil blev uploadet." });
    }
  
    // Læs eksisterende filer fra JSON
    let files = [];
    if (fs.existsSync("files.json")) {
      files = JSON.parse(fs.readFileSync("files.json"));
    }
  
    // Opret metadata for den nye fil
    const newFile = {
      filename: req.file.filename,
      originalname: req.file.originalname,
      uploadDate: new Date().toISOString()
    };
  
    // Tilføj til listen og gem
    files.push(newFile);
    fs.writeFileSync("files.json", JSON.stringify(files, null, 2));
  
    res.json({ message: "Fil uploadet!", file: newFile });
  });
  app.get("/files", (req, res) => {
    if (!fs.existsSync("files.json")) {
      return res.json([]);
    }
    const files = JSON.parse(fs.readFileSync("files.json"));
    res.json(files);
  });
    
  app.post("/ask-ai", async (req, res) => {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ message: "Ingen spørgsmål modtaget." });
    }
  
    // Læs alle filer
    const files = JSON.parse(fs.readFileSync("files.json"));
    if (files.length === 0) {
      return res.status(400).json({ message: "Ingen dokumenter tilgængelige." });
    }
  
    let combinedText = "";
    for (const file of files) {
      const filePath = `uploads/${file.filename}`;
      try {
        const text = await extractText(filePath);
        combinedText += text + "\n\n";
      } catch (error) {
        console.error("Fejl ved læsning af fil:", file.filename, error);
      }
    }
  
    if (!combinedText.trim()) {
      return res.status(400).json({ message: "Ingen tekst kunne udtrækkes fra dokumenterne." });
    }
  
    // Send data til OpenAI
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "Svar kun på spørgsmål ud fra den tilgængelige tekst. Hvis spørgsmålet er uden for tekstens indhold, sig 'Jeg ved det ikke'." },
          { role: "user", content: `Dokumenttekst:\n${combinedText}\n\nSpørgsmål: ${question}` }
        ]
      });
  
      res.json({ answer: response.choices[0].message.content });
    } catch (error) {
      console.error("OpenAI fejl:", error);
      res.status(500).json({ message: "Fejl ved kontakt til AI." });
    }
  });
  

// Hjemmeside-test
app.get("/", (req, res) => {
  res.send("Backend kører!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server kører på port ${PORT}`));
