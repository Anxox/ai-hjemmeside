const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();

exports.askAi = functions.https.onRequest((req, res) => {
    console.log("askAi function called!"); // Tilføj denne linje
  cors(req, res, async () => {
    res.json({ answer: "Dette er din rigtige AI-funktion!" });
  });
});

