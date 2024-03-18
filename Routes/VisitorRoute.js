import express from "express";
import con from "../utils/db.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import OpenAI from "openai";
import ElevenLabs from "elevenlabs-node";
import { exec } from "child_process";
import { promises as fs } from "fs";

const router = express.Router();

router.post("/visitor_login", (req, res) => {
  const sql = "SELECT * from visitor Where username = ? and password = ?";
  con.query(sql, [req.body.username, req.body.password], (err, result) => {
    if (err) return res.json({ loginStatus: false, Error: "Query error" });
    if (result.length > 0) {
      const username = result[0].username;
      const token = jwt.sign(
        { role: "visitor", username: username, visitorID: result[0].visitorID },
        "jwt_secret_key",
        { expiresIn: "1d" }
      );
      res.cookie("token", token);
      return res.json({ loginStatus: true, visitorID: result[0].visitorID });
    } else {
      return res.json({
        loginStatus: false,
        Error: "wrong username or password",
      });
    }
  });
});

router.get("/detail/:visitorID", (req, res) => {
  const visitorID = req.params.visitorID;
  const sql = "SELECT * FROM visitor WHERE visitorID = ?";
  con.query(sql, [visitorID], (err, result) => {
    if (err) return res.json({ Status: false });
    return res.json({ Status: true, Result: result });
  });
});

router.get("/nb", (req, res) => {
  const sql = "SELECT * FROM notablebatangaueños";
  con.query(sql, (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, Result: result });
  });
});

router.get("/nb/:nbID", (req, res) => {
  const nbID = req.params.nbID;
  const sql = "SELECT * FROM notablebatangaueños WHERE nbID = ?";
  con.query(sql, [nbID], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, Result: result });
  });
});

router.get("/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ Status: true });
});

dotenv.config();

// Pre-Trained Model
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Text-To-Speech
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
const voiceID = process.env.ELEVENLABS_VOICE_ID;

const voice = new ElevenLabs({
  apiKey: elevenLabsApiKey, // Your API key from Elevenlabs
  voiceId: voiceID, // A Voice ID from Elevenlabs
});

router.post("/chat_nb", async (req, res) => {
  const { prompt } = req.body;
  try {
    // Analyse message and get response
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125",
      messages: prompt,
      temperature: 1,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    // Transcribe the text response to audio
    const fileName = "Public/Audios/message_audio.mp3";
    const message = completion.choices[0].message.content;
    const textInput = message; // The text you wish to convert to speech
    await voice.textToSpeech({
      voiceId: voiceID,
      fileName: fileName,
      textInput: textInput,
    });

    // generate lipsync
    await lipSyncMessage();

    const audio = await audioFileToBase64(fileName);
    const lipsync = await readJsonTranscript(
      `Public/Audios/message_audio.json`
    );

    const response = { message: message, audio: audio, lipsync: lipsync };
    res.send(response);
  } catch (err) {
    res.status(500).send(err);
  }
});

// For NB speaking pattern
const lipSyncMessage = async () => {
  await execCommand(
    "ffmpeg -y -i Public\\Audios\\message_audio.mp3 Public\\Audios\\message_audio.wav"
    // -y to overwrite the file
  );
  await execCommand(
    ".\\bin\\rhubarb.exe -f json -o Public\\Audios\\message_audio.json Public\\Audios\\message_audio.wav -r phonetic"
  );
  // -r phonetic is faster but less accurate
};

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(file);
  return data.toString("base64");
};

export { router as visitorRouter };
